<script setup lang="ts">
import type { OrderDetail } from '~/types'

const route = useRoute()
const id = computed(() => String(route.params.id ?? ''))

const { data: order, pending, error, refresh } = await useFetch<OrderDetail>(
  // check=1: server đối soát giao dịch qua SePay Open API khi đơn còn pending.
  () => `/api/orders/${id.value}?check=1`,
  { lazy: !import.meta.server }
)

useHead(() => ({ title: order.value ? `Đơn ${formatOrderCode(order.value.id)}` : 'Chi tiết đơn hàng' }))

const paymentState = computed(() => String(route.query.payment ?? ''))
const confirming = computed(
  () => paymentState.value === 'success' && Boolean(order.value) && order.value!.paymentStatus !== 'paid'
)

// Cập nhật realtime qua SSE (server cầu nối PocketBase), không reload lại trang.
const realtimeLive = ref(false)
let source: EventSource | null = null
let fallbackTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  source = new EventSource(`/api/orders/${encodeURIComponent(id.value)}/stream`)
  source.addEventListener('order', (event) => {
    try {
      const next = JSON.parse((event as MessageEvent).data) as OrderDetail
      if (next?.id === order.value?.id) order.value = next
    } catch {}
  })
  source.onopen = () => {
    realtimeLive.value = true
  }
  source.onerror = () => {
    realtimeLive.value = false
  }
  // Dự phòng khi SSE bị chặn/mất kết nối: hỏi lại thưa (60s), không reload màn hình.
  fallbackTimer = setInterval(() => {
    const current = order.value
    if (!current || realtimeLive.value) return
    if (current.paymentStatus === 'paid' || current.status === 'cancelled') return
    if (current.paymentMethod === 'qr' || current.paymentMethod === 'sepay') refresh()
  }, 60_000)
})
onBeforeUnmount(() => {
  source?.close()
  if (fallbackTimer) clearInterval(fallbackTimer)
})
</script>

<template>
  <div class="container-page py-4">
    <AccountHeader title="Chi tiết đơn hàng" back-to="/" />

    <SkeletonOrderDetail v-if="pending" />

    <div v-else-if="error || !order" class="mt-4">
      <EmptyState
        title="Không tìm thấy đơn hàng"
        description="Mã đơn không đúng hoặc đơn hàng không còn tồn tại."
        action-label="Về trang chủ"
        action-to="/"
      />
    </div>

    <template v-else>
      <div
        v-if="confirming"
        class="mb-3 rounded-xl border border-primary/25 bg-primary-soft/60 px-3.5 py-3 t-meta text-primary"
      >
        Đang xác nhận thanh toán từ SePay… Trang sẽ tự cập nhật khi cổng thanh toán báo về.
      </div>
      <div
        v-else-if="paymentState === 'success' && order.paymentStatus === 'paid'"
        class="mb-3 rounded-xl border border-primary/25 bg-primary-soft/60 px-3.5 py-3 t-meta text-primary"
      >
        Thanh toán thành công. Cảm ơn bạn!
      </div>
      <div
        v-else-if="(paymentState === 'error' || paymentState === 'cancel') && order.paymentStatus !== 'paid'"
        class="mb-3 rounded-xl border border-hairline bg-white/70 px-3.5 py-3 t-meta text-muted"
      >
        {{ paymentState === 'cancel' ? 'Bạn đã huỷ thanh toán.' : 'Thanh toán chưa hoàn tất.' }}
        Bạn có thể thử lại bằng nút thanh toán bên dưới.
      </div>

      <OrderPaymentCard :order="order" class="mb-5" />
      <OrderDetailView :order="order" />
    </template>
  </div>
</template>
