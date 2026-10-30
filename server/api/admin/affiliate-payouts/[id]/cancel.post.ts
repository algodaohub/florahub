import { requireAdminMutation } from '~~/server/utils/admin'
import { cancelPayout, payoutSummary } from '~~/server/utils/affiliate-payout'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'affiliates', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã phiếu chi' })

  const body = await readBody<{ note?: string }>(event)
  const payout = await cancelPayout(id, body?.note ?? '')

  return { payout: payoutSummary(payout) }
})
