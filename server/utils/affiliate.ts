import { pbFirst, pbQuote, type PbRecord } from './pocketbase'
import { getStoreConfig } from './store'
import type { StoreConfig } from '~/types/store'

export const AFFILIATE_COOKIE = 'affiliate_ref'
export const DEFAULT_COMMISSION_RATE = 5

function clampRate(value: unknown) {
  const rate = Number(value)
  return Number.isFinite(rate) ? Math.min(100, Math.max(0, Math.round(rate))) : 0
}

/** Thời hạn ghi nhận giới thiệu (cookie ref) theo cấu hình cửa hàng. */
export async function readAffiliateAttributionDays(event?: any): Promise<number> {
  const { config } = await getStoreConfig(event)
  const days = Math.round(Number(config.features.affiliateAttributionDays) || 0)
  return Math.min(365, Math.max(1, days || 30))
}

export type AffiliatePayoutPolicy = {
  /** Hạn mức tối thiểu trên tổng hoa hồng gộp (đã gồm GTGT). */
  threshold: number
  autoReconcile: boolean
}

export async function readAffiliatePayoutPolicy(event?: any): Promise<AffiliatePayoutPolicy> {
  const { config } = await getStoreConfig(event)
  return {
    threshold: Math.max(0, Math.round(Number(config.features.affiliatePayoutThreshold) || 0)),
    autoReconcile: config.features.affiliateAutoReconcile !== false
  }
}

/**
 * Tỷ lệ áp dụng khi ghi nhận/thanh toán đơn:
 * CTV có tỷ lệ riêng (`custom_rate`) dùng tỷ lệ đó, còn lại lấy cấu hình cửa hàng hiện tại.
 */
export function effectiveAffiliateRate(
  config: StoreConfig | null | undefined,
  affiliate: PbRecord | null | undefined
): number {
  if (affiliate?.custom_rate === true) return clampRate(affiliate.commission_rate)
  return clampRate(config?.features?.affiliateCommissionRate)
}

export function generateAffiliateCode(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
    .toUpperCase()
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${base || 'SHARE'}${suffix}`.slice(0, 12)
}

export async function findAffiliateByCode(code: string) {
  if (!code) return null
  return pbFirst<PbRecord>('affiliates', { filter: `code = ${pbQuote(code.toUpperCase())}` })
}

export async function findAffiliateByUser(userId: string) {
  if (!userId) return null
  return pbFirst<PbRecord>('affiliates', { filter: `user = ${pbQuote(userId)}` })
}

/** Đủ thông tin để lập phiếu chi chuyển khoản. */
export function affiliateBankReady(record: PbRecord | null | undefined): boolean {
  if (!record) return false
  return Boolean(
    String(record.bank_name ?? '').trim() &&
      String(record.bank_account_no ?? '').trim() &&
      String(record.bank_account_name ?? '').trim()
  )
}

export type AffiliateProfile = {
  id: string
  code: string
  commissionRate: number
  customRate: boolean
  status: string
  createdAt: string
  bankName: string
  bankAccountNo: string
  bankAccountName: string
  taxCode: string
}

/** Hồ sơ CTV dùng chung cho admin và khách (chỉ chủ sở hữu/admin được xem). */
export function affiliateProfile(record: PbRecord): AffiliateProfile {
  return {
    id: record.id,
    code: String(record.code ?? ''),
    commissionRate: clampRate(record.commission_rate),
    customRate: record.custom_rate === true,
    status: String(record.status ?? ''),
    createdAt: String(record.created_at || record.created || ''),
    bankName: String(record.bank_name ?? ''),
    bankAccountNo: String(record.bank_account_no ?? ''),
    bankAccountName: String(record.bank_account_name ?? ''),
    taxCode: String(record.tax_code ?? '')
  }
}

/** Hiển thị số tài khoản cho danh sách/log: giữ 3 đầu và 4 cuối. */
export function maskBankAccount(value: string) {
  const account = String(value ?? '').replace(/\s+/g, '')
  if (account.length <= 7) return account
  return `${account.slice(0, 3)}•••${account.slice(-4)}`
}

export type CommissionTotals = {
  pending: number
  approved: number
  processing: number
  paid: number
  total: number
}

export function summarizeCommissions(records: PbRecord[]): CommissionTotals {
  const totals: CommissionTotals = { pending: 0, approved: 0, processing: 0, paid: 0, total: 0 }
  for (const record of records) {
    const amount = Math.max(0, Number(record.amount ?? 0))
    const status = String(record.status ?? '')
    if (status === 'pending') totals.pending += amount
    else if (status === 'approved') totals.approved += amount
    else if (status === 'processing') totals.processing += amount
    else if (status === 'paid') totals.paid += amount
  }
  totals.total = totals.approved + totals.processing + totals.paid
  return totals
}
