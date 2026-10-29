#!/usr/bin/env node
/**
 * Nhập phí giao hàng phẳng cũ vào chính sách vận chuyển của từng store.
 *
 * Nguồn cũ: `settings.shipping_fee` / `settings.free_shipping_threshold` và
 * `store_configs.config.features.shippingFee` / `freeShippingThreshold`.
 * Đích: `store_configs.config.shipping.fallbackFee` / `freeShippingThreshold`.
 *
 * Chỉ ghi khi khối `shipping` chưa có giá trị tương ứng, nên chạy lại nhiều lần
 * không ghi đè cấu hình admin đã chỉnh sau này.
 *
 * Cách dùng:
 *   node scripts/migrate-shipping-policy.mjs
 *   node scripts/migrate-shipping-policy.mjs --check   # chỉ xem sẽ ghi gì
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const url = (process.env.POCKETBASE_URL || 'http://127.0.0.1:8091').replace(/\/$/, '')
const adminEmail = process.env.PB_ADMIN_EMAIL || 'admin@florahub.local'
const adminPassword = process.env.PB_ADMIN_PASSWORD || 'FloraHubAdmin123'
const checkOnly = process.argv.includes('--check')

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

async function listAll(collection) {
  const items = []
  for (let page = 1; page <= 50; page += 1) {
    const data = await jsonFetch(`/api/collections/${collection}/records?perPage=200&page=${page}`)
    items.push(...(data.items ?? []))
    if (!data.items?.length || page >= (data.totalPages ?? 1)) break
  }
  return items
}

function parseConfig(raw) {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return typeof raw === 'object' ? raw : null
}

function legacyNumber(raw) {
  if (raw === undefined || raw === null || raw === '') return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : undefined
}

function missing(value) {
  return value === undefined || value === null
}

loadEnvFile()

const auth = await jsonFetch('/api/admins/auth-with-password', {
  method: 'POST',
  body: { identity: adminEmail, password: adminPassword }
})
token = auth.token

const settings = (
  await jsonFetch('/api/collections/settings/records?perPage=1&sort=-created')
).items?.[0]
const globalFee = legacyNumber(settings?.shipping_fee)
const globalThreshold = legacyNumber(settings?.free_shipping_threshold)

const stores = await listAll('store_configs')
let changed = 0

for (const store of stores) {
  const config = parseConfig(store.config)
  if (!config) continue

  const features = config.features ?? {}
  const fee = legacyNumber(features.shippingFee) ?? globalFee
  const threshold = legacyNumber(features.freeShippingThreshold) ?? globalThreshold
  const shipping = config.shipping ?? {}

  const patch = {}
  if (missing(shipping.fallbackFee) && fee !== undefined) patch.fallbackFee = fee
  if (missing(shipping.freeShippingThreshold) && threshold !== undefined) {
    patch.freeShippingThreshold = threshold
  }
  if (!Object.keys(patch).length) continue

  const label = store.name || store.domain || store.id
  console.log(`→ ${label} (${store.id})`)
  for (const [key, value] of Object.entries(patch)) {
    console.log(`  · shipping.${key} = ${value}`)
  }
  changed += 1

  if (checkOnly) continue
  await jsonFetch(`/api/collections/store_configs/records/${store.id}`, {
    method: 'PATCH',
    body: { config: { ...config, shipping: { ...shipping, ...patch } } }
  })
}

if (!changed) {
  console.log('… Không có store nào cần migrate. Chính sách vận chuyển giữ nguyên.')
} else if (checkOnly) {
  console.log(`… ${changed} store sẽ được cập nhật (chưa ghi vì --check).`)
} else {
  console.log(`✔ Đã cập nhật ${changed} store.`)
}
