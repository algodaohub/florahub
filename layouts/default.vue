<script setup lang="ts">
import '~/assets/css/fonts.css'
import '~/assets/css/vant.css'

const { site, config } = useSite()
const { cart, ensure } = useCart()
await ensure()

const { user, ready, refresh } = useAuth()
if (!ready.value) await refresh()

// Load on demand: Vant + CSS chỉ tải khi thực sự mở sheet, admin không dính chunk này.
const AddToCartSheet = defineAsyncComponent(() => import('~/components/AddToCartSheet.vue'))

const route = useRoute()
const search = ref('')

watch(
  () => route.query.q,
  (value) => {
    if (typeof value === 'string') search.value = value
  },
  { immediate: true }
)

const count = computed(() => cart.value.count)
const layout = computed(() => config.value.layout)
const shellStyle = computed(() =>
  route.path.startsWith('/studio')
    ? { maxWidth: '1180px' }
    : { maxWidth: `${layout.value.shellWidth}px` }
)

const showHeader = computed(() => {
  if (route.path.startsWith('/account') || route.path.startsWith('/orders')) return false
  if (route.path === '/about' || route.path.startsWith('/studio')) return false
  if (route.path.startsWith('/category') || route.path === '/categories') return false
  if (route.path.startsWith('/product')) return false
  return !['/cart', '/checkout', '/track-order'].includes(route.path)
})

const navMeta = {
  home: { label: 'Trang chủ', icon: 'home', path: '/' },
  categories: { label: 'Danh mục', icon: 'grid', path: '/categories' },
  cart: { label: 'Giỏ hàng', icon: 'bag', path: '/cart' },
  account: { label: 'Tài khoản', icon: 'user', path: '/account' },
  assistant: { label: 'Trợ lý', icon: 'shop', path: '/tro-ly' }
} as const

const navItems = computed(() =>
  layout.value.bottomNav.items.map((key) => {
    const meta = navMeta[key]
    return {
      key,
      label: meta.label,
      icon: meta.icon,
      to: key === 'account' && !user.value ? '/login' : meta.path
    }
  })
)

function submitSearch() {
  const q = search.value.trim()
  navigateTo({ path: '/search', query: q ? { q } : {} })
}

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  if (path === '/account') return route.path.startsWith('/account') || route.path === '/login' || route.path === '/register'
  if (path === '/categories') return route.path === '/categories' || route.path.startsWith('/category/')
  return route.path.startsWith(path)
}
</script>

<template>
  <div class="min-h-[100dvh] bg-paper-deep">
    <div
      class="mx-auto flex min-h-[100dvh] w-full flex-col bg-paper shadow-[0_0_60px_-20px_rgba(43,42,38,0.35)]"
      :data-card="layout.productCardStyle"
      :style="shellStyle"
    >
      <NuxtLink
        v-if="layout.announcement.enabled && layout.announcement.text && route.path !== '/checkout'"
        :to="layout.announcement.href || '/'"
        class="block bg-primary px-3 py-1.5 text-center t-meta font-medium leading-snug text-white"
      >
        {{ layout.announcement.text }}
      </NuxtLink>

      <header v-if="showHeader" class="sticky top-0 z-30 border-b border-hairline bg-paper/95 shadow-[0_10px_22px_-22px_rgba(27,26,22,0.55)] backdrop-blur-md">
        <!-- classic: brand + search + cart -->
        <div v-if="layout.headerStyle === 'classic'" class="flex items-center gap-2.5 px-3.5 py-3">
          <NuxtLink to="/" class="flex min-w-0 shrink-0 items-center gap-1.5" :aria-label="`${site.siteName} — Trang chủ`">
            <img
              v-if="site.logoUrl"
              :src="site.logoUrl"
              :alt="site.siteName"
              width="40"
              height="40"
              decoding="async"
              class="h-10 w-10 shrink-0 rounded-full object-cover"
            />
            <span v-else class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary t-section font-semibold text-white">
              {{ site.siteName.slice(0, 1) }}
            </span>
            <span class="min-w-0">
              <span class="block max-w-[110px] truncate t-page font-bold leading-tight tracking-tight">
                {{ site.siteName }}
              </span>
              <span v-if="layout.showTagline && site.tagline" class="block max-w-[100px] truncate t-micro leading-tight text-muted">
                {{ site.tagline }}
              </span>
            </span>
          </NuxtLink>

          <form class="min-w-0 flex-1" role="search" @submit.prevent="submitSearch">
            <label class="sr-only" for="header-search">Tìm kiếm sản phẩm</label>
            <div class="relative">
              <input
                id="header-search"
                v-model="search"
                type="search"
                class="field h-10 py-2.5 pl-9 t-body"
                placeholder="Tìm sản phẩm..."
                autocomplete="off"
              />
              <svg
                viewBox="0 0 24 24"
                class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" stroke-linecap="round" />
              </svg>
            </div>
          </form>

          <NuxtLink
            v-if="layout.assistantInHeader"
            to="/tro-ly"
            class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink"
            aria-label="Trợ lý mua sắm"
          >
            <AppIcon name="shop" size="h-5 w-5" />
          </NuxtLink>
          <CartButton :count="count" />
        </div>

        <!-- centered: brand centered, search below -->
        <div v-else-if="layout.headerStyle === 'centered'" class="px-3.5 pb-3.5 pt-3">
          <div class="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
            <span aria-hidden="true" />
            <NuxtLink to="/" class="flex min-w-0 flex-col items-center" :aria-label="`${site.siteName} — Trang chủ`">
              <img v-if="site.logoUrl" :src="site.logoUrl" :alt="site.siteName" width="160" height="36" decoding="async" class="h-9 w-auto object-contain" />
              <span class="max-w-[220px] truncate t-page font-bold tracking-tight">
                {{ site.siteName }}
              </span>
              <span v-if="layout.showTagline && site.tagline" class="max-w-[220px] truncate t-micro text-muted">
                {{ site.tagline }}
              </span>
            </NuxtLink>
            <div class="flex items-center justify-end gap-1">
              <NuxtLink
                v-if="layout.assistantInHeader"
                to="/tro-ly"
                class="grid h-10 w-10 place-items-center rounded-full text-ink"
                aria-label="Trợ lý mua sắm"
              >
                <AppIcon name="shop" size="h-5 w-5" />
              </NuxtLink>
              <CartButton :count="count" />
            </div>
          </div>

          <form class="mt-2" role="search" @submit.prevent="submitSearch">
            <label class="sr-only" for="header-search-centered">Tìm kiếm sản phẩm</label>
            <div class="relative">
              <input
                id="header-search-centered"
                v-model="search"
                type="search"
                class="field h-10 py-2.5 pl-9 t-body"
                placeholder="Tìm sản phẩm..."
                autocomplete="off"
              />
              <svg
                viewBox="0 0 24 24"
                class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" stroke-linecap="round" />
              </svg>
            </div>
          </form>
        </div>

        <!-- minimal: brand only -->
        <div v-else class="flex items-center justify-between gap-3 px-3.5 py-3">
          <NuxtLink to="/" class="flex min-w-0 items-center gap-2" :aria-label="`${site.siteName} — Trang chủ`">
            <img v-if="site.logoUrl" :src="site.logoUrl" :alt="site.siteName" width="40" height="40" decoding="async" class="h-10 w-10 rounded-full object-cover" />
            <span class="min-w-0">
              <span class="block truncate t-page font-bold leading-tight">{{ site.siteName }}</span>
              <span v-if="layout.showTagline && site.tagline" class="block truncate t-micro text-muted">{{ site.tagline }}</span>
            </span>
          </NuxtLink>
          <div class="flex items-center gap-1">
            <NuxtLink to="/search" class="grid h-10 w-10 place-items-center rounded-full text-ink" aria-label="Tìm kiếm">
              <AppIcon name="search" size="h-5 w-5" />
            </NuxtLink>
            <NuxtLink v-if="layout.assistantInHeader" to="/tro-ly" class="grid h-10 w-10 place-items-center rounded-full text-ink" aria-label="Trợ lý mua sắm">
              <AppIcon name="shop" size="h-5 w-5" />
            </NuxtLink>
            <CartButton :count="count" />
          </div>
        </div>
      </header>

      <main id="main-content" class="flex-1 pb-28">
        <slot />
      </main>

      <footer
        v-if="layout.footer.enabled && layout.footer.text && route.path !== '/checkout'"
        class="border-t border-hairline/60 px-4 py-5 text-center t-meta leading-relaxed text-muted"
      >
        {{ layout.footer.text }}
      </footer>

      <nav
        v-if="layout.bottomNav.enabled && navItems.length && !route.path.startsWith('/studio') && !route.path.startsWith('/product/') && route.path !== '/checkout'"
        class="fixed inset-x-0 bottom-0 z-40 mx-auto w-full border-t border-hairline bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        :style="shellStyle"
        aria-label="Điều hướng"
      >
        <div class="grid" :style="{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }">
          <NuxtLink
            v-for="item in navItems"
            :key="item.key"
            :to="item.to"
            class="relative flex flex-col items-center gap-1 py-2.5 t-micro font-semibold"
            :class="isActive(item.to) || (item.key === 'account' && user && isActive('/account')) ? 'text-primary' : 'text-muted'"
          >
            <AppIcon :name="item.icon" size="h-5 w-5" />
            {{ item.label }}
            <span
              v-if="item.key === 'cart' && count > 0"
              class="absolute right-3 top-1 grid h-4 min-w-[1rem] place-items-center rounded-full bg-discount px-1 t-micro font-semibold text-white"
            >
              {{ count > 9 ? '9+' : count }}
            </span>
          </NuxtLink>
        </div>
      </nav>

      <AddToCartSheet />
    </div>
  </div>
</template>
