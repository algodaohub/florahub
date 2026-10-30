import { pbListAll, pbListPage, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdmin } from '~~/server/utils/admin'
import { combineFilters, parsePaging } from '~~/server/utils/admin-data'
import { payoutSummary } from '~~/server/utils/affiliate-payout'
import { readAffiliatePayoutPolicy } from '~~/server/utils/affiliate'

function displayName(record: PbRecord | null | undefined) {
  if (!record) return ''
  return [record.last_name, record.first_name].filter(Boolean).join(' ') || record.name || record.email || ''
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event, { resource: 'affiliates', action: 'read' })

  const query = getQuery(event)
  const status = String(query.status ?? '').trim()
  const affiliateId = String(query.affiliate ?? '').trim()
  const from = String(query.from ?? '').trim()
  const to = String(query.to ?? '').trim()
  const { page, perPage } = parsePaging(event, 25)

  const result = await pbListPage<PbRecord>('affiliate_payouts', {
    filter: combineFilters([
      status ? `status = ${pbQuote(status)}` : null,
      affiliateId ? `affiliate = ${pbQuote(affiliateId)}` : null,
      from ? `created_at >= ${pbQuote(`${from} 00:00:00`)}` : null,
      to ? `created_at <= ${pbQuote(`${to} 23:59:59`)}` : null
    ]),
    sort: '-created_at',
    page,
    perPage
  })

  const affiliateIds = [...new Set(result.items.map((item) => String(item.affiliate ?? '')).filter(Boolean))]
  const affiliates = affiliateIds.length
    ? await pbListAll<PbRecord>('affiliates', {
        filter: affiliateIds.map((id) => `id = ${pbQuote(id)}`).join(' || '),
        expand: 'user',
        fields:
          'id,code,user,expand.user.id,expand.user.email,expand.user.name,expand.user.first_name,expand.user.last_name'
      })
    : []
  const affiliateMap = new Map(affiliates.map((item) => [item.id, item]))

  const [allPayouts, policy] = await Promise.all([
    pbListAll<PbRecord>('affiliate_payouts', { fields: 'id,status,net_total' }),
    readAffiliatePayoutPolicy(event)
  ])
  const summary = allPayouts.reduce(
    (totals, payout) => {
      if (String(payout.status ?? '') === 'draft') totals.draft += 1
      if (String(payout.status ?? '') === 'paid') {
        totals.paid += 1
        totals.paidNet += Math.max(0, Number(payout.net_total ?? 0))
      }
      return totals
    },
    { draft: 0, paid: 0, paidNet: 0 }
  )

  return {
    page: result.page,
    perPage: result.perPage,
    total: result.totalItems,
    totalPages: result.totalPages,
    items: result.items.map((item) => {
      const affiliate = affiliateMap.get(String(item.affiliate ?? '')) ?? null
      const user = (affiliate?.expand?.user ?? null) as PbRecord | null
      return {
        ...payoutSummary(item),
        affiliateId: String(item.affiliate ?? ''),
        affiliateCode: String(affiliate?.code ?? ''),
        affiliateName: displayName(user),
        affiliateEmail: String(user?.email ?? ''),
        reference: String(item.reference ?? ''),
        note: String(item.note ?? ''),
        bankName: String(item.bank_name ?? ''),
        bankAccountNo: String(item.bank_account_no ?? ''),
        bankAccountName: String(item.bank_account_name ?? ''),
        taxCode: String(item.tax_code ?? '')
      }
    }),
    summary,
    policy: {
      threshold: policy.threshold,
      autoReconcile: policy.autoReconcile
    }
  }
})
