import { pbListPage, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdmin } from '~~/server/utils/admin'
import { combineFilters, parsePaging } from '~~/server/utils/admin-data'
import { payoutSummary } from '~~/server/utils/affiliate-payout'

export default defineEventHandler(async (event) => {
  await requireAdmin(event, { resource: 'affiliates', action: 'read' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã cộng tác viên' })

  const query = getQuery(event)
  const status = String(query.status ?? '').trim()
  const { page, perPage } = parsePaging(event, 20)

  const result = await pbListPage<PbRecord>('affiliate_payouts', {
    filter: combineFilters([`affiliate = ${pbQuote(id)}`, status ? `status = ${pbQuote(status)}` : null]),
    sort: '-created_at',
    page,
    perPage
  })

  return {
    page: result.page,
    perPage: result.perPage,
    total: result.totalItems,
    totalPages: result.totalPages,
    items: result.items.map(payoutSummary)
  }
})
