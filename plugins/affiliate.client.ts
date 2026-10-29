export default defineNuxtPlugin(() => {
  const route = useRoute()
  let lastCode = ''

  watch(
    () => route.query.ref,
    (value) => {
      const code = typeof value === 'string' ? value.trim().toUpperCase() : ''
      if (!code || !/^[A-Z0-9]{4,20}$/.test(code) || code === lastCode) return
      lastCode = code

      document.cookie = `affiliate_ref=${encodeURIComponent(code)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`

      $fetch('/api/affiliate/click', {
        method: 'POST',
        body: {
          code,
          path: route.fullPath,
          referrer: document.referrer || undefined
        }
      }).catch(() => {})
    },
    { immediate: true }
  )
})
