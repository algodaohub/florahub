import { pbListAll, pbListPage, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdmin } from '~~/server/utils/admin'
import { combineFilters, parsePaging, searchFilter } from '~~/server/utils/admin-data'
import {
  affiliateBankReady,
  maskBankAccount,
  summarizeCommissions,
  type CommissionTotals
} from '~~/server/utils/affiliate'
import { approveDueCommissions } from '~~/server/utils/affiliate-commission'
import { getSiteSettings } from '~~/server/utils/store'

function displayName(record: PbRecord | null | undefined) {
  if (!record) return ''
  return [record.last_name, record.first_name].filter(Boolean).join(' ') || record.name || record.email || ''
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event, { resource: 'affiliates', action: 'read' })

  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  const status = String(query.status ?? '').trim()
  const { page, perPage } = parsePaging(event)

  await approveDueCommissions('status = "pending"').catch(() => undefined)

  const parts: Array<string | null> = [status ? `status = ${pbQuote(status)}` : null]
  if (q) {
    const users = await pbListAll<PbRecord>('users', {
      filter: searchFilter(['email', 'name', 'first_name', 'last_name'], q) ?? undefined,
      fields: 'id',
      perPage: 100
    })
    const matches = [`code ~ ${pbQuote(q)}`, ...users.map((user) => `user = ${pbQuote(user.id)}`)]
    parts.push(`(${matches.join(' || ')})`)
  }

  const result = await pbListPage<PbRecord>('affiliates', {
    filter: combineFilters(parts) || undefined,
    sort: '-created_at',
    page,
    perPage,
    expand: 'user',
    fields:
      'id,code,commission_rate,custom_rate,status,created_at,bank_name,bank_account_no,bank_account_name,tax_code,user,expand.user.id,expand.user.email,expand.user.name,expand.user.first_name,expand.user.last_name,expand.user.phone'
  })

  const [allCommissions, affiliateCount, activeCount, settings] = await Promise.all([
    pbListAll<PbRecord>('affiliate_commissions', {
      fields: 'id,affiliate,amount,status',
      perPage: 500
    }),
    pbListPage<PbRecord>('affiliates', { perPage: 1, fields: 'id' }),
    pbListPage<PbRecord>('affiliates', { filter: `status = "active"`, perPage: 1, fields: 'id' }),
    getSiteSettings(event)
  ])

  const summaryTotals = summarizeCommissions(allCommissions)
  const byAffiliate = new Map<string, PbRecord[]>()
  for (const commission of allCommissions) {
    const key = String(commission.affiliate ?? '')
    if (!key) continue
    const list = byAffiliate.get(key) ?? []
    list.push(commission)
    byAffiliate.set(key, list)
  }

  return {
    page: result.page,
    perPage: result.perPage,
    total: result.totalItems,
    totalPages: result.totalPages,
    items: result.items.map((item) => {
      const user = (item.expand?.user ?? null) as PbRecord | null
      const stats: CommissionTotals = summarizeCommissions(byAffiliate.get(item.id) ?? [])
      const customRate = item.custom_rate === true
      const storedRate = Number(item.commission_rate ?? 0)
      return {
        id: item.id,
        code: String(item.code ?? ''),
        name: displayName(user),
        email: String(user?.email ?? ''),
        phone: String(user?.phone ?? ''),
        commissionRate: storedRate,
        effectiveRate: customRate ? storedRate : settings.affiliateCommissionRate,
        customRate,
        status: String(item.status ?? ''),
        createdAt: item.created_at || item.created || '',
        bankName: String(item.bank_name ?? ''),
        bankAccountMasked: maskBankAccount(String(item.bank_account_no ?? '')),
        bankReady: affiliateBankReady(item),
        stats
      }
    }),
    summary: {
      affiliates: affiliateCount.totalItems,
      active: activeCount.totalItems,
      pending: summaryTotals.pending,
      approved: summaryTotals.approved,
      processing: summaryTotals.processing,
      paid: summaryTotals.paid
    }
  }
})
