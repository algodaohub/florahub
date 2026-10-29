import type { AuthUser } from '~/types'

export type AdminRole = 'customer' | 'staff' | 'admin'

export function useAdmin() {
  const user = useState<AuthUser | null>('admin-user', () => null)
  const role = useState<AdminRole>('admin-role', () => 'customer')
  const permissions = useState<string[]>('admin-permissions', () => [])
  const ready = useState<boolean>('admin-ready', () => false)
  const pending = useState<boolean>('admin-pending', () => false)
  const requestFetch = useRequestFetch()

  async function refresh(force = false) {
    if (!force && ready.value) return user.value
    pending.value = true
    try {
      const response = await requestFetch<{ user: AuthUser | null; role: AdminRole; permissions: string[] }>(
        '/api/admin/me'
      )
      user.value = response.user
      role.value = response.role ?? 'customer'
      permissions.value = response.permissions ?? []
      return user.value
    } catch {
      user.value = null
      role.value = 'customer'
      permissions.value = []
      return null
    } finally {
      ready.value = true
      pending.value = false
    }
  }

  async function login(email: string, password: string) {
    const response = await $fetch<{ user: AuthUser; role: AdminRole; permissions: string[] }>('/api/admin/login', {
      method: 'POST',
      body: { email, password }
    })
    user.value = response.user
    role.value = response.role
    permissions.value = response.permissions ?? []
    ready.value = true
    return response.user
  }

  async function logout() {
    try {
      await $fetch('/api/admin/logout', { method: 'POST' })
    } catch {
      // phiên đã hết hạn — vẫn xoá state phía client
    }
    user.value = null
    role.value = 'customer'
    permissions.value = []
    ready.value = true
  }

  const isAdmin = computed(() => role.value === 'admin')
  const canManage = computed(() => role.value === 'admin' || role.value === 'staff')

  function can(resource: string) {
    if (role.value === 'admin') return true
    if (role.value !== 'staff') return false
    if (permissions.value.length === 0) return true
    return permissions.value.includes(resource)
  }

  return { user, role, permissions, ready, pending, isAdmin, canManage, can, refresh, login, logout }
}
