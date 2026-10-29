#!/usr/bin/env node
/**
 * Đồng bộ dữ liệu đơn vị hành chính Việt Nam theo chuẩn 2 cấp (sau 01/07/2025).
 *
 * Nguồn chính: https://provinces.open-api.vn/api/v2 (34 tỉnh/thành, 3.321 phường/xã)
 * Nguồn dự phòng: mantisvn/Vietnamese-Administrative-Units-Dataset (Nghị quyết 202/2025/QH15)
 *
 * Cách dùng:
 *   node scripts/sync-vn-locations.mjs            # tải mới và ghi file
 *   node scripts/sync-vn-locations.mjs --check    # chỉ kiểm tra dữ liệu đã có
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = join(root, 'server/assets/vn-locations.json')

const PRIMARY_API = 'https://provinces.open-api.vn/api/v2'
const FALLBACK_JSON =
  'https://raw.githubusercontent.com/mantisvn/Vietnamese-Administrative-Units-Dataset/main/Vietnamese-Administrative-Units-Dataset.json'

const EXPECTED_PROVINCES = 34
const EXPECTED_WARDS = 3321

const checkOnly = process.argv.includes('--check')

async function fetchJson(url, attempt = 1) {
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'florahub-location-sync' }
    })
    if (!response.ok) throw new Error(`HTTP ${response.status} cho ${url}`)
    return await response.json()
  } catch (error) {
    if (attempt >= 4) throw error
    await new Promise((resolve) => setTimeout(resolve, attempt * 800))
    return fetchJson(url, attempt + 1)
  }
}

/** Chuyển tên đơn vị hành chính thành "type" ngắn gọn. */
function wardType(name, divisionType) {
  if (divisionType) return divisionType
  if (/^Đặc khu/i.test(name)) return 'đặc khu'
  if (/^Phường/i.test(name)) return 'phường'
  if (/^Xã/i.test(name)) return 'xã'
  if (/^Thị trấn/i.test(name)) return 'thị trấn'
  return 'xã'
}

function provinceType(name, divisionType) {
  if (divisionType) return divisionType
  return /^Thành phố/i.test(name) ? 'thành phố trung ương' : 'tỉnh'
}

function sortByName(a, b) {
  return a.name.localeCompare(b.name, 'vi')
}

function normalizeCode(code) {
  if (typeof code === 'number') return code
  const parsed = Number.parseInt(String(code ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function sortProvinces(provinces) {
  return [...provinces].sort((a, b) => {
    if (a.code === 1) return -1
    if (b.code === 1) return 1
    return a.name.localeCompare(b.name, 'vi')
  })
}

async function loadFromPrimary() {
  // 2 request duy nhất: danh mục tỉnh/thành và toàn bộ phường/xã (3.321 bản ghi).
  const [provinces, wards] = await Promise.all([
    fetchJson(`${PRIMARY_API}/p/`),
    fetchJson(`${PRIMARY_API}/w/`)
  ])
  if (!Array.isArray(provinces) || !Array.isArray(wards)) {
    throw new Error('Phản hồi API không đúng định dạng')
  }

  const provinceCodes = new Set(provinces.map((province) => normalizeCode(province.code)))
  const wardsByProvince = new Map()
  const orphanCodes = new Set()

  for (const ward of wards) {
    const provinceCode = normalizeCode(ward.province_code)
    if (provinceCode === null) continue
    if (!provinceCodes.has(provinceCode)) {
      orphanCodes.add(provinceCode)
      continue
    }
    if (!wardsByProvince.has(provinceCode)) wardsByProvince.set(provinceCode, [])
    wardsByProvince.get(provinceCode).push({
      code: normalizeCode(ward.code),
      name: ward.name,
      type: wardType(ward.name, ward.division_type),
      codename: ward.codename || ''
    })
  }

  if (orphanCodes.size) {
    throw new Error(`Có phường/xã thuộc tỉnh không tồn tại: ${[...orphanCodes].join(', ')}`)
  }

  process.stdout.write(`  Đã tải ${provinces.length} tỉnh/thành · ${wards.length} phường/xã\n`)

  return provinces.map((province) => ({
    code: normalizeCode(province.code),
    name: province.name,
    type: provinceType(province.name, province.division_type),
    codename: province.codename || '',
    phoneCode: Number(province.phone_code ?? 0),
    wards: (wardsByProvince.get(normalizeCode(province.code)) ?? []).sort(sortByName)
  }))
}

async function loadFromFallback() {
  const data = await fetchJson(FALLBACK_JSON)
  const provinces = data.provinces ?? []
  const wards = data.wards ?? data.communes ?? []

  return provinces.map((province) => {
    const code = normalizeCode(province.code)
    return {
      code,
      name: province.name,
      type: provinceType(province.name, province.division_type),
      codename: province.codename || '',
      phoneCode: Number(province.phone_code ?? 0),
      wards: wards
        .filter((ward) => normalizeCode(ward.province_code ?? ward.provinceCode ?? ward.province_id) === code)
        .map((ward) => ({
          code: normalizeCode(ward.code),
          name: ward.name,
          type: wardType(ward.name, ward.division_type),
          codename: ward.codename || ''
        }))
        .sort(sortByName)
    }
  })
}

function validate(provinces) {
  const problems = []
  const wardTotal = provinces.reduce((sum, province) => sum + province.wards.length, 0)

  if (provinces.length !== EXPECTED_PROVINCES) {
    problems.push(`Số tỉnh/thành là ${provinces.length}, mong đợi ${EXPECTED_PROVINCES}`)
  }
  if (wardTotal !== EXPECTED_WARDS) {
    problems.push(`Số phường/xã là ${wardTotal}, mong đợi ${EXPECTED_WARDS}`)
  }

  const codes = new Set()
  const wardCodes = new Set()
  for (const province of provinces) {
    if (province.code === null) problems.push(`Tỉnh không có mã hợp lệ: ${province.name}`)
    if (codes.has(province.code)) problems.push(`Mã tỉnh bị trùng: ${province.code}`)
    codes.add(province.code)
    if (!province.wards.length) problems.push(`Tỉnh không có phường/xã: ${province.name}`)
    for (const ward of province.wards) {
      if (ward.code === null) problems.push(`Phường/xã không có mã hợp lệ: ${ward.name}`)
      if (wardCodes.has(ward.code)) problems.push(`Mã phường/xã bị trùng: ${ward.code} (${ward.name})`)
      wardCodes.add(ward.code)
    }
  }

  return { wardTotal, problems }
}

async function main() {
  if (checkOnly) {
    if (!existsSync(outputPath)) {
      console.error('✖ Chưa có server/assets/vn-locations.json')
      process.exitCode = 1
      return
    }
    const dataset = JSON.parse(readFileSync(outputPath, 'utf8'))
    const { wardTotal, problems } = validate(dataset.provinces ?? [])
    console.log(`Nguồn: ${dataset.source}`)
    console.log(`Cập nhật: ${dataset.updatedAt}`)
    console.log(`Tỉnh/thành: ${dataset.provinces?.length ?? 0} · Phường/xã: ${wardTotal}`)
    if (problems.length) {
      console.error('✖ Dữ liệu không hợp lệ:')
      for (const problem of problems) console.error(`  - ${problem}`)
      process.exitCode = 1
    } else {
      console.log('✔ Dữ liệu hợp lệ')
    }
    return
  }

  let provinces
  let source = PRIMARY_API
  let sourceLabel = 'provinces.open-api.vn (v2, 2 cấp)'

  try {
    console.log('→ Tải dữ liệu từ provinces.open-api.vn ...')
    provinces = await loadFromPrimary()
  } catch (error) {
    console.warn(`! Không tải được nguồn chính (${error.message}), chuyển sang nguồn dự phòng ...`)
    provinces = await loadFromFallback()
    source = FALLBACK_JSON
    sourceLabel = 'mantisvn/Vietnamese-Administrative-Units-Dataset (NQ 202/2025/QH15)'
  }

  provinces = sortProvinces(
    provinces.filter((province) => province.code !== null && province.name).map((province) => ({
      ...province,
      wards: province.wards.filter((ward) => ward.name)
    }))
  )

  const { wardTotal, problems } = validate(provinces)
  if (problems.length) {
    console.error('✖ Dữ liệu không hợp lệ, không ghi file:')
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exitCode = 1
    return
  }

  const dataset = {
    source,
    sourceLabel,
    endpoints:
      source === PRIMARY_API
        ? [`GET ${PRIMARY_API}/p/`, `GET ${PRIMARY_API}/w/`]
        : [source],
    standard: '2 cấp (tỉnh/thành phố → phường/xã), áp dụng từ 01/07/2025',
    updatedAt: new Date().toISOString(),
    counts: { provinces: provinces.length, wards: wardTotal },
    provinces
  }

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(dataset)}\n`, 'utf8')

  const sizeKb = Math.round(Buffer.byteLength(JSON.stringify(dataset)) / 1024)
  console.log(`✔ Đã ghi ${outputPath}`)
  console.log(`  ${provinces.length} tỉnh/thành · ${wardTotal} phường/xã · ~${sizeKb} KB`)
}

main().catch((error) => {
  console.error('✖ Đồng bộ thất bại:', error)
  process.exitCode = 1
})
