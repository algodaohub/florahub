#!/usr/bin/env node
/**
 * Nhập credentials thanh toán đang nằm trong .env vào collection `payment_settings`.
 *
 * Sau khi chạy, server đọc key từ PocketBase; các dòng secret trong .env có thể comment lại.
 * Script chỉ in giá trị đã mask, không in secret.
 *
 * Cách dùng:
 *   node scripts/migrate-payment-settings.mjs
 *   node scripts/migrate-payment-settings.mjs --check   # chỉ xem sẽ nhập gì
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const url = (process.env.POCKETBASE_URL || 'http://127.0.0.1:8091').replace(/\/$/, '')
const adminEmail = process.env.PB_ADMIN_EMAIL || 'admin@florahub.local'
const adminPassword = process.env.PB_ADMIN_PASSWORD || 'FloraHubAdmin123'
const checkOnly = process.argv.includes('--check')
const COLLECTION = 'payment_settings'
const SCOPE = 'default'

/** .env không tự nạp khi chạy node thuần — đọc thủ công, ưu tiên process.env. */
function loadEnvFile() {
  try {
    const text = readFileSync(resolve(root, '.env'), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
      if (!match || line.trim().startsWith('#')) continue
      const value = match[2].replace(/^(['"])(.*)\1$/, '$2')
      if (process.env[match[1]] === undefined) process.env[match[1]] = value
    }
  } catch {
    // .env không bắt buộc khi đã export biến môi trường.
  }
}

function env(name) {
  return String(process.env[name] ?? '').trim()
}

function mask(value) {
  if (!value) return '(trống)'
  return `••••${value.slice(-4)}`
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
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { message: text }
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${data?.message || response.statusText}`)
  }
  return data
}

loadEnvFile()

const auth = await jsonFetch('/api/admins/auth-with-password', {
  method: 'POST',
  body: { identity: adminEmail, password: adminPassword }
})
token = auth.token

const existing = (
  await jsonFetch(
    `/api/collections/${COLLECTION}/records?perPage=1&filter=${encodeURIComponent(`scope="${SCOPE}"`)}`
  )
).items?.[0]

const incoming = {
  sepay_api_token: env('SEPAY_API_TOKEN'),
  sepay_api_base_url: env('SEPAY_API_BASE_URL'),
  sepay_webhook_api_key: env('SEPAY_WEBHOOK_API_KEY'),
  sepay_webhook_secret: env('SEPAY_WEBHOOK_SECRET'),
  sepay_pg_merchant_id: env('SEPAY_PG_MERCHANT_ID'),
  sepay_pg_secret_key: env('SEPAY_PG_SECRET_KEY'),
  sepay_pg_ipn_secret: env('SEPAY_PG_IPN_SECRET'),
  sepay_pg_env: env('SEPAY_PG_ENV'),
  sepay_pg_public_url: env('SEPAY_PG_PUBLIC_URL')
}

const body = { scope: SCOPE }
const summary = []
for (const [field, value] of Object.entries(incoming)) {
  // Không ghi đè giá trị đã có trong DB bằng chuỗi rỗng.
  if (!value && existing?.[field]) continue
  if (!value) continue
  body[field] = field === 'sepay_pg_env' ? (value === 'production' ? 'production' : 'sandbox') : value
  summary.push(`${field} = ${field.includes('url') || field.endsWith('_id') || field.endsWith('_env') ? value : mask(value)}`)
}

if (summary.length === 0) {
  console.log('… Không có biến SEPAY_* nào mới trong .env. Bản ghi giữ nguyên.')
  process.exit(0)
}

console.log(existing ? '→ Cập nhật bản ghi payment_settings hiện có:' : '→ Tạo bản ghi payment_settings:')
for (const line of summary) console.log(`  · ${line}`)

if (checkOnly) process.exit(0)

if (existing) {
  await jsonFetch(`/api/collections/${COLLECTION}/records/${existing.id}`, { method: 'PATCH', body })
} else {
  await jsonFetch(`/api/collections/${COLLECTION}/records`, { method: 'POST', body })
}

console.log('✔ Đã lưu credentials vào PocketBase.')
console.log('  Tiếp theo: comment các dòng SEPAY_* chứa secret trong .env và cấu hình tại /admin/payments.')
