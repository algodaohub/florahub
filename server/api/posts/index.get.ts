import { toPost } from '~~/server/utils/catalog'
import { pbListAll, type PbRecord } from '~~/server/utils/pocketbase'

export default defineEventHandler(async () => {
  const posts = await pbListAll<PbRecord>('posts', { sort: '-published_at' })
  return posts.map(toPost)
})
