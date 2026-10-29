import { getAdminSession, isAdminRole } from '~~/server/utils/admin'
import { toAuthUser } from '~~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  const session = await getAdminSession(event)
  if (!session || !isAdminRole(session.role)) {
    return { user: null, role: 'customer' as const, permissions: [] }
  }

  return {
    user: toAuthUser(session.record),
    role: session.role,
    permissions: session.permissions
  }
})
