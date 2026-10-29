import { requireAdmin } from '~~/server/utils/admin'
import { listCarriers } from '~~/server/utils/goship'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return { carriers: await listCarriers() }
})
