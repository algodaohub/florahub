import { pbListPage, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdmin } from '~~/server/utils/admin'
import { parsePaging } from '~~/server/utils/admin-data'

export default defineEventHandler(async (event) => {
  await requireAdmin(event, { resource: 'affiliates', action: 'read' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã cộng tác viên' })

  const { page, perPage } = parsePaging(event, 30)
  const result = await pbListPage<PbRecord>('affiliate_clicks', {
    filter: `affiliate = ${pbQuote(id)}`,
    sort: '-created_at',
    page,
    perPage,
    fields: 'id,path,referrer,created_at'
  })

  return {
    page: result.page,
    perPage: result.perPage,
    total: result.totalItems,
    totalPages: result.totalPages,
    items: result.items.map((item) => ({
      id: item.id,
      path: String(item.path ?? ''),
      referrer: String(item.referrer ?? ''),
      createdAt: item.created_at || item.created || ''
    }))
  }
})
