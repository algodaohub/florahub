<script setup lang="ts">
const route = useRoute()
const { user, role, ready, refresh, logout } = useAdmin()
if (!ready.value) await refresh()

const menuOpen = ref(false)
const nav = [
  {
    key: 'orders',
    label: 'Đơn hàng',
    to: '/admin/orders',
    path: 'M4 7h16M4 12h16M4 17h10',
    match: /^\/admin\/orders/
  },
  {
    key: 'products',
    label: 'Sản phẩm',
    to: '/admin/products',
    path: 'M4 8l8-4 8 4-8 4-8-4Zm0 0v8l8 4 8-4V8',
    match: /^\/admin\/products/
  },
  {
    key: 'categories',
    label: 'Danh mục',
    to: '/admin/categories',
    path: 'M4 7h6l2 2h8v10H4V7Z',
    match: /^\/admin\/categories/
  },
  {
    key: 'storefront',
    label: 'Cửa hàng',
    to: '/admin/storefront',
    path: 'M4 9h16M6 9v10h12V9M9 9V6a3 3 0 0 1 6 0v3',
    match: /^\/admin\/storefront/
  },
  {
    key: 'payments',
    label: 'Thanh toán',
    to: '/admin/payments',
    path: 'M3 8h18v10H3V8Zm0 4h18M7 15h4',
    match: /^\/admin\/payments/
  },
  {
    key: 'shipping',
    label: 'Vận chuyển',
    to: '/admin/shipping',
    path: 'M3 7h11v8H3V7Zm11 3h4l3 3v2h-7v-5ZM6 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm12 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
    match: /^\/admin\/shipping/
  },
  {
    key: 'accounting',
    label: 'Kế toán',
    to: '/admin/accounting',
    path: 'M5 4h14v16H5V4Zm3 5h8M8 13h5M8 17h3',
    match: /^\/admin\/accounting/
  },
  {
    key: 'affiliates',
    label: 'Cộng tác viên',
    to: '/admin/affiliates',
    path: 'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20v-1a5 5 0 0 1 10 0v1M13 20v-1a5 5 0 0 1 10 0v1',
    match: /^\/admin\/affiliate/
  },
  {
    key: 'ai',
    label: 'Mô hình AI',
    to: '/admin/ai',
    path: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z',
    match: /^\/admin\/ai/
  },
  {
    key: 'assistant',
    label: 'Tài liệu trợ lý',
    to: '/admin/assistant',
    path: 'M7 4h10l3 3v13H7V4ZM10 11h7M10 15h7M10 18h4',
    match: /^\/admin\/assistant/
  }
]

const currentTitle = computed(() => String(route.meta.title ?? 'Quản trị'))

useHead({
  titleTemplate: (title) => (title ? `${title} — FloraHub` : 'FloraHub Admin')
})
const currentNav = computed(() => nav.find((item) => item.match.test(route.path)) ?? null)

const roleLabel = computed(() => (role.value === 'admin' ? 'Quản trị viên' : role.value === 'staff' ? 'Nhân viên' : ''))

const clock = ref('')
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  const tick = () => {
    clock.value = new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
    }).format(new Date())
  }
  tick()
  timer = setInterval(tick, 30_000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  }
)

async function signOut() {
  await logout()
  await navigateTo('/admin/login')
}
</script>

<template>
  <div
    class="min-h-dvh w-full bg-slate-100 text-slate-900"
    style="--font-body: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-family: var(--font-body)"
  >
    <!-- Mobile overlay -->
    <div
      v-if="menuOpen"
      class="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
      aria-hidden="true"
      @click="menuOpen = false"
    />

    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0"
      :class="menuOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
        <NuxtLink to="/admin/orders" class="flex min-w-0 items-center gap-2">
          <span class="grid h-8 w-8 place-items-center rounded-lg bg-emerald-700 text-sm font-bold text-white">F</span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-semibold leading-tight">FloraHub</span>
            <span class="block text-[11px] leading-tight text-slate-500">Bảng quản trị</span>
          </span>
        </NuxtLink>
        <button type="button" class="rounded p-1 text-slate-500 lg:hidden" aria-label="Đóng menu" @click="menuOpen = false">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto px-2 py-3" aria-label="Điều hướng quản trị">
        <p class="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Quản lý</p>
        <NuxtLink
          v-for="item in nav"
          :key="item.key"
          :to="item.to"
          class="mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition"
          :class="
            item.match.test(route.path)
              ? 'bg-emerald-50 text-emerald-800'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          "
        >
          <svg viewBox="0 0 24 24" class="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" stroke-width="1.7">
            <path :d="item.path" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ item.label }}
        </NuxtLink>

        <p class="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Liên kết</p>
        <a
          href="/"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <svg viewBox="0 0 24 24" class="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" stroke-width="1.7">
            <path d="M14 5h5v5M19 5l-8 8M9 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Xem cửa hàng
        </a>
      </nav>

      <div class="shrink-0 border-t border-slate-200 p-3">
        <div class="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-2">
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
            {{ (user?.displayName || user?.email || '?').slice(0, 1).toUpperCase() }}
          </span>
          <span class="min-w-0">
            <span class="block truncate text-xs font-semibold">{{ user?.displayName || user?.email }}</span>
            <span class="block truncate text-[11px] text-slate-500">{{ roleLabel }} · {{ user?.email }}</span>
          </span>
        </div>
        <button
          type="button"
          class="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          @click="signOut"
        >
          Đăng xuất
        </button>
      </div>
    </aside>

    <!-- Content -->
    <div class="flex min-h-dvh w-full flex-col lg:pl-64">
      <header class="sticky top-0 z-30 flex h-14 w-full shrink-0 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
        <button
          type="button"
          class="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Mở menu"
          @click="menuOpen = true"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" />
          </svg>
        </button>

        <div class="min-w-0 flex-1">
          <p class="truncate text-[11px] font-medium uppercase tracking-wider text-slate-400">
            FloraHub / {{ currentNav?.label ?? 'Quản trị' }}
          </p>
          <h1 class="truncate text-sm font-semibold leading-tight">{{ currentTitle }}</h1>
        </div>

        <span class="hidden text-xs text-slate-400 sm:block">{{ clock }}</span>
        <NuxtLink
          to="/"
          target="_blank"
          class="hidden rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:block"
        >
          Cửa hàng ↗
        </NuxtLink>
      </header>

      <main class="w-full flex-1 px-4 py-5 sm:px-6 lg:px-8">
        <slot />
      </main>
    </div>
  </div>
</template>
