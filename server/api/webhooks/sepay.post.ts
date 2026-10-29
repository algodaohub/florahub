import { createHmac, timingSafeEqual } from 'node:crypto'
import { pbCreate, pbFirst, pbQuote, pbUpdate, type PbRecord } from '~~/server/utils/pocketbase'
import { readPaymentSettings } from '~~/server/utils/payment-settings'

/**
 * Webhook SePay: tự đánh dấu đơn đã thanh toán khi có tiền vào.
 *
 * Secrets lấy từ collection `payment_settings` (cấu hình tại /admin/payments), chọn 1 trong 2:
 *   sepay_webhook_secret  — xác thực HMAC-SHA256 (khuyến nghị)
 *   sepay_webhook_api_key — xác thực header `Authorization: Apikey <key>`
 *
 * URL khai báo trên https://my.sepay.vn/webhooks: https://<domain>/api/webhooks/sepay
 */
const MAX_SKEW_SECONDS = 300

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function reject(event: any, status: number, message: string) {
  setResponseStatus(event, status)
  return { success: false, message }
}

type SepayPayload = {
  id?: number | string
  transferType?: string
  transferAmount?: number | string
  content?: string
  code?: string
  accountNumber?: string
  gateway?: string
}

function parsePayload(raw: string, contentType: string): SepayPayload | null {
  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return Object.fromEntries(new URLSearchParams(raw)) as SepayPayload
    }
    return JSON.parse(raw) as SepayPayload
  } catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  const raw = (await readRawBody(event, 'utf8')) ?? ''
  const settings = await readPaymentSettings()
  const secret = settings.webhookSecret
  const apiKey = settings.webhookApiKey

  if (!secret && !apiKey) {
    return reject(event, 503, 'Chưa cấu hình webhook SePay trong /admin/payments')
  }

  if (secret) {
    const signature = String(getRequestHeader(event, 'x-sepay-signature') ?? '')
    const timestamp = Number(getRequestHeader(event, 'x-sepay-timestamp') ?? 0)
    if (!timestamp || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > MAX_SKEW_SECONDS) {
      return reject(event, 401, 'Timestamp không hợp lệ hoặc quá cũ')
    }
    const expected = `sha256=${createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex')}`
    if (!safeEqual(expected, signature)) return reject(event, 401, 'Sai chữ ký')
  } else {
    const auth = String(getRequestHeader(event, 'authorization') ?? '')
    const token = auth.startsWith('Apikey ') ? auth.slice(7).trim() : ''
    if (!token || !safeEqual(apiKey, token)) return reject(event, 401, 'Sai API key')
  }

  const payload = parsePayload(raw, String(getRequestHeader(event, 'content-type') ?? ''))
  if (!payload) return reject(event, 400, 'Body không đọc được')

  // Chỉ xử lý tiền vào; tiền ra/hoàn tiền để shop xử lý tay.
  if (payload.transferType !== 'in') return { success: true }

  const transactionId = String(payload.id ?? '').trim()
  if (!transactionId) return { success: true }

  const duplicated = await pbFirst<PbRecord>('orders', {
    filter: `sepay_transaction_id = ${pbQuote(transactionId)}`
  })
  if (duplicated) return { success: true }

  const duplicatedTopup = await pbFirst<PbRecord>('wallet_transactions', {
    filter: `sepay_transaction_id = ${pbQuote(transactionId)}`
  })
  if (duplicatedTopup) return { success: true }

  // Nội dung chuyển khoản: NAPXXXXXX (nạp ví) hoặc ORD-XXXXXX (đơn hàng).
  const content = `${payload.content ?? ''} ${payload.code ?? ''}`.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const amount = Math.round(Number(payload.transferAmount ?? 0))

  const topupMatch = content.match(/NAP([A-Z0-9]{6})/)
  if (topupMatch) {
    const code = `NAP${topupMatch[1]}`
    const topup = await pbFirst<PbRecord>('wallet_transactions', {
      filter: `code = ${pbQuote(code)} && status = "pending"`
    })
    if (!topup) {
      console.info('[sepay] không tìm thấy yêu cầu nạp ví', code)
      return { success: true }
    }
    if (amount < Number(topup.amount ?? 0)) {
      console.warn('[sepay] nạp ví thiếu tiền', { code, amount, expected: topup.amount })
      return { success: true }
    }

    const userId = String(topup.user ?? '')
    let wallet = await pbFirst<PbRecord>('wallets', { filter: `user = ${pbQuote(userId)}` })
    if (!wallet) {
      wallet = await pbCreate<PbRecord>('wallets', { user: userId, balance: 0 })
    }

    await pbUpdate('wallets', wallet.id, { balance: Number(wallet.balance ?? 0) + amount })
    await pbUpdate('wallet_transactions', topup.id, {
      status: 'paid',
      sepay_transaction_id: transactionId,
      paid_at: new Date().toISOString()
    })

    console.info('[sepay] đã nạp ví', { user: userId, code, amount, transactionId })
    return { success: true }
  }

  const match = content.match(/ORD([A-Z0-9]{6})/)
  if (!match) {
    console.info('[sepay] bỏ qua giao dịch không có mã đơn', transactionId)
    return { success: true }
  }

  // Ưu tiên id đầy đủ (15 ký tự) nếu nội dung chứa invoice ORD-<id>-<suffix>; nếu không khớp thì lùi về 6 ký tự cuối.
  const fullId = content.match(/ORD([A-Z0-9]{15})/)?.[1]?.toLowerCase() ?? ''
  const suffix = match[1].toLowerCase()
  let found = fullId ? await pbFirst<PbRecord>('orders', { filter: `id = ${pbQuote(fullId)}` }) : null
  let usedSuffix = false
  if (!found) {
    found = await pbFirst<PbRecord>('orders', { filter: `id ~ ${pbQuote(suffix)}` })
    usedSuffix = true
  }
  if (!found || (usedSuffix && !String(found.id).toLowerCase().endsWith(suffix))) {
    console.info('[sepay] không tìm thấy đơn cho mã', fullId || suffix)
    return { success: true }
  }

  if (String(found.payment_status) === 'paid') return { success: true }

  const total = Math.round(Number(found.total ?? 0))
  if (amount < total) {
    console.warn('[sepay] chuyển thiếu tiền', { order: found.id, amount, total })
    return { success: true }
  }

  await pbUpdate('orders', found.id, {
    payment_status: 'paid',
    sepay_transaction_id: transactionId,
    paid_at: new Date().toISOString()
  })

  console.info('[sepay] đã xác nhận thanh toán', { order: found.id, amount, transactionId })
  return { success: true }
})
