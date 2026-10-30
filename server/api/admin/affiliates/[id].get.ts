import { pbGetRecord, pbListAll, pbQuote, toAuthUser, type PbRecord, type PbUserRecord } from '~~/server/utils/pocketbase'
import { requireAdmin } from '~~/server/utils/admin'
import {
  affiliateProfile,
  readAffiliateAttributionDays,
  readAffiliatePayoutPolicy,
  summarizeCommissions
} from '~~/server/utils/affiliate'
import { approveDueCommissions, readAffiliateHoldDays } from '~~/server/utils/affiliate-commission'
import { payoutTax } from '~~/server/utils/affiliate-payout'
import { getSiteSettings } from '~~/server/utils/store'

export default defineEventHandler(async (event) => {
  await requireAdmin(event, { resource: 'affiliates', action: 'read' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã cộng tác viên' })

  const affiliate = await pbGetRecord<PbRecord>('affiliates', id)
  if (!affiliate) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy cộng tác viên' })

  await approveDueCommissions(`status = "pending" && affiliate = ${pbQuote(id)}`).catch(() => undefined)

  const [user, commissions, settings, holdDays, attributionDays, payoutPolicy] = await Promise.all([
    affiliate.user ? pbGetRecord<PbUserRecord>('users', String(affiliate.user)) : Promise.resolve(null),
    pbListAll<PbRecord>('affiliate_commissions', {
      filter: `affiliate = ${pbQuote(id)}`,
      fields: 'id,amount,status,payout'
    }),
    getSiteSettings(event),
    readAffiliateHoldDays(),
    readAffiliateAttributionDays(event),
    readAffiliatePayoutPolicy(event)
  ])

  const stats = summarizeCommissions(commissions)
  const available = commissions.filter(
    (line) => String(line.status ?? '') === 'approved' && !line.payout
  )
  const availableGross = available.reduce((sum, line) => sum + Math.max(0, Number(line.amount ?? 0)), 0)
  const auth = user ? toAuthUser(user) : null
  const profile = affiliateProfile(affiliate)

  return {
    affiliate: {
      ...profile,
      effectiveRate: profile.customRate ? profile.commissionRate : settings.affiliateCommissionRate
    },
    user: auth
      ? {
          id: auth.id,
          email: auth.email,
          displayName: auth.displayName,
          phone: auth.phone
        }
      : null,
    link: `${getRequestURL(event).origin}/?ref=${profile.code}`,
    stats,
    available: {
      count: available.length,
      gross: availableGross,
      tax: payoutTax(availableGross),
      net: availableGross - payoutTax(availableGross)
    },
    defaults: {
      rate: settings.affiliateCommissionRate,
      holdDays,
      attributionDays,
      payoutThreshold: payoutPolicy.threshold,
      autoReconcile: payoutPolicy.autoReconcile
    }
  }
})
