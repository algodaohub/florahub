import { requirePbUser, pbListAll, pbListPage, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { findAffiliateByUser } from '~~/server/utils/affiliate'
import { getSiteSettings } from '~~/server/utils/store'

export default defineEventHandler(async (event) => {
  const { record } = await requirePbUser(event)
  const settings = await getSiteSettings(event)
  const affiliate = await findAffiliateByUser(record.id)

  if (!affiliate) {
    return {
      affiliate: null,
      defaultRate: settings.affiliateCommissionRate,
      stats: { clicks: 0, orders: 0, pending: 0, paid: 0, total: 0 },
      commissions: []
    }
  }

  const affiliateFilter = `affiliate = ${pbQuote(affiliate.id)}`
  const [clicks, orderCount, allCommissions] = await Promise.all([
    pbListPage<PbRecord>('affiliate_clicks', { filter: affiliateFilter, perPage: 1, fields: 'id' }),
    pbListPage<PbRecord>('affiliate_commissions', { filter: affiliateFilter, perPage: 1, fields: 'id' }),
    pbListAll<PbRecord>('affiliate_commissions', {
      filter: affiliateFilter,
      sort: '-created_at',
      expand: 'order'
    })
  ])

  const commissions = allCommissions.slice(0, 20)
  const totals = allCommissions.reduce(
    (sum, item) => {
      const amount = Number(item.amount ?? 0)
      if (item.status === 'paid') sum.paid += amount
      if (item.status === 'pending') sum.pending += amount
      return sum
    },
    { pending: 0, paid: 0, total: 0 }
  )
  totals.total = totals.pending + totals.paid

  const origin = getRequestURL(event).origin

  return {
    affiliate: {
      id: affiliate.id,
      code: affiliate.code,
      commissionRate: Number(affiliate.commission_rate ?? 0),
      status: affiliate.status,
      createdAt: affiliate.created_at || affiliate.created,
      link: `${origin}/?ref=${affiliate.code}`
    },
    defaultRate: settings.affiliateCommissionRate,
    stats: {
      clicks: clicks.totalItems,
      orders: orderCount.totalItems,
      pending: totals.pending,
      paid: totals.paid,
      total: totals.total
    },
    commissions: commissions.map((item) => {
      const order = item.expand?.order
      return {
        id: item.id,
        amount: Number(item.amount ?? 0),
        rate: Number(item.rate ?? 0),
        status: item.status,
        createdAt: item.created_at || item.created,
        order: order
          ? {
              id: order.id,
              total: Number(order.total ?? 0),
              status: order.status,
              createdAt: order.created_at || order.created
            }
          : { id: String(item.order ?? ''), total: 0, status: '', createdAt: '' }
      }
    })
  }
})
