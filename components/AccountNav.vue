<script setup lang="ts">
const route = useRoute()

const items = [
  { label: 'Tổng quan', to: '/account', icon: 'home' },
  { label: 'Đơn hàng', to: '/account/orders', icon: 'box' },
  { label: 'Địa chỉ', to: '/account/addresses', icon: 'pin' },
  { label: 'Ví', to: '/account/wallet', icon: 'wallet' },
  { label: 'Thông báo', to: '/account/notifications', icon: 'bell' },
  { label: 'Hồ sơ', to: '/account/profile', icon: 'user' }
]

function active(to: string) {
  if (to === '/account') return route.path === '/account'
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <nav class="no-scrollbar flex gap-2 overflow-x-auto py-2" aria-label="Tài khoản">
    <NuxtLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 t-meta font-semibold transition"
      :class="active(item.to) ? 'border-primary bg-primary text-white' : 'border-hairline bg-white/70 text-ink/70'"
    >
      {{ item.label }}
    </NuxtLink>
  </nav>
</template>
