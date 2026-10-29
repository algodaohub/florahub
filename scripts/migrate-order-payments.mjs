#!/usr/bin/env node
/**
 * Thêm trường thanh toán vào collection `orders` (idempotent).
 *
 *   payment_method: qr | cod   — phương thức áp dụng cho đơn
 *   payment_status: pending | cod | paid | refunded
 *
 * Cách dùng:
 *   node scripts/migrate-order-payments.mjs
 *   node scripts/migrate-order-payments.mjs --check
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
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.message || `${response.status} ${response.statusText}`)
  }
  return data
}

const FIELDS = [
  {
    system: false,
    id: 'payment_method',
    name: 'payment_method',
    type: 'text',
    required: false,
    presentable: false,
    unique: false,
    options: { min: null, max: null, pattern: '' }
  },
  {
    system: false,
    id: 'payment_status',
    name: 'payment_status',
    type: 'text',
    required: false,
    presentable: false,
    unique: false,
    options: { min: null, max: null, pattern: '' }
  }
]

token = (
  await jsonFetch('/api/admins/auth-with-password', {
    method: 'POST',
    body: { identity: adminEmail, password: adminPassword }
  })
).token

const collection = await jsonFetch('/api/collections/orders')
const existing = new Set((collection.schema ?? []).map((field) => field.name))
const missing = FIELDS.filter((field) => !existing.has(field.name))

if (!missing.length) {
  console.log('✔ orders đã có đủ trường thanh toán')
  process.exit(0)
}

if (checkOnly) {
  console.log(`… orders thiếu ${missing.map((field) => field.name).join(', ')} (--check, không ghi)`)
  process.exit(0)
}

await jsonFetch(`/api/collections/${collection.id}`, {
  method: 'PATCH',
  body: { schema: [...(collection.schema ?? []), ...missing] }
})

console.log(`✔ Đã thêm ${missing.map((field) => field.name).join(', ')} vào orders`)
