#!/usr/bin/env node
/**
 * Đồng bộ danh mục địa chỉ Goship (tỉnh/thành → quận/huyện → phường/xã) vào JSON snapshot.
 *
 * Token và API base đọc từ PocketBase collection `shipping_settings` (admin) — không qua env.
 * Snapshot dùng làm nguồn chính khi runtime, nên app không phải gọi Goship/PocketBase cho danh mục.
 *
 * Cách dùng:
 *   node scripts/sync-goship-locations.mjs            # tải mới và ghi server/assets/goship-locations.json
 *   node scripts/sync-goship-locations.mjs --check    # chỉ kiểm tra file đã có
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = join(root, 'server/assets/goship-locations.json')
const checkOnly = process.argv.includes('--check')

const REQUEST_GAP_MS = 350
const MAX_RETRY_WAIT_MS = 5000
const REQUEST_TIMEOUT_MS = 20_000
const PROGRESS_EVERY_DISTRICTS = 25

/** .env không tự nạp khi chạy node thuần — đọc thủ công, ưu tiên process.env. */
function loadEnvFile() {
  try {
    const text = readFileSync(join(root, '.env'), 'utf8')
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

loadEnvFile()

const pbUrl = (process.env.POCKETBASE_URL || 'http://127.0.0.1:8091').replace(/\/+$/, '')
const adminEmail = process.env.PB_ADMIN_EMAIL || 'admin@florahub.local'
const adminPassword = process.env.PB_ADMIN_PASSWORD || 'FloraHubAdmin123'

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let lastRequestAt = 0

async function throttle() {
  const gap = REQUEST_GAP_MS - (Date.now() - lastRequestAt)
  if (gap > 0) await wait(gap)
  lastRequestAt = Date.now()
}

async function goshipGet(baseUrl, token, path, attempt = 1) {
  await throttle()
  let response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch (error) {
    if (attempt >= 3) throw new Error(`Không gọi được ${path}: ${error.message}`)
    await wait(attempt * 500)
    return goshipGet(baseUrl, token, path, attempt + 1)
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('Goship từ chối access token — cập nhật lại trong /admin/shipping')
  }
  if (response.status === 429 && attempt <= 2) {
    const retryAfter = Number(response.headers.get('retry-after') ?? 1)
    const delay = Math.min(MAX_RETRY_WAIT_MS, Math.max(1, Number.isFinite(retryAfter) ? retryAfter : 1) * 1000)
    await wait(delay)
    return goshipGet(baseUrl, token, path, attempt + 1)
  }
  if (response.status >= 500 && attempt <= 2) {
    await wait(attempt * 1000)
    return goshipGet(baseUrl, token, path, attempt + 1)
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} cho ${path}`)
  return await response.json()
}

async function pbAdminToken() {
  const response = await fetch(`${pbUrl}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: adminEmail, password: adminPassword })
  })
  if (!response.ok) {
    throw new Error(`Đăng nhập PocketBase thất bại (${response.status}) — kiểm tra PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD`)
  }
  return (await response.json()).token
}

async function readGoshipSettings(pbToken) {
  const filter = encodeURIComponent('scope = "default"')
  const response = await fetch(`${pbUrl}/api/collections/shipping_settings/records?perPage=1&filter=${filter}`, {
    headers: { Authorization: pbToken }
  })
  if (!response.ok) throw new Error(`Đọc shipping_settings thất bại (${response.status})`)
  const record = (await response.json()).items?.[0]
  const token = String(record?.goship_access_token ?? '').trim()
  const baseUrl = String(record?.goship_api_base_url ?? '').trim() || 'https://api.goship.io/api/v2'
  if (!token) {
    throw new Error('Chưa có goship_access_token trong shipping_settings — cấu hình trong /admin/shipping')
  }
  return { token, baseUrl: baseUrl.replace(/\/+$/, '') }
}

function rowsOf(data, key) {
  const candidates = [data?.[key], data?.data, data]
  return candidates.find((value) => Array.isArray(value)) ?? []
}

function normalize(item, parentCode) {
  const code = String(item?.id ?? item?.code ?? '').trim()
  const name = String(item?.name ?? '').trim()
  if (!code || !name) return null
  return parentCode ? { code, name, parentCode } : { code, name }
}

function dedupe(items) {
  const map = new Map()
  for (const item of items) if (item && !map.has(item.code)) map.set(item.code, item)
  return [...map.values()]
}

function sortByName(items) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'vi'))
}

function formatDuration(ms) {
  const seconds = Math.round(ms / 1000)
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s` : `${seconds}s`
}

function checkSnapshot() {
  if (!existsSync(outputPath)) {
    console.error('✖ Chưa có server/assets/goship-locations.json — chạy npm run goship:locations')
    process.exitCode = 1
    return
  }

  let data
  try {
    data = JSON.parse(readFileSync(outputPath, 'utf8'))
  } catch (error) {
    console.error(`✖ File JSON không đọc được: ${error.message}`)
    process.exitCode = 1
    return
  }

  const problems = []
  const counts = data.counts ?? {}
  const levels = [
    ['cities', data.cities],
    ['districts', data.districts],
    ['wards', data.wards]
  ]
  for (const [key, list] of levels) {
    if (!Array.isArray(list) || list.length === 0) {
      problems.push(`Danh mục ${key} trống`)
      continue
    }
    if (counts[key] !== list.length) problems.push(`counts.${key}=${counts[key]} nhưng có ${list.length} bản ghi`)
    const codes = new Set()
    for (const item of list) {
      if (!item?.code || !item?.name) problems.push(`${key}: bản ghi thiếu code/name`)
      if (item?.code && codes.has(item.code)) problems.push(`${key}: mã trùng ${item.code}`)
      if (item?.code) codes.add(item.code)
    }
  }

  const cityCodes = new Set((data.cities ?? []).map((city) => city.code))
  const districtCodes = new Set((data.districts ?? []).map((district) => district.code))
  for (const district of data.districts ?? []) {
    if (!cityCodes.has(district.parentCode)) problems.push(`Quận ${district.code} có parentCode lạ ${district.parentCode}`)
  }
  for (const ward of data.wards ?? []) {
    if (!districtCodes.has(ward.parentCode)) problems.push(`Phường ${ward.code} có parentCode lạ ${ward.parentCode}`)
  }

  console.log(`Nguồn: ${data.source} (${data.apiBaseUrl})`)
  console.log(`Cập nhật: ${data.updatedAt}`)
  console.log(
    `Tỉnh/thành: ${data.cities?.length ?? 0} · Quận/huyện: ${data.districts?.length ?? 0} · Phường/xã: ${data.wards?.length ?? 0}`
  )
  if (problems.length) {
    console.error('✖ Dữ liệu không hợp lệ:')
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exitCode = 1
  } else {
    console.log('✔ Dữ liệu hợp lệ')
  }
}

async function main() {
  if (checkOnly) {
    checkSnapshot()
    return
  }

  const startedAt = Date.now()
  const pbToken = await pbAdminToken()
  const { token, baseUrl } = await readGoshipSettings(pbToken)

  console.log(`→ Đồng bộ danh mục Goship từ ${baseUrl} ...`)

  const cities = sortByName(
    dedupe(rowsOf(await goshipGet(baseUrl, token, '/cities'), 'cities').map((item) => normalize(item)).filter(Boolean))
  )
  if (cities.length === 0) throw new Error('Goship không trả về tỉnh/thành nào')
  console.log(`  ${cities.length} tỉnh/thành`)

  const districts = []
  const wards = []
  let districtCount = 0

  for (const [cityIndex, city] of cities.entries()) {
    const cityDistricts = sortByName(
      dedupe(
        rowsOf(await goshipGet(baseUrl, token, `/cities/${encodeURIComponent(city.code)}/districts`), 'districts')
          .map((item) => normalize(item, city.code))
          .filter(Boolean)
      )
    )
    if (cityDistricts.length === 0) throw new Error(`Tỉnh ${city.name} (${city.code}) không có quận/huyện`)
    districts.push(...cityDistricts)

    for (const district of cityDistricts) {
      const districtWards = sortByName(
        dedupe(
          rowsOf(await goshipGet(baseUrl, token, `/districts/${encodeURIComponent(district.code)}/wards`), 'wards')
            .map((item) => normalize(item, district.code))
            .filter(Boolean)
        )
      )
      if (districtWards.length === 0) {
        console.warn(`  ! ${district.name} (${district.code}) không có phường/xã`)
      }
      wards.push(...districtWards)
      districtCount += 1
      if (districtCount % PROGRESS_EVERY_DISTRICTS === 0) {
        process.stdout.write(
          `  … ${districtCount} quận/huyện · ${wards.length} phường/xã · ${formatDuration(Date.now() - startedAt)}\n`
        )
      }
    }

    process.stdout.write(`  [${cityIndex + 1}/${cities.length}] ${city.name}: ${cityDistricts.length} quận/huyện\n`)
  }

  if (new Set(districts.map((district) => district.code)).size !== districts.length) {
    throw new Error('Có quận/huyện trùng mã giữa nhiều tỉnh — dừng để kiểm tra dữ liệu Goship')
  }
  if (new Set(wards.map((ward) => ward.code)).size !== wards.length) {
    throw new Error('Có phường/xã trùng mã giữa nhiều quận — dừng để kiểm tra dữ liệu Goship')
  }

  const snapshot = {
    source: 'goship',
    apiBaseUrl: baseUrl,
    updatedAt: new Date().toISOString(),
    counts: { cities: cities.length, districts: districts.length, wards: wards.length },
    cities,
    districts,
    wards
  }

  mkdirSync(dirname(outputPath), { recursive: true })
  const tmpPath = `${outputPath}.tmp`
  writeFileSync(tmpPath, `${JSON.stringify(snapshot)}\n`, 'utf8')
  renameSync(tmpPath, outputPath)

  const sizeKb = Math.round(Buffer.byteLength(JSON.stringify(snapshot)) / 1024)
  console.log(`✔ Đã ghi ${outputPath}`)
  console.log(
    `  ${cities.length} tỉnh/thành · ${districts.length} quận/huyện · ${wards.length} phường/xã · ~${sizeKb} KB · ${formatDuration(Date.now() - startedAt)}`
  )
}

main().catch((error) => {
  console.error('✖ Đồng bộ thất bại:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
