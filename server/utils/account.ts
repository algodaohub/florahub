import { listRecords, updateRecord } from './pocketbase'

export type AddressRecord = {
  id: string
  user: string
  label: string
  recipient: string
  phone: string
  line1: string
  ward?: string
  district?: string
  city: string
  city_code?: string
  district_code?: string
  ward_code?: string
  is_default: boolean
  created: string
  updated: string
}

export type NotificationRecord = {
  id: string
  user: string
  title: string
  body: string
  read: boolean
  created: string
}

export type WalletRecord = {
  id: string
  user: string
  balance: number
  bank_name?: string
  bank_account?: string
  bank_holder?: string
}

export type WalletTransactionRecord = {
  id: string
  user: string
  amount: number
  type: string
  status?: string
  code?: string
  note?: string
  created: string
}

export function toAddress(record: AddressRecord) {
  return {
    id: record.id,
    label: record.label || 'Địa chỉ',
    recipient: record.recipient,
    phone: record.phone,
    line1: record.line1,
    ward: record.ward || '',
    district: record.district || '',
    city: record.city,
    cityCode: record.city_code || '',
    districtCode: record.district_code || '',
    wardCode: record.ward_code || '',
    isDefault: Boolean(record.is_default)
  }
}

export function toNotification(record: NotificationRecord) {
  return {
    id: record.id,
    title: record.title,
    body: record.body,
    read: Boolean(record.read),
    createdAt: record.created
  }
}

export function toWallet(record: WalletRecord | null) {
  if (!record) {
    return { id: null, balance: 0, bankName: '', bankAccount: '', bankHolder: '' }
  }
  return {
    id: record.id,
    balance: Number(record.balance ?? 0),
    bankName: record.bank_name || '',
    bankAccount: record.bank_account || '',
    bankHolder: record.bank_holder || ''
  }
}

export function toWalletTransaction(record: WalletTransactionRecord) {
  return {
    id: record.id,
    amount: Number(record.amount ?? 0),
    type: record.type,
    status: record.status || 'paid',
    code: record.code || '',
    note: record.note || '',
    createdAt: record.created
  }
}

export async function clearDefaultAddress(token: string, userId: string, exceptId?: string) {
  const result = await listRecords<AddressRecord>('addresses', token, `user = "${userId}" && is_default = true`)
  for (const item of result.items) {
    if (item.id === exceptId) continue
    await updateRecord('addresses', item.id, token, { is_default: false })
  }
}
