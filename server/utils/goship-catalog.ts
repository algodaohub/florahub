import dataset from '../assets/goship-locations.json'
import type { GoshipLocation } from './goship'

type GoshipCatalog = {
  source: string
  apiBaseUrl: string
  updatedAt: string
  counts: { cities: number; districts: number; wards: number }
  cities: Array<{ code: string; name: string }>
  districts: GoshipLocation[]
  wards: GoshipLocation[]
}

const data = dataset as GoshipCatalog

const cityList: GoshipLocation[] = data.cities.map((city) => ({
  code: city.code,
  name: city.name,
  parentCode: ''
}))

function groupBy(items: GoshipLocation[]) {
  const map = new Map<string, GoshipLocation[]>()
  for (const item of items) {
    if (!item.parentCode) continue
    const list = map.get(item.parentCode)
    if (list) list.push(item)
    else map.set(item.parentCode, [item])
  }
  return map
}

const districtsByCity = groupBy(data.districts)
const wardsByDistrict = groupBy(data.wards)

/** Danh mục tỉnh/thành đóng gói sẵn — rỗng khi snapshot chưa được sinh (`npm run goship:locations`). */
export function catalogCities(): GoshipLocation[] {
  return cityList
}

/** `null` khi tỉnh không có trong snapshot để caller chuyển sang nguồn live dự phòng. */
export function catalogDistricts(cityCode: string): GoshipLocation[] | null {
  return districtsByCity.get(String(cityCode)) ?? null
}

/** `null` khi quận/huyện không có trong snapshot để caller chuyển sang nguồn live dự phòng. */
export function catalogWards(districtCode: string): GoshipLocation[] | null {
  return wardsByDistrict.get(String(districtCode)) ?? null
}

export function catalogMeta() {
  return { updatedAt: data.updatedAt, counts: data.counts }
}
