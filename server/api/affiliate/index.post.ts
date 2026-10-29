import { requirePbUser, pbCreate, pbFirst, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { findAffiliateByUser, generateAffiliateCode } from '~~/server/utils/affiliate'
import { getSiteSettings } from '~~/server/utils/store'

export default defineEventHandler(async (event) => {
  const { record, user } = await requirePbUser(event)
  const existing = await findAffiliateByUser(record.id)
  const origin = getRequestURL(event).origin

  if (existing) {
    return {
      affiliate: {
        id: existing.id,
        code: existing.code,
        commissionRate: Number(existing.commission_rate ?? 0),
        status: existing.status,
        createdAt: existing.created_at || existing.created,
        link: `${origin}/?ref=${existing.code}`
      }
    }
  }

  const settings = await getSiteSettings(event)
  let code = generateAffiliateCode(user.displayName)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const taken = await pbFirst<PbRecord>('affiliates', { filter: `code = ${pbQuote(code)}`, fields: 'id' })
    if (!taken) break
    code = generateAffiliateCode(user.displayName)
  }

  const affiliate = await pbCreate('affiliates', {
    user: record.id,
    code,
    commission_rate: settings.affiliateCommissionRate,
    status: 'active',
    created_at: new Date().toISOString()
  })

  return {
    affiliate: {
      id: affiliate.id,
      code: affiliate.code,
      commissionRate: Number(affiliate.commission_rate ?? 0),
      status: affiliate.status,
      createdAt: affiliate.created_at || affiliate.created,
      link: `${origin}/?ref=${affiliate.code}`
    }
  }
})
