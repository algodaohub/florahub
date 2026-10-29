import type { ShippingAddressResolution } from '~/types/shipping'
import { findProvince, listProvinces, listWards } from './locations'
import { catalogCities, catalogDistricts, catalogWards } from './goship-catalog'
import type { GoshipLocation } from './goship'
import type { ShippingSettings } from './shipping-settings'
import { pickupComplete } from './shipping-settings'
import { resolveWardDowngrade } from './ward-downgrade'
import { normalizeLocationName } from '~~/utils/locations'

/** Danh mục Goship chỉ đọc từ snapshot đóng gói — không gọi mạng, không cache DB. */
export function getGoshipCities(): GoshipLocation[] {
  return catalogCities()
}

export function getGoshipDistricts(cityCode: string): GoshipLocation[] {
  return catalogDistricts(String(cityCode)) ?? []
}

export function getGoshipWards(districtCode: string): GoshipLocation[] {
  return catalogWards(String(districtCode)) ?? []
}

export type AddressResolveInput = {
  cityCode?: string
  cityName?: string
  wardCode?: string
  wardName?: string
  districtCode?: string
}

function emptyResolution(): ShippingAddressResolution {
  return {
    resolution: 'unresolved',
    city: '',
    cityCode: '',
    district: '',
    districtCode: '',
    ward: '',
    wardCode: '',
    districtOptions: []
  }
}

async function findProvinceByName(cityName: string) {
  const target = normalizeLocationName(cityName)
  if (!target) return null
  const provinces = await listProvinces().catch(() => [])
  return provinces.find((province) => normalizeLocationName(province.name) === target) ?? null
}

/**
 * Ánh xạ địa chỉ 2 cấp của FloraHub (sau 01/07/2025) sang địa chỉ 3 cấp cũ mà Goship nhận,
 * dùng bảng `ward_downgrade_rules` thay cho so khớp tên toàn bộ danh mục Goship.
 */
export async function resolveCustomerAddress(input: AddressResolveInput): Promise<ShippingAddressResolution> {
  const province =
    (input.cityCode ? await findProvince(input.cityCode).catch(() => null) : null) ??
    (input.cityName ? await findProvinceByName(input.cityName) : null)

  if (!province) return { ...emptyResolution(), city: String(input.cityName ?? '').trim() }

  const wards = await listWards(province.code).catch(() => [])
  const wardCode = String(input.wardCode ?? '').trim()
  const wardName = normalizeLocationName(input.wardName ?? '')
  const ward =
    wards.find((item) => wardCode && String(item.code) === wardCode) ??
    (wardName ? wards.find((item) => normalizeLocationName(item.name) === wardName) : undefined) ??
    null

  if (!ward) {
    return { ...emptyResolution(), city: province.name, ward: String(input.wardName ?? '').trim() }
  }

  const resolved = await resolveWardDowngrade({
    wardCode: String(ward.code),
    provinceCode: String(province.code),
    districtCode: input.districtCode
  })

  return resolved ?? { ...emptyResolution(), city: province.name, ward: ward.name }
}

export function validatePickup(settings: ShippingSettings) {
  if (!pickupComplete(settings)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Chưa cấu hình đủ địa chỉ lấy hàng (tỉnh/quận/phường + số nhà) trong /admin/shipping'
    })
  }
  return settings.pickup
}

/** Địa chỉ gửi cho Goship: mã 3 cấp + tên/điện thoại/số nhà. */
export function pickupAddressForShipment(settings: ShippingSettings) {
  const pickup = validatePickup(settings)
  return {
    name: pickup.name,
    phone: pickup.phone,
    street: pickup.street,
    ward: pickup.wardCode,
    district: pickup.districtCode,
    city: pickup.cityCode
  }
}

export function rateAddressFromPickup(settings: ShippingSettings) {
  const pickup = validatePickup(settings)
  return { district: pickup.districtCode, city: pickup.cityCode }
}
