import { AFFILIATE_COOKIE, findAffiliateByCode, readAffiliateAttributionDays } from '~~/server/utils/affiliate'
import { pbCreate } from '~~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ code?: string; path?: string; referrer?: string }>(event)
  const code = String(body?.code ?? '').trim().toUpperCase()
  if (!code) return { ok: false }

  const affiliate = await findAffiliateByCode(code)
  if (!affiliate || affiliate.status !== 'active') return { ok: false }

  await pbCreate('affiliate_clicks', {
    affiliate: affiliate.id,
    path: String(body?.path ?? '/').slice(0, 500),
    ...(body?.referrer ? { referrer: String(body.referrer).slice(0, 500) } : {}),
    created_at: new Date().toISOString()
  })

  const attributionDays = await readAffiliateAttributionDays(event)
  setCookie(event, AFFILIATE_COOKIE, affiliate.code, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * attributionDays
  })

  return { ok: true }
})
