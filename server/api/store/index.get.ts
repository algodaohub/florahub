import { listStores } from '~~/server/utils/store'
import { requireStudioOrAdmin } from '~~/server/utils/studio'

export default defineEventHandler(async (event) => {
  await requireStudioOrAdmin(event)
  return { stores: await listStores() }
})
