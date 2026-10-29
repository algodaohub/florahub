import { pbListAll, pbListPage, pbQuote } from '~~/server/utils/pocketbase'
import { requireAdmin } from '~~/server/utils/admin'
import { ORDER_STATUSES } from '~~/server/utils/admin-data'

function isoDayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString()
}

/** Số liệu nhanh cho đầu trang danh sách đơn. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event, { resource: 'orders', action: 'read' })

  const todayStart = isoDayStart(new Date())

  const [statusCounts, pendingPayments, paidToday, completedToday, awaiting, total] = await Promise.all([
    Promise.all(
      ORDER_STATUSES.map((status) =>
        pbListPage('orders', {
          filter: `status = ${pbQuote(status)}`,
          perPage: 1,
          fields: 'id'
        })
      )
    ),
    pbListPage('orders', {
      filter: 'payment_status = "pending" && status != "cancelled"',
      perPage: 1,
      fields: 'id'
    }),
    pbListPage('orders', {
      filter: `payment_status = "paid" && paid_at >= ${pbQuote(todayStart)}`,
      perPage: 1,
      fields: 'id'
    }),
    pbListAll('orders', {
      filter: `status = "completed" && completed_at >= ${pbQuote(todayStart)}`,
      fields: 'id,total,refunded_amount'
    }),
    pbListAll('orders', {
      filter: 'payment_status = "pending" && status != "cancelled"',
      fields: 'id,total'
    }),
    pbListPage('orders', { perPage: 1, fields: 'id' })
  ])

  const counts: Record<string, number> = {}
  ORDER_STATUSES.forEach((status, index) => {
    counts[status] = statusCounts[index]?.totalItems ?? 0
  })

  return {
    totalOrders: total.totalItems,
    statusCounts: counts,
    pendingOrders: counts.pending ?? 0,
    pendingPayments: pendingPayments.totalItems,
    paidToday: paidToday.totalItems,
    completedToday: completedToday.length,
    revenueToday: completedToday.reduce(
      (sum, order) => sum + Math.max(0, Number(order.total ?? 0) - Number(order.refunded_amount ?? 0)),
      0
    ),
    awaitingAmount: awaiting.reduce((sum, order) => sum + Number(order.total ?? 0), 0)
  }
})
