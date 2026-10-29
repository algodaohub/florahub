import { pbGetRecord, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { cancelTaxInvoice, ensureOrderAccounting, issueTaxInvoice } from '~~/server/utils/accounting'

/** Xuất hoá đơn (kể cả thay thế) hoặc huỷ hoá đơn; số đã cấp không bao giờ tái sử dụng. */
export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'orders', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã đơn hàng' })

  const current = await pbGetRecord<PbRecord>('orders', id)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy đơn hàng' })

  const body = await readBody<{ action?: string; reason?: string }>(event)
  const action = String(body?.action ?? '')

  let warning = ''
  if (action === 'cancel') {
    await cancelTaxInvoice(current, String(body?.reason ?? ''))
  } else if (action === 'issue') {
    await issueTaxInvoice(current)
    try {
      const fresh = (await pbGetRecord<PbRecord>('orders', id)) ?? current
      const sync = await ensureOrderAccounting(fresh)
      warning = sync.warnings.join(' · ')
    } catch (error) {
      warning = error instanceof Error ? error.message : 'Không ghi được bút toán doanh thu'
    }
  } else {
    throw createError({ statusCode: 400, statusMessage: 'Thao tác hoá đơn không hợp lệ' })
  }

  const fresh = (await pbGetRecord<PbRecord>('orders', id)) ?? current

  return {
    invoice: {
      number: fresh.tax_invoice_number || '',
      issuedAt: fresh.tax_invoice_issued_at || '',
      status: fresh.tax_invoice_status || '',
      cancelledReason: fresh.tax_invoice_cancelled_reason || ''
    },
    warning
  }
})
