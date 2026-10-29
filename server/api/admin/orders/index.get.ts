import { pbListPage, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdmin } from '~~/server/utils/admin'
import { combineFilters, parsePaging, searchFilter } from '~~/server/utils/admin-data'

export default defineEventHandler(async (event) => {
  await requireAdmin(event, { resource: 'orders', action: 'read' })

  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  const status = String(query.status ?? '').trim()
  const payment = String(query.payment ?? '').trim()
  const from = String(query.from ?? '').trim()
  const to = String(query.to ?? '').trim()
  const { page, perPage } = parsePaging(event)

  const filter = combineFilters([
    status ? `status = ${pbQuote(status)}` : null,
    payment ? `payment_status = ${pbQuote(payment)}` : null,
    from ? `created_at >= ${pbQuote(`${from} 00:00:00`)}` : null,
    to ? `created_at <= ${pbQuote(`${to} 23:59:59`)}` : null,
    searchFilter(['email', 'shipping_name', 'shipping_phone', 'id'], q)
  ])

  const result = await pbListPage<PbRecord>('orders', {
    filter: filter || undefined,
    sort: '-created_at',
    page,
    perPage,
    expand: 'user,affiliate',
    fields:
      'id,email,status,payment_method,payment_status,total,shipping_name,shipping_phone,created_at,paid_at,completed_at,tax_invoice_number,user,affiliate,expand.user.id,expand.user.email,expand.affiliate.code,shipping_provider,shipping_carrier,shipping_carrier_name,shipping_service,shipping_code,shipping_status_code,shipping_status_text,shipping_returning'
  })

  const ids = result.items.map((item) => item.id)
  const counts = new Map<string, number>()
  if (ids.length > 0) {
    const items = await pbListPage<PbRecord>('order_items', {
      filter: ids.map((id) => `order = ${pbQuote(id)}`).join(' || '),
      perPage: 500,
      fields: 'id,order,quantity'
    })
    for (const item of items.items) {
      const key = String(item.order ?? '')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  return {
    page: result.page,
    perPage: result.perPage,
    total: result.totalItems,
    totalPages: result.totalPages,
    items: result.items.map((item) => ({
      id: item.id,
      email: item.email,
      status: item.status,
      paymentMethod: item.payment_method,
      paymentStatus: item.payment_status,
      total: Number(item.total ?? 0),
      shippingName: item.shipping_name,
      shippingPhone: item.shipping_phone,
      paidAt: item.paid_at || '',
      completedAt: item.completed_at || '',
      taxInvoiceNumber: item.tax_invoice_number || '',
      hasAffiliate: Boolean(item.affiliate),
      affiliateCode: String(item.expand?.affiliate?.code ?? ''),
      shippingProvider: String(item.shipping_provider ?? ''),
      shippingCarrier: String(item.shipping_carrier ?? ''),
      shippingCarrierName: String(item.shipping_carrier_name ?? ''),
      shippingService: String(item.shipping_service ?? ''),
      shippingCode: String(item.shipping_code ?? ''),
      shippingStatusCode: Number(item.shipping_status_code ?? 0),
      shippingStatusText: String(item.shipping_status_text ?? ''),
      shippingReturning: item.shipping_returning === true,
      createdAt: item.created_at || item.created,
      customerEmail: item.expand?.user?.email ?? null,
      itemCount: counts.get(item.id) ?? 0
    }))
  }
})
