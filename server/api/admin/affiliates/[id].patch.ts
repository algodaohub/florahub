import { pbGetRecord, pbUpdate, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { toNumber, toText } from '~~/server/utils/admin-data'
import { affiliateProfile, affiliateBankReady, effectiveAffiliateRate } from '~~/server/utils/affiliate'
import { getStoreConfig } from '~~/server/utils/store'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'affiliates', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã cộng tác viên' })

  const current = await pbGetRecord<PbRecord>('affiliates', id)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy cộng tác viên' })

  const body = await readBody<Record<string, unknown>>(event)
  const patch: Record<string, unknown> = {}

  if (body?.commissionRate !== undefined) {
    const rate = toNumber(body.commissionRate, -1)
    if (rate < 0 || rate > 100) {
      throw createError({ statusCode: 400, statusMessage: 'Tỷ lệ hoa hồng phải từ 0 đến 100%' })
    }
    patch.commission_rate = Math.round(rate)
    patch.custom_rate = body?.customRate === false ? false : true
  } else if (body?.customRate !== undefined) {
    patch.custom_rate = body.customRate === true
  }

  if (body?.status !== undefined) {
    const status = toText(body.status, 20)
    if (!['active', 'suspended'].includes(status)) {
      throw createError({ statusCode: 400, statusMessage: 'Trạng thái cộng tác viên không hợp lệ' })
    }
    patch.status = status
  }

  if (body?.bankName !== undefined) patch.bank_name = toText(body.bankName, 120)
  if (body?.bankAccountName !== undefined) patch.bank_account_name = toText(body.bankAccountName, 120)
  if (body?.taxCode !== undefined) patch.tax_code = toText(body.taxCode, 20)

  if (body?.bankAccountNo !== undefined) {
    const accountNo = toText(body.bankAccountNo, 40).replace(/\s+/g, '')
    if (accountNo && !/^\d{6,40}$/.test(accountNo)) {
      throw createError({ statusCode: 400, statusMessage: 'Số tài khoản chỉ gồm 6–40 chữ số' })
    }
    patch.bank_account_no = accountNo
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Không có thay đổi để lưu' })
  }

  const merged = { ...current, ...patch }
  const bankFields = ['bank_name', 'bank_account_no', 'bank_account_name']
  const filled = bankFields.filter((field) => String(merged[field] ?? '').trim())
  if (filled.length > 0 && filled.length < bankFields.length) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Nhập đủ ngân hàng, số tài khoản và chủ tài khoản hoặc để trống cả ba'
    })
  }

  const updated = await pbUpdate<PbRecord>('affiliates', id, patch)
  const { config } = await getStoreConfig(event)
  const profile = affiliateProfile(updated)

  return {
    affiliate: {
      ...profile,
      effectiveRate: effectiveAffiliateRate(config, updated),
      bankReady: affiliateBankReady(updated)
    }
  }
})
