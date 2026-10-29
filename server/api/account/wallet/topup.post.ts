import { createRecord, listRecords, pbFirst, pbQuote, requirePbUser, type PbRecord } from '~~/server/utils/pocketbase'
import { toWallet, type WalletRecord } from '~~/server/utils/account'
import { getStoreConfig } from '~~/server/utils/store'
import { buildVietQrUrl, isQrPaymentReady } from '~~/utils/payments'

function generateTopupCode() {
  return `NAP${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0')}`
}

/**
 * Tạo yêu cầu nạp ví ở trạng thái chờ. Tiền chỉ vào ví khi webhook SePay
 * nhận đúng nội dung `NAPXXXXXX` và đủ số tiền.
 */
export default defineEventHandler(async (event) => {
  const { token, record } = await requirePbUser(event)
  const body = await readBody<{ amount?: number }>(event)
  const amount = Math.round(Number(body?.amount ?? 0))

  if (!Number.isFinite(amount) || amount < 10000 || amount > 50000000) {
    throw createError({ statusCode: 400, statusMessage: 'Số tiền nạp từ 10.000₫ đến 50.000.000₫' })
  }

  const { config } = await getStoreConfig(event)
  if (!isQrPaymentReady(config.payments)) {
    throw createError({ statusCode: 400, statusMessage: 'Cửa hàng chưa cấu hình tài khoản nhận chuyển khoản QR' })
  }

  const wallets = await listRecords<WalletRecord>('wallets', token, `user = "${record.id}"`, 1)
  if (!wallets.items[0]) {
    await createRecord<WalletRecord>('wallets', token, { user: record.id, balance: 0 })
  }

  let code = generateTopupCode()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const taken = await pbFirst<PbRecord>('wallet_transactions', { filter: `code = ${pbQuote(code)}`, fields: 'id' })
    if (!taken) break
    code = generateTopupCode()
  }

  const transaction = await createRecord<PbRecord>('wallet_transactions', token, {
    user: record.id,
    amount,
    type: 'topup',
    status: 'pending',
    code,
    note: `Nạp ví ${code}`
  })

  const qr = config.payments.qr
  return {
    topup: {
      id: transaction.id,
      code,
      amount,
      payment: {
        method: 'qr',
        bankName: qr.bankName || qr.bankId,
        bankId: qr.bankId,
        accountNo: qr.accountNo,
        accountName: qr.accountName,
        qrUrl: buildVietQrUrl(config.payments, { amount, addInfo: code }),
        instructions: `Chuyển khoản ${amount}₫ tới ${qr.bankName || qr.bankId} · ${qr.accountNo}. Nội dung: ${code}.`
      }
    }
  }
})
