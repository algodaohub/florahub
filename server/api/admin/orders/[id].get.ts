import { pbFirst, pbGetRecord, pbListAll, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdmin } from '~~/server/utils/admin'
import { journalForOrder } from '~~/server/utils/accounting'
import { listShipmentEvents, orderShippingFromRecord } from '~~/server/utils/order-shipping'
import { getStoreConfig } from '~~/server/utils/store'
import { isQrPaymentReady } from '~~/utils/payments'
import {
  commissionEligibleAt,
  effectiveCommissionStatus,
  readAffiliateHoldDays
} from '~~/server/utils/affiliate-commission'
import { findProvince, listWards } from '~~/server/utils/locations'

function displayName(record: PbRecord | null) {
  if (!record) return ''
  return [record.last_name, record.first_name].filter(Boolean).join(' ') || record.name || record.email || ''
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event, { resource: 'orders', action: 'read' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã đơn hàng' })

  const order = await pbGetRecord<PbRecord>('orders', id)
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy đơn hàng' })

  const [items, customer, commissionRecord, journal, shipmentEvents] = await Promise.all([
    pbListAll<PbRecord>('order_items', {
      filter: `order = ${pbQuote(id)}`,
      sort: 'created'
    }),
    order.user ? pbGetRecord<PbRecord>('users', String(order.user)) : Promise.resolve(null),
    pbFirst<PbRecord>('affiliate_commissions', { filter: `order = ${pbQuote(id)}` }),
    journalForOrder(id),
    listShipmentEvents(id)
  ])

  const { config } = await getStoreConfig(event)
  const qr = config.payments.qr
  const paymentQr = isQrPaymentReady(config.payments)
    ? {
        enabled: true,
        bankId: qr.bankId,
        bankName: qr.bankName,
        accountNo: qr.accountNo,
        accountName: qr.accountName,
        template: qr.template
      }
    : null

  let affiliate = null
  if (order.affiliate) {
    const record = await pbGetRecord<PbRecord>('affiliates', String(order.affiliate))
    if (record) {
      const referrer = record.user ? await pbGetRecord<PbRecord>('users', String(record.user)) : null
      affiliate = {
        code: String(record.code ?? ''),
        rate: Number(record.commission_rate ?? 0),
        status: String(record.status ?? ''),
        referrerName: displayName(referrer),
        referrerEmail: String(referrer?.email ?? '')
      }
    }
  }

  const holdDays = commissionRecord ? await readAffiliateHoldDays() : 0
  const eligibleAtMs = commissionRecord ? commissionEligibleAt(order, holdDays) : null

  const regionCityCode = String(order.shipping_region_city_code ?? '')
  const regionWardCode = String(order.shipping_region_ward_code ?? '')
  let regionCity = ''
  let regionWard = ''
  if (regionCityCode) {
    regionCity = (await findProvince(regionCityCode))?.name ?? String(order.shipping_city_name ?? '')
    if (regionWardCode) {
      regionWard =
        (await listWards(regionCityCode)).find((ward) => String(ward.code) === regionWardCode)?.name ??
        String(order.shipping_ward_name ?? '')
    }
  }
  // Đơn cũ chưa có mã vùng: prefill theo tên Goship để admin chọn lại trong danh mục.
  if (!regionCity) regionCity = String(order.shipping_city_name ?? '')
  if (!regionWard) regionWard = String(order.shipping_ward_name ?? '')

  return {
    order: {
      id: order.id,
      email: order.email,
      status: order.status,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      subtotal: Number(order.subtotal ?? 0),
      shippingTotal: Number(order.shipping_total ?? 0),
      discountTotal: Number(order.discount_total ?? 0),
      taxRate: Number(order.tax_rate ?? 0),
      taxTotal: Number(order.tax_total ?? 0),
      total: Number(order.total ?? 0),
      shippingName: order.shipping_name,
      shippingPhone: order.shipping_phone,
      shippingAddress: order.shipping_address,
      shippingRegion: {
        city: regionCity,
        ward: regionWard,
        cityCode: regionCityCode,
        wardCode: regionWardCode
      },
      note: order.note,
      paidAt: order.paid_at || '',
      completedAt: order.completed_at || '',
      cancelledAt: order.cancelled_at || '',
      refundedAt: order.refunded_at || '',
      refundedAmount: Number(order.refunded_amount ?? 0),
      taxInvoiceNumber: order.tax_invoice_number || '',
      taxInvoiceIssuedAt: order.tax_invoice_issued_at || '',
      taxInvoiceStatus: order.tax_invoice_status || '',
      taxInvoiceCancelledReason: order.tax_invoice_cancelled_reason || '',
      sepayTransactionId: order.sepay_transaction_id || '',
      sepayOrderId: order.sepay_order_id || '',
      accountingPostedAt: order.accounting_posted_at || '',
      createdAt: order.created_at || order.created,
      updatedAt: order.updated
    },
    shipping: orderShippingFromRecord(order),
    shipmentEvents,
    paymentQr,
    customer: customer
      ? {
          id: customer.id,
          email: customer.email,
          displayName: displayName(customer)
        }
      : null,
    affiliate,
    commission: commissionRecord
      ? {
          amount: Number(commissionRecord.amount ?? 0),
          rate: Number(commissionRecord.rate ?? 0),
          status: effectiveCommissionStatus(commissionRecord, order, holdDays),
          eligibleAt: eligibleAtMs ? new Date(eligibleAtMs).toISOString() : ''
        }
      : null,
    journal: journal.map((line) => ({
      id: line.id,
      date: line.entry_date,
      refType: line.ref_type,
      account: line.account,
      accountName: line.account_name,
      description: line.description,
      debit: Number(line.debit ?? 0),
      credit: Number(line.credit ?? 0),
      invoiceNumber: line.invoice_number || ''
    })),
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      variantTitle: item.variant_title,
      thumbnail: item.thumbnail,
      unitPrice: Number(item.unit_price ?? 0),
      quantity: Number(item.quantity ?? 0)
    }))
  }
})
