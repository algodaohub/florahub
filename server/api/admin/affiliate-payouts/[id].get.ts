import { pbGetRecord, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdmin } from '~~/server/utils/admin'
import { buildAffiliateStatement } from '~~/server/utils/affiliate-statement'
import { PAYOUT_COLLECTION, payoutSummary } from '~~/server/utils/affiliate-payout'

function displayName(record: PbRecord | null | undefined) {
  if (!record) return ''
  return [record.last_name, record.first_name].filter(Boolean).join(' ') || record.name || record.email || ''
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event, { resource: 'affiliates', action: 'read' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã phiếu chi' })

  const payout = await pbGetRecord<PbRecord>(PAYOUT_COLLECTION, id)
  if (!payout) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy phiếu chi' })

  const affiliate = payout.affiliate
    ? await pbGetRecord<PbRecord>('affiliates', String(payout.affiliate))
    : null
  const user = affiliate?.user ? await pbGetRecord<PbRecord>('users', String(affiliate.user)) : null
  const statement = await buildAffiliateStatement(id)
  if (!statement) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy phiếu chi' })

  return {
    payout: {
      ...payoutSummary(payout),
      affiliateId: String(payout.affiliate ?? ''),
      affiliateCode: String(affiliate?.code ?? ''),
      affiliateName: displayName(user),
      affiliateEmail: String(user?.email ?? ''),
      reference: String(payout.reference ?? ''),
      note: String(payout.note ?? ''),
      bankName: String(payout.bank_name ?? ''),
      bankAccountNo: String(payout.bank_account_no ?? ''),
      bankAccountName: String(payout.bank_account_name ?? ''),
      taxCode: String(payout.tax_code ?? '')
    },
    lines: statement.lines,
    statement
  }
})
