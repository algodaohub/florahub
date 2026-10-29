import type { PbRecord } from './pocketbase'
import { pbCreate, pbFirst, pbListAll, pbQuote, pbUpdate } from './pocketbase'
import { accountName, formatInvoiceNumber, parseInvoiceSequence } from '~~/utils/accounting'

export const JOURNAL_COLLECTION = 'journal_entries'
export const ACCOUNTING_SETTINGS_COLLECTION = 'accounting_settings'
export const ACCOUNTING_SCOPE = 'default'

export type AccountingSettings = {
  sellerName: string
  sellerTaxCode: string
  sellerAddress: string
  invoiceSymbol: string
  invoiceTemplate: string
  updatedAt: string
}

type JournalLine = {
  account: string
  debit: number
  credit: number
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function text(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}

function orderLabel(order: PbRecord) {
  return `#${String(order.id ?? '').slice(-6).toUpperCase()}`
}

/** TK tiền nhận được: COD → tiền mặt, còn lại → tiền gửi ngân hàng. */
function receiptAccount(order: PbRecord) {
  return String(order.payment_method ?? '') === 'cod' ? '111' : '112'
}

/** Đơn chưa thu tiền (dữ liệu cũ) ghi vào phải thu khách hàng. */
function saleDebitAccount(order: PbRecord) {
  const status = String(order.payment_status ?? '')
  if (status === 'paid' || status === 'refunded') return receiptAccount(order)
  if (status === 'cod') return '111'
  return '131'
}

export function orderNetRevenue(order: PbRecord) {
  return Math.max(0, num(order.total) - num(order.tax_total))
}

export function orderVat(order: PbRecord) {
  return Math.max(0, num(order.tax_total))
}

export function orderVatRate(order: PbRecord) {
  return Math.max(0, num(order.tax_rate))
}

async function hasJournal(orderId: string, refType: string) {
  const existing = await pbFirst<PbRecord>(JOURNAL_COLLECTION, {
    filter: `order = ${pbQuote(orderId)} && ref_type = ${pbQuote(refType)}`,
    perPage: 1,
    fields: 'id'
  })
  return Boolean(existing)
}

async function writeJournal(
  order: PbRecord,
  refType: 'sale' | 'refund',
  date: string,
  description: string,
  lines: JournalLine[]
) {
  const invoiceNumber = text(order.tax_invoice_number, 80)
  for (const line of lines) {
    if (!line.debit && !line.credit) continue
    await pbCreate(JOURNAL_COLLECTION, {
      entry_date: date,
      order: String(order.id),
      ref_type: refType,
      account: line.account,
      account_name: accountName(line.account),
      description,
      debit: line.debit,
      credit: line.credit,
      invoice_number: invoiceNumber,
      created_at: new Date().toISOString()
    })
  }
}

/** Ghi nhận doanh thu tại thời điểm hoàn tất (VAS 14). Idempotent theo ref_type. */
export async function postSaleEntry(order: PbRecord) {
  if (await hasJournal(String(order.id), 'sale')) return false
  const total = num(order.total)
  if (total <= 0) return false

  const vat = orderVat(order)
  const net = total - vat
  const date = String(order.completed_at || order.created_at || order.created || new Date().toISOString())
  const description = `Doanh thu đơn ${orderLabel(order)}`

  await writeJournal(order, 'sale', date, description, [
    { account: saleDebitAccount(order), debit: total, credit: 0 },
    { account: '511', debit: 0, credit: net },
    { account: '3331', debit: 0, credit: vat }
  ])
  await pbUpdate('orders', String(order.id), { accounting_posted_at: new Date().toISOString() })
  return true
}

/** Hoàn tiền: giảm doanh thu (5212) + thuế GTGT đầu ra tương ứng. */
export async function postRefundEntry(order: PbRecord, amount: number, reason: string) {
  if (await hasJournal(String(order.id), 'refund')) return false
  const refund = Math.max(0, Math.round(amount))
  if (refund <= 0) return false

  const total = num(order.total)
  const vat = total > 0 ? Math.round((orderVat(order) * refund) / total) : 0
  const net = refund - vat
  const date = String(order.refunded_at || new Date().toISOString())
  const description = `Hoàn tiền đơn ${orderLabel(order)}${reason ? ` — ${reason}` : ''}`.slice(0, 500)

  await writeJournal(order, 'refund', date, description, [
    { account: '5212', debit: net, credit: 0 },
    { account: '3331', debit: vat, credit: 0 },
    { account: receiptAccount(order), debit: 0, credit: refund }
  ])
  return true
}

/** Cấp số hoá đơn tuần tự theo năm; huỷ giữ số, xuất thay thế lấy số kế tiếp. */
export async function issueTaxInvoice(order: PbRecord) {
  if (String(order.status ?? '') !== 'completed') {
    throw createError({ statusCode: 400, statusMessage: 'Chỉ xuất hoá đơn cho đơn đã hoàn tất' })
  }
  if (String(order.tax_invoice_status ?? '') === 'issued' && order.tax_invoice_number) {
    return {
      number: String(order.tax_invoice_number),
      issuedAt: String(order.tax_invoice_issued_at ?? ''),
      status: 'issued',
      created: false
    }
  }

  const issuedAt = new Date().toISOString()
  const year = new Date(String(order.completed_at || issuedAt)).getFullYear()

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const latest = await pbFirst<PbRecord>('orders', {
      filter: `tax_invoice_number ~ ${pbQuote(`HD${year}-`)}`,
      sort: '-tax_invoice_number',
      fields: 'tax_invoice_number',
      perPage: 1
    })
    const sequence = parseInvoiceSequence(String(latest?.tax_invoice_number ?? '')) + 1
    const number = formatInvoiceNumber(year, sequence)
    try {
      await pbUpdate('orders', String(order.id), {
        tax_invoice_number: number,
        tax_invoice_issued_at: issuedAt,
        tax_invoice_status: 'issued',
        tax_invoice_cancelled_reason: ''
      })
      return { number, issuedAt, status: 'issued', created: true }
    } catch (error) {
      if (attempt === 5) throw error
    }
  }

  throw createError({ statusCode: 500, statusMessage: 'Không cấp được số hoá đơn, vui lòng thử lại' })
}

export async function cancelTaxInvoice(order: PbRecord, reason: string) {
  if (String(order.tax_invoice_status ?? '') !== 'issued') {
    throw createError({ statusCode: 400, statusMessage: 'Đơn chưa có hoá đơn đã xuất để huỷ' })
  }
  const note = text(reason, 500)
  if (note.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'Vui lòng nhập lý do huỷ hoá đơn' })
  }
  await pbUpdate('orders', String(order.id), {
    tax_invoice_status: 'cancelled',
    tax_invoice_cancelled_reason: note
  })
}

/**
 * Đồng bộ sổ cho một đơn: hoàn tất → xuất hoá đơn + bút toán doanh thu;
 * đã hoàn tiền → bút toán hoàn tiền. Lỗi không chặn cập nhật đơn, chỉ trả cảnh báo.
 */
export async function ensureOrderAccounting(order: PbRecord): Promise<{ warnings: string[] }> {
  const warnings: string[] = []

  if (String(order.status ?? '') === 'completed') {
    if (!order.tax_invoice_number) {
      try {
        await issueTaxInvoice(order)
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : 'Không xuất được hoá đơn')
      }
    }
    try {
      const fresh = (await pbFirst<PbRecord>('orders', { filter: `id = ${pbQuote(order.id)}` })) ?? order
      await postSaleEntry(fresh)
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'Không ghi được bút toán doanh thu')
    }
  }

  if (String(order.payment_status ?? '') === 'refunded' && num(order.refunded_amount) > 0) {
    try {
      await postRefundEntry(order, num(order.refunded_amount), text(order.tax_invoice_cancelled_reason))
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'Không ghi được bút toán hoàn tiền')
    }
  }

  return { warnings: warnings.filter(Boolean) }
}

export function emptyAccountingSettings(): AccountingSettings {
  return {
    sellerName: '',
    sellerTaxCode: '',
    sellerAddress: '',
    invoiceSymbol: '',
    invoiceTemplate: '',
    updatedAt: ''
  }
}

export async function readAccountingSettings(): Promise<AccountingSettings> {
  try {
    const record = await pbFirst<PbRecord>(ACCOUNTING_SETTINGS_COLLECTION, {
      filter: `scope = ${pbQuote(ACCOUNTING_SCOPE)}`,
      perPage: 1
    })
    if (!record) return emptyAccountingSettings()
    return {
      sellerName: text(record.seller_name, 200),
      sellerTaxCode: text(record.seller_tax_code, 40),
      sellerAddress: text(record.seller_address, 400),
      invoiceSymbol: text(record.invoice_symbol, 40),
      invoiceTemplate: text(record.invoice_template, 40),
      updatedAt: String(record.updated_at ?? record.updated ?? '')
    }
  } catch {
    return emptyAccountingSettings()
  }
}

export type AccountingSettingsInput = Partial<Omit<AccountingSettings, 'updatedAt'>>

export async function saveAccountingSettings(input: AccountingSettingsInput): Promise<AccountingSettings> {
  const current = await readAccountingSettings()
  const next: AccountingSettings = {
    sellerName: input.sellerName === undefined ? current.sellerName : text(input.sellerName, 200),
    sellerTaxCode: input.sellerTaxCode === undefined ? current.sellerTaxCode : text(input.sellerTaxCode, 40),
    sellerAddress: input.sellerAddress === undefined ? current.sellerAddress : text(input.sellerAddress, 400),
    invoiceSymbol: input.invoiceSymbol === undefined ? current.invoiceSymbol : text(input.invoiceSymbol, 40),
    invoiceTemplate:
      input.invoiceTemplate === undefined ? current.invoiceTemplate : text(input.invoiceTemplate, 40),
    updatedAt: new Date().toISOString()
  }

  const existing = await pbFirst<PbRecord>(ACCOUNTING_SETTINGS_COLLECTION, {
    filter: `scope = ${pbQuote(ACCOUNTING_SCOPE)}`,
    perPage: 1
  })
  const body = {
    scope: ACCOUNTING_SCOPE,
    seller_name: next.sellerName,
    seller_tax_code: next.sellerTaxCode,
    seller_address: next.sellerAddress,
    invoice_symbol: next.invoiceSymbol,
    invoice_template: next.invoiceTemplate,
    updated_at: next.updatedAt
  }
  if (existing) await pbUpdate(ACCOUNTING_SETTINGS_COLLECTION, existing.id, body)
  else await pbCreate(ACCOUNTING_SETTINGS_COLLECTION, body)

  return next
}

export async function journalForOrder(orderId: string) {
  return pbListAll<PbRecord>(JOURNAL_COLLECTION, {
    filter: `order = ${pbQuote(orderId)}`,
    sort: 'created'
  })
}

export async function listJournalLines(from: string, to: string) {
  const fromIso = new Date(`${from}T00:00:00`).toISOString()
  const toIso = new Date(`${to}T23:59:59.999`).toISOString()
  return pbListAll<PbRecord>(JOURNAL_COLLECTION, {
    filter: `entry_date >= ${pbQuote(fromIso)} && entry_date <= ${pbQuote(toIso)}`,
    sort: 'entry_date,created',
    expand: 'order'
  })
}

/** Số dư đầu kỳ: mọi bút toán trước ngày bắt đầu kỳ. */
export async function listOpeningLines(from: string) {
  const fromIso = new Date(`${from}T00:00:00`).toISOString()
  return pbListAll<PbRecord>(JOURNAL_COLLECTION, {
    filter: `entry_date < ${pbQuote(fromIso)}`,
    fields: 'account,debit,credit'
  })
}

export function sumByAccount(lines: PbRecord[]) {
  const totals = new Map<string, { debit: number; credit: number }>()
  for (const line of lines) {
    const account = String(line.account ?? '')
    if (!account) continue
    const current = totals.get(account) ?? { debit: 0, credit: 0 }
    current.debit += num(line.debit)
    current.credit += num(line.credit)
    totals.set(account, current)
  }
  return totals
}
