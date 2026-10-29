<script setup lang="ts">
import type { Wallet } from '~/types'

const { user, logout } = useAuth()
const { config } = useSite()

const { data: walletData } = await useFetch<{ wallet: Wallet }>('/api/account/wallet', {
  key: 'account-wallet-preview'
})

const balance = computed(() => walletData.value?.wallet.balance ?? 0)

const menu = computed(() => [
  { label: 'Đơn hàng của tôi', to: '/account/orders', icon: 'clipboard' },
  { label: 'Thông báo', to: '/account/notifications', icon: 'mail' },
  { label: 'Ví của tôi', to: '/account/wallet', icon: 'wallet' },
  ...(config.value.features.affiliate
    ? [{ label: 'Cộng tác viên', to: '/account/affiliate', icon: 'gift' }]
    : []),
  { label: 'Thông tin cá nhân', to: '/account/profile', icon: 'user' },
  { label: 'Địa chỉ giao hàng', to: '/account/addresses', icon: 'pin' },
  { label: 'Thông tin xuất hóa đơn', to: '/account/billing', icon: 'receipt' }
])

const support = [
  { label: 'Tin tức & Hướng dẫn', to: '/posts', icon: 'news' },
  { label: 'Về chúng tôi', to: '/about', icon: 'info' }
]

async function signOut() {
  await logout()
  await navigateTo('/')
}

useHead({ title: 'Tài khoản' })
</script>

<template>
  <div>
    <PageHeader title="Tài khoản" />

    <div class="px-3">
      <section class="flex items-center gap-3 border-b border-hairline/60 py-4">
        <AppIcon name="shop" size="h-[22px] w-[22px]" class="shrink-0 text-ink/80" />
        <div class="min-w-0">
          <p class="truncate t-body font-semibold leading-tight">{{ user?.displayName || 'Khách' }}</p>
          <p class="t-meta text-muted mt-0.5 truncate">{{ user?.email }}</p>
        </div>
      </section>

      <section
        class="mt-4 flex items-center justify-between gap-3 rounded-[20px] border border-hairline/70 bg-white/55 px-4 py-3.5"
      >
        <div class="min-w-0">
          <p class="t-body text-muted">Số dư</p>
          <NuxtLink
            to="/account/wallet"
            class="mt-1.5 inline-block t-display font-semibold leading-none underline decoration-1 underline-offset-4"
          >
            {{ formatVnd(balance) }}
          </NuxtLink>
        </div>
        <NuxtLink
          to="/account/wallet"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 t-body font-semibold text-white shadow-soft active:scale-[0.98]"
        >
          <span class="grid h-[18px] w-[18px] place-items-center rounded-full border border-white/70 t-micro leading-none">¥</span>
          Nạp tiền
        </NuxtLink>
      </section>

      <section class="mt-6">
        <h2 class="t-section mb-2.5 ml-1">Quản lý tài khoản</h2>
        <nav class="overflow-hidden rounded-[18px] border border-hairline/70 bg-white/55" aria-label="Quản lý tài khoản">
          <NuxtLink
            v-for="(item, index) in menu"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3.5 px-4 py-3.5"
            :class="index > 0 ? 'border-t border-hairline/50' : ''"
          >
            <AppIcon :name="item.icon" size="h-[19px] w-[19px]" class="shrink-0 text-ink/70" />
            <span class="t-body flex-1 font-medium text-ink">{{ item.label }}</span>
            <AppIcon name="chevron" size="h-4 w-4" class="shrink-0 text-muted/70" />
          </NuxtLink>
        </nav>
      </section>

      <section class="mt-6">
        <h2 class="t-section mb-2.5 ml-1">Hỗ trợ &amp; thông tin</h2>
        <nav class="overflow-hidden rounded-[18px] border border-hairline/70 bg-white/55" aria-label="Hỗ trợ và thông tin">
          <NuxtLink
            v-for="(item, index) in support"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3.5 px-4 py-3.5"
            :class="index > 0 ? 'border-t border-hairline/50' : ''"
          >
            <AppIcon :name="item.icon" size="h-[19px] w-[19px]" class="shrink-0 text-ink/70" />
            <span class="t-body flex-1 font-medium text-ink">{{ item.label }}</span>
            <AppIcon name="chevron" size="h-4 w-4" class="shrink-0 text-muted/70" />
          </NuxtLink>
        </nav>
      </section>

      <button
        type="button"
        class="mt-6 flex w-full items-center justify-center gap-2 rounded-[18px] border border-hairline/70 bg-white/55 py-3.5 t-body font-medium text-discount active:scale-[0.99]"
        @click="signOut"
      >
        <AppIcon name="logout" size="h-[18px] w-[18px]" />
        Đăng xuất
      </button>

      <p class="pb-4 pt-4 text-center t-micro text-muted">Phiên bản ứng dụng 1.0</p>
    </div>
  </div>
</template>
