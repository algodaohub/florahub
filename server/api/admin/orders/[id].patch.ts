import { pbGetRecord, pbUpdate, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { isOrderStatus, isPaymentStatus, toText } from '~~/server/utils/admin-data'
import { canSetOrderStatus, canSetPaymentStatus } from '~~/utils/order-state'
import { ensureOrderAccounting } from '~~/server/utils/accounting'
import { approveDueCommissionForOrder, cancelCommissionForOrder, syncCommissionAtPayment } from '~~/server/utils/affiliate-commission'
import { resolveCustomerAddress } from '~~/server/utils/shipping-address'
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
    shippingCityCode?: string
    shippingWardCode?: string
    shippingCityName?: string
    shippingWardName?: string
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

  // Admin chọn lại tỉnh/phường theo danh mục hành chính → ánh xạ sang mã Goship
  // để báo giá/tạo vận đơn; quote và rate cũ của địa chỉ trước không còn hiệu lực.
  const regionProvided =
    body?.shippingCityCode !== undefined ||
    body?.shippingWardCode !== undefined ||
    body?.shippingCityName !== undefined ||
    body?.shippingWardName !== undefined

  if (regionProvided) {
    if (['cancelled', 'completed'].includes(currentStatus)) {
      throw createError({ statusCode: 400, statusMessage: 'Đơn đã kết thúc — không sửa địa chỉ giao hàng' })
    }
    const shipmentActive =
      Boolean(String(current.shipping_shipment_id ?? '').trim()) ||
      (Boolean(String(current.shipping_code ?? '').trim()) &&
        String(current.shipping_status_text ?? '') !== 'Đã huỷ vận đơn')
    if (shipmentActive) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Đơn đã có vận đơn — huỷ vận đơn trước khi đổi địa chỉ giao hàng'
      })
    }

    const cityCode = String(body?.shippingCityCode ?? '').trim()
    const wardCode = String(body?.shippingWardCode ?? '').trim()
    if (!cityCode || !wardCode) {
      throw createError({ statusCode: 400, statusMessage: 'Chọn đủ tỉnh/thành phố và phường/xã' })
    }

    let resolution
    try {
      resolution = await resolveCustomerAddress({
        cityCode,
        cityName: body?.shippingCityName,
        wardCode,
        wardName: body?.shippingWardName
      })
    } catch {
      resolution = null
    }
    if (!resolution || resolution.resolution !== 'resolved') {
      const where = resolution ? [resolution.city, resolution.ward].filter(Boolean).join(' — ') : ''
      throw createError({
        statusCode: 400,
        statusMessage: `Địa chỉ chưa khớp danh mục vận chuyển${where ? ` (${where})` : ''}. Hãy chọn phường/xã chuẩn trong danh mục.`
      })
    }

    patch.shipping_region_city_code = cityCode
    patch.shipping_region_ward_code = wardCode
    patch.shipping_city_name = resolution.city
    patch.shipping_district_name = resolution.district
    patch.shipping_ward_name = resolution.ward
    patch.shipping_city_code = resolution.cityCode
    patch.shipping_district_code = resolution.districtCode
    patch.shipping_ward_code_goship = resolution.wardCode
    patch.shipping_provider = ''
    patch.shipping_quote_id = ''
    patch.shipping_option_id = ''
    patch.shipping_rate_id = ''
    patch.shipping_carrier = ''
    patch.shipping_carrier_name = ''
    patch.shipping_service = ''
    patch.shipping_fee_quoted = 0
  }

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
