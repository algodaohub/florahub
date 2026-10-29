import type { VietnamProvince, VietnamWard } from '~/types'
import { isSameLocationName, normalizeLocationName } from '~/utils/locations'

type ProvincesPayload = {
  source: string
  standard: string
  updatedAt: string
  counts: { provinces: number; wards: number }
  provinces: VietnamProvince[]
}

type WardsPayload = {
  province: { code: number; name: string; type: string }
  wards: VietnamWard[]
}

// Dữ liệu hành chính là bất biến trong một phiên chạy nên cache ở cấp module.
const wardCache = new Map<number, VietnamWard[]>()
const wardRequests = new Map<number, Promise<VietnamWard[]>>()
let provinceRequest: Promise<VietnamProvince[]> | null = null

export function useVietnamLocations() {
  const provinces = useState<VietnamProvince[]>('vn-locations-provinces', () => [])
  const updatedAt = useState<string>('vn-locations-updated-at', () => '')
  const pending = useState<boolean>('vn-locations-pending', () => false)
  const pendingWards = useState<number | null>('vn-locations-pending-wards', () => null)

  async function ensureProvinces(force = false) {
    if (!force && provinces.value.length) return provinces.value
    if (provinceRequest) return provinceRequest

    pending.value = true
    provinceRequest = $fetch<ProvincesPayload>('/api/locations/provinces')
      .then((payload) => {
        provinces.value = payload.provinces
        updatedAt.value = payload.updatedAt
        return provinces.value
      })
      .finally(() => {
        pending.value = false
        provinceRequest = null
      })

    return provinceRequest
  }

  async function loadWards(provinceCode: number | string | null | undefined) {
    const code = Number.parseInt(String(provinceCode ?? ''), 10)
    if (!Number.isFinite(code)) return []

    const cached = wardCache.get(code)
    if (cached) return cached

    const inflight = wardRequests.get(code)
    if (inflight) return inflight

    pendingWards.value = code
    const request = $fetch<WardsPayload>('/api/locations/wards', { query: { province: code } })
      .then((payload) => {
        wardCache.set(code, payload.wards)
        return payload.wards
      })
      .finally(() => {
        wardRequests.delete(code)
        if (pendingWards.value === code) pendingWards.value = null
      })

    wardRequests.set(code, request)
    return request
  }

  function findProvinceByName(name: string) {
    if (!name) return null
    const target = normalizeLocationName(name)
    if (!target) return null
    return provinces.value.find((province) => normalizeLocationName(province.name) === target) ?? null
  }

  function findWardByName(wards: VietnamWard[], name: string) {
    if (!name) return null
    return wards.find((ward) => isSameLocationName(ward.name, name)) ?? null
  }

  return {
    provinces,
    updatedAt,
    pending,
    pendingWards,
    ensureProvinces,
    loadWards,
    findProvinceByName,
    findWardByName
  }
}
