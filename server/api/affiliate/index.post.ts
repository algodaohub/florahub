import { requirePbUser, pbCreate, pbFirst, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { findAffiliateByUser, generateAffiliateCode } from '~~/server/utils/affiliate'
import { getSiteSettings } from '~~/server/utils/store'

function affiliateResponse(record: PbRecord, defaultRate: number, origin: string) {
  const customRate = record.custom_rate === true
  const storedRate = Number(record.commission_rate ?? 0)
  return {
    id: record.id,
    code: record.code,
    commissionRate: storedRate,
    effectiveRate: customRate ? storedRate : defaultRate,
    customRate,
    status: record.status,
    createdAt: record.created_at || record.created,
    link: `${origin}/?ref=${record.code}`,
    bankName: String(record.bank_name ?? ''),
    bankAccountNo: String(record.bank_account_no ?? ''),
    bankAccountName: String(record.bank_account_name ?? ''),
    taxCode: String(record.tax_code ?? '')
  }
}

export default defineEventHandler(async (event) => {
  const { record, user } = await requirePbUser(event)
  const settings = await getSiteSettings(event)
  const existing = await findAffiliateByUser(record.id)
  const origin = getRequestURL(event).origin

  if (existing) {
    return { affiliate: affiliateResponse(existing, settings.affiliateCommissionRate, origin) }
  }

  let code = generateAffiliateCode(user.displayName)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const taken = await pbFirst<PbRecord>('affiliates', { filter: `code = ${pbQuote(code)}`, fields: 'id' })
    if (!taken) break
    code = generateAffiliateCode(user.displayName)
  }

  const affiliate = await pbCreate<PbRecord>('affiliates', {
    user: record.id,
    code,
    commission_rate: settings.affiliateCommissionRate,
    custom_rate: false,
    status: 'active',
    created_at: new Date().toISOString()
  })

  return { affiliate: affiliateResponse(affiliate, settings.affiliateCommissionRate, origin) }
})
