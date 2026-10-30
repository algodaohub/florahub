import { requireAdminMutation } from '~~/server/utils/admin'
import { payPayout, payoutSummary } from '~~/server/utils/affiliate-payout'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'affiliates', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã phiếu chi' })

  const body = await readBody<{ method?: string; reference?: string; note?: string }>(event)
  const payout = await payPayout(id, {
    method: body?.method,
    reference: body?.reference,
    note: body?.note
  })

  return { payout: payoutSummary(payout) }
})
