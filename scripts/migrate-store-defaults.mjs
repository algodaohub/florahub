#!/usr/bin/env node
/**
 * Thêm trường `is_default` vào collection `store_configs` và chọn store mặc định.
 *
 * Trước đây store mặc định là bản ghi domain rỗng "mới cập nhật nhất", nên chỉ cần
 * lưu một store khác là storefront đổi theo. Sau migration, store mặc định được
 * đánh dấu tường minh và không thay đổi khi sửa store khác.
 *
 * Cách dùng:
 *   node scripts/migrate-store-defaults.mjs                 # tự chọn store đang được resolve
 *   node scripts/migrate-store-defaults.mjs --default <id>  # chỉ định store mặc định
 *   node scripts/migrate-store-defaults.mjs --check         # chỉ xem, không ghi
 */
const url = (process.env.POCKETBASE_URL || 'http://127.0.0.1:8091').replace(/\/$/, '')
const adminEmail = process.env.PB_ADMIN_EMAIL || 'admin@florahub.local'
const adminPassword = process.env.PB_ADMIN_PASSWORD || 'FloraHubAdmin123'
const checkOnly = process.argv.includes('--check')
const defaultArgIndex = process.argv.indexOf('--default')
const requestedDefault = defaultArgIndex > -1 ? String(process.argv[defaultArgIndex + 1] || '').trim() : ''

const FIELD = {
  system: false,
  id: 'scdefault0000001',
  name: 'is_default',
  type: 'bool',
  required: false,
  presentable: false,
  unique: false,
  options: {}
}

let token = ''

async function jsonFetch(path, { method = 'GET', body } = {}) {
  const headers = {}
  if (token) headers.Authorization = token
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : {}
  if (!response.ok) {
    throw new Error(data?.message || `${response.status} ${response.statusText}`)
  }
  return data
}

function normalizeHost(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/:\d+$/, '')
    .replace(/^www\./, '')
}

const auth = await jsonFetch('/api/admins/auth-with-password', {
  method: 'POST',
  body: { identity: adminEmail, password: adminPassword }
})
token = auth.token

const collection = await jsonFetch('/api/collections/store_configs')
const hasField = (collection.schema ?? []).some((field) => field.name === 'is_default')

const records = (await jsonFetch('/api/collections/store_configs/records?perPage=200&sort=-updated')).items

if (!records.length) {
  console.log('… store_configs chưa có bản ghi nào, không cần chọn mặc định')
  process.exit(0)
}

const active = records.filter((record) => record.active !== false)
const defaults = active.filter((record) => !normalizeHost(record.domain))
const explicitlyMarked = records.find((record) => record.is_default === true)

const target =
  (requestedDefault && records.find((record) => record.id === requestedDefault)) ||
  explicitlyMarked ||
  defaults[0] ||
  active[0]

if (requestedDefault && target?.id !== requestedDefault) {
  console.error(`✖ Không tìm thấy store ${requestedDefault}`)
  process.exit(1)
}

console.log(`→ Store mặc định: ${target.name || target.id} (${target.id}) · domain: ${target.domain || '(mọi host)'}`)

if (checkOnly) {
  console.log(hasField ? '✔ Đã có trường is_default' : '… Thiếu trường is_default')
  process.exit(0)
}

if (!hasField) {
  await jsonFetch(`/api/collections/${collection.id}`, {
    method: 'PATCH',
    body: { schema: [...(collection.schema ?? []), FIELD] }
  })
  console.log('✔ Đã thêm trường is_default vào store_configs')
}

for (const record of records) {
  const shouldBeDefault = record.id === target.id
  if (Boolean(record.is_default) === shouldBeDefault) continue
  await jsonFetch(`/api/collections/store_configs/records/${record.id}`, {
    method: 'PATCH',
    body: { is_default: shouldBeDefault }
  })
  console.log(`  · ${record.name || record.id}: is_default = ${shouldBeDefault}`)
}

console.log('✔ Hoàn tất. Storefront chỉ đổi khi bạn đổi store mặc định hoặc domain.')
