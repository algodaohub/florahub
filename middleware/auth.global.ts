export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/account')) return

  const { user, ready, refresh } = useAuth()
  if (!ready.value) await refresh()

  if (!user.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
