#!/usr/bin/env node
/**
 * Sinh luật ghi ngược địa chỉ: phường/xã mới (2 cấp, sau 01/07/2025) → địa chỉ cũ 3 cấp.
 *
 * Nguồn:
 *   - server/assets/vn-locations.json          danh mục mới (34 tỉnh / 3.321 phường)
 *   - server/assets/goship-locations.json      danh mục 3 cấp mà Goship đang nhận
 *   - provinces.open-api.vn/api/v1/?depth=2    tên quận/huyện cũ (2020–2025)
 *   - provinces.open-api.vn/api/v2/w/{code}/to-legacies/  phường mới → phường cũ
 *
 * Kết quả: server/assets/ward-downgrade-rules.json (ghi atomic).
 * Override thủ công: scripts/lib/ward-downgrade-overrides.json.
 *
 * Cách dùng:
 *   node scripts/sync-ward-downgrade-rules.mjs            # sinh dữ liệu
 *   node scripts/sync-ward-downgrade-rules.mjs --check    # chỉ kiểm tra file đã sinh
 *   node scripts/sync-ward-downgrade-rules.mjs --province 79   # chạy thử 1 tỉnh (không ghi file)
 *   node scripts/sync-ward-downgrade-rules.mjs --no-cache      # bỏ qua cache tải mạng
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const newDatasetPath = join(root, 'server', 'assets', 'vn-locations.json')
const goshipDatasetPath = join(root, 'server', 'assets', 'goship-locations.json')
const outputPath = join(root, 'server', 'assets', 'ward-downgrade-rules.json')
const overridesPath = join(root, 'scripts', 'lib', 'ward-downgrade-overrides.json')
const cacheDir = join(root, 'scripts', '.cache')

const LEGACY_API = 'https://provinces.open-api.vn/api'
const API_V2 = `${LEGACY_API}/v2`

const checkOnly = process.argv.includes('--check')
const noCache = process.argv.includes('--no-cache')
const provinceIndex = process.argv.indexOf('--province')
const provinceFilter = provinceIndex >= 0 ? String(process.argv[provinceIndex + 1] || '') : ''

const CONCURRENCY = 4
const REQUEST_DELAY_MS = 80

/** Tỉnh cũ đã đổi tên cấp tỉnh nhưng cùng địa bàn Goship: mã tỉnh cũ → mã thành phố Goship. */
const PROVINCE_ALIASES = new Map([
  // Thành phố Huế (từ 01/2025, trước là tỉnh Thừa Thiên Huế)
  [46, '530000']
])

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Bỏ dấu + tiền tố hành chính, giống utils/locations.ts bên Nuxt.
function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\b(thanh pho dao|huyen dao|thi xa dao|thanh pho|tinh|tp|tp\.|phuong|thi tran|thi xa|dac khu|quan|huyen|xa)\b/g, ' ')
    .replace(/[.,\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function readJson(path, label) {
  if (!existsSync(path)) {
    console.error(`✖ Chưa có ${label}: ${path}`)
    process.exit(1)
  }
  return JSON.parse(readFileSync(path, 'utf8'))
}

async function fetchJson(url, { cacheKey } = {}) {
  const cacheFile = cacheKey ? join(cacheDir, cacheKey) : ''
  if (cacheFile && !noCache && existsSync(cacheFile)) {
    return JSON.parse(readFileSync(cacheFile, 'utf8'))
  }

  let lastError = null
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(20000)
      })
      if (response.status === 429 || response.status >= 500) {
        const wait = Math.min(5000, Number(response.headers.get('retry-after') || 0) * 1000 || attempt * 800)
        throw Object.assign(new Error(`HTTP ${response.status}`), { wait })
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      if (cacheFile && !noCache) {
        mkdirSync(dirname(cacheFile), { recursive: true })
        writeFileSync(cacheFile, JSON.stringify(data))
      }
      return data
    } catch (error) {
      lastError = error
      if (attempt < 4) await sleep(error.wait || attempt * 600)
    }
  }
  throw new Error(`${url} — ${lastError?.message || 'lỗi không xác định'}`)
}

async function runPool(items, limit, worker) {
  let index = 0
  const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, async () => {
    while (index < items.length) {
      const item = items[index]
      index += 1
      await worker(item)
      if (REQUEST_DELAY_MS) await sleep(REQUEST_DELAY_MS)
    }
  })
  await Promise.all(workers)
}

function compactName(value) {
  return normalize(value).replace(/[^a-z0-9]/g, '')
}

/** So khớp theo dạng thu gọn để bắt biến thể chính tả: Sapa/sa pa, Krông A Na/Krông Ana, H' Drai/H'drai. */
function findByName(map, name) {
  if (!map) return []
  const direct = map.get(normalize(name))
  if (direct) return direct
  const target = compactName(name)
  if (!target) return []
  const matches = []
  for (const [key, items] of map) {
    if (compactName(key) === target) matches.push(...items)
  }
  return matches
}

function pickUnique(map, name) {
  const items = findByName(map, name)
  return items.length === 1 ? items[0] : null
}

function districtKind(name) {
  const text = String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
  if (/\b(thanh pho|tp\.?|thi xa)\b/.test(text)) return 'city'
  if (/\b(quan|huyen)\b/.test(text)) return 'rural'
  return ''
}

function tokens(name) {
  return new Set(normalize(name).split(' ').filter(Boolean))
}

function nameOverlap(left, right) {
  const a = tokens(left)
  const b = tokens(right)
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const token of a) if (b.has(token)) shared += 1
  return (shared * 2) / (a.size + b.size)
}

function resolveCity(indexes, legacyProvince) {
  const alias = PROVINCE_ALIASES.get(Number(legacyProvince?.code))
  if (alias) {
    const city = indexes.cityByCode.get(String(alias))
    if (city) return city
  }
  return indexes.cityByNorm.get(normalize(legacyProvince?.name)) ?? null
}

/** Tên quận cũ có thể trùng 2 đơn vị Goship (vd Hoa Lư huyện/thành phố) — ưu tiên đúng loại rồi mới theo phường cũ. */
function resolveDistrict(indexes, city, legacyDistrictName, legacyWardName) {
  const bucket = indexes.districtByCity.get(city.code)
  let candidates = findByName(bucket, legacyDistrictName)
  if (candidates.length <= 1) return candidates[0] ?? null

  const kind = districtKind(legacyDistrictName)
  if (kind) {
    const sameKind = candidates.filter((district) => districtKind(district.name) === kind)
    if (sameKind.length === 1) return sameKind[0]
    if (sameKind.length > 1) candidates = sameKind
  }

  const withWard = candidates.filter((district) =>
    pickUnique(indexes.wardsByDistrict.get(district.code), legacyWardName)
  )
  return withWard.length === 1 ? withWard[0] : null
}

/** Không khớp tên (xã sáp nhập sau 2023) thì lấy phường gần tên nhất cùng quận — quận mới là khoá tính phí. */
function resolveWard(indexes, district, legacyWardName) {
  const bucket = indexes.wardsByDistrict.get(district.code)
  const exact = pickUnique(bucket, legacyWardName)
  if (exact) return { ward: exact, fallback: false }

  const items = bucket ? [...bucket.values()].flat() : []
  if (!items.length) return { ward: null, fallback: false }

  const best = items
    .map((ward) => ({ ward, score: nameOverlap(ward.name, legacyWardName) }))
    .sort((left, right) => right.score - left.score || Number(left.ward.code) - Number(right.ward.code))[0]
  return { ward: best.ward, fallback: true }
}

function buildGoshipIndexes(goship) {
  const cityByCode = new Map()
  const cityByNorm = new Map()
  const districtByCity = new Map()
  const wardsByDistrict = new Map()

  for (const city of goship.cities ?? []) {
    cityByCode.set(String(city.code), city)
    const key = normalize(city.name)
    if (!cityByNorm.has(key)) cityByNorm.set(key, city)
  }
  for (const district of goship.districts ?? []) {
    if (!districtByCity.has(district.parentCode)) districtByCity.set(district.parentCode, new Map())
    const bucket = districtByCity.get(district.parentCode)
    const key = normalize(district.name)
    if (!bucket.has(key)) bucket.set(key, [])
    bucket.get(key).push(district)
  }
  for (const ward of goship.wards ?? []) {
    if (!wardsByDistrict.has(ward.parentCode)) wardsByDistrict.set(ward.parentCode, new Map())
    const bucket = wardsByDistrict.get(ward.parentCode)
    const key = normalize(ward.name)
    if (!bucket.has(key)) bucket.set(key, [])
    bucket.get(key).push(ward)
  }

  return { cityByCode, cityByNorm, districtByCity, wardsByDistrict }
}

function buildLegacyIndexes(legacyProvinces) {
  const provinceByCode = new Map()
  const districtByCode = new Map()
  for (const province of legacyProvinces) {
    provinceByCode.set(Number(province.code), province)
    for (const district of province.districts ?? []) {
      districtByCode.set(Number(district.code), {
        ...district,
        province_code: province.code,
        province_name: province.name
      })
    }
  }
  return { provinceByCode, districtByCode }
}

function rowKey(row) {
  return `${row.goship_ward_code}`
}

function ruleFromLegacy({ newWard, legacyWard, legacyDistrict, legacyProvinceName, city, district, ward, syncedAt, source, note }) {
  return {
    new_province_code: String(newWard.provinceCode),
    new_province_name: newWard.provinceName,
    new_ward_code: String(newWard.code),
    new_ward_name: newWard.name,
    old_province_code: String(legacyWard.province_code ?? ''),
    old_province_name: legacyProvinceName,
    old_district_code: String(legacyWard.district_code ?? ''),
    old_district_name: legacyDistrict?.name ?? '',
    old_ward_code: String(legacyWard.code ?? ''),
    old_ward_name: legacyWard.name,
    goship_city_code: city.code,
    goship_city_name: city.name,
    goship_district_code: district.code,
    goship_district_name: district.name,
    goship_ward_code: ward.code,
    goship_ward_name: ward.name,
    is_primary: false,
    active: true,
    source,
    note,
    synced_at: syncedAt
  }
}

function ruleFromGoship({ newWard, chain, syncedAt, note }) {
  return {
    new_province_code: String(newWard.provinceCode),
    new_province_name: newWard.provinceName,
    new_ward_code: String(newWard.code),
    new_ward_name: newWard.name,
    old_province_code: '',
    old_province_name: '',
    old_district_code: '',
    old_district_name: '',
    old_ward_code: '',
    old_ward_name: '',
    goship_city_code: chain.city.code,
    goship_city_name: chain.city.name,
    goship_district_code: chain.district.code,
    goship_district_name: chain.district.name,
    goship_ward_code: chain.ward.code,
    goship_ward_name: chain.ward.name,
    is_primary: false,
    active: true,
    source: 'manual',
    note,
    synced_at: syncedAt
  }
}

function findGoshipChain(code, indexes, goship) {
  const ward = (goship.wards ?? []).find((item) => String(item.code) === String(code))
  if (!ward) return null
  const district = (goship.districts ?? []).find((item) => String(item.code) === String(ward.parentCode))
  if (!district) return null
  const city = (goship.cities ?? []).find((item) => String(item.code) === String(district.parentCode))
  if (!city) return null
  return { city, district, ward }
}

function choosePrimary(rows, newWardName) {
  const target = normalize(newWardName)
  const named = rows.filter((row) => normalize(row.old_ward_name) === target)
  const pool = named.length ? named : rows

  const byDistrict = new Map()
  for (const row of pool) {
    if (!byDistrict.has(row.goship_district_code)) byDistrict.set(row.goship_district_code, [])
    byDistrict.get(row.goship_district_code).push(row)
  }
  const groups = [...byDistrict.values()].sort((left, right) => {
    if (right.length !== left.length) return right.length - left.length
    const minLeft = Math.min(...left.map((row) => Number(row.old_ward_code) || Infinity))
    const minRight = Math.min(...right.map((row) => Number(row.old_ward_code) || Infinity))
    return minLeft - minRight
  })
  const chosen = groups[0]
    .slice()
    .sort((left, right) => (Number(left.old_ward_code) || Infinity) - (Number(right.old_ward_code) || Infinity))[0]
  for (const row of rows) row.is_primary = row === chosen
}

function applyOverrides(rows, override, { newWard, indexes, goship, syncedAt }) {
  if (!override) return rows
  if (Array.isArray(override)) {
    return override
      .map((code) => {
        const chain = findGoshipChain(code, indexes, goship)
        return chain ? ruleFromGoship({ newWard, chain, syncedAt, note: 'override thủ công' }) : null
      })
      .filter(Boolean)
  }

  let next = rows
  if (Array.isArray(override.remove)) {
    const remove = new Set(override.remove.map(String))
    next = next.filter((row) => !remove.has(String(row.goship_ward_code)))
  }
  if (Array.isArray(override.add)) {
    const existing = new Set(next.map((row) => String(row.goship_ward_code)))
    for (const code of override.add) {
      if (existing.has(String(code))) continue
      const chain = findGoshipChain(code, indexes, goship)
      if (chain) next.push(ruleFromGoship({ newWard, chain, syncedAt, note: 'override thủ công' }))
    }
  }
  if (Array.isArray(override.targets)) {
    next = override.targets
      .map((code) => {
        const chain = findGoshipChain(code, indexes, goship)
        return chain ? ruleFromGoship({ newWard, chain, syncedAt, note: 'override thủ công' }) : null
      })
      .filter(Boolean)
  }
  return next
}

function validate(rules, newWards, overrides, goship) {
  const errors = []
  const cityByCode = new Map((goship.cities ?? []).map((city) => [String(city.code), city]))
  const districtByCode = new Map((goship.districts ?? []).map((district) => [String(district.code), district]))
  const wardByCode = new Map((goship.wards ?? []).map((ward) => [String(ward.code), ward]))
  const seen = new Set()
  const byNewWard = new Map()

  for (const rule of rules) {
    const key = `${rule.new_ward_code}|${rule.goship_ward_code}`
    if (seen.has(key)) errors.push(`Trùng luật ${key}`)
    seen.add(key)

    const city = cityByCode.get(String(rule.goship_city_code))
    const district = districtByCode.get(String(rule.goship_district_code))
    const ward = wardByCode.get(String(rule.goship_ward_code))
    if (!city) errors.push(`${rule.new_ward_code}: thiếu thành phố Goship ${rule.goship_city_code}`)
    if (!district) errors.push(`${rule.new_ward_code}: thiếu quận Goship ${rule.goship_district_code}`)
    if (!ward) errors.push(`${rule.new_ward_code}: thiếu phường Goship ${rule.goship_ward_code}`)
    if (district && ward && String(ward.parentCode) !== String(district.code)) {
      errors.push(`${rule.new_ward_code}: phường ${ward.code} không thuộc quận ${district.code}`)
    }
    if (district && city && String(district.parentCode) !== String(city.code)) {
      errors.push(`${rule.new_ward_code}: quận ${district.code} không thuộc thành phố ${city.code}`)
    }
    if (!String(rule.new_province_code || '').trim() || !String(rule.new_ward_code || '').trim()) {
      errors.push('Luật thiếu mã tỉnh/phường mới')
    }

    if (!byNewWard.has(rule.new_ward_code)) byNewWard.set(rule.new_ward_code, [])
    byNewWard.get(rule.new_ward_code).push(rule)
  }

  for (const ward of newWards) {
    if (overrides[String(ward.code)]?.skip) continue
    const rows = byNewWard.get(String(ward.code)) ?? []
    if (!rows.length) {
      errors.push(`Phường ${ward.code} (${ward.name}) chưa có luật ghi ngược`)
      continue
    }
    const primary = rows.filter((row) => row.is_primary)
    if (primary.length !== 1) {
      errors.push(`Phường ${ward.code} (${ward.name}) có ${primary.length} luật chính, cần đúng 1`)
    }
  }

  return errors
}

function atomicWrite(path, content) {
  const tmp = `${path}.tmp`
  writeFileSync(tmp, content)
  renameSync(tmp, path)
}

function listUnmatched(unmatched) {
  for (const item of unmatched.slice(0, 30)) {
    const reasons = [...new Set(item.issues.map((issue) => issue.reason))].join(', ')
    console.log(`  - ${item.ward.code} ${item.ward.name}: ${item.issues.length} phường cũ không khớp (${reasons})`)
  }
  if (unmatched.length > 30) console.log(`  … và ${unmatched.length - 30} phường khác`)
}

async function main() {
  const newDataset = readJson(newDatasetPath, 'danh mục địa chỉ mới (chạy `npm run locations:sync`)')
  const goship = readJson(goshipDatasetPath, 'snapshot Goship (chạy `npm run goship:locations`)')
  const overrides = existsSync(overridesPath) ? readJson(overridesPath, 'override') : {}

  const newWards = []
  for (const province of newDataset.provinces ?? []) {
    for (const ward of province.wards ?? []) {
      newWards.push({
        provinceCode: province.code,
        provinceName: province.name,
        code: ward.code,
        name: ward.name
      })
    }
  }
  const targets = provinceFilter
    ? newWards.filter((ward) => String(ward.provinceCode) === provinceFilter)
    : newWards

  const indexes = buildGoshipIndexes(goship)

  if (checkOnly) {
    const output = readJson(outputPath, 'luật đã sinh (chạy `npm run rules:sync`)')
    const errors = validate(output.rules ?? [], newWards, overrides, goship)
    const primaryCount = (output.rules ?? []).filter((rule) => rule.is_primary).length
    console.log(
      `→ ${output.rules?.length ?? 0} luật · ${new Set((output.rules ?? []).map((rule) => rule.new_ward_code)).size}/${newWards.length} phường mới có luật · ${primaryCount} luật chính`
    )
    if (errors.length) {
      console.error(`✖ ${errors.length} lỗi:`)
      for (const message of errors.slice(0, 40)) console.error(`  - ${message}`)
      if (errors.length > 40) console.error(`  … và ${errors.length - 40} lỗi khác`)
      process.exit(1)
    }
    console.log('✔ Luật ghi ngược hợp lệ.')
    return
  }

  const legacyProvinces = await fetchJson(`${LEGACY_API}/v1/?depth=2`, { cacheKey: 'legacy-v1-depth2.json' })
  const { provinceByCode, districtByCode } = buildLegacyIndexes(legacyProvinces)

  const syncedAt = new Date().toISOString()
  const rules = []
  const skipped = []
  const unmatched = []
  const ambiguous = []

  let done = 0
  await runPool(targets, CONCURRENCY, async (newWard) => {
    const override = overrides[String(newWard.code)]
    if (override?.skip) {
      skipped.push(newWard)
      done += 1
      return
    }

    const legacyWards = await fetchJson(`${API_V2}/w/${newWard.code}/to-legacies/`, {
      cacheKey: join('ward-legacy', `${newWard.code}.json`)
    })
    const rows = []
    const issues = []

    for (const legacyWard of Array.isArray(legacyWards) ? legacyWards : []) {
      const legacyProvince = provinceByCode.get(Number(legacyWard.province_code))
      const legacyDistrict = districtByCode.get(Number(legacyWard.district_code))
      const city = resolveCity(indexes, legacyProvince)
      const district = city
        ? resolveDistrict(indexes, city, legacyDistrict?.name, legacyWard.name)
        : null
      const { ward, fallback } = district
        ? resolveWard(indexes, district, legacyWard.name)
        : { ward: null, fallback: false }

      if (!city || !district || !ward) {
        issues.push({
          legacy: legacyWard.name,
          reason: !city ? 'không có tỉnh Goship' : !district ? 'không có quận Goship' : 'không có phường Goship'
        })
        continue
      }

      rows.push(
        ruleFromLegacy({
          newWard,
          legacyWard,
          legacyDistrict,
          legacyProvinceName: legacyProvince?.name ?? '',
          city,
          district,
          ward,
          syncedAt,
          source: 'legacy-api',
          note: fallback ? 'Tên phường cũ không có trong Goship — chọn phường gần nhất cùng quận' : ''
        })
      )
    }

    let next = applyOverrides(rows, override, { newWard, indexes, goship, syncedAt })

    const byCode = new Map()
    for (const row of next) {
      if (!byCode.has(rowKey(row))) byCode.set(rowKey(row), row)
    }
    next = [...byCode.values()]

    if (!next.length) {
      if (issues.length) unmatched.push({ ward: newWard, issues })
      else ambiguous.push(newWard)
      done += 1
      return
    }

    choosePrimary(next, newWard.name)
    rules.push(...next)
    done += 1
    if (done % 200 === 0 || done === targets.length) {
      process.stdout.write(`\r  Đã xử lý ${done}/${targets.length} phường mới…`)
    }
  })
  process.stdout.write('\n')

  rules.sort((left, right) => {
    const wardDiff = Number(left.new_ward_code) - Number(right.new_ward_code)
    if (wardDiff) return wardDiff
    return String(left.goship_ward_code).localeCompare(String(right.goship_ward_code))
  })

  const covered = new Set(rules.map((rule) => rule.new_ward_code)).size
  const payload = {
    source: 'provinces.open-api.vn',
    apiBase: LEGACY_API,
    updatedAt: syncedAt,
    counts: {
      newWards: targets.length,
      rows: rules.length,
      covered,
      skipped: skipped.length,
      unmatched: unmatched.length + ambiguous.length
    },
    rules
  }

  if (provinceFilter) {
    console.log(`→ Chạy thử tỉnh ${provinceFilter}: ${rules.length} luật / ${targets.length} phường (không ghi file)`)
    console.log(JSON.stringify(rules.slice(0, 5), null, 2))
    return
  }

  atomicWrite(outputPath, `${JSON.stringify(payload)}\n`)
  console.log(
    `✔ Đã ghi ${outputPath}: ${rules.length} luật · ${covered}/${targets.length} phường mới · bỏ qua ${skipped.length} · chưa khớp ${unmatched.length + ambiguous.length}`
  )

  if (unmatched.length) {
    console.warn(`\n⚠ ${unmatched.length} phường mới không tìm được địa chỉ cũ — bổ sung scripts/lib/ward-downgrade-overrides.json:`)
    listUnmatched(unmatched)
  }
  if (ambiguous.length) {
    console.warn(`\n⚠ ${ambiguous.length} phường mới không có dữ liệu legacy (to-legacies rỗng):`)
    for (const ward of ambiguous.slice(0, 20)) console.warn(`  - ${ward.code} ${ward.name}`)
  }

  const errors = validate(rules, newWards, overrides, goship)
  if (errors.length) {
    console.error(`\n✖ ${errors.length} lỗi dữ liệu:`)
    for (const message of errors.slice(0, 40)) console.error(`  - ${message}`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(`✖ Sinh luật thất bại: ${error.message}`)
  process.exitCode = 1
})
