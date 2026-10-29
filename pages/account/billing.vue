<script setup lang="ts">
import type { AccountOrderSummary } from '~/types'

const { data } = await useFetch<{ orders: AccountOrderSummary[]; total: number }>('/api/account/orders', {
  query: { limit: 50 },
  key: 'account-billing'
})

const paidTotal = computed(() =>
  (data.value?.orders ?? [])
    .filter((order) => ['confirmed', 'shipping', 'completed'].includes(order.status))
    .reduce((sum, order) => sum + order.total, 0)
)

const statusLabel: Record<string, string> = {
  pending: 'Chờ thanh toán',
  confirmed: 'Đã thanh toán',
  shipping: 'Đang giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ'
}

useHead({ title: 'Hoá đơn & thanh toán' })
</script>

<template>
  <div class="container-page py-4">
    <AccountHeader title="Hoá đơn & thanh toán" back-to="/account" />

    <div class="mt-3">
      <h1 class="t-page font-semibold">Hoá đơn & thanh toán</h1>
      <p class="mt-0.5 t-meta text-muted">Tổng hợp hoá đơn từ các đơn hàng của bạn.</p>
    </div>

    <section class="mt-3 grid grid-cols-2 gap-2">
      <div class="rounded-xl2 border border-hairline/70 bg-white/70 p-4">
        <p class="t-micro text-muted">Đã thanh toán</p>
        <p class="mt-1 t-page font-semibold text-primary">{{ formatVnd(paidTotal) }}</p>
      </div>
      <div class="rounded-xl2 border border-hairline/70 bg-white/70 p-4">
        <p class="t-micro text-muted">Số hoá đơn</p>
        <p class="mt-1 t-page font-semibold">{{ data?.total ?? 0 }}</p>
      </div>
    </section>

    <div v-if="data?.orders.length" class="mt-4 space-y-2">
      <NuxtLink
        v-for="order in data.orders"
        :key="order.id"
        :to="`/account/orders/${order.id}`"
        class="flex items-center gap-3 rounded-xl2 border border-hairline/70 bg-white/70 p-3.5"
      >
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
            <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" stroke-linejoin="round" />
            <path d="M9 8h6M9 12h6" stroke-linecap="round" />
          </svg>
        </span>
        <div class="min-w-0 flex-1">
          <p class="t-body font-semibold">{{ formatOrderCode(order.id) }}</p>
          <p class="t-micro text-muted">{{ formatDate(order.createdAt) }} · {{ order.itemCount }} món</p>
        </div>
        <div class="text-right">
          <p class="t-body font-semibold">{{ formatVnd(order.total) }}</p>
          <p class="t-micro text-muted">{{ statusLabel[order.status] ?? order.status }}</p>
        </div>
      </NuxtLink>
    </div>

    <p v-else class="mt-4 rounded-xl2 border border-dashed border-hairline bg-white/50 p-6 text-center t-body text-muted">
      Chưa có hoá đơn nào.
    </p>
  </div>
</template>
