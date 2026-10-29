import { getProvincesBundle } from '~~/server/utils/locations'

export default defineEventHandler(async (event) => {
  const { meta, provinces } = await getProvincesBundle()

  setHeader(event, 'cache-control', 'public, max-age=3600, stale-while-revalidate=604800')

  return {
    ...meta,
    provinces
  }
})
