import { defineTask } from 'nitropack/runtime'
import { reconcileAffiliatePayouts } from '~~/server/utils/affiliate-payout'

export default defineTask({
  meta: {
    name: 'affiliate:monthly-reconcile',
    description: 'Đối soát hoa hồng hàng tháng, duyệt khoản đến hạn và lập phiếu chi nháp khi đủ hạn mức.'
  },
  async run() {
    const result = await reconcileAffiliatePayouts()
    return { result }
  }
})
