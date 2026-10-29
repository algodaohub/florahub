import { requirePbUser } from '~~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  const { user } = await requirePbUser(event)
  return { user }
})
