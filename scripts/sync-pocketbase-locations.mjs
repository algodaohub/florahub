#!/usr/bin/env node
/**
 * Đồng bộ dữ liệu hành chính Việt Nam (2 cấp) vào PocketBase.
 *
 * Nguồn dữ liệu: server/assets/vn-locations.json (chạy `npm run locations:sync` để cập nhật).
 * Collections: provinces, wards, location_meta.
 *
 * Cách dùng:
 *   node scripts/sync-pocketbase-locations.mjs          # tạo collection + upsert toàn bộ
 *   node scripts/sync-pocketbase-locations.mjs --check  # chỉ so sánh, không ghi
 *   node scripts/sync-pocketbase-locations.mjs --reset  # xoá dữ liệu cũ rồi import lại từ đầu
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  locationMetaCollection,
  provincesCollection,
  wardsCollection
} from './lib/location-collections.mjs'

const root = process.cwd()
const url = (process.env.POCKETBASE_URL || 'http://127.0.0.1:8091').replace(/\/$/, '')
const adminEmail = process.env.PB_ADMIN_EMAIL || 'admin@florahub.local'
const adminPassword = process.env.PB_ADMIN_PASSWORD || 'FloraHubAdmin123'
const datasetPath = join(root, 'server', 'assets', 'vn-locations.json')
const checkOnly = process.argv.includes('--check')
const reset = process.argv.includes('--reset')
const CONCURRENCY = 16

if (!existsSync(datasetPath)) {
  console.error('✖ Chưa có server/assets/vn-locations.json — chạy `npm run locations:sync` trước.')
  process.exit(1)
}

const dataset = JSON.parse(readFileSync(datasetPath, 'utf8'))
const provinces = dataset.provinces ?? []
const totalWards = provinces.reduce((sum, province) => sum + province.wards.length, 0)

if (!provinces.length) {
  console.error('✖ Dataset rỗng, không có gì để đồng bộ.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// PocketBase HTTP
// ---------------------------------------------------------------------------

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
    const error = new Error(data?.message || `${response.status} ${response.statusText}`)
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

async function authenticate() {
  token = (
    await jsonFetch('/api/admins/auth-with-password', {
      method: 'POST',
      body: { identity: adminEmail, password: adminPassword }
    })
  ).token
}

async function listAll(collection) {
  const items = []
  let page = 1
  let totalPages = 1

  do {
    const data = await jsonFetch(`/api/collections/${collection}/records?page=${page}&perPage=500`)
    items.push(...data.items)
    totalPages = data.totalPages
    page += 1
  } while (page <= totalPages)

  return items
}

const createRecord = (collection, body) =>
  jsonFetch(`/api/collections/${collection}/records`, { method: 'POST', body })

const patchRecord = (collection, id, body) =>
  jsonFetch(`/api/collections/${collection}/records/${id}`, { method: 'PATCH', body })

const deleteRecord = (collection, id) =>
  jsonFetch(`/api/collections/${collection}/records/${id}`, { method: 'DELETE' })

async function runPool(tasks, limit = CONCURRENCY) {
  let index = 0
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (index < tasks.length) {
      const current = index
      index += 1
      await tasks[current]()
    }
  })
  await Promise.all(workers)
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

async function ensureCollections() {
  const existing = await jsonFetch('/api/collections?perPage=200')
  const byName = new Map(existing.items.map((item) => [item.name, item]))

  const ensure = async (definition) => {
    const current = byName.get(definition.name)
    if (!current) {
      if (checkOnly) {
        console.log(`… Thiếu collection ${definition.name} (bỏ qua vì --check)`)
        return null
      }
      const created = await jsonFetch('/api/collections', { method: 'POST', body: definition })
      byName.set(definition.name, created)
      console.log(`→ Đã tạo collection ${definition.name}`)
      return created
    }

    const currentFields = new Set((current.schema ?? []).map((field) => field.name))
    const missing = definition.schema.filter((field) => !currentFields.has(field.name))
    const rulesPatch = {}
    for (const rule of ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']) {
      if ((current[rule] ?? null) !== definition[rule]) rulesPatch[rule] = definition[rule]
    }

    if ((missing.length || Object.keys(rulesPatch).length) && !checkOnly) {
      const updated = await jsonFetch(`/api/collections/${current.id}`, {
        method: 'PATCH',
        body: {
          schema: [...(current.schema ?? []), ...missing],
          ...(Object.keys(rulesPatch).length ? rulesPatch : {})
        }
      })
      byName.set(definition.name, updated)
      console.log(`→ Đã cập nhật collection ${definition.name}`)
      return updated
    }

    if (missing.length) console.log(`… ${definition.name}: thiếu ${missing.length} trường (bỏ qua vì --check)`)

    return current
  }

  const provinceCollection = await ensure(provincesCollection)
  if (!provinceCollection) return null
  const wardCollection = await ensure(wardsCollection(provinceCollection.id))
  const metaCollection = await ensure(locationMetaCollection)

  return {
    provinces: provinceCollection,
    wards: wardCollection,
    meta: metaCollection
  }
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

function buildPatch(current, desired) {
  const patch = {}
  for (const [key, value] of Object.entries(desired)) {
    const before = current[key]
    const changed =
      typeof value === 'number'
        ? Number(before ?? 0) !== value
        : String(before ?? '') !== String(value ?? '')
    if (changed) patch[key] = value
  }
  return patch
}

async function upsert(collection, desired, { label, concurrency = CONCURRENCY, removeStale = true } = {}) {
  const existing = await listAll(collection)
  const byCode = new Map(existing.map((record) => [Number(record.code), record]))
  const desiredCodes = new Set(desired.map((item) => item.code))

  const stats = { created: 0, updated: 0, unchanged: 0, removed: 0, errors: [] }
  const tasks = []

  for (const item of desired) {
    const current = byCode.get(item.code)
    if (!current) {
      tasks.push(async () => {
        try {
          await createRecord(collection, item)
          stats.created += 1
        } catch (error) {
          stats.errors.push(`${label} ${item.code}: ${error.message}`)
        }
      })
      continue
    }

    const patch = buildPatch(current, item)
    if (!Object.keys(patch).length) {
      stats.unchanged += 1
      continue
    }

    tasks.push(async () => {
      try {
        await patchRecord(collection, current.id, patch)
        stats.updated += 1
      } catch (error) {
        stats.errors.push(`${label} ${item.code}: ${error.message}`)
      }
    })
  }

  if (tasks.length) {
    let done = 0
    const total = tasks.length
    const wrapped = tasks.map((task) => async () => {
      await task()
      done += 1
      if (done % 500 === 0 || done === total) {
        process.stdout.write(`\r  ${label}: ${done}/${total}`)
      }
    })
    await runPool(wrapped, concurrency)
    process.stdout.write('\n')
  }

  if (!checkOnly && removeStale) {
    for (const record of existing) {
      if (desiredCodes.has(Number(record.code))) continue
      await deleteRecord(collection, record.id)
      stats.removed += 1
    }
  }

  return stats
}

function logStats(label, stats) {
  console.log(
    `  ${label}: tạo ${stats.created} · cập nhật ${stats.updated} · giữ nguyên ${stats.unchanged} · xoá ${stats.removed}`
  )
  if (stats.errors.length) {
    console.error(`  ✖ ${stats.errors.length} lỗi khi ghi ${label}:`)
    for (const message of stats.errors.slice(0, 10)) console.error(`    - ${message}`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log(`→ Dữ liệu nguồn: ${provinces.length} tỉnh/thành · ${totalWards} phường/xã`)
console.log(`→ PocketBase: ${url}${checkOnly ? ' (chế độ --check)' : ''}${reset && !checkOnly ? ' (import lại từ đầu)' : ''}`)

try {
  await authenticate()
  const collections = await ensureCollections()
  if (!collections) {
    process.exit(1)
  }

  if (reset && !checkOnly) {
    for (const collection of ['wards', 'provinces', 'location_meta']) {
      const records = await listAll(collection)
      await runPool(
        records.map((record) => () => deleteRecord(collection, record.id)),
        CONCURRENCY
      )
      console.log(`→ Đã xoá ${records.length} bản ghi cũ trong ${collection}`)
    }
  }

  const provinceRecords = await listAll('provinces')
  const provinceIdByCode = new Map(provinceRecords.map((record) => [Number(record.code), record.id]))

  const provinceStats = await upsert(
    'provinces',
    provinces.map((province, index) => ({
      code: province.code,
      name: province.name,
      codename: province.codename || '',
      type: province.type,
      phone_code: Number(province.phoneCode ?? 0),
      ward_count: province.wards.length,
      sort_order: index
    })),
    { label: 'tỉnh/thành', concurrency: 6, removeStale: false }
  )
  logStats('tỉnh/thành', provinceStats)

  const refreshedProvinces = await listAll('provinces')
  provinceIdByCode.clear()
  for (const record of refreshedProvinces) provinceIdByCode.set(Number(record.code), record.id)

  const missingProvinces = provinces.filter((province) => !provinceIdByCode.has(province.code))
  if (missingProvinces.length) {
    throw new Error(`Thiếu bản ghi tỉnh/thành: ${missingProvinces.map((p) => p.name).join(', ')}`)
  }

  const wardItems = provinces.flatMap((province) =>
    province.wards.map((ward, index) => ({
      province: provinceIdByCode.get(province.code),
      province_code: province.code,
      code: ward.code,
      name: ward.name,
      codename: ward.codename || '',
      type: ward.type,
      sort_order: index
    }))
  )

  const wardStats = await upsert('wards', wardItems, { label: 'phường/xã' })
  logStats('phường/xã', wardStats)

  if (!checkOnly) {
    // Xoá tỉnh/thành không còn trong chuẩn mới (sau khi đã dọn wards liên quan).
    const provinceCodes = new Set(provinces.map((province) => province.code))
    let removedProvinces = 0
    for (const record of await listAll('provinces')) {
      if (provinceCodes.has(Number(record.code))) continue
      await deleteRecord('provinces', record.id)
      removedProvinces += 1
    }
    if (removedProvinces) console.log(`  Đã xoá ${removedProvinces} tỉnh/thành không còn trong dữ liệu mới`)

    const meta = {
      key: 'vn',
      source: dataset.sourceLabel || dataset.source || '',
      standard: dataset.standard || '',
      updated_at: dataset.updatedAt || '',
      province_count: provinces.length,
      ward_count: totalWards
    }
    const metaRecords = await jsonFetch(
      `/api/collections/location_meta/records?perPage=1&filter=${encodeURIComponent('key="vn"')}`
    )
    const current = metaRecords.items[0]
    if (!current) {
      await createRecord('location_meta', meta)
      console.log('→ Đã tạo bản ghi location_meta')
    } else {
      const patch = buildPatch(current, meta)
      if (Object.keys(patch).length) {
        await patchRecord('location_meta', current.id, patch)
        console.log('→ Đã cập nhật location_meta')
      }
    }
  }

  const errors = provinceStats.errors.length + wardStats.errors.length
  console.log(
    `\n✔ Đồng bộ xong: ${provinces.length} tỉnh/thành · ${totalWards} phường/xã${checkOnly ? ' (không ghi)' : ''}`
  )
  if (errors) process.exitCode = 1
} catch (error) {
  console.error(`\n✖ Đồng bộ thất bại: ${error.message}`)
  if (error.status === 401) {
    console.error('  Kiểm tra PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD và đảm bảo PocketBase đang chạy.')
  } else if (error.cause?.code === 'ECONNREFUSED' || /fetch failed/i.test(error.message)) {
    console.error('  PocketBase chưa chạy? Khởi động bằng `npm run pb:serve` rồi thử lại.')
  }
  process.exitCode = 1
}
