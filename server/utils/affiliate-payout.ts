import {
  pbCreate,
  pbDelete,
  pbGetRecord,
  pbListAll,
  pbQuote,
  pbUpdate,
  type PbRecord
} from './pocketbase'
import { affiliateBankReady, readAffiliatePayoutPolicy } from './affiliate'

export const PAYOUT_COLLECTION = 'affiliate_payouts'
export const COMMISSION_COLLECTION = 'affiliate_commissions'
export const AFFILIATE_PIT_RATE = 10

export type PayoutMethod = 'bank_transfer' | 'cash' | 'other'

export type DraftPayoutInput = {
  periodFrom?: string
  periodTo?: string
  note?: string
}

export type PayPayoutInput = {
  method?: string
  reference?: string
  note?: string
}

const locks = new Map<string, Promise<unknown>>()

async function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve()
  const run = previous.then(task, task)
  locks.set(key, run)
  try {
    return await run
  } finally {
    if (locks.get(key) === run) locks.delete(key)
  }
}

export function formatPayoutNumber(year: number, sequence: number) {
  return `PC${year}-${String(sequence).padStart(6, '0')}`
}

export function parsePayoutSequence(value: string) {
  const match = /-(\d+)$/.exec(String(value ?? ''))
  return match ? Number(match[1]) : 0
}

export function payoutTax(gross: number) {
  return Math.round((Math.max(0, Math.round(gross)) * AFFILIATE_PIT_RATE) / 100)
}

export function payoutSummary(record: PbRecord) {
  return {
    id: record.id,
    number: String(record.number ?? ''),
    status: String(record.status ?? ''),
    grossTotal: Number(record.gross_total ?? 0),
    taxRate: Number(record.tax_rate ?? AFFILIATE_PIT_RATE),
    taxTotal: Number(record.tax_total ?? 0),
    netTotal: Number(record.net_total ?? 0),
    commissionCount: Number(record.commission_count ?? 0),
    method: String(record.method ?? ''),
    paidAt: record.paid_at || '',
    cancelledAt: record.cancelled_at || '',
    createdAt: record.created_at || record.created || ''
  }
}

function toIsoDate(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const ms = Date.parse(text)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : ''
}

function commissionTimestamp(record: PbRecord) {
  return (
    toIsoDate(record.approved_at) ||
    toIsoDate(record.created_at) ||
    toIsoDate(record.created)
  )
}

async function nextPayoutNumber(year: number) {
  const latest = await pbListAll<PbRecord>(PAYOUT_COLLECTION, {
    filter: `number ~ ${pbQuote(`PC${year}-`)}`,
    sort: '-number',
    perPage: 1,
    fields: 'number'
  })
  return formatPayoutNumber(year, parsePayoutSequence(String(latest[0]?.number ?? '')) + 1)
}

async function createPayoutRecord(body: Record<string, unknown>) {
  const year = new Date().getFullYear()
  let lastError: unknown = null
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const number = await nextPayoutNumber(year)
    try {
      return await pbCreate<PbRecord>(PAYOUT_COLLECTION, { ...body, number })
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? createError({ statusCode: 500, statusMessage: 'Không cấp được số phiếu chi' })
}

async function attachLinesToPayout(payoutId: string, lines: PbRecord[]) {
  const attached: string[] = []
  try {
    for (const line of lines) {
      await pbUpdate(COMMISSION_COLLECTION, line.id, { payout: payoutId, status: 'processing' })
      attached.push(line.id)
    }
  } catch (error) {
    for (const id of attached) {
      await pbUpdate(COMMISSION_COLLECTION, id, { payout: '', status: 'approved' }).catch(() => undefined)
    }
    throw error
  }
  return attached
}

async function createPayoutFromLines(affiliate: PbRecord, lines: PbRecord[], input: DraftPayoutInput = {}) {
  const gross = lines.reduce((sum, line) => sum + Math.max(0, Number(line.amount ?? 0)), 0)
  const tax = payoutTax(gross)
  const payout = await createPayoutRecord({
    affiliate: affiliate.id,
    status: 'draft',
    gross_total: gross,
    tax_rate: AFFILIATE_PIT_RATE,
    tax_total: tax,
    net_total: gross - tax,
    commission_count: lines.length,
    method: '',
    reference: '',
    note: String(input.note ?? '').trim().slice(0, 500),
    bank_name: affiliate.bank_name || '',
    bank_account_no: affiliate.bank_account_no || '',
    bank_account_name: affiliate.bank_account_name || '',
    tax_code: affiliate.tax_code || '',
    period_from: toIsoDate(input.periodFrom),
    period_to: toIsoDate(input.periodTo),
    created_at: new Date().toISOString()
  })

  try {
    await withLock(`payout:${payout.id}`, () => attachLinesToPayout(payout.id, lines))
  } catch (error) {
    await pbDelete(PAYOUT_COLLECTION, payout.id).catch(() => undefined)
    throw error
  }

  return payout
}

async function approvedUnattachedLines(affiliateId: string, input: DraftPayoutInput = {}) {
  const fromMs = Date.parse(toIsoDate(input.periodFrom)) || 0
  const toMs = Date.parse(toIsoDate(input.periodTo)) || 0
  const candidates = await pbListAll<PbRecord>(COMMISSION_COLLECTION, {
    filter: `affiliate = ${pbQuote(affiliateId)} && status = "approved"`,
    sort: 'created_at'
  })
  return candidates.filter((line) => {
    if (line.payout) return false
    if (fromMs || toMs) {
      const stamp = Date.parse(commissionTimestamp(line))
      if (!Number.isFinite(stamp)) return false
      if (fromMs && stamp < fromMs) return false
      if (toMs && stamp > toMs) return false
    }
    return true
  })
}

/** Lập phiếu chi nháp từ các hoa hồng đã duyệt và chưa gắn phiếu khác. */
export async function createDraftPayout(affiliateId: string, input: DraftPayoutInput = {}) {
  return withLock(`affiliate:${affiliateId}`, async () => {
    const affiliate = await pbGetRecord<PbRecord>('affiliates', affiliateId)
    if (!affiliate) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy cộng tác viên' })
    if (!affiliateBankReady(affiliate)) {
      throw createError({
        statusCode: 422,
        statusMessage: 'Cộng tác viên chưa cập nhật đủ thông tin ngân hàng để nhận hoa hồng'
      })
    }

    const lines = await approvedUnattachedLines(affiliateId, input)
    if (lines.length === 0) {
      throw createError({ statusCode: 422, statusMessage: 'Không có hoa hồng khả dụng để lập phiếu chi' })
    }

    return createPayoutFromLines(affiliate, lines, input)
  })
}

/** Xác nhận đã chi: khoá hoa hồng ở trạng thái paid. */
export async function payPayout(payoutId: string, input: PayPayoutInput = {}) {
  return withLock(`payout:${payoutId}`, async () => {
    const payout = await pbGetRecord<PbRecord>(PAYOUT_COLLECTION, payoutId)
    if (!payout) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy phiếu chi' })
    const status = String(payout.status ?? '')
    if (status === 'paid') throw createError({ statusCode: 409, statusMessage: 'Phiếu chi đã được xác nhận' })
    if (status !== 'draft') throw createError({ statusCode: 409, statusMessage: 'Chỉ phiếu nháp mới có thể xác nhận chi' })

    const method: PayoutMethod = ['bank_transfer', 'cash', 'other'].includes(String(input.method))
      ? (String(input.method) as PayoutMethod)
      : 'bank_transfer'
    if (method === 'bank_transfer' && !String(payout.bank_account_no ?? '').trim()) {
      throw createError({ statusCode: 422, statusMessage: 'Phiếu chi chưa có số tài khoản nhận tiền' })
    }

    const paidAt = new Date().toISOString()
    const lines = await pbListAll<PbRecord>(COMMISSION_COLLECTION, {
      filter: `payout = ${pbQuote(payoutId)}`,
      fields: 'id,status'
    })
    const updated: string[] = []
    try {
      for (const line of lines) {
        await pbUpdate(COMMISSION_COLLECTION, line.id, { status: 'paid', paid_at: paidAt })
        updated.push(line.id)
      }
      return await pbUpdate<PbRecord>(PAYOUT_COLLECTION, payoutId, {
        status: 'paid',
        paid_at: paidAt,
        method,
        reference: String(input.reference ?? '').trim().slice(0, 120),
        note: String(input.note ?? payout.note ?? '').trim().slice(0, 500)
      })
    } catch (error) {
      for (const id of updated) {
        await pbUpdate(COMMISSION_COLLECTION, id, { status: 'processing', paid_at: '' }).catch(() => undefined)
      }
      throw error
    }
  })
}

/** Huỷ phiếu nháp và trả hoa hồng về trạng thái khả dụng. */
export async function cancelPayout(payoutId: string, note = '') {
  return withLock(`payout:${payoutId}`, async () => {
    const payout = await pbGetRecord<PbRecord>(PAYOUT_COLLECTION, payoutId)
    if (!payout) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy phiếu chi' })
    const status = String(payout.status ?? '')
    if (status === 'paid') throw createError({ statusCode: 409, statusMessage: 'Phiếu đã chi không thể huỷ' })
    if (status !== 'draft') throw createError({ statusCode: 409, statusMessage: 'Phiếu chi đã bị huỷ' })

    const lines = await pbListAll<PbRecord>(COMMISSION_COLLECTION, {
      filter: `payout = ${pbQuote(payoutId)}`,
      fields: 'id'
    })
    for (const line of lines) {
      await pbUpdate(COMMISSION_COLLECTION, line.id, { payout: '', status: 'approved', paid_at: '' })
    }

    const reason = String(note ?? '').trim().slice(0, 400)
    const currentNote = String(payout.note ?? '').trim()
    return pbUpdate<PbRecord>(PAYOUT_COLLECTION, payoutId, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      note: [currentNote, reason ? `Huỷ: ${reason}` : ''].filter(Boolean).join(' · ').slice(0, 500)
    })
  })
}

/** Tính lại tổng phiếu nháp; tự huỷ khi không còn dòng hoa hồng hợp lệ. */
async function recalculateDraftTotals(payoutId: string) {
  const payout = await pbGetRecord<PbRecord>(PAYOUT_COLLECTION, payoutId)
  if (!payout || String(payout.status ?? '') !== 'draft') return payout

  const lines = await pbListAll<PbRecord>(COMMISSION_COLLECTION, {
    filter: `payout = ${pbQuote(payoutId)} && status = "processing"`,
    fields: 'id,amount'
  })
  const gross = lines.reduce((sum, line) => sum + Math.max(0, Number(line.amount ?? 0)), 0)
  const count = lines.length

  if (count === 0) {
    return pbUpdate<PbRecord>(PAYOUT_COLLECTION, payoutId, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString()
    })
  }

  const tax = payoutTax(gross)
  return pbUpdate<PbRecord>(PAYOUT_COLLECTION, payoutId, {
    gross_total: gross,
    tax_rate: AFFILIATE_PIT_RATE,
    tax_total: tax,
    net_total: gross - tax,
    commission_count: count
  })
}

export async function refreshDraftTotals(payoutId: string) {
  return withLock(`payout:${payoutId}`, () => recalculateDraftTotals(payoutId))
}

export type AffiliateReconcileResult = {
  ran: boolean
  threshold: number
  autoReconcile: boolean
  approvedLines: number
  approvedGross: number
  created: number
  toppedUp: number
  skippedThreshold: number
  skippedNoBank: number
  skippedNoLines: number
  errors: number
  periodFrom: string
  periodTo: string
}

type ReconcileOptions = {
  event?: any
  now?: Date
  /** Bỏ qua cờ tự động khi admin chạy đối soát thủ công. */
  force?: boolean
}

function earliestCommissionIso(lines: PbRecord[]) {
  let earliest = 0
  for (const line of lines) {
    const stamp = Date.parse(commissionTimestamp(line))
    if (Number.isFinite(stamp) && (!earliest || stamp < earliest)) earliest = stamp
  }
  return earliest ? new Date(earliest).toISOString() : ''
}

function laterIso(a: string, b: string) {
  if (!a) return b
  if (!b) return a
  return Date.parse(a) >= Date.parse(b) ? a : b
}

function earlierIso(a: string, b: string) {
  if (!a) return b
  if (!b) return a
  return Date.parse(a) <= Date.parse(b) ? a : b
}

/**
 * Đối soát tự động hàng tháng: duyệt hoa hồng đến hạn và lập phiếu chi nháp
 * khi tổng hoa hồng khả dụng (đã gồm GTGT) đạt hạn mức cấu hình.
 * Hoa hồng chưa đủ hạn mức được cộng dồn sang kỳ sau; hoa hồng đã nằm trong
 * phiếu nháp được bổ sung vào chính phiếu đó thay vì tạo phiếu thứ hai.
 */
export async function reconcileAffiliatePayouts(options: ReconcileOptions = {}): Promise<AffiliateReconcileResult> {
  const policy = await readAffiliatePayoutPolicy(options.event)
  const now = options.now ?? new Date()
  const periodEnd = options.force
    ? now
    : new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
  const periodEndIso = periodEnd.toISOString()
  const periodMonth = options.force ? now : new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const periodLabel = `${String(periodMonth.getMonth() + 1).padStart(2, '0')}/${periodMonth.getFullYear()}`

  const result: AffiliateReconcileResult = {
    ran: policy.autoReconcile || Boolean(options.force),
    threshold: policy.threshold,
    autoReconcile: policy.autoReconcile,
    approvedLines: 0,
    approvedGross: 0,
    created: 0,
    toppedUp: 0,
    skippedThreshold: 0,
    skippedNoBank: 0,
    skippedNoLines: 0,
    errors: 0,
    periodFrom: '',
    periodTo: periodEndIso
  }
  if (!result.ran) return result

  // Import động để tránh vòng lặp module với affiliate-commission.
  const { approveDueCommissions } = await import('./affiliate-commission')
  await approveDueCommissions('status = "pending"').catch(() => undefined)

  const approved = await pbListAll<PbRecord>(COMMISSION_COLLECTION, {
    filter: 'status = "approved" && payout = ""',
    sort: 'created_at'
  })
  result.approvedLines = approved.length
  result.approvedGross = approved.reduce((sum, line) => sum + Math.max(0, Number(line.amount ?? 0)), 0)
  result.periodFrom = earliestCommissionIso(approved)
  if (approved.length === 0) return result

  const byAffiliate = new Map<string, PbRecord[]>()
  for (const line of approved) {
    const key = String(line.affiliate ?? '')
    if (!key) continue
    const list = byAffiliate.get(key) ?? []
    list.push(line)
    byAffiliate.set(key, list)
  }

  for (const affiliateId of byAffiliate.keys()) {
    await withLock(`affiliate:${affiliateId}`, async () => {
      try {
        const affiliate = await pbGetRecord<PbRecord>('affiliates', affiliateId)
        if (!affiliate) {
          result.errors += 1
          return
        }
        if (!affiliateBankReady(affiliate)) {
          result.skippedNoBank += 1
          return
        }

        const fresh = await approvedUnattachedLines(affiliateId)
        if (fresh.length === 0) {
          result.skippedNoLines += 1
          return
        }

        const [existingDraft] = await pbListAll<PbRecord>(PAYOUT_COLLECTION, {
          filter: `affiliate = ${pbQuote(affiliateId)} && status = "draft"`,
          sort: '-created_at',
          perPage: 1
        })

        if (existingDraft) {
          let attachedToDraft = false
          await withLock(`payout:${existingDraft.id}`, async () => {
            const current = await pbGetRecord<PbRecord>(PAYOUT_COLLECTION, existingDraft.id)
            if (!current || String(current.status ?? '') !== 'draft') {
              result.skippedNoLines += 1
              return
            }
            await attachLinesToPayout(current.id, fresh)
            const updated = await recalculateDraftTotals(current.id)
            if (!updated) return
            await pbUpdate(PAYOUT_COLLECTION, current.id, {
              period_from: earlierIso(toIsoDate(current.period_from), earliestCommissionIso(fresh)),
              period_to: laterIso(toIsoDate(current.period_to), periodEndIso)
            })
            attachedToDraft = true
          })
          if (attachedToDraft) result.toppedUp += 1
          return
        }

        const gross = fresh.reduce((sum, line) => sum + Math.max(0, Number(line.amount ?? 0)), 0)
        if (gross < policy.threshold) {
          result.skippedThreshold += 1
          return
        }

        await createPayoutFromLines(affiliate, fresh, {
          periodFrom: earliestCommissionIso(fresh),
          periodTo: periodEndIso,
          note: `Đối soát tự động tháng ${periodLabel}`
        })
        result.created += 1
      } catch {
        result.errors += 1
      }
    })
  }

  return result
}

/** Gỡ một hoa hồng khỏi phiếu nháp (huỷ/hoàn đơn) rồi tính lại phiếu. */
export async function detachCommissionFromDraft(commission: PbRecord | null | undefined) {
  if (!commission?.payout) return
  const payout = await pbGetRecord<PbRecord>(PAYOUT_COLLECTION, String(commission.payout))
  if (!payout || String(payout.status ?? '') !== 'draft') return

  await pbUpdate(COMMISSION_COLLECTION, commission.id, { payout: '', status: 'approved', paid_at: '' })
  await refreshDraftTotals(payout.id)
}

/** Hoàn một phần làm thay đổi số tiền: phiếu nháp chứa dòng phải được tính lại. */
export async function refreshDraftForCommission(commission: PbRecord | null | undefined) {
  if (!commission?.payout) return
  await refreshDraftTotals(String(commission.payout))
}
