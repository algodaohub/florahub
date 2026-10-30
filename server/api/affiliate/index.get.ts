import { requirePbUser, pbListAll, pbListPage, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { findAffiliateByUser, readAffiliateAttributionDays, readAffiliatePayoutPolicy } from '~~/server/utils/affiliate'
import { getSiteSettings } from '~~/server/utils/store'
import { payoutSummary } from '~~/server/utils/affiliate-payout'
import {
  approveDueCommissions,
  commissionEligibleAt,
  effectiveCommissionStatus,
  readAffiliateHoldDays
} from '~~/server/utils/affiliate-commission'

export default defineEventHandler(async (event) => {
  const { record } = await requirePbUser(event)
  const settings = await getSiteSettings(event)
  const affiliation = await findAffiliateByUser(record.id)
  const holdDays = await readAffiliateHoldDays()
  const attributionDays = await readAffiliateAttributionDays(event)
  const payoutPolicy = await readAffiliatePayoutPolicy(event)

  if (!affiliation) {
    return {
      affiliate: null,
      defaultRate: settings.affiliateCommissionRate,
      holdDays,
      attributionDays,
      payoutThreshold: payoutPolicy.threshold,
      autoReconcile: payoutPolicy.autoReconcile,
      stats: { clicks: 0, orders: 0, pending: 0, approved: 0, processing: 0, paid: 0, total: 0 },
      commissions: [],
      payouts: []
    }
  }

  const affiliate = affiliation
  const affiliateFilter = `affiliate = ${pbQuote(affiliate.id)}`
  await approveDueCommissions(`status = "pending" && ${affiliateFilter}`)

  const [clicks, orderCount, allCommissions, payouts] = await Promise.all([
    pbListPage<PbRecord>('affiliate_clicks', { filter: affiliateFilter, perPage: 1, fields: 'id' }),
    pbListPage<PbRecord>('affiliate_commissions', { filter: affiliateFilter, perPage: 1, fields: 'id' }),
    pbListAll<PbRecord>('affiliate_commissions', {
      filter: affiliateFilter,
      sort: '-created_at',
      expand: 'order'
    }),
    pbListPage<PbRecord>('affiliate_payouts', {
      filter: affiliateFilter,
      sort: '-created_at',
      perPage: 5
    })
  ])

  const now = Date.now()
  const detailed = allCommissions.map((item) => {
    const order = (item.expand?.order ?? null) as PbRecord | null
    const eligibleMs = commissionEligibleAt(order, holdDays)
    return {
      item,
      order,
      status: effectiveCommissionStatus(item, order, holdDays, now),
      eligibleAt: eligibleMs ? new Date(eligibleMs).toISOString() : ''
    }
  })

  const commissions = detailed.slice(0, 20)
  const totals = detailed.reduce(
    (sum, entry) => {
      const amount = Number(entry.item.amount ?? 0)
      if (entry.status === 'paid') sum.paid += amount
      if (entry.status === 'approved') sum.approved += amount
      if (entry.status === 'processing') sum.processing += amount
      if (entry.status === 'pending') sum.pending += amount
      return sum
    },
    { pending: 0, approved: 0, processing: 0, paid: 0, total: 0 }
  )
  totals.total = totals.approved + totals.processing + totals.paid

  const origin = getRequestURL(event).origin
  const customRate = affiliate.custom_rate === true
  const storedRate = Number(affiliate.commission_rate ?? 0)

  return {
    affiliate: {
      id: affiliate.id,
      code: affiliate.code,
      commissionRate: storedRate,
      effectiveRate: customRate ? storedRate : settings.affiliateCommissionRate,
      customRate,
      status: affiliate.status,
      createdAt: affiliate.created_at || affiliate.created,
      link: `${origin}/?ref=${affiliate.code}`,
      bankName: String(affiliate.bank_name ?? ''),
      bankAccountNo: String(affiliate.bank_account_no ?? ''),
      bankAccountName: String(affiliate.bank_account_name ?? ''),
      taxCode: String(affiliate.tax_code ?? '')
    },
    defaultRate: settings.affiliateCommissionRate,
    holdDays,
    attributionDays,
    payoutThreshold: payoutPolicy.threshold,
    autoReconcile: payoutPolicy.autoReconcile,
    stats: {
      clicks: clicks.totalItems,
      orders: orderCount.totalItems,
      pending: totals.pending,
      approved: totals.approved,
      processing: totals.processing,
      paid: totals.paid,
      total: totals.total
    },
    commissions: commissions.map(({ item, order, status, eligibleAt }) => ({
      id: item.id,
      amount: Number(item.amount ?? 0),
      rate: Number(item.rate ?? 0),
      status,
      eligibleAt,
      payoutId: String(item.payout ?? ''),
      createdAt: item.created_at || item.created,
      order: order
        ? {
            id: order.id,
            total: Number(order.total ?? 0),
            status: order.status,
            createdAt: order.created_at || order.created
          }
        : { id: String(item.order ?? ''), total: 0, status: '', createdAt: '' }
    })),
    payouts: payouts.items.map(payoutSummary)
  }
})
