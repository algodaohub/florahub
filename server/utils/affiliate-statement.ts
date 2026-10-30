import { pbGetRecord, pbListAll, pbQuote, toAuthUser, type PbRecord, type PbUserRecord } from './pocketbase'
import { readAccountingSettings } from './accounting'
import { getSiteSettings } from './store'
import { AFFILIATE_PIT_RATE, PAYOUT_COLLECTION, COMMISSION_COLLECTION } from './affiliate-payout'
import { amountInWords } from '~/utils/money-words'
import { formatOrderCode } from '~/utils/format'

export type AffiliateStatementLine = {
  commissionId: string
  orderId: string
  orderCode: string
  orderDate: string
  completedAt: string
  goodsTotal: number
  rate: number
  amount: number
}

export type AffiliateStatement = {
  number: string
  status: string
  issuedAt: string
  paidAt: string
  cancelledAt: string
  method: string
  reference: string
  note: string
  periodFrom: string
  periodTo: string
  seller: {
    name: string
    taxCode: string
    address: string
    phone: string
    email: string
    invoiceSymbol: string
    invoiceTemplate: string
  }
  affiliate: {
    name: string
    email: string
    code: string
    taxCode: string
    bankName: string
    bankAccountNo: string
    bankAccountName: string
  }
  lines: AffiliateStatementLine[]
  totals: {
    gross: number
    taxRate: number
    tax: number
    net: number
    count: number
    netInWords: string
  }
}

function text(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toIso(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : ''
}

/** Dữ liệu phiếu chi/đối soát; chỉ đọc, không chứa token hay thông tin đăng nhập. */
export async function buildAffiliateStatement(payoutId: string): Promise<AffiliateStatement | null> {
  const payout = await pbGetRecord<PbRecord>(PAYOUT_COLLECTION, payoutId)
  if (!payout) return null

  const affiliateId = String(payout.affiliate ?? '')
  const [affiliate, settings, site, lines] = await Promise.all([
    affiliateId ? pbGetRecord<PbRecord>('affiliates', affiliateId) : Promise.resolve(null),
    readAccountingSettings(),
    getSiteSettings(),
    pbListAll<PbRecord>(COMMISSION_COLLECTION, {
      filter: `payout = ${pbQuote(payoutId)}`,
      sort: 'created_at',
      expand: 'order'
    })
  ])

  const user = affiliate?.user ? await pbGetRecord<PbUserRecord>('users', String(affiliate.user)) : null
  const auth = user ? toAuthUser(user) : null

  const statementLines: AffiliateStatementLine[] = lines.map((line) => {
    const order = (line.expand?.order ?? null) as PbRecord | null
    const subtotal = num(order?.subtotal)
    const discount = num(order?.discount_total)
    return {
      commissionId: line.id,
      orderId: String(order?.id ?? line.order ?? ''),
      orderCode: order?.id ? formatOrderCode(String(order.id)) : '',
      orderDate: toIso(order?.created_at || order?.created),
      completedAt: toIso(order?.completed_at),
      goodsTotal: Math.max(0, subtotal - discount),
      rate: num(line.rate),
      amount: Math.max(0, num(line.amount))
    }
  })

  const gross = statementLines.length
    ? statementLines.reduce((sum, line) => sum + line.amount, 0)
    : num(payout.gross_total)
  const taxRate = num(payout.tax_rate) || AFFILIATE_PIT_RATE
  const tax = num(payout.tax_total)
  const net = num(payout.net_total)

  return {
    number: text(payout.number, 40),
    status: text(payout.status, 20),
    issuedAt: toIso(payout.created_at || payout.created),
    paidAt: toIso(payout.paid_at),
    cancelledAt: toIso(payout.cancelled_at),
    method: text(payout.method, 40),
    reference: text(payout.reference, 120),
    note: text(payout.note, 500),
    periodFrom: toIso(payout.period_from),
    periodTo: toIso(payout.period_to),
    seller: {
      name: settings.sellerName || site.siteName,
      taxCode: settings.sellerTaxCode,
      address: settings.sellerAddress || site.address,
      phone: site.hotline,
      email: site.email,
      invoiceSymbol: settings.invoiceSymbol,
      invoiceTemplate: settings.invoiceTemplate
    },
    affiliate: {
      name: auth?.displayName || text(affiliate?.code, 40),
      email: auth?.email || '',
      code: text(affiliate?.code, 40),
      taxCode: text(payout.tax_code ?? affiliate?.tax_code, 20),
      bankName: text(payout.bank_name, 120),
      bankAccountNo: text(payout.bank_account_no, 40),
      bankAccountName: text(payout.bank_account_name, 120)
    },
    lines: statementLines,
    totals: {
      gross,
      taxRate,
      tax,
      net,
      count: statementLines.length || num(payout.commission_count),
      netInWords: amountInWords(net)
    }
  }
}
