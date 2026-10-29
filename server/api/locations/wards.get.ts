import { findProvince, listWards } from '~~/server/utils/locations'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const province = await findProvince(query.province as string | undefined)

  setHeader(event, 'cache-control', 'public, max-age=86400, stale-while-revalidate=604800')

  if (!province) {
    throw createError({ statusCode: 400, statusMessage: 'Tỉnh/thành không hợp lệ' })
  }

  return {
    province: {
      code: province.code,
      name: province.name,
      type: province.type,
      codename: province.codename,
      phoneCode: province.phoneCode
    },
    wards: await listWards(province.code)
  }
})
