import { toPost } from '~~/server/utils/catalog'
import { pbFirst, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Thiếu slug bài viết' })

  const post = await pbFirst<PbRecord>('posts', { filter: `slug = ${pbQuote(slug)}` })
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy bài viết' })

  return toPost(post)
})
