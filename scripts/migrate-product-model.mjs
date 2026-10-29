#!/usr/bin/env node
/**
 * Mở rộng mô hình sản phẩm cho 3 loại hàng hoá: vật lý / sản phẩm số / dịch vụ.
 *
 * Thêm vào PocketBase (idempotent, chạy lại không ghi đè dữ liệu):
 *   products        type, requires_shipping, weight_grams,
 *                   seo_title, seo_description, seo_keywords, canonical_url,
 *                   aeo_summary, highlights, faq,
 *                   digital_file, digital_download_limit, digital_expiry_days, digital_license,
 *                   service_duration, service_location, service_capacity, service_booking_note
 *   product_images  type, file, poster, is_featured, duration  (media: ảnh + video)
 *   categories      description, parent, seo_title, seo_description, is_active, updated_at
 *
 * Cách dùng:
 *   node scripts/migrate-product-model.mjs
 *   node scripts/migrate-product-model.mjs --check
 */
const url = (process.env.POCKETBASE_URL || 'http://127.0.0.1:8091').replace(/\/$/, '')
const adminEmail = process.env.PB_ADMIN_EMAIL || 'admin@florahub.local'
const adminPassword = process.env.PB_ADMIN_PASSWORD || 'FloraHubAdmin123'
const checkOnly = process.argv.includes('--check')

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
  if (!response.ok) throw new Error(data?.message || `${response.status} ${response.statusText}`)
  return data
}

const textField = (id, name, max = 5000) => ({
  system: false,
  id,
  name,
  type: 'text',
  required: false,
  presentable: false,
  unique: false,
  options: { min: null, max, pattern: '' }
})

const numberField = (id, name, { min = null, max = null } = {}) => ({
  system: false,
  id,
  name,
  type: 'number',
  required: false,
  presentable: false,
  unique: false,
  options: { min, max, noDecimal: false }
})

const boolField = (id, name) => ({
  system: false,
  id,
  name,
  type: 'bool',
  required: false,
  presentable: false,
  unique: false,
  options: {}
})

const selectField = (id, name, values) => ({
  system: false,
  id,
  name,
  type: 'select',
  required: false,
  presentable: false,
  unique: false,
  options: { maxSelect: 1, values }
})

const jsonField = (id, name, maxSize = 20000) => ({
  system: false,
  id,
  name,
  type: 'json',
  required: false,
  presentable: false,
  unique: false,
  options: { maxSize }
})

const fileField = (id, name, { mimeTypes = null, maxSize = 26214400, protected: isProtected = false, thumbs = [] } = {}) => ({
  system: false,
  id,
  name,
  type: 'file',
  required: false,
  presentable: false,
  unique: false,
  options: {
    maxSelect: 1,
    maxSize,
    mimeTypes,
    thumbs,
    protected: isProtected
  }
})

const imageMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif', 'image/avif']
const mediaMimes = [...imageMimes, 'video/mp4', 'video/webm', 'video/quicktime']

const productFields = [
  selectField('pf0000000000001', 'type', ['physical', 'digital', 'service']),
  boolField('pf0000000000002', 'requires_shipping'),
  numberField('pf0000000000003', 'weight_grams', { min: 0, max: 1000000 }),
  textField('pf0000000000004', 'seo_title', 120),
  textField('pf0000000000005', 'seo_description', 320),
  textField('pf0000000000006', 'seo_keywords', 300),
  textField('pf0000000000007', 'canonical_url', 500),
  textField('pf0000000000008', 'aeo_summary', 1200),
  jsonField('pf0000000000009', 'highlights', 10000),
  jsonField('pf0000000000010', 'faq', 20000),
  fileField('pf0000000000011', 'digital_file', {
    mimeTypes: null,
    maxSize: 52428800,
    protected: true
  }),
  numberField('pf0000000000012', 'digital_download_limit', { min: 0, max: 10000 }),
  numberField('pf0000000000013', 'digital_expiry_days', { min: 0, max: 3650 }),
  textField('pf0000000000014', 'digital_license', 5000),
  numberField('pf0000000000015', 'service_duration', { min: 0, max: 100000 }),
  textField('pf0000000000016', 'service_location', 200),
  numberField('pf0000000000017', 'service_capacity', { min: 0, max: 100000 }),
  textField('pf0000000000018', 'service_booking_note', 2000)
]

const mediaFields = [
  selectField('pm0000000000001', 'type', ['image', 'video']),
  fileField('pm0000000000002', 'file', {
    mimeTypes: mediaMimes,
    maxSize: 26214400,
    thumbs: ['240x240']
  }),
  fileField('pm0000000000003', 'poster', {
    mimeTypes: imageMimes,
    maxSize: 5242880
  }),
  boolField('pm0000000000004', 'is_featured'),
  numberField('pm0000000000005', 'duration', { min: 0, max: 86400 })
]

const categoryFields = [
  textField('pc0000000000001', 'description', 2000),
  boolField('pc0000000000003', 'is_active'),
  textField('pc0000000000004', 'seo_title', 120),
  textField('pc0000000000005', 'seo_description', 320),
  fileField('pc0000000000007', 'image', {
    mimeTypes: imageMimes,
    maxSize: 5242880
  }),
  {
    system: false,
    id: 'pc0000000000002',
    name: 'parent',
    type: 'relation',
    required: false,
    presentable: false,
    unique: false,
    options: {
      collectionId: '',
      cascadeDelete: false,
      minSelect: null,
      maxSelect: 1,
      displayFields: null
    }
  },
  {
    system: false,
    id: 'pc0000000000006',
    name: 'updated_at',
    type: 'date',
    required: false,
    presentable: false,
    unique: false,
    options: { min: '', max: '' }
  }
]

const auth = await jsonFetch('/api/admins/auth-with-password', {
  method: 'POST',
  body: { identity: adminEmail, password: adminPassword }
})
token = auth.token

// `product_images.url` là field cũ (URL ngoài); bản ghi upload chỉ có file nên phải bỏ required.
const mediaCollection = await jsonFetch('/api/collections/product_images')
const legacyUrl = (mediaCollection.schema ?? []).find((field) => field.name === 'url')
if (legacyUrl && legacyUrl.required && !checkOnly) {
  await jsonFetch('/api/collections/product_images', {
    method: 'PATCH',
    body: {
      schema: (mediaCollection.schema ?? []).map((field) =>
        field.name === 'url' ? { ...field, required: false } : field
      )
    }
  })
  console.log('✔ product_images.url → không bắt buộc (cho phép media chỉ có file)')
}

const categoryCollection = await jsonFetch('/api/collections/categories')
categoryFields.find((field) => field.name === 'parent').options.collectionId = categoryCollection.id

const plan = [
  { name: 'products', fields: productFields },
  { name: 'product_images', fields: mediaFields },
  { name: 'categories', fields: categoryFields }
]

let added = 0

for (const item of plan) {
  const collection = await jsonFetch(`/api/collections/${item.name}`)
  const existing = new Set((collection.schema ?? []).map((field) => field.name))
  const missing = item.fields.filter((field) => !existing.has(field.name))

  console.log(`${item.name}: ${existing.size} field, thiếu ${missing.length}`)
  if (missing.length === 0) continue

  for (const field of missing) {
    console.log(`  + ${field.name} (${field.type})`)
  }
  if (checkOnly) continue

  await jsonFetch(`/api/collections/${item.name}`, {
    method: 'PATCH',
    body: { schema: [...(collection.schema ?? []), ...missing] }
  })
  added += missing.length
}

// Sản phẩm cũ chưa có `type` đều là hàng vật lý.
if (!checkOnly) {
  const legacyProducts = await jsonFetch(
    '/api/collections/products/records?perPage=500&filter=' + encodeURIComponent('type = ""')
  )
  let typed = 0
  for (const record of legacyProducts.items ?? []) {
    await jsonFetch(`/api/collections/products/records/${record.id}`, {
      method: 'PATCH',
      body: { type: 'physical', requires_shipping: true }
    })
    typed += 1
  }
  if (typed > 0) console.log(`✔ Gán loại "vật lý" cho ${typed} sản phẩm cũ.`)
}

// Media cũ chỉ có `url` ảnh ngoài, chưa có `type`.
if (!checkOnly) {
  const legacyMedia = await jsonFetch(
    '/api/collections/product_images/records?perPage=500&filter=' + encodeURIComponent('type = ""')
  )
  let typed = 0
  for (const record of legacyMedia.items ?? []) {
    await jsonFetch(`/api/collections/product_images/records/${record.id}`, {
      method: 'PATCH',
      body: { type: 'image' }
    })
    typed += 1
  }
  if (typed > 0) console.log(`✔ Gán loại "ảnh" cho ${typed} media cũ.`)
}

// Danh mục cũ (chưa từng sửa) mặc định hiển thị; danh mục đã chỉnh sẽ có updated_at.
if (!checkOnly) {
  const legacy = await jsonFetch('/api/collections/categories/records?perPage=500&filter=' + encodeURIComponent('is_active = false && updated_at = ""'))
  let activated = 0
  for (const record of legacy.items ?? []) {
    await jsonFetch(`/api/collections/categories/records/${record.id}`, {
      method: 'PATCH',
      body: { is_active: true, updated_at: new Date().toISOString() }
    })
    activated += 1
  }
  if (activated > 0) console.log(`✔ Bật hiển thị ${activated} danh mục cũ.`)
}

console.log(
  checkOnly
    ? '… chỉ kiểm tra, không ghi. Bỏ --check để thêm field.'
    : added > 0
      ? `✔ Đã thêm ${added} field.`
      : '✔ Schema đã đầy đủ, không cần thay đổi.'
)
