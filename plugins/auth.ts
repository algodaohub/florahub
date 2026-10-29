export default defineNuxtPlugin(async () => {
  // Admin có phiên riêng (/api/admin/me) — không gọi /api/auth/me của storefront.
  if (useRouter().currentRoute.value.path.startsWith('/admin')) return

  const { ready, refresh } = useAuth()
  if (!ready.value) await refresh()
})
