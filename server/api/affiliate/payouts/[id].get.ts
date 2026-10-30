import { requirePbUser, pbGetRecord, type PbRecord } from '~~/server/utils/pocketbase'
import { findAffiliateByUser } from '~~/server/utils/affiliate'
import { buildAffiliateStatement } from '~~/server/utils/affiliate-statement'
import { PAYOUT_COLLECTION, payoutSummary } from '~~/server/utils/affiliate-payout'

export default defineEventHandler(async (event) => {
  const { record } = await requirePbUser(event)
  const affiliate = await findAffiliateByUser(record.id)
  if (!affiliate) throw createError({ statusCode: 404, statusMessage: 'Bạn chưa tham gia chương trình cộng tác viên' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã phiếu chi' })

  const payout = await pbGetRecord<PbRecord>(PAYOUT_COLLECTION, id)
  if (!payout || String(payout.affiliate ?? '') !== affiliate.id) {
    throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy phiếu chi' })
  }

  const statement = await buildAffiliateStatement(id)
  if (!statement) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy phiếu chi' })

  return {
    payout: {
      ...payoutSummary(payout),
      note: String(payout.note ?? ''),
      reference: String(payout.reference ?? '')
    },
    statement
  }
})
