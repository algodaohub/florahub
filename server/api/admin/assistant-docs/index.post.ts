import { pbCreate, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { toBool, toNumber, toText } from '~~/server/utils/admin-data'
import { toAdminDoc } from '~~/server/utils/assistant-docs'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { adminOnly: true })

  const body = await readBody<Record<string, unknown>>(event)
  const title = toText(body?.title, 200)
  const content = toText(body?.content, 20000)
  if (!title) throw createError({ statusCode: 400, statusMessage: 'Nhập tiêu đề tài liệu' })
  if (!content) throw createError({ statusCode: 400, statusMessage: 'Nhập nội dung tài liệu' })

  const created = await pbCreate<PbRecord>('assistant_docs', {
    title,
    content,
    tags: toText(body?.tags, 300),
    is_active: body?.isActive === undefined ? true : toBool(body.isActive),
    sort_order: toNumber(body?.sortOrder, 0),
    updated_at: new Date().toISOString()
  })

  return { doc: toAdminDoc(created) }
})
