import { pbGetRecord, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { approveDueCommissions } from '~~/server/utils/affiliate-commission'
import { createDraftPayout, payoutSummary } from '~~/server/utils/affiliate-payout'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'affiliates', action: 'write' })

  const body = await readBody<{
    affiliate?: string
    periodFrom?: string
    periodTo?: string
    note?: string
  }>(event)

  const affiliateId = String(body?.affiliate ?? '').trim()
  if (!affiliateId) throw createError({ statusCode: 400, statusMessage: 'Chọn cộng tác viên để lập phiếu' })

  await approveDueCommissions(`status = "pending" && affiliate = ${pbQuote(affiliateId)}`)

  const payout = await createDraftPayout(affiliateId, {
    periodFrom: body?.periodFrom,
    periodTo: body?.periodTo,
    note: body?.note
  })

  const affiliate = await pbGetRecord<PbRecord>('affiliates', affiliateId)
  return {
    payout: {
      ...payoutSummary(payout),
      affiliateId,
      affiliateCode: String(affiliate?.code ?? ''),
      affiliateName: '',
      affiliateEmail: '',
      reference: '',
      note: String(payout.note ?? ''),
      bankName: String(payout.bank_name ?? ''),
      bankAccountNo: String(payout.bank_account_no ?? ''),
      bankAccountName: String(payout.bank_account_name ?? ''),
      taxCode: String(payout.tax_code ?? '')
    }
  }
})
