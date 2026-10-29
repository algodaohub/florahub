import { pbListAll, pbListPage, pbQuote } from '~~/server/utils/pocketbase'
import { requireAdmin } from '~~/server/utils/admin'
import {
  listJournalLines,
  listOpeningLines,
  readAccountingSettings,
  sumByAccount
} from '~~/server/utils/accounting'
import { getStoreConfig } from '~~/server/utils/store'
import { ACCOUNT_NAMES, accountName } from '~~/utils/accounting'

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function dateInput(value: unknown, fallback: string) {
  const text = String(value ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback
}

function monthStart() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
}

function today() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function dayKey(value: unknown) {
  const date = new Date(String(value ?? '').replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Sổ kế toán: tổng hợp tài khoản, nhật ký, sổ hoá đơn theo kỳ. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event, { resource: 'orders', action: 'read' })

  const query = getQuery(event)
  const from = dateInput(query.from, monthStart())
  const to = dateInput(query.to, today())
  if (from > to) throw createError({ statusCode: 400, statusMessage: 'Khoảng ngày không hợp lệ' })

  const fromIso = new Date(`${from}T00:00:00`).toISOString()
  const toIso = new Date(`${to}T23:59:59.999`).toISOString()

  const [lines, openingLines, invoices, completedCount, settings, store] = await Promise.all([
    listJournalLines(from, to),
    listOpeningLines(from),
    pbListAll('orders', {
      filter: `tax_invoice_status != "" && tax_invoice_issued_at >= ${pbQuote(fromIso)} && tax_invoice_issued_at <= ${pbQuote(toIso)}`,
      sort: 'tax_invoice_number',
      fields:
        'id,email,shipping_name,total,tax_total,tax_rate,tax_invoice_number,tax_invoice_issued_at,tax_invoice_status,tax_invoice_cancelled_reason,payment_method,payment_status,completed_at'
    }),
    pbListPage('orders', {
      filter: `status = "completed" && completed_at >= ${pbQuote(fromIso)} && completed_at <= ${pbQuote(toIso)}`,
      perPage: 1,
      fields: 'id'
    }),
    readAccountingSettings(),
    getStoreConfig(event)
  ])

  const totals = sumByAccount(lines)
  const openingTotals = sumByAccount(openingLines)
  const debitBalance = (account: string) => {
    const row = totals.get(account)
    return row ? row.debit - row.credit : 0
  }
  // Doanh thu & thuế là doanh số phát sinh của kỳ (bút toán bán hàng); hoàn tiền theo dõi riêng ở 5212.
  const saleTurnover = (account: string) =>
    lines.reduce(
      (sum, line) =>
        line.ref_type === 'sale' && String(line.account ?? '') === account ? sum + Number(line.credit ?? 0) : sum,
      0
    )

  const netRevenue = saleTurnover('511')
  const vatOutput = saleTurnover('3331')

  // Số dư đầu/cuối kỳ theo từng tài khoản (dư Nợ hoặc dư Có).
  const knownOrder = Object.keys(ACCOUNT_NAMES)
  const accountCodes = [...new Set([...openingTotals.keys(), ...totals.keys()])].sort((a, b) => {
    const ia = knownOrder.indexOf(a)
    const ib = knownOrder.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
  const accounts = accountCodes
    .map((account) => {
      const opening = openingTotals.get(account) ?? { debit: 0, credit: 0 }
      const period = totals.get(account) ?? { debit: 0, credit: 0 }
      const openingNet = opening.debit - opening.credit
      const closingNet = openingNet + period.debit - period.credit
      return {
        account,
        name: accountName(account),
        openingDebit: Math.max(0, openingNet),
        openingCredit: Math.max(0, -openingNet),
        periodDebit: period.debit,
        periodCredit: period.credit,
        closingDebit: Math.max(0, closingNet),
        closingCredit: Math.max(0, -closingNet)
      }
    })
    .filter(
      (row) =>
        row.openingDebit || row.openingCredit || row.periodDebit || row.periodCredit || row.closingDebit || row.closingCredit
    )

  // Tài khoản đối ứng: các dòng cùng chứng từ (đơn + loại bút toán), lấy phía ngược lại.
  const groups = new Map<string, typeof lines>()
  for (const line of lines) {
    const key = `${String(line.order ?? '')}::${String(line.ref_type ?? '')}`
    const bucket = groups.get(key) ?? []
    bucket.push(line)
    groups.set(key, bucket)
  }
  const counterOf = (line: (typeof lines)[number]) => {
    const group = groups.get(`${String(line.order ?? '')}::${String(line.ref_type ?? '')}`) ?? []
    const debit = Number(line.debit ?? 0)
    const credit = Number(line.credit ?? 0)
    const opposite = group.filter(
      (item) => item.id !== line.id && (debit > 0 ? Number(item.credit ?? 0) > 0 : Number(item.debit ?? 0) > 0)
    )
    const merged = new Map<string, number>()
    for (const item of opposite) {
      const account = String(item.account ?? '')
      if (!account) continue
      merged.set(account, (merged.get(account) ?? 0) + Number(item.credit ?? 0) + Number(item.debit ?? 0))
    }
    return [...merged.entries()].map(([account, amount]) => ({ account, name: accountName(account), amount }))
  }

  const daily = new Map<string, { net: number; vat: number }>()
  for (const line of lines) {
    if (line.ref_type !== 'sale') continue
    const key = dayKey(line.entry_date)
    if (!key) continue
    const bucket = daily.get(key) ?? { net: 0, vat: 0 }
    const account = String(line.account ?? '')
    if (account === '511') bucket.net += Number(line.credit ?? 0)
    if (account === '3331') bucket.vat += Number(line.credit ?? 0)
    daily.set(key, bucket)
  }

  return {
    range: { from, to },
    vatRate: Number(store.config.features.taxRate ?? 0),
    settings,
    summary: {
      ordersCompleted: completedCount.totalItems,
      grossSales: netRevenue + vatOutput,
      netRevenue,
      vatOutput,
      cash: debitBalance('111'),
      bank: debitBalance('112'),
      receivable: debitBalance('131'),
      returns: debitBalance('5212'),
      invoicesIssued: invoices.length,
      invoicesCancelled: invoices.filter((item) => item.tax_invoice_status === 'cancelled').length
    },
    daily: [...daily.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, net: value.net, vat: value.vat, gross: value.net + value.vat })),
    accounts,
    entries: lines.map((line) => {
      const order = (line.expand as Record<string, any> | undefined)?.order ?? null
      return {
        id: line.id,
        date: line.entry_date,
        refType: line.ref_type,
        account: line.account,
        accountName: line.account_name,
        description: line.description,
        debit: Number(line.debit ?? 0),
        credit: Number(line.credit ?? 0),
        invoiceNumber: line.invoice_number || '',
        orderId: String(line.order ?? ''),
        orderCode: line.order ? `#${String(line.order).slice(-6).toUpperCase()}` : '',
        customer: order?.shipping_name || order?.email || '',
        counterAccounts: counterOf(line)
      }
    }),
    invoices: invoices.map((order) => ({
      id: order.id,
      number: order.tax_invoice_number,
      issuedAt: order.tax_invoice_issued_at,
      status: order.tax_invoice_status,
      cancelledReason: order.tax_invoice_cancelled_reason || '',
      customer: order.shipping_name || order.email,
      email: order.email,
      total: Number(order.total ?? 0),
      taxTotal: Number(order.tax_total ?? 0),
      taxRate: Number(order.tax_rate ?? 0),
      net: Number(order.total ?? 0) - Number(order.tax_total ?? 0),
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status
    }))
  }
})
