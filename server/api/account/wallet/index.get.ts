import { createRecord, listRecords, requirePbUser } from '~~/server/utils/pocketbase'
import {
  toWallet,
  toWalletTransaction,
  type WalletRecord,
  type WalletTransactionRecord
} from '~~/server/utils/account'

export default defineEventHandler(async (event) => {
  const { token, record } = await requirePbUser(event)

  const wallets = await listRecords<WalletRecord>('wallets', token, `user = "${record.id}"`, 1)
  let wallet = wallets.items[0]
  if (!wallet) {
    wallet = await createRecord<WalletRecord>('wallets', token, {
      user: record.id,
      balance: 0,
      bank_name: '',
      bank_account: '',
      bank_holder: ''
    })
  }

  const transactions = await listRecords<WalletTransactionRecord>(
    'wallet_transactions',
    token,
    `user = "${record.id}"`
  )

  return {
    wallet: toWallet(wallet),
    transactions: transactions.items.map(toWalletTransaction)
  }
})
