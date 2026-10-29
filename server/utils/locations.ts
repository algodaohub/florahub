import dataset from '../assets/vn-locations.json'
import { pbFetch } from './pocketbase'

export type VnWard = {
  code: number
  name: string
  type: string
  codename: string
}

export type VnProvince = {
  code: number
  name: string
  type: string
  codename: string
  phoneCode: number
  wardCount: number
}

export type LocationMeta = {
  source: string
  standard: string
  updatedAt: string
  counts: { provinces: number; wards: number }
  resolvedBy: 'pocketbase' | 'bundled'
}

type VnLocationDataset = {
  source: string
  sourceLabel?: string
  standard: string
  updatedAt: string
  counts: { provinces: number; wards: number }
  provinces: Array<{
    code: number
    name: string
    type: string
    codename?: string
    phoneCode?: number
    wards: VnWard[]
  }>
}

type PbList<T> = {
  page: number
  perPage: number
  totalItems: number
  totalPages: number
  items: T[]
}

type PbProvinceRecord = {
  code: number
  name: string
  codename?: string
  type?: string
  phone_code?: number
  ward_count?: number
}

type PbWardRecord = {
  code: number
  name: string
  codename?: string
  type?: string
}

type PbMetaRecord = {
  source?: string
  standard?: string
  updated_at?: string
}

const data = dataset as VnLocationDataset

/**
 * Dữ liệu đóng gói sẵn trong bundle, dùng khi PocketBase chưa sẵn sàng
 * (chưa chạy `npm run pb:locations`) hoặc tạm thời không kết nối được.
 */
const bundledProvinces: VnProvince[] = data.provinces.map((province) => ({
  code: province.code,
  name: province.name,
  type: province.type,
  codename: province.codename || '',
  phoneCode: Number(province.phoneCode ?? 0),
  wardCount: province.wards.length
}))

const bundledWardIndex = new Map<number, VnWard[]>(
  data.provinces.map((province) => [province.code, province.wards])
)

const bundledMeta: LocationMeta = {
  source: data.sourceLabel || data.source,
  standard: data.standard,
  updatedAt: data.updatedAt,
  counts: data.counts,
  resolvedBy: 'bundled'
}

const CACHE_TTL = 5 * 60 * 1000
const FALLBACK_TTL = 30 * 1000

type CacheEntry<T> = { at: number; ttl: number; value: T }
type ProvinceBundle = { provinces: VnProvince[]; meta: LocationMeta }

let bundleCache: CacheEntry<ProvinceBundle> | null = null
const wardCache = new Map<number, CacheEntry<VnWard[]>>()

function isFresh<T>(entry: CacheEntry<T> | null | undefined) {
  return Boolean(entry && entry.at + entry.ttl > Date.now())
}

async function fetchAll<T>(path: string): Promise<T[]> {
  const items: T[] = []
  let page = 1
  let totalPages = 1

  do {
    const separator = path.includes('?') ? '&' : '?'
    const response = await pbFetch<PbList<T>>(`${path}${separator}page=${page}&perPage=500`)
    items.push(...response.items)
    totalPages = response.totalPages
    page += 1
  } while (page <= totalPages)

  return items
}

async function loadBundleFromPocketBase(): Promise<ProvinceBundle> {
  const [rows, metaResponse] = await Promise.all([
    fetchAll<PbProvinceRecord>('/api/collections/provinces/records?sort=sort_order'),
    pbFetch<PbList<PbMetaRecord>>(
      `/api/collections/location_meta/records?perPage=1&filter=${encodeURIComponent('key="vn"')}`
    ).catch(() => null)
  ])

  if (!rows.length) {
    throw new Error('PocketBase chưa có dữ liệu tỉnh/thành')
  }

  const provinces: VnProvince[] = rows.map((row) => ({
    code: Number(row.code),
    name: row.name,
    type: row.type || '',
    codename: row.codename || '',
    phoneCode: Number(row.phone_code ?? 0),
    wardCount: Number(row.ward_count ?? 0)
  }))

  const meta = metaResponse?.items?.[0]

  return {
    provinces,
    meta: {
      source: meta?.source || bundledMeta.source,
      standard: meta?.standard || bundledMeta.standard,
      updatedAt: meta?.updated_at || bundledMeta.updatedAt,
      counts: {
        provinces: provinces.length,
        wards: provinces.reduce((sum, province) => sum + province.wardCount, 0)
      },
      resolvedBy: 'pocketbase'
    }
  }
}

export async function getProvincesBundle(): Promise<ProvinceBundle> {
  if (isFresh(bundleCache)) return bundleCache!.value

  try {
    const bundle = await loadBundleFromPocketBase()
    bundleCache = { at: Date.now(), ttl: CACHE_TTL, value: bundle }
    return bundle
  } catch {
    const fallback = { provinces: bundledProvinces, meta: bundledMeta }
    bundleCache = { at: Date.now(), ttl: FALLBACK_TTL, value: fallback }
    return fallback
  }
}

/** Danh sách 34 tỉnh/thành, kèm số lượng phường/xã (không gửi toàn bộ wards). */
export async function listProvinces() {
  const { provinces } = await getProvincesBundle()
  return provinces
}

export async function findProvince(code: number | string | null | undefined) {
  const parsed = Number.parseInt(String(code ?? ''), 10)
  if (!Number.isFinite(parsed)) return null
  const provinces = await listProvinces()
  return provinces.find((province) => province.code === parsed) ?? null
}

export async function listWards(provinceCode: number | string | null | undefined): Promise<VnWard[]> {
  const province = await findProvince(provinceCode)
  if (!province) return []

  const cached = wardCache.get(province.code)
  if (isFresh(cached)) return cached!.value

  try {
    const rows = await fetchAll<PbWardRecord>(
      `/api/collections/wards/records?filter=${encodeURIComponent(`province_code = ${province.code}`)}&sort=sort_order`
    )
    if (!rows.length) throw new Error('PocketBase chưa có dữ liệu phường/xã')

    const wards = rows.map((row) => ({
      code: Number(row.code),
      name: row.name,
      type: row.type || '',
      codename: row.codename || ''
    }))
    wardCache.set(province.code, { at: Date.now(), ttl: CACHE_TTL, value: wards })
    return wards
  } catch {
    const fallback = bundledWardIndex.get(province.code) ?? []
    wardCache.set(province.code, { at: Date.now(), ttl: FALLBACK_TTL, value: fallback })
    return fallback
  }
}
