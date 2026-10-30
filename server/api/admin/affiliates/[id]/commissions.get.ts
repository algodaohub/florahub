import { pbListPage, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdmin } from '~~/server/utils/admin'
import { combineFilters, parsePaging } from '~~/server/utils/admin-data'
import {
  approveDueCommissions,
  commissionEligibleAt,
  readAffiliateHoldDays
} from '~~/server/utils/affiliate-commission'

export default defineEventHandler(async (event) => {
  await requireAdmin(event, { resource: 'affiliates', action: 'read' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã cộng tác viên' })

  const query = getQuery(event)
  const status = String(query.status ?? '').trim()
  const { page, perPage } = parsePaging(event)

  await approveDueCommissions(`status = "pending" && affiliate = ${pbQuote(id)}`).catch(() => undefined)

  const [result, holdDays] = await Promise.all([
    pbListPage<PbRecord>('affiliate_commissions', {
      filter: combineFilters([
        `affiliate = ${pbQuote(id)}`,
        status ? `status = ${pbQuote(status)}` : null
      ]),
      sort: '-created_at',
      page,
      perPage,
      expand: 'order',
      fields:
        'id,amount,rate,status,created_at,approved_at,paid_at,payout,order,expand.order.id,expand.order.total,expand.order.status,expand.order.payment_status,expand.order.completed_at,expand.order.created_at'
    }),
    readAffiliateHoldDays()
  ])

  return {
    page: result.page,
    perPage: result.perPage,
    total: result.totalItems,
    totalPages: result.totalPages,
    holdDays,
    items: result.items.map((item) => {
      const order = (item.expand?.order ?? null) as PbRecord | null
      const eligibleMs = commissionEligibleAt(order, holdDays)
      return {
        id: item.id,
        amount: Number(item.amount ?? 0),
        rate: Number(item.rate ?? 0),
        status: String(item.status ?? ''),
        eligibleAt: eligibleMs ? new Date(eligibleMs).toISOString() : '',
        approvedAt: item.approved_at || '',
        paidAt: item.paid_at || '',
        payoutId: String(item.payout ?? ''),
        createdAt: item.created_at || item.created || '',
        order: {
          id: String(order?.id ?? item.order ?? ''),
          total: Number(order?.total ?? 0),
          status: String(order?.status ?? ''),
          paymentStatus: String(order?.payment_status ?? ''),
          completedAt: order?.completed_at || '',
          createdAt: order?.created_at || order?.created || ''
        }
      }
    })
  }
})
