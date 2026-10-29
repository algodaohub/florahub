import { createRecord, listRecords, requirePbUser, updateRecord } from '~~/server/utils/pocketbase'
import { toWallet, type WalletRecord } from '~~/server/utils/account'

export default defineEventHandler(async (event) => {
  const { token, record } = await requirePbUser(event)
  const body = await readBody<{
    bankName?: string
    bankAccount?: string
    bankHolder?: string
  }>(event)

  const wallets = await listRecords<WalletRecord>('wallets', token, `user = "${record.id}"`, 1)
  let wallet = wallets.items[0]
  const payload = {
    bank_name: String(body?.bankName ?? '').trim(),
    bank_account: String(body?.bankAccount ?? '').trim(),
    bank_holder: String(body?.bankHolder ?? '').trim().toUpperCase()
  }

  if (!wallet) {
    wallet = await createRecord<WalletRecord>('wallets', token, {
      user: record.id,
      balance: 0,
      ...payload
    })
  } else {
    wallet = await updateRecord<WalletRecord>('wallets', wallet.id, token, payload)
  }

  return { wallet: toWallet(wallet) }
})
