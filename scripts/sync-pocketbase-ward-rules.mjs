#!/usr/bin/env node
/**
 * Nạp luật ghi ngược địa chỉ vào PocketBase.
 *
 * Nguồn: server/assets/ward-downgrade-rules.json (chạy `npm run rules:sync` để cập nhật).
 * Collection: ward_downgrade_rules (server-only, rule `null`).
 *
 * Cách dùng:
 *   node scripts/sync-pocketbase-ward-rules.mjs          # tạo collection + upsert
 *   node scripts/sync-pocketbase-ward-rules.mjs --check  # chỉ so sánh, không ghi
 *   node scripts/sync-pocketbase-ward-rules.mjs --reset  # xoá dữ liệu cũ rồi import lại
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { wardDowngradeRulesCollection } from './lib/location-collections.mjs'

const root = process.cwd()
const url = (process.env.POCKETBASE_URL || 'http://127.0.0.1:8091').replace(/\/$/, '')
const adminEmail = process.env.PB_ADMIN_EMAIL || 'admin@florahub.local'
const adminPassword = process.env.PB_ADMIN_PASSWORD || 'FloraHubAdmin123'
const datasetPath = join(root, 'server', 'assets', 'ward-downgrade-rules.json')
const checkOnly = process.argv.includes('--check')
const reset = process.argv.includes('--reset')
const CONCURRENCY = 16

if (!existsSync(datasetPath)) {
  console.error('✖ Chưa có server/assets/ward-downgrade-rules.json — chạy `npm run rules:sync` trước.')
  process.exit(1)
}

const dataset = JSON.parse(readFileSync(datasetPath, 'utf8'))
const rules = Array.isArray(dataset.rules) ? dataset.rules : []

if (!rules.length) {
  console.error('✖ Dataset rỗng, không có gì để đồng bộ.')
  process.exit(1)
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

async function loadCollections() {
  const data = await jsonFetch('/api/collections?perPage=200')
  const byName = new Map(data.items.map((item) => [item.name, item]))
  const provinces = byName.get('provinces')
  const wards = byName.get('wards')
  if (!provinces || !wards) {
    throw new Error('Thiếu collection provinces/wards — chạy `npm run pb:locations` trước')
  }
  return { byName, definition: wardDowngradeRulesCollection(provinces.id, wards.id) }
}

async function ensureCollection(definition, byName) {
  const current = byName.get(definition.name)
  if (!current) {
    if (checkOnly) {
      console.log(`… Thiếu collection ${definition.name} (bỏ qua vì --check)`)
      return null
    }
    const created = await jsonFetch('/api/collections', { method: 'POST', body: definition })
    console.log(`→ Đã tạo collection ${definition.name}`)
    return created
  }

  const currentFields = new Set((current.schema ?? []).map((field) => field.name))
  const missing = definition.schema.filter((field) => !currentFields.has(field.name))
  const rulesPatch = {}
  for (const rule of ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']) {
    if ((current[rule] ?? null) !== definition[rule]) {
      rulesPatch[rule] = definition[rule]
    }
  }

  if ((missing.length || Object.keys(rulesPatch).length) && !checkOnly) {
    const updated = await jsonFetch(`/api/collections/${current.id}`, {
      method: 'PATCH',
      body: {
        schema: [...(current.schema ?? []), ...missing],
        ...(Object.keys(rulesPatch).length ? rulesPatch : {})
      }
    })
    console.log(`→ Đã cập nhật collection ${definition.name}`)
    return updated
  }

  if (missing.length) console.log(`… ${definition.name}: thiếu ${missing.length} trường (bỏ qua vì --check)`)
  return current
}

async function loadRelationMaps() {
  const [provinces, wards] = await Promise.all([listAll('provinces'), listAll('wards')])
  return {
    provinceIdByCode: new Map(provinces.map((record) => [String(record.code), record.id])),
    wardIdByCode: new Map(wards.map((record) => [String(record.code), record.id]))
  }
}

function recordKey(record) {
  return `${record.new_ward_code}|${record.goship_ward_code}`
}

function buildPatch(current, desired) {
  const patch = {}
  let changed = false
  for (const [key, value] of Object.entries(desired)) {
    if (key === 'synced_at') continue
    const before = current[key]
    const differs =
      typeof value === 'boolean'
        ? Boolean(before) !== value
        : typeof value === 'number'
          ? Number(before ?? 0) !== value
          : String(before ?? '') !== String(value ?? '')
    if (differs) {
      patch[key] = value
      changed = true
    }
  }
  if (changed) patch.synced_at = desired.synced_at
  return patch
}

async function upsert(collectionName, maps) {
  const existing = await listAll(collectionName)
  const byKey = new Map(existing.map((record) => [recordKey(record), record]))
  const desiredKeys = new Set(rules.map((rule) => recordKey(rule)))
  const stats = { created: 0, updated: 0, unchanged: 0, removed: 0, skipped: 0, errors: [] }
  const tasks = []

  for (const rule of rules) {
    const new_province = maps.provinceIdByCode.get(String(rule.new_province_code)) ?? ''
    const new_ward = maps.wardIdByCode.get(String(rule.new_ward_code)) ?? ''
    if (!new_province || !new_ward) {
      stats.skipped += 1
      if (stats.skipped <= 10) {
        const missing = !new_province ? `tỉnh ${rule.new_province_code}` : `phường ${rule.new_ward_code}`
        stats.errors.push(`${rule.new_ward_code}/${rule.goship_ward_code}: thiếu ${missing} trong PocketBase`)
      }
      continue
    }

    const desired = { ...rule, new_province, new_ward }
    const current = byKey.get(recordKey(rule))
    if (!current) {
      if (checkOnly) {
        stats.created += 1
        continue
      }
      tasks.push(async () => {
        try {
          await createRecord(collectionName, desired)
          stats.created += 1
        } catch (error) {
          stats.errors.push(`${rule.new_ward_code}/${rule.goship_ward_code}: ${error.message}`)
        }
      })
      continue
    }

    const patch = buildPatch(current, desired)
    if (!Object.keys(patch).length) {
      stats.unchanged += 1
      continue
    }
    if (checkOnly) {
      stats.updated += 1
      continue
    }

    tasks.push(async () => {
      try {
        await patchRecord(collectionName, current.id, patch)
        stats.updated += 1
      } catch (error) {
        stats.errors.push(`${rule.new_ward_code}/${rule.goship_ward_code}: ${error.message}`)
      }
    })
  }

  if (tasks.length) {
    let done = 0
    const total = tasks.length
    await runPool(
      tasks.map((task) => async () => {
        await task()
        done += 1
        if (done % 500 === 0 || done === total) process.stdout.write(`\r  Ghi luật: ${done}/${total}`)
      })
    )
    process.stdout.write('\n')
  }

  if (!checkOnly) {
    for (const record of existing) {
      if (desiredKeys.has(recordKey(record))) continue
      await deleteRecord(collectionName, record.id)
      stats.removed += 1
    }
  }

  return stats
}

console.log(`→ Luật nguồn: ${rules.length} dòng · ${new Set(rules.map((rule) => rule.new_ward_code)).size} phường mới`)
console.log(`→ PocketBase: ${url}${checkOnly ? ' (chế độ --check)' : ''}${reset && !checkOnly ? ' (import lại từ đầu)' : ''}`)

try {
  await authenticate()
  const { byName, definition } = await loadCollections()
  const collection = await ensureCollection(definition, byName)
  if (!collection) process.exit(1)

  if (reset && !checkOnly) {
    const records = await listAll(definition.name)
    await runPool(records.map((record) => () => deleteRecord(definition.name, record.id)))
    console.log(`→ Đã xoá ${records.length} bản ghi cũ`)
  }

  const maps = await loadRelationMaps()
  const stats = await upsert(definition.name, maps)
  const skipped = stats.skipped ? ` · bỏ qua ${stats.skipped} (thiếu tỉnh/phường)` : ''
  console.log(
    `  Luật: tạo ${stats.created} · cập nhật ${stats.updated} · giữ nguyên ${stats.unchanged} · xoá ${stats.removed}${skipped}`
  )
  if (stats.errors.length) {
    console.error(`  ✖ ${stats.errors.length} lỗi khi ghi luật:`)
    for (const message of stats.errors.slice(0, 10)) console.error(`    - ${message}`)
    process.exitCode = 1
  } else {
    console.log(`\n✔ Đồng bộ xong${checkOnly ? ' (không ghi)' : ''}.`)
  }
} catch (error) {
  console.error(`\n✖ Đồng bộ thất bại: ${error.message}`)
  if (error.status === 401) {
    console.error('  Kiểm tra PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD và đảm bảo PocketBase đang chạy.')
  } else if (error.cause?.code === 'ECONNREFUSED' || /fetch failed/i.test(error.message)) {
    console.error('  PocketBase chưa chạy? Khởi động bằng `npm run pb:serve` rồi thử lại.')
  }
  process.exitCode = 1
}
