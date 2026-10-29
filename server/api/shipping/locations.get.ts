import { catalogMeta } from '~~/server/utils/goship-catalog'
import { getGoshipCities, getGoshipDistricts, getGoshipWards } from '~~/server/utils/shipping-address'

/** Danh mục địa chỉ Goship cho trường hợp phường/xã thuộc nhiều quận/huyện. */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const type = String(query.type ?? 'cities').trim()
  const meta = catalogMeta()

  setHeader(event, 'cache-control', 'public, max-age=3600, stale-while-revalidate=86400')

  if (type === 'cities') {
    return { type, meta, items: await getGoshipCities() }
  }
  if (type === 'districts') {
    const city = String(query.city ?? '').trim()
    if (!city) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã tỉnh/thành' })
    return { type, meta, items: await getGoshipDistricts(city) }
  }
  if (type === 'wards') {
    const district = String(query.district ?? '').trim()
    if (!district) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã quận/huyện' })
    return { type, meta, items: await getGoshipWards(district) }
  }
  throw createError({ statusCode: 400, statusMessage: 'Loại danh mục không hợp lệ' })
})
