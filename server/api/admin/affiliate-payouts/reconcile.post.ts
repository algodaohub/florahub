import { requireAdminMutation } from '~~/server/utils/admin'
import { reconcileAffiliatePayouts } from '~~/server/utils/affiliate-payout'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'affiliates', action: 'write' })

  // Chạy thủ công vẫn tôn trọng hạn mức nhưng bỏ qua cờ tự động hàng tháng.
  const result = await reconcileAffiliatePayouts({ event, force: true })
  return { result }
})
