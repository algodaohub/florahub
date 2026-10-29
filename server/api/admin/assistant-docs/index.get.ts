import { pbListAll, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdmin } from '~~/server/utils/admin'
import { toAdminDoc } from '~~/server/utils/assistant-docs'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const rows = await pbListAll<PbRecord>('assistant_docs', { sort: 'sort_order,title' })
  return { items: rows.map(toAdminDoc) }
})
