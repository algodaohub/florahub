import { pbGetRecord, pbUpdate, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { isOrderStatus, isPaymentStatus, toText } from '~~/server/utils/admin-data'
import { canSetOrderStatus, canSetPaymentStatus } from '~~/utils/order-state'
import { ensureOrderAccounting } from '~~/server/utils/accounting'
import { approveDueCommissionForOrder, cancelCommissionForOrder, syncCommissionAtPayment } from '~~/server/utils/affiliate-commission'
import { ORDER_STATUS_META, PAYMENT_STATUS_META } from '~~/utils/admin'

function orderLabel(status: string) {
  return ORDER_STATUS_META[status]?.label ?? status
}

function paymentLabel(status: string) {
  return PAYMENT_STATUS_META[status]?.label ?? status
}

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'orders', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã đơn hàng' })

  const current = await pbGetRecord<PbRecord>('orders', id)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy đơn hàng' })

  const body = await readBody<{
    status?: string
    paymentStatus?: string
    note?: string
    shippingName?: string
    shippingPhone?: string
    shippingAddress?: string
  }>(event)

  const patch: Record<string, unknown> = {}
  const now = new Date().toISOString()
  const currentStatus = String(current.status ?? '')
  const currentPayment = String(current.payment_status ?? '')
  const nextStatus = body?.status === undefined ? currentStatus : String(body.status)
  const nextPayment = body?.paymentStatus === undefined ? currentPayment : String(body.paymentStatus)

  if (body?.status !== undefined) {
    if (!isOrderStatus(body.status)) {
      throw createError({ statusCode: 400, statusMessage: 'Trạng thái đơn hàng không hợp lệ' })
    }
    if (!canSetOrderStatus(currentStatus, body.status)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Không thể chuyển đơn từ "${orderLabel(currentStatus)}" sang "${orderLabel(body.status)}"`
      })
    }
    if (body.status === 'cancelled' && nextPayment === 'paid') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Đơn đã thanh toán — hoàn tiền trước khi huỷ đơn'
      })
    }
    if (body.status === 'completed' && nextPayment === 'pending') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Đơn chưa thu được tiền — không thể hoàn tất'
      })
    }
    if (body.status === 'completed' && nextPayment === 'refunded') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Đơn đã hoàn tiền — không thể hoàn tất'
      })
    }
    patch.status = body.status
    if (body.status === 'completed' && !current.completed_at) patch.completed_at = now
    if (body.status === 'cancelled' && !current.cancelled_at) patch.cancelled_at = now
  }

  if (body?.paymentStatus !== undefined) {
    if (!isPaymentStatus(body.paymentStatus)) {
      throw createError({ statusCode: 400, statusMessage: 'Trạng thái thanh toán không hợp lệ' })
    }
    if (body.paymentStatus === 'refunded') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Dùng chức năng Hoàn tiền để ghi nhận số tiền và lý do'
      })
    }
    if (!canSetPaymentStatus(currentPayment, body.paymentStatus)) {
      if (currentPayment === 'paid') {
        throw createError({
          statusCode: 400,
          statusMessage: 'Đơn đã thanh toán — không thể chuyển về chờ thanh toán. Dùng Hoàn tiền nếu cần.'
        })
      }
      throw createError({
        statusCode: 400,
        statusMessage: `Không thể chuyển thanh toán từ "${paymentLabel(currentPayment)}" sang "${paymentLabel(body.paymentStatus)}"`
      })
    }
    if (nextStatus === 'cancelled' && body.paymentStatus !== currentPayment) {
      throw createError({ statusCode: 400, statusMessage: 'Đơn đã huỷ — không cập nhật thanh toán' })
    }
    if (nextStatus === 'completed' && body.paymentStatus === 'pending') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Đơn chưa thu được tiền — không thể hoàn tất'
      })
    }
    patch.payment_status = body.paymentStatus
    if (body.paymentStatus === 'paid' && !current.paid_at) patch.paid_at = now
  }

  if (body?.note !== undefined) patch.note = toText(body.note, 2000)
  if (body?.shippingName !== undefined) patch.shipping_name = toText(body.shippingName, 120)
  if (body?.shippingPhone !== undefined) patch.shipping_phone = toText(body.shippingPhone, 40)
  if (body?.shippingAddress !== undefined) patch.shipping_address = toText(body.shippingAddress, 400)

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Không có thay đổi để lưu' })
  }

  const updated = await pbUpdate<PbRecord>('orders', id, patch)

  let warning = ''
  if (nextStatus === 'completed' || nextPayment === 'refunded') {
    try {
      const sync = await ensureOrderAccounting(updated)
      warning = sync.warnings.join(' · ')
    } catch (error) {
      warning = error instanceof Error ? error.message : 'Không đồng bộ được sổ kế toán'
    }
  }

  const fresh = (await pbGetRecord<PbRecord>('orders', id)) ?? updated

  // Hoa hồng chốt theo tỷ lệ tại thời điểm đơn được đánh dấu đã thanh toán.
  if (body.paymentStatus === 'paid' && String(current.payment_status ?? '') !== 'paid') {
    await syncCommissionAtPayment(fresh, event).catch(() => undefined)
  }

  if (fresh.status === 'completed') {
    await approveDueCommissionForOrder(fresh).catch(() => undefined)
  } else if (fresh.status === 'cancelled') {
    await cancelCommissionForOrder(fresh.id).catch(() => undefined)
  }

  return {
    order: {
      id: fresh.id,
      status: fresh.status,
      paymentStatus: fresh.payment_status,
      note: fresh.note,
      shippingName: fresh.shipping_name,
      shippingPhone: fresh.shipping_phone,
      shippingAddress: fresh.shipping_address,
      paidAt: fresh.paid_at || '',
      completedAt: fresh.completed_at || '',
      cancelledAt: fresh.cancelled_at || '',
      taxInvoiceNumber: fresh.tax_invoice_number || '',
      taxInvoiceStatus: fresh.tax_invoice_status || '',
      updatedAt: fresh.updated
    },
    warning
  }
})
