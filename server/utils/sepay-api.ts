import type { PbRecord } from './pocketbase'
import { pbFirst, pbQuote, pbUpdate } from './pocketbase'
import { syncCommissionAtPayment } from './affiliate-commission'
import {
  readPaymentSettings,
  saveBankAccountsSnapshot,
  type SepayBankAccount
} from './payment-settings'

const MIN_INTERVAL_MS = 350
const MAX_RETRY_WAIT_MS = 5000
const REQUEST_TIMEOUT_MS = 8000
const ACCOUNT_CACHE_TTL = 5 * 60 * 1000
const RECONCILE_THROTTLE_MS = 20_000

let lastRequestAt = 0
let queue: Promise<unknown> = Promise.resolve()
let accountCache: { accounts: SepayBankAccount[]; expiresAt: number } | null = null
const lastReconciled = new Map<string, number>()

type SepayTransaction = {
  id: string
  accountNumber: string
  amountIn: number
  transferType: string
  content: string
  referenceNumber: string
  transactionDate: string
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function call(path: string, query: Record<string, string | number | undefined>) {
  const settings = await readPaymentSettings()
  if (!settings.apiToken) {
    throw createError({ statusCode: 503, statusMessage: 'Chưa cấu hình SePay API token trong /admin/payments' })
  }

  const run = queue.then(async () => {
    const gap = MIN_INTERVAL_MS - (Date.now() - lastRequestAt)
    if (gap > 0) await wait(gap)
    try {
      return await requestWithRetry(settings.apiBaseUrl, settings.apiToken, path, query)
    } finally {
      lastRequestAt = Date.now()
    }
  })
  queue = run.catch(() => undefined)
  return run
}

async function requestWithRetry(
  baseUrl: string,
  token: string,
  path: string,
  query: Record<string, string | number | undefined>,
  retried = false
): Promise<any> {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}${path}`)
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
  }

  let response: Response
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Không kết nối được SePay API' })
  }

  if (response.status === 429 && !retried) {
    const retryAfter = Number(response.headers.get('x-sepay-userapi-retry-after') ?? 1)
    const delay = Math.min(MAX_RETRY_WAIT_MS, Math.max(1, Number.isFinite(retryAfter) ? retryAfter : 1) * 1000)
    await wait(delay)
    return requestWithRetry(baseUrl, token, path, query, true)
  }

  const text = await response.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { message: text }
  }

  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage:
        response.status === 401 || response.status === 403
          ? 'SePay API từ chối token — kiểm tra lại trong /admin/payments'
          : data?.message || `SePay API trả về lỗi ${response.status}`
    })
  }

  return data
}

function pick(item: any, ...keys: string[]) {
  for (const key of keys) {
    const value = item?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return ''
}

// SePay trả `bankaccounts` / `transactions` ở top-level; một số bản mock dùng `data`.
function rowsOf(data: any, key: string): any[] {
  const candidates = [data?.[key], data?.data, data]
  return candidates.find((value) => Array.isArray(value)) ?? []
}

function normalizeAccount(item: any): SepayBankAccount {
  return {
    id: String(pick(item, 'id', 'account_number') ?? ''),
    accountNumber: String(pick(item, 'account_number', 'accountNumber')).trim(),
    accountHolderName: String(pick(item, 'account_holder_name', 'accountHolderName')).trim(),
    bankName: String(pick(item, 'bank_name', 'bankName', 'bank_full_name')).trim(),
    bankShortName: String(pick(item, 'bank_short_name', 'bankShortName', 'bank_code')).trim(),
    active: item?.active !== false && item?.is_active !== false
  }
}

function normalizeTransaction(item: any): SepayTransaction {
  return {
    id: String(pick(item, 'id', 'transaction_id', 'reference_number')),
    accountNumber: String(pick(item, 'account_number', 'accountNumber')).trim(),
    amountIn: Math.round(Number(pick(item, 'amount_in', 'transfer_amount', 'amountIn') ?? 0)),
    transferType: String(pick(item, 'transfer_type', 'transferType')).toLowerCase(),
    content: `${pick(item, 'content', 'transaction_content')} ${pick(item, 'code')}`.trim(),
    referenceNumber: String(pick(item, 'reference_number', 'referenceNumber')),
    transactionDate: String(pick(item, 'transaction_date', 'transactionDate'))
  }
}

/** Danh sách tài khoản ngân hàng đã liên kết; cache 5 phút + lưu snapshot vào DB. */
export async function listBankAccounts(force = false): Promise<SepayBankAccount[]> {
  if (!force && accountCache && accountCache.expiresAt > Date.now()) return accountCache.accounts

  const data = await call('/bankaccounts/list', {})
  const rows = rowsOf(data, 'bankaccounts')
  const accounts = rows.map(normalizeAccount).filter((account) => account.accountNumber)

  accountCache = { accounts, expiresAt: Date.now() + ACCOUNT_CACHE_TTL }
  try {
    await saveBankAccountsSnapshot(accounts, new Date().toISOString())
  } catch (error) {
    console.warn('[sepay-api] không lưu được snapshot tài khoản', error instanceof Error ? error.message : error)
  }
  return accounts
}

function sepayDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`
}

export async function listTransactions(options: {
  accountNumber?: string
  since?: Date
  limit?: number
}): Promise<SepayTransaction[]> {
  const data = await call('/transactions/list', {
    account_number: options.accountNumber,
    transaction_date_min: options.since ? sepayDate(options.since) : undefined,
    limit: Math.min(100, Math.max(1, options.limit ?? 50))
  })
  const rows = rowsOf(data, 'transactions')
  return rows.map(normalizeTransaction).filter((transaction) => transaction.id)
}

function normalized(value: string) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function matchesOrder(order: PbRecord, transaction: SepayTransaction) {
  const content = normalized(transaction.content)
  if (!content) return false
  const orderId = normalized(order.id)
  const suffix = orderId.slice(-6)
  const invoice = normalized(String(order.sepay_invoice_number ?? ''))
  return content.includes(orderId) || content.includes(`ORD${suffix}`) || (invoice.length > 0 && content.includes(invoice))
}

/**
 * Đối soát một đơn pending với giao dịch tiền vào qua SePay Open API.
 * Dùng làm lưới an toàn khi webhook trễ/mất và cho nút "Kiểm tra thanh toán".
 */
export async function reconcileOrder(order: PbRecord, options: { force?: boolean } = {}) {
  const method = String(order.payment_method ?? '')
  if (!['qr', 'sepay'].includes(method)) return { checked: false, paid: false, reason: 'method' }
  if (String(order.payment_status ?? '') !== 'pending') {
    return { checked: false, paid: String(order.payment_status) === 'paid', reason: 'not-pending' }
  }
  if (String(order.status ?? '') === 'cancelled') return { checked: false, paid: false, reason: 'cancelled' }

  const settings = await readPaymentSettings()
  if (!settings.apiToken) return { checked: false, paid: false, reason: 'not-configured' }

  const last = lastReconciled.get(order.id) ?? 0
  if (!options.force && Date.now() - last < RECONCILE_THROTTLE_MS) {
    return { checked: false, paid: false, reason: 'throttled' }
  }
  lastReconciled.set(order.id, Date.now())

  const createdAt = new Date(String(order.created_at || order.created || Date.now()))
  const floor = Number.isFinite(createdAt.getTime()) ? createdAt.getTime() - 24 * 60 * 60 * 1000 : Date.now() - 3 * 86400_000
  const since = new Date(Math.max(floor, Date.now() - 3 * 86400_000))

  let accounts: SepayBankAccount[] = []
  try {
    accounts = await listBankAccounts()
  } catch (error) {
    console.warn('[sepay-api] không lấy được tài khoản ngân hàng', error instanceof Error ? error.message : error)
  }

  const numbers = accounts.map((account) => account.accountNumber).filter(Boolean)
  const targets = numbers.length ? numbers : ['']
  const total = Math.round(Number(order.total ?? 0))

  for (const accountNumber of targets) {
    const transactions = await listTransactions({ accountNumber: accountNumber || undefined, since, limit: 50 })
    for (const transaction of transactions) {
      if (!['in', '', 'credit'].includes(transaction.transferType)) continue
      if (transaction.amountIn < total) continue
      if (!matchesOrder(order, transaction)) continue

      const used = await pbFirst<PbRecord>('orders', {
        filter: `sepay_transaction_id = ${pbQuote(transaction.id)}`
      })
      if (used && String(used.id) !== String(order.id)) continue

      const fresh = await pbFirst<PbRecord>('orders', { filter: `id = ${pbQuote(order.id)}` })
      if (!fresh) return { checked: true, paid: false, reason: 'missing' }
      if (String(fresh.payment_status ?? '') === 'paid') return { checked: true, paid: true, reason: 'already-paid' }

      await pbUpdate('orders', fresh.id, {
        payment_status: 'paid',
        sepay_transaction_id: transaction.id,
        paid_at: new Date().toISOString()
      })
      await syncCommissionAtPayment({ ...fresh, payment_status: 'paid' }).catch(() => undefined)
      console.info('[sepay-api] đã đối soát thanh toán', {
        order: fresh.id,
        transactionId: transaction.id,
        amount: transaction.amountIn
      })
      return { checked: true, paid: true, reason: 'matched' }
    }
  }

  return { checked: true, paid: false, reason: 'no-transaction' }
}
