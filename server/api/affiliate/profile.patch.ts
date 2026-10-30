import { requirePbUser, pbUpdate, type PbRecord } from '~~/server/utils/pocketbase'
import { affiliateProfile, findAffiliateByUser } from '~~/server/utils/affiliate'

function text(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max)
}

export default defineEventHandler(async (event) => {
  const { record } = await requirePbUser(event)
  const affiliate = await findAffiliateByUser(record.id)
  if (!affiliate) throw createError({ statusCode: 404, statusMessage: 'Bạn chưa tham gia chương trình cộng tác viên' })

  const body = await readBody<Record<string, unknown>>(event)
  const patch: Record<string, unknown> = {}

  if (body?.bankName !== undefined) patch.bank_name = text(body.bankName, 120)
  if (body?.bankAccountName !== undefined) patch.bank_account_name = text(body.bankAccountName, 120)
  if (body?.taxCode !== undefined) patch.tax_code = text(body.taxCode, 20)

  if (body?.bankAccountNo !== undefined) {
    const accountNo = text(body.bankAccountNo, 40).replace(/\s+/g, '')
    if (accountNo && !/^\d{6,40}$/.test(accountNo)) {
      throw createError({ statusCode: 400, statusMessage: 'Số tài khoản chỉ gồm 6–40 chữ số' })
    }
    patch.bank_account_no = accountNo
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Không có thay đổi để lưu' })
  }

  const merged: PbRecord = { ...affiliate, ...patch }
  const bankFields = ['bank_name', 'bank_account_no', 'bank_account_name']
  const filled = bankFields.filter((field) => String(merged[field] ?? '').trim())
  if (filled.length > 0 && filled.length < bankFields.length) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Nhập đủ ngân hàng, số tài khoản và chủ tài khoản hoặc để trống cả ba'
    })
  }

  const updated = await pbUpdate<PbRecord>('affiliates', affiliate.id, patch)
  return { affiliate: affiliateProfile(updated) }
})
