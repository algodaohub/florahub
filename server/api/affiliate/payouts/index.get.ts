import { requirePbUser, pbListPage, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { findAffiliateByUser } from '~~/server/utils/affiliate'
import { payoutSummary } from '~~/server/utils/affiliate-payout'
import { combineFilters, parsePaging } from '~~/server/utils/admin-data'

export default defineEventHandler(async (event) => {
  const { record } = await requirePbUser(event)
  const affiliate = await findAffiliateByUser(record.id)
  if (!affiliate) {
    return { page: 1, perPage: 10, total: 0, totalPages: 0, items: [] }
  }

  const query = getQuery(event)
  const status = String(query.status ?? '').trim()
  const { page, perPage } = parsePaging(event, 10)

  const result = await pbListPage<PbRecord>('affiliate_payouts', {
    filter: combineFilters([
      `affiliate = ${pbQuote(affiliate.id)}`,
      status && ['draft', 'paid', 'cancelled'].includes(status) ? `status = ${pbQuote(status)}` : null
    ]),
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
