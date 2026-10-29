import { setDefaultStore } from '~~/server/utils/store'
import { requireStudioOrAdmin } from '~~/server/utils/studio'

export default defineEventHandler(async (event) => {
  await requireStudioOrAdmin(event)
  const body = await readBody<{ store?: string }>(event)
  const storeId = String(body?.store ?? getQuery(event).store ?? '').trim()

  if (!storeId) throw createError({ statusCode: 400, statusMessage: 'Thiếu cửa hàng' })

  return { store: await setDefaultStore(storeId) }
})
