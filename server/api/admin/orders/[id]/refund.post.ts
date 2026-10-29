import { pbGetRecord, pbUpdate, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { toText } from '~~/server/utils/admin-data'
import { ensureOrderAccounting } from '~~/server/utils/accounting'

/** Hoàn tiền đơn đã thanh toán: bắt buộc lý do, ghi bút toán 5212/3331 và huỷ hoá đơn nếu hoàn toàn phần. */
export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'orders', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã đơn hàng' })

  const current = await pbGetRecord<PbRecord>('orders', id)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy đơn hàng' })

  if (String(current.payment_status ?? '') !== 'paid') {
    throw createError({ statusCode: 400, statusMessage: 'Chỉ hoàn tiền cho đơn đã thanh toán' })
  }

  const body = await readBody<{ amount?: number | string; reason?: string }>(event)
  const reason = toText(body?.reason, 500)
  if (reason.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'Vui lòng nhập lý do hoàn tiền' })
  }

  const total = Math.max(0, Number(current.total ?? 0))
  const requested =
    body?.amount === undefined || body?.amount === null || body?.amount === '' ? total : Number(body.amount)
  const amount = Math.round(requested)
  if (!Number.isFinite(amount) || amount <= 0 || amount > total) {
    throw createError({ statusCode: 400, statusMessage: `Số tiền hoàn phải trong khoảng 1 – ${total} ₫` })
  }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    payment_status: 'refunded',
    refunded_at: now,
    refunded_amount: amount
  }
  if (amount >= total && String(current.tax_invoice_status ?? '') === 'issued') {
    patch.tax_invoice_status = 'cancelled'
    patch.tax_invoice_cancelled_reason = `Hoàn tiền: ${reason}`.slice(0, 500)
  }

  const updated = await pbUpdate<PbRecord>('orders', id, patch)

  let warning = ''
  try {
    const sync = await ensureOrderAccounting(updated)
    warning = sync.warnings.join(' · ')
  } catch (error) {
    warning = error instanceof Error ? error.message : 'Không ghi được bút toán hoàn tiền'
  }

  const fresh = (await pbGetRecord<PbRecord>('orders', id)) ?? updated

  return {
    order: {
      id: fresh.id,
      status: fresh.status,
      paymentStatus: fresh.payment_status,
      refundedAt: fresh.refunded_at || '',
      refundedAmount: Number(fresh.refunded_amount ?? 0),
      taxInvoiceNumber: fresh.tax_invoice_number || '',
      taxInvoiceStatus: fresh.tax_invoice_status || '',
      taxInvoiceCancelledReason: fresh.tax_invoice_cancelled_reason || ''
    },
    warning
  }
})
