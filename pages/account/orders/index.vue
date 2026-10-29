<script setup lang="ts">
import type { AccountOrderSummary } from '~/types'

const { data, pending } = await useFetch<{ orders: AccountOrderSummary[]; total: number }>('/api/account/orders', {
  query: { limit: 30 },
  key: 'account-orders',
  lazy: !import.meta.server
})

useHead({ title: 'Đơn hàng của tôi' })
</script>

<template>
  <div class="container-page py-4">
    <AccountHeader title="Đơn hàng của tôi" back-to="/account" />

    <div v-if="pending" class="mt-3">
      <SkeletonOrders />
    </div>

    <div v-else-if="data?.orders.length" class="space-y-2.5">
      <NuxtLink
        v-for="order in data.orders"
        :key="order.id"
        :to="`/account/orders/${order.id}`"
        class="flex items-start gap-2 rounded-[14px] border border-hairline/40 bg-white/55 px-4 py-3.5 shadow-soft"
      >
        <div class="min-w-0 flex-1">
          <p class="truncate t-body font-medium">Đơn {{ formatOrderCode(order.id) }}</p>
          <p class="mt-1.5 t-body text-muted">{{ formatDateTimeNumeric(order.createdAt) }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-1.5 pt-0.5">
          <span class="t-body font-medium">{{ formatVnd(order.total) }}</span>
          <AppIcon name="chevron" size="h-4 w-4" class="text-muted" />
        </div>
      </NuxtLink>
    </div>

    <div v-else class="mt-6 rounded-[18px] border border-dashed border-hairline bg-white/45 px-6 py-12 text-center">
      <p class="t-section font-semibold">Chưa có đơn hàng nào</p>
      <p class="mt-1 t-body text-muted">Đơn hàng bạn đặt sẽ xuất hiện tại đây.</p>
      <NuxtLink to="/categories" class="btn-primary mt-5 px-6">Xem danh mục</NuxtLink>
    </div>
  </div>
</template>
