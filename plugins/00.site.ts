import { STORE_CONFIG_UPDATED_KEY } from '~/utils/store-config'

export default defineNuxtPlugin(async () => {
  // Admin không dùng theme storefront: bỏ qua để không tốn 1 request /api/site.
  if (useRouter().currentRoute.value.path.startsWith('/admin')) return

  const { ready, load } = useSite()
  if (!ready.value) await load()

  // Tab khác vừa lưu theme trong Studio → áp dụng ngay, không cần tải lại trang.
  if (import.meta.client) {
    window.addEventListener('storage', (event) => {
      if (event.key === STORE_CONFIG_UPDATED_KEY) void load(true)
    })
  }
})
