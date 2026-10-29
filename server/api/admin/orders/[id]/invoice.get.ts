import { pbGetRecord, pbListAll, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdmin } from '~~/server/utils/admin'
import { readAccountingSettings } from '~~/server/utils/accounting'

/** Chi tiết hoá đơn GTGT của một đơn (chỉ đơn đã được cấp số). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event, { resource: 'orders', action: 'read' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã đơn hàng' })

  const order = await pbGetRecord<PbRecord>('orders', id)
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy đơn hàng' })
  if (!order.tax_invoice_number) throw createError({ statusCode: 404, statusMessage: 'Đơn chưa có hoá đơn' })

  const [items, settings] = await Promise.all([
    pbListAll<PbRecord>('order_items', { filter: `order = ${pbQuote(id)}`, sort: 'created' }),
    readAccountingSettings()
  ])

  const total = Number(order.total ?? 0)
  const taxTotal = Number(order.tax_total ?? 0)

  return {
    invoice: {
      number: String(order.tax_invoice_number),
      issuedAt: order.tax_invoice_issued_at || order.completed_at || '',
      status: order.tax_invoice_status || '',
      cancelledReason: order.tax_invoice_cancelled_reason || '',
      taxRate: Number(order.tax_rate ?? 0),
      net: total - taxTotal,
      taxTotal,
      total,
      subtotal: Number(order.subtotal ?? 0),
      discountTotal: Number(order.discount_total ?? 0),
      shippingTotal: Number(order.shipping_total ?? 0),
      paymentMethod: order.payment_method || '',
      paymentStatus: order.payment_status || '',
      completedAt: order.completed_at || '',
      seller: {
        name: settings.sellerName,
        taxCode: settings.sellerTaxCode,
        address: settings.sellerAddress,
        invoiceSymbol: settings.invoiceSymbol,
        invoiceTemplate: settings.invoiceTemplate
      },
      buyer: {
        name: order.shipping_name || '',
        phone: order.shipping_phone || '',
        address: order.shipping_address || '',
        email: order.email || ''
      },
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        variantTitle: item.variant_title || '',
        unitPrice: Number(item.unit_price ?? 0),
        quantity: Number(item.quantity ?? 0)
      }))
    }
  }
})
