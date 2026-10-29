<script setup lang="ts">
import type { OrderDetail } from '~/types'

const route = useRoute()
const id = computed(() => String(route.params.id ?? ''))
const { data: order, pending, error } = await useFetch<OrderDetail>(
  () => `/api/account/orders/${id.value}`,
  { lazy: !import.meta.server }
)

useHead(() => ({ title: order.value ? `Đơn ${formatOrderCode(order.value.id)}` : 'Chi tiết đơn hàng' }))
</script>

<template>
  <div class="container-page py-4">
    <AccountHeader title="Chi tiết đơn hàng" back-to="/account/orders" />

    <SkeletonOrderDetail v-if="pending" />

    <div v-else-if="error || !order" class="mt-4">
      <EmptyState
        title="Không tìm thấy đơn hàng"
        description="Đơn hàng không tồn tại hoặc không thuộc tài khoản này."
        action-label="Về danh sách đơn"
        action-to="/account/orders"
      />
    </div>

    <OrderDetailView v-else :order="order" />
  </div>
</template>
