import { chmodSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, appendFileSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import {
  locationMetaCollection,
  provincesCollection,
  wardsCollection
} from './lib/location-collections.mjs'

const root = process.cwd()
const binDir = join(root, 'bin')
const bin = join(binDir, 'pocketbase')
const dataDir = join(root, 'pb_data')
const url = process.env.POCKETBASE_URL || 'http://127.0.0.1:8091'
const adminEmail = process.env.PB_ADMIN_EMAIL || 'admin@florahub.local'
const adminPassword = process.env.PB_ADMIN_PASSWORD || 'FloraHubAdmin123'

const demoEmail = 'demo@florahub.vn'
const demoPassword = 'FloraHub1234'

function ensureEnv() {
  const envPath = join(root, '.env')
  const current = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
  const lines = []
  if (!current.includes('POCKETBASE_URL=')) lines.push(`POCKETBASE_URL=${url}`)
  if (!current.includes('PB_ADMIN_EMAIL=')) lines.push(`PB_ADMIN_EMAIL=${adminEmail}`)
  if (!current.includes('PB_ADMIN_PASSWORD=')) lines.push(`PB_ADMIN_PASSWORD=${adminPassword}`)
  // Máy cài đặt mới dùng 9router local; đổi trong /admin/ai nếu khách chọn provider khác.
  if (!current.includes('AI_PROVIDER=')) lines.push('AI_PROVIDER=9router')
  if (!current.includes('AI_BASE_URL=')) lines.push('AI_BASE_URL=http://127.0.0.1:20128/v1')
  if (!current.includes('AI_MODEL=')) lines.push('AI_MODEL=oc/deepseek-v4.1-flash-free')
  if (lines.length) appendFileSync(envPath, `\n${lines.join('\n')}\n`)
}

function ensureBinary() {
  if (existsSync(bin)) return
  const source = process.env.POCKETBASE_BIN || '/Users/saturnlai/Workspaces/Inventory/leatherback/pocketbase/pocketbase'
  if (!existsSync(source)) {
    throw new Error(
      `Không tìm thấy PocketBase binary. Đặt POCKETBASE_BIN trỏ tới binary hoặc copy thủ công vào ${bin}`
    )
  }
  mkdirSync(binDir, { recursive: true })
  copyFileSync(source, bin)
  chmodSync(bin, 0o755)
  console.log(`→ Đã copy PocketBase binary vào ${bin}`)
}

async function isHealthy() {
  try {
    const response = await fetch(`${url}/api/health`)
    return response.ok
  } catch {
    return false
  }
}

async function startServer() {
  if (await isHealthy()) {
    console.log(`→ PocketBase đã chạy tại ${url}`)
    return
  }

  mkdirSync(dataDir, { recursive: true })

  try {
    execFileSync(bin, ['--dir', dataDir, 'admin', 'create', adminEmail, adminPassword], { stdio: 'ignore' })
    console.log(`→ Đã tạo admin ${adminEmail}`)
  } catch {
    console.log('→ Admin đã tồn tại, bỏ qua')
  }

  const log = openSync(join(root, 'pb.log'), 'a')
  const child = spawn(bin, ['serve', `--http=${url.replace(/^https?:\/\//, '')}`, '--dir', dataDir], {
    detached: true,
    stdio: ['ignore', log, log]
  })
  child.unref()

  for (let i = 0; i < 60; i += 1) {
    if (await isHealthy()) {
      console.log(`→ PocketBase đang chạy tại ${url}`)
      return
    }
    await sleep(250)
  }
  throw new Error(`Không khởi động được PocketBase tại ${url}. Xem pb.log`)
}

async function jsonFetch(path, { method = 'GET', token, body } = {}) {
  const headers = {}
  if (token) headers.Authorization = token
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.message || `${response.status} ${response.statusText}`
    const error = new Error(message)
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

async function adminAuth() {
  const data = await jsonFetch('/api/admins/auth-with-password', {
    method: 'POST',
    body: { identity: adminEmail, password: adminPassword }
  })
  return data.token
}

async function ensureCollections(token) {
  const existing = await jsonFetch('/api/collections?perPage=200', { token })
  const byName = new Map(existing.items.map((item) => [item.name, item]))

  const text = (name, required = false) => ({
    name,
    type: 'text',
    required,
    presentable: false,
    unique: false,
    options: { min: null, max: null, pattern: '' }
  })
  const bool = (name) => ({
    name,
    type: 'bool',
    required: false,
    presentable: false,
    unique: false,
    options: {}
  })
  const relation = (name, collectionId, required = true) => ({
    name,
    type: 'relation',
    required,
    presentable: false,
    unique: false,
    options: { collectionId, cascadeDelete: true, minSelect: null, maxSelect: 1, displayFields: null }
  })

  let users = byName.get('users')
  if (!users) {
    users = await jsonFetch('/api/collections', {
      method: 'POST',
      token,
      body: {
        name: 'users',
        type: 'auth',
        schema: [text('first_name'), text('last_name'), text('phone')],
        listRule: 'id = @request.auth.id',
        viewRule: 'id = @request.auth.id',
        createRule: '',
        updateRule: 'id = @request.auth.id',
        deleteRule: null,
        options: {
          allowEmailAuth: true,
          allowOAuth2Auth: false,
          allowUsernameAuth: false,
          exceptEmailDomains: null,
          manageRule: null,
          minPasswordLength: 8,
          onlyEmailDomains: null,
          onlyVerified: false,
          requireEmail: true
        }
      }
    })
    console.log('→ Đã tạo collection users')
  }

  const usersSchema = [...(users.schema ?? [])]
  for (const field of [text('first_name'), text('last_name'), text('phone')]) {
    if (!usersSchema.some((item) => item.name === field.name)) usersSchema.push(field)
  }
  const usersOptions = {
    ...users.options,
    allowEmailAuth: true,
    allowOAuth2Auth: false,
    allowUsernameAuth: false,
    minPasswordLength: 8,
    requireEmail: true
  }
  const rulesChanged = users.createRule !== '' || users.updateRule !== 'id = @request.auth.id' || users.listRule !== 'id = @request.auth.id' || users.viewRule !== 'id = @request.auth.id'
  if (rulesChanged || JSON.stringify(users.schema) !== JSON.stringify(usersSchema) || JSON.stringify(users.options) !== JSON.stringify(usersOptions)) {
    users = await jsonFetch(`/api/collections/${users.id}`, {
      method: 'PATCH',
      token,
      body: {
        schema: usersSchema,
        options: usersOptions,
        listRule: 'id = @request.auth.id',
        viewRule: 'id = @request.auth.id',
        createRule: '',
        updateRule: 'id = @request.auth.id',
        deleteRule: null
      }
    })
    console.log('→ Đã cập nhật schema users (first_name, last_name, phone)')
  }

  const ensure = async (definition) => {
    if (byName.has(definition.name)) return byName.get(definition.name)
    const created = await jsonFetch('/api/collections', { method: 'POST', token, body: definition })
    byName.set(definition.name, created)
    console.log(`→ Đã tạo collection ${definition.name}`)
    return created
  }

  const ownRules = {
    listRule: 'user = @request.auth.id',
    viewRule: 'user = @request.auth.id',
    createRule: '@request.auth.id != "" && user = @request.auth.id',
    updateRule: 'user = @request.auth.id',
    deleteRule: 'user = @request.auth.id'
  }

  await ensure({
    name: 'addresses',
    type: 'base',
    schema: [
      relation('user', users.id),
      text('label'),
      text('recipient', true),
      text('phone', true),
      text('line1', true),
      text('ward'),
      text('district'),
      text('city'),
      bool('is_default')
    ],
    ...ownRules
  })

  await ensure({
    name: 'notifications',
    type: 'base',
    schema: [
      relation('user', users.id),
      text('title', true),
      text('body'),
      bool('read')
    ],
    ...ownRules
  })

  await ensure({
    name: 'wallets',
    type: 'base',
    schema: [
      { ...relation('user', users.id), unique: true },
      { name: 'balance', type: 'number', required: false, presentable: false, unique: false, options: { min: 0, max: null, noDecimal: true } },
      text('bank_name'),
      text('bank_account'),
      text('bank_holder')
    ],
    ...ownRules
  })

  await ensure({
    name: 'wallet_transactions',
    type: 'base',
    schema: [
      relation('user', users.id),
      { name: 'amount', type: 'number', required: true, presentable: false, unique: false, options: { min: null, max: null, noDecimal: true } },
      text('type'),
      text('note')
    ],
    ...ownRules
  })

  const settingsDefinition = {
    name: 'settings',
    type: 'base',
    schema: [
      text('site_name', true),
      text('tagline'),
      text('description'),
      text('logo_url'),
      text('favicon_url'),
      text('primary_color'),
      text('primary_dark_color'),
      text('primary_soft_color'),
      text('accent_color'),
      text('accent_soft_color'),
      text('paper_color'),
      text('paper_deep_color'),
      text('ink_color'),
      text('muted_color'),
      text('hairline_color'),
      text('discount_color'),
      text('hotline'),
      text('email'),
      text('address'),
      text('currency'),
      text('locale'),
      text('shipping_fee'),
      text('free_shipping_threshold'),
      text('affiliate_commission_rate')
    ],
    listRule: '',
    viewRule: '',
    createRule: null,
    updateRule: null,
    deleteRule: null
  }
  const settings = await ensure(settingsDefinition)
  const settingsSchema = [...(settings.schema ?? [])]
  for (const field of settingsDefinition.schema) {
    if (!settingsSchema.some((item) => item.name === field.name)) settingsSchema.push(field)
  }
  if (settingsSchema.length !== (settings.schema ?? []).length) {
    await jsonFetch(`/api/collections/${settings.id}`, {
      method: 'PATCH',
      token,
      body: { schema: settingsSchema }
    })
    console.log('→ Đã bổ sung trường cấu hình website còn thiếu')
  }

  const provinces = await ensure(provincesCollection)
  await ensure(wardsCollection(provinces.id))
  await ensure(locationMetaCollection)

  return { users }
}

const siteDefaults = {
  site_name: 'FloraHub',
  tagline: 'Hoa tươi mỗi ngày',
  description: 'Cửa hàng hoa tươi giao nhanh, giá minh bạch, đặt hoa trực tuyến mỗi ngày.',
  logo_url: '/images/logo.svg',
  favicon_url: '/images/logo.svg',
  primary_color: '#3F6B4F',
  primary_dark_color: '#2E523C',
  primary_soft_color: '#E5EDE6',
  accent_color: '#B9764A',
  accent_soft_color: '#F3E5DA',
  paper_color: '#F7F3EB',
  paper_deep_color: '#EFE8DB',
  ink_color: '#2B2A26',
  muted_color: '#7C766B',
  hairline_color: '#E3DCCE',
  discount_color: '#B4553F',
  hotline: '1900 0000',
  email: 'hello@florahub.vn',
  address: 'TP. Hồ Chí Minh',
  currency: 'VND',
  locale: 'vi-VN',
  shipping_fee: '30000',
  free_shipping_threshold: '500000',
  affiliate_commission_rate: '5'
}

async function ensureSiteSettings(token) {
  const existing = await jsonFetch('/api/collections/settings/records?perPage=1', { token })
  if (existing.totalItems > 0) {
    const record = existing.items[0]
    const patch = {}
    for (const [key, value] of Object.entries(siteDefaults)) {
      if (!record[key]) patch[key] = value
    }
    if (Object.keys(patch).length) {
      await jsonFetch(`/api/collections/settings/records/${record.id}`, { method: 'PATCH', token, body: patch })
      console.log('→ Đã bổ sung cấu hình website còn thiếu')
    } else {
      console.log('→ Cấu hình website đã tồn tại, bỏ qua')
    }
    return
  }

  await jsonFetch('/api/collections/settings/records', {
    method: 'POST',
    token,
    body: siteDefaults
  })
  console.log('→ Đã tạo cấu hình website mặc định')
}

async function ensureDemoData(token, usersCollectionId) {
  const users = await jsonFetch(
    `/api/collections/users/records?filter=${encodeURIComponent(`email = "${demoEmail}"`)}`,
    { token }
  )
  let demo = users.items[0]

  if (!demo) {
    demo = await jsonFetch('/api/collections/users/records', {
      method: 'POST',
      token,
      body: {
        email: demoEmail,
        password: demoPassword,
        passwordConfirm: demoPassword,
        first_name: 'Demo',
        last_name: 'Khách',
        phone: '0901234567',
        verified: true
      }
    })
    console.log(`→ Đã tạo tài khoản demo ${demoEmail}`)
  }

  if (!demo.first_name || !demo.last_name || !demo.phone) {
    demo = await jsonFetch(`/api/collections/users/records/${demo.id}`, {
      method: 'PATCH',
      token,
      body: {
        first_name: demo.first_name || 'Demo',
        last_name: demo.last_name || 'Khách',
        phone: demo.phone || '0901234567',
        verified: true
      }
    })
    console.log('→ Đã bổ sung hồ sơ cho tài khoản demo')
  }

  const addresses = await jsonFetch(
    `/api/collections/addresses/records?filter=${encodeURIComponent(`user = "${demo.id}"`)}`,
    { token }
  )
  if (addresses.totalItems === 0) {
    await jsonFetch('/api/collections/addresses/records', {
      method: 'POST',
      token,
      body: {
        user: demo.id,
        label: 'Văn phòng',
        recipient: 'Demo Khách',
        phone: '0901234567',
        line1: '12 Nguyễn Huệ',
        ward: 'Phường Sài Gòn',
        city: 'Thành phố Hồ Chí Minh',
        is_default: true
      }
    })
    await jsonFetch('/api/collections/addresses/records', {
      method: 'POST',
      token,
      body: {
        user: demo.id,
        label: 'Kho hoa',
        recipient: 'Demo Khách',
        phone: '0901234567',
        line1: '45 Trần Phú',
        ward: 'Phường Nha Trang',
        city: 'Tỉnh Khánh Hòa',
        is_default: false
      }
    })
    console.log('→ Đã tạo địa chỉ mẫu')
  }

  const wallets = await jsonFetch(
    `/api/collections/wallets/records?filter=${encodeURIComponent(`user = "${demo.id}"`)}`,
    { token }
  )
  let wallet = wallets.items[0]
  if (!wallet) {
    wallet = await jsonFetch('/api/collections/wallets/records', {
      method: 'POST',
      token,
      body: {
        user: demo.id,
        balance: 250000,
        bank_name: 'Vietcombank',
        bank_account: '0123456789',
        bank_holder: 'DEMO KHACH'
      }
    })
    await jsonFetch('/api/collections/wallet_transactions/records', {
      method: 'POST',
      token,
      body: { user: demo.id, amount: 250000, type: 'topup', note: 'Nạp tiền demo' }
    })
    console.log('→ Đã tạo ví demo 250.000₫')
  }

  const notifications = await jsonFetch(
    `/api/collections/notifications/records?filter=${encodeURIComponent(`user = "${demo.id}"`)}`,
    { token }
  )
  if (notifications.totalItems === 0) {
    for (const item of [
      { title: 'Chào mừng đến FloraHub', body: 'Tài khoản demo đã sẵn sàng. Bạn có thể đặt hoa và theo dõi đơn tại đây.' },
      { title: 'Ưu đãi theo mùa đang diễn ra', body: 'Giảm đến 13% cho các bó hoa trong khung giờ vàng hôm nay.' },
      { title: 'Cập nhật chính sách giao hàng', body: 'Đơn từ 500.000₫ được miễn phí giao hàng nội thành.' }
    ]) {
      await jsonFetch('/api/collections/notifications/records', {
        method: 'POST',
        token,
        body: { user: demo.id, title: item.title, body: item.body, read: false }
      })
    }
    console.log('→ Đã tạo thông báo mẫu')
  }

  return { demo, usersCollectionId }
}

ensureEnv()
ensureBinary()
await startServer()

const token = await adminAuth()
const { users } = await ensureCollections(token)
await ensureSiteSettings(token)
await ensureDemoData(token, users.id)

console.log('\nPocketBase sẵn sàng:')
console.log(`  URL:   ${url}`)
console.log(`  Admin: ${adminEmail} / ${adminPassword}`)
console.log(`  Demo:  ${demoEmail} / ${demoPassword}`)
