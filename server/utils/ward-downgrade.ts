import type { ShippingAddressResolution, ShippingDistrictOption } from '~/types/shipping'
import { pbListAll, pbQuote } from './pocketbase'

const CACHE_TTL_MS = 5 * 60 * 1000

export type WardDowngradeRule = {
  new_province_code: string
  new_province_name: string
  new_ward_code: string
  new_ward_name: string
  old_province_code: string
  old_province_name: string
  old_district_code: string
  old_district_name: string
  old_ward_code: string
  old_ward_name: string
  goship_city_code: string
  goship_city_name: string
  goship_district_code: string
  goship_district_name: string
  goship_ward_code: string
  goship_ward_name: string
  is_primary: boolean
  active: boolean
  source: string
  note: string
}

type CacheEntry = { items: WardDowngradeRule[]; expiresAt: number }

const ruleCache = new Map<string, CacheEntry>()

function text(row: Record<string, unknown>, key: string) {
  return String(row[key] ?? '').trim()
}

function normalizeRule(row: Record<string, unknown>): WardDowngradeRule {
  return {
    new_province_code: text(row, 'new_province_code'),
    new_province_name: text(row, 'new_province_name'),
    new_ward_code: text(row, 'new_ward_code'),
    new_ward_name: text(row, 'new_ward_name'),
    old_province_code: text(row, 'old_province_code'),
    old_province_name: text(row, 'old_province_name'),
    old_district_code: text(row, 'old_district_code'),
    old_district_name: text(row, 'old_district_name'),
    old_ward_code: text(row, 'old_ward_code'),
    old_ward_name: text(row, 'old_ward_name'),
    goship_city_code: text(row, 'goship_city_code'),
    goship_city_name: text(row, 'goship_city_name'),
    goship_district_code: text(row, 'goship_district_code'),
    goship_district_name: text(row, 'goship_district_name'),
    goship_ward_code: text(row, 'goship_ward_code'),
    goship_ward_name: text(row, 'goship_ward_name'),
    is_primary: Boolean(row.is_primary),
    active: Boolean(row.active),
    source: text(row, 'source'),
    note: text(row, 'note')
  }
}

/** Luật ghi ngược cho một phường mới; `null` khi PocketBase lỗi (caller trả `unresolved`, không ném). */
export async function rulesForWard(wardCode: string | null | undefined): Promise<WardDowngradeRule[] | null> {
  const key = String(wardCode ?? '').trim()
  if (!key) return null

  const hit = ruleCache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.items

  try {
    const rows = await pbListAll<Record<string, unknown>>('ward_downgrade_rules', {
      filter: `active = true && new_ward_code = ${pbQuote(key)}`
    })
    const items = rows
      .map(normalizeRule)
      .filter((rule) => rule.goship_city_code && rule.goship_district_code && rule.goship_ward_code)
    ruleCache.set(key, { items, expiresAt: Date.now() + CACHE_TTL_MS })
    return items
  } catch (error) {
    console.warn(
      '[ward-downgrade] không đọc được luật ghi ngược:',
      error instanceof Error ? error.message : error
    )
    return null
  }
}

export type WardDowngradeInput = {
  wardCode?: string
  provinceCode?: string
  districtCode?: string
}

function toResolution(rule: WardDowngradeRule): ShippingAddressResolution {
  return {
    resolution: 'resolved',
    city: rule.goship_city_name,
    cityCode: rule.goship_city_code,
    district: rule.goship_district_name,
    districtCode: rule.goship_district_code,
    ward: rule.goship_ward_name,
    wardCode: rule.goship_ward_code,
    districtOptions: []
  }
}

function toDistrictOptions(rules: WardDowngradeRule[]): ShippingDistrictOption[] {
  const options: ShippingDistrictOption[] = []
  const seen = new Set<string>()
  for (const rule of rules) {
    if (seen.has(rule.goship_district_code)) continue
    seen.add(rule.goship_district_code)
    options.push({
      code: rule.goship_district_code,
      name: rule.goship_district_name,
      wardCode: rule.goship_ward_code
    })
  }
  return options
}

/**
 * Hạ cấp phường/xã mới (2 cấp) về địa chỉ 3 cấp mà Goship nhận.
 * - `null`: không có luật → caller trả `unresolved`.
 * - `resolved`: đúng 1 đích, hoặc có `is_primary`, hoặc `districtCode` lọc còn 1 quận.
 * - `ambiguous`: nhiều quận, chưa có luật chính → trả `districtOptions` cho khách chọn.
 */
export async function resolveWardDowngrade(
  input: WardDowngradeInput
): Promise<ShippingAddressResolution | null> {
  const rules = await rulesForWard(input.wardCode)
  if (!rules || !rules.length) return null

  const provinceCode = String(input.provinceCode ?? '').trim()
  const inProvince = provinceCode ? rules.filter((rule) => rule.new_province_code === provinceCode) : []
  let candidates = inProvince.length ? inProvince : rules

  const districtCode = String(input.districtCode ?? '').trim()
  if (districtCode) {
    const narrowed = candidates.filter((rule) => rule.goship_district_code === districtCode)
    if (narrowed.length) candidates = narrowed
  }

  const primary = candidates.find((rule) => rule.is_primary)
  if (primary) return toResolution(primary)

  const districtCodes = new Set(candidates.map((rule) => rule.goship_district_code))
  if (districtCodes.size === 1) return toResolution(candidates[0]!)

  const first = candidates[0]!
  return {
    resolution: 'ambiguous',
    city: first.goship_city_name,
    cityCode: first.goship_city_code,
    district: '',
    districtCode: '',
    ward: first.goship_ward_name,
    wardCode: first.goship_ward_code,
    districtOptions: toDistrictOptions(candidates)
  }
}
