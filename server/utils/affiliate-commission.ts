import {
  pbCreate,
  pbFirst,
  pbGetRecord,
  pbListAll,
  pbQuote,
  pbUpdate,
  type PbRecord
} from './pocketbase'
import { getStoreConfig } from './store'
import { effectiveAffiliateRate } from './affiliate'
import { detachCommissionFromDraft, refreshDraftForCommission } from './affiliate-payout'

const COLLECTION = 'affiliate_commissions'
export const DAY_MS = 24 * 60 * 60 * 1000

export async function readAffiliateHoldDays(): Promise<number> {
  const { config } = await getStoreConfig()
  return Math.min(365, Math.max(0, Math.round(Number(config.features.affiliateHoldDays) || 0)))
}

/** Mốc duyệt hoa hồng = thời điểm hoàn tất đơn + số ngày giữ. */
export function commissionEligibleAt(order: PbRecord | null | undefined, holdDays: number): number | null {
  const completedAt = Date.parse(String(order?.completed_at ?? ''))
  if (!Number.isFinite(completedAt)) return null
  return completedAt + holdDays * DAY_MS
}

/** Đơn đủ điều kiện chi hoa hồng: hoàn tất, đã thu tiền, không huỷ/hoàn/đang chuyển hoàn. */
export function orderQualifiesForCommission(order: PbRecord | null | undefined): boolean {
  if (!order) return false
  return (
    String(order.status ?? '') === 'completed' &&
    String(order.payment_status ?? '') === 'paid' &&
    !order.refunded_at &&
    !order.cancelled_at &&
    order.shipping_returning !== true
  )
}

export function effectiveCommissionStatus(
  record: PbRecord,
  order: PbRecord | null | undefined,
  holdDays: number,
  now = Date.now()
): string {
  const stored = String(record.status ?? 'pending') || 'pending'
  if (stored !== 'pending') return stored
  if (!orderQualifiesForCommission(order)) return stored
  const eligibleAt = commissionEligibleAt(order, holdDays)
  return eligibleAt !== null && eligibleAt <= now ? 'approved' : stored
}

/**
 * Chốt tỷ lệ hoa hồng tại thời điểm đơn được thanh toán.
 * CTV có tỷ lệ riêng dùng tỷ lệ đó; còn lại dùng tỷ lệ cửa hàng hiện hành.
 */
export async function syncCommissionAtPayment(order: PbRecord, event?: any): Promise<PbRecord | null> {
  const affiliateId = String(order?.affiliate ?? '').trim()
  if (!affiliateId) return null

  const commission = await pbFirst<PbRecord>(COLLECTION, {
    filter: `order = ${pbQuote(order.id)}`
  })
  const status = String(commission?.status ?? '')
  if (commission && status !== 'pending') return commission

  const affiliate = await pbGetRecord<PbRecord>('affiliates', affiliateId)
  if (!affiliate) return commission

  const { config } = await getStoreConfig(event)
  const rate = effectiveAffiliateRate(config, affiliate)
  const base = Math.max(0, Number(order.subtotal ?? 0) - Number(order.discount_total ?? 0))
  const amount = Math.round((base * rate) / 100)

  await pbUpdate('orders', order.id, { affiliate_commission: amount }).catch(() => undefined)

  if (!commission) {
    if (amount <= 0) return null
    return pbCreate<PbRecord>(COLLECTION, {
      affiliate: affiliateId,
      order: order.id,
      amount,
      rate,
      status: 'pending'
    })
  }

  return pbUpdate<PbRecord>(COLLECTION, commission.id, { amount, rate })
}

/** Duyệt các hoa hồng đã hết thời gian giữ; chỉ ghi DB khi thực sự đủ điều kiện. */
export async function approveDueCommissions(filter: string): Promise<void> {
  const records = await pbListAll<PbRecord>(COLLECTION, { filter, expand: 'order' })
  if (records.length === 0) return
  const holdDays = await readAffiliateHoldDays()
  const now = Date.now()
  for (const record of records) {
    if (String(record.status ?? '') !== 'pending') continue
    const order = (record.expand?.order ?? null) as PbRecord | null
    if (effectiveCommissionStatus(record, order, holdDays, now) !== 'approved') continue
    await pbUpdate(COLLECTION, record.id, {
      status: 'approved',
      approved_at: new Date(now).toISOString()
    }).catch(() => undefined)
  }
}

export async function approveDueCommissionForOrder(order: PbRecord): Promise<void> {
  await approveDueCommissions(`order = ${pbQuote(order.id)}`)
}

/** Huỷ hoa hồng khi đơn bị huỷ/hoàn toàn phần; không đụng tới khoản đã chi trả. */
export async function cancelCommissionForOrder(orderId: string): Promise<void> {
  const record = await pbFirst<PbRecord>(COLLECTION, { filter: `order = ${pbQuote(orderId)}` })
  if (!record) return
  const status = String(record.status ?? '')
  if (status === 'cancelled' || status === 'paid') return
  if (status === 'processing') await detachCommissionFromDraft(record)
  await pbUpdate(COLLECTION, record.id, { status: 'cancelled' }).catch(() => undefined)
}

/** Hoàn một phần: giảm hoa hồng theo tỷ lệ còn lại; hoàn toàn phần thì huỷ. */
export async function applyRefundToCommission(order: PbRecord): Promise<void> {
  const record = await pbFirst<PbRecord>(COLLECTION, { filter: `order = ${pbQuote(order.id)}` })
  if (!record) return
  const status = String(record.status ?? '')
  if (status === 'cancelled' || status === 'paid') return

  const total = Math.max(0, Number(order.total ?? 0))
  const refunded = Math.max(0, Number(order.refunded_amount ?? 0))
  if (total > 0 && refunded >= total) {
    await cancelCommissionForOrder(order.id)
    return
  }
  if (refunded <= 0 || total <= 0) return

  const base = Math.max(0, Number(order.subtotal ?? 0) - Number(order.discount_total ?? 0))
  const rate = Math.max(0, Number(record.rate ?? 0))
  const remainingRatio = Math.max(0, (total - refunded) / total)
  const amount = Math.round(base * (rate / 100) * remainingRatio)
  const updated = await pbUpdate<PbRecord>(COLLECTION, record.id, { amount }).catch(() => null)
  if (updated && String(updated.status ?? '') === 'processing') {
    await refreshDraftForCommission(updated)
  }
}
