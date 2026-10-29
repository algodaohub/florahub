import type { AuthUser } from '~/types'

export function useAuth() {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const ready = useState<boolean>('auth-ready', () => false)
  const pending = useState<boolean>('auth-pending', () => false)
  const requestFetch = useRequestFetch()

  async function refresh(force = false) {
    if (!force && ready.value) return user.value
    pending.value = true
    try {
      const response = await requestFetch<{ user: AuthUser }>('/api/auth/me')
      user.value = response.user
      return response.user
    } catch {
      user.value = null
      return null
    } finally {
      ready.value = true
      pending.value = false
    }
  }

  async function login(email: string, password: string) {
    const response = await $fetch<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    })
    user.value = response.user
    ready.value = true
    return response.user
  }

  async function register(input: {
    email: string
    password: string
    confirmPassword: string
    firstName: string
    lastName: string
    phone: string
  }) {
    const response = await $fetch<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: input
    })
    user.value = response.user
    ready.value = true
    return response.user
  }

  async function updateProfile(input: { firstName: string; lastName: string; phone: string }) {
    const response = await $fetch<{ user: AuthUser }>('/api/auth/profile', {
      method: 'PATCH',
      body: input
    })
    user.value = response.user
    return response.user
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    ready.value = true
  }

  const isLoggedIn = computed(() => Boolean(user.value))

  return { user, ready, pending, isLoggedIn, refresh, login, register, updateProfile, logout }
}
