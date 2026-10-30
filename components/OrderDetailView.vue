<script setup lang="ts">
import type { OrderDetail } from '~/types'
import { vatRateLabel } from '~/utils/accounting'

const props = defineProps<{ order: OrderDetail }>()

const productsRef = ref<HTMLElement | null>(null)

const steps = [
  { key: 'pending', label: 'Đặt hàng' },
  { key: 'confirmed', label: 'Xác nhận' },
  { key: 'shipping', label: 'Đang giao' },
  { key: 'completed', label: 'Hoàn tất' }
]

const statusLabels: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ'
}

const cancelled = computed(() => props.order.status === 'cancelled')

const currentStep = computed(() => {
  const index = steps.findIndex((step) => step.key === props.order.status)
  return index >= 0 ? index : 0
})

const statusLabel = computed(() => statusLabels[props.order.status] ?? props.order.status)

const paymentStatus = computed(() => {
  if (cancelled.value) return 'Đã huỷ'
  if (props.order.paymentStatus === 'paid' || props.order.status === 'completed') return 'Đã thanh toán'
  if (props.order.paymentMethod === 'cod' || props.order.paymentStatus === 'cod') return 'Thanh toán khi nhận hàng'
  return 'Chờ thanh toán'
})

const paymentMethodLabel = computed(() => {
  if (props.order.paymentMethod === 'qr') return 'VietQR (miễn phí)'
  if (props.order.paymentMethod === 'sepay') return 'Cổng SePay (có phí)'
  return 'Thanh toán khi nhận hàng'
})

const deliveryStatus = computed(() => {
  if (cancelled.value) return 'Đã huỷ'
  if (props.order.status === 'completed') return 'Đã giao'
  if (props.order.status === 'shipping') return 'Đang giao'
  return 'Chưa giao'
})

const region = computed(() => {
  const parts = props.order.shippingAddress
    .split(/\s*[,\n]\s*|\s+[-–]\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 1]! : ''
})

function scrollToProducts() {
  productsRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div>
    <section aria-labelledby="order-info-title">
      <h2 id="order-info-title" class="t-section">Thông tin đơn hàng</h2>

      <dl class="mt-1.5 divide-y divide-hairline/60">
        <div class="flex items-baseline justify-between gap-4 py-3.5">
          <dt class="t-section">Đơn</dt>
          <dd class="text-right t-body text-ink/80">{{ formatOrderCode(order.id) }}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-4 py-3.5">
          <dt class="t-section">Ngày đặt</dt>
          <dd class="text-right t-body text-ink/80">{{ formatDateTimeNumeric(order.createdAt) }}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-4 py-3.5">
          <dt class="t-section">Trạng thái</dt>
          <dd class="text-right t-body" :class="cancelled ? 'text-discount' : 'text-ink/80'">{{ statusLabel }}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-4 py-3.5">
          <dt class="t-section">Thanh toán</dt>
          <dd class="text-right t-body text-ink/80">{{ paymentStatus }}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-4 py-3.5">
          <dt class="t-section">Giao hàng</dt>
          <dd class="text-right t-body text-ink/80">{{ deliveryStatus }}</dd>
        </div>
      </dl>

      <button
        type="button"
        class="flex w-full items-start gap-3 border-t border-hairline/60 py-3.5 text-left"
        @click="scrollToProducts"
      >
        <AppIcon name="barcode" size="h-5 w-5" class="mt-0.5 shrink-0 text-ink/80" />
        <span class="min-w-0 flex-1">
          <span class="block t-section">Phiếu mua hàng</span>
          <span class="mt-1 block t-meta leading-snug text-muted">
            Xem số lượng đã mua cho từng sản phẩm
          </span>
        </span>
        <AppIcon name="chevron" size="h-4 w-4" class="mt-1.5 shrink-0 text-muted" />
      </button>
    </section>

    <section class="mt-7" aria-labelledby="order-progress-title">
      <h2 id="order-progress-title" class="t-section">Tiến trình đơn hàng</h2>

      <div v-if="!cancelled" class="mt-4">
        <div class="flex items-center px-1">
          <template v-for="(step, index) in steps" :key="step.key">
            <span
              class="grid h-6 w-6 shrink-0 place-items-center rounded-full"
              :class="index <= currentStep ? 'bg-primary text-white' : 'bg-[#b9b4a8]'"
            >
              <svg
                v-if="index <= currentStep"
                viewBox="0 0 24 24"
                class="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                aria-hidden="true"
              >
                <path d="m5 12 4.5 4.5L19 7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <span
              v-if="index < steps.length - 1"
              class="h-[3px] flex-1"
              :class="index < currentStep ? 'bg-primary/40' : 'bg-hairline'"
            />
          </template>
        </div>
        <p class="mt-4 text-center t-body">
          Bước {{ currentStep + 1 }}/{{ steps.length }} · {{ steps[currentStep]?.label }}
        </p>
      </div>

      <p
        v-else
        class="mt-3 rounded-[16px] border border-discount/25 bg-discount/5 px-4 py-3 t-body text-discount"
      >
        Đơn hàng đã được huỷ.
      </p>
    </section>

    <section ref="productsRef" class="mt-7 scroll-mt-20" aria-labelledby="order-products-title">
      <h2 id="order-products-title" class="t-section">Sản phẩm đã đặt</h2>

      <div class="mt-3 rounded-[18px] border border-hairline/40 bg-white/45 px-3">
        <div
          v-for="(item, index) in order.items"
          :key="item.id"
          class="py-3.5"
          :class="index > 0 ? 'border-t border-hairline/50' : ''"
        >
          <div class="flex gap-3">
            <img
              :src="item.thumbnail"
              :alt="item.title"
              width="88"
              height="88"
              loading="lazy"
              decoding="async"
              class="h-[88px] w-[88px] shrink-0 rounded-[14px] bg-paper-deep object-cover"
            />
            <div class="min-w-0 flex-1">
              <p class="t-body font-semibold leading-snug">{{ item.title }}</p>
              <p class="mt-1 t-body text-muted">{{ item.variantTitle }}</p>

              <div class="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p class="t-meta text-muted">Thành tiền</p>
                  <p class="mt-1 t-section font-semibold text-accent">{{ formatVnd(item.unitPrice) }}</p>
                </div>
                <div class="text-right">
                  <p class="t-section font-semibold">{{ formatVnd(item.unitPrice * item.quantity) }}</p>
                  <p class="mt-1 t-body text-muted">x{{ item.quantity }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="mt-7" aria-labelledby="order-totals-title">
      <h2 id="order-totals-title" class="t-section">Đơn hàng</h2>

      <div class="mt-3 rounded-[18px] border border-hairline/40 bg-white/45 px-4 py-2">
        <dl class="space-y-2 t-body">
          <div class="flex items-baseline justify-between gap-4">
            <dt class="text-muted">Tạm tính</dt>
            <dd>{{ formatVnd(order.subtotal) }}</dd>
          </div>
          <div v-if="order.discountTotal > 0" class="flex items-baseline justify-between gap-4">
            <dt class="text-muted">Giảm giá</dt>
            <dd class="text-discount">-{{ formatVnd(order.discountTotal) }}</dd>
          </div>
          <div v-if="order.shippingTotal > 0" class="flex items-baseline justify-between gap-4">
            <dt class="text-muted">Phí giao hàng</dt>
            <dd>{{ formatVnd(order.shippingTotal) }}</dd>
          </div>
          <div v-if="order.taxTotal > 0" class="flex items-baseline justify-between gap-4">
            <dt class="t-meta text-muted">Trong đó VAT ({{ vatRateLabel(order.taxRate) }})</dt>
            <dd class="t-meta text-muted">{{ formatVnd(order.taxTotal) }}</dd>
          </div>
        </dl>

        <div class="flex items-baseline justify-between gap-4 border-t border-hairline/60 py-3.5">
          <p class="t-section font-semibold">Tổng thanh toán</p>
          <p class="t-page font-semibold text-primary">{{ formatVnd(order.total) }}</p>
        </div>
        <p v-if="order.taxTotal > 0" class="t-micro text-muted">Giá đã bao gồm VAT, không cộng thêm khi thanh toán.</p>
        </div>
      </div>
    </section>

    <section class="mt-7" aria-labelledby="order-shipping-title">
      <h2 id="order-shipping-title" class="t-section">Giao hàng</h2>

      <div class="mt-3 rounded-[18px] border border-hairline/40 bg-white/45 px-4">
        <dl class="divide-y divide-hairline/50 t-body">
          <div class="flex items-baseline justify-between gap-4 py-3.5">
            <dt class="text-muted">Người nhận</dt>
            <dd class="ml-auto max-w-[62%] text-right">{{ order.shippingName }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-3.5">
            <dt class="shrink-0 text-muted">SĐT</dt>
            <dd class="ml-auto max-w-[62%] text-right">{{ order.shippingPhone }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-3.5">
            <dt class="shrink-0 text-muted">Địa chỉ</dt>
            <dd class="ml-auto max-w-[62%] text-right leading-relaxed">{{ order.shippingAddress }}</dd>
          </div>
          <div v-if="region" class="flex items-baseline justify-between gap-4 py-3.5">
            <dt class="shrink-0 text-muted">Khu vực giao hàng</dt>
            <dd class="ml-auto max-w-[62%] text-right">{{ region }}</dd>
          </div>
          <div v-if="order.note" class="flex items-baseline justify-between gap-4 py-3.5">
            <dt class="shrink-0 text-muted">Ghi chú</dt>
            <dd class="ml-auto max-w-[62%] text-right leading-relaxed">{{ order.note }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <section class="mt-7" aria-labelledby="order-payment-title">
      <h2 id="order-payment-title" class="t-section">Thanh toán</h2>

      <div class="mt-3 rounded-[18px] border border-hairline/40 bg-white/45 px-4">
        <dl class="divide-y divide-hairline/50 t-body">
          <div class="flex items-baseline justify-between gap-4 py-3.5">
            <dt class="text-muted">Phương thức</dt>
            <dd class="ml-auto max-w-[62%] text-right">{{ paymentMethodLabel }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-3.5">
            <dt class="text-muted">Trạng thái</dt>
            <dd class="ml-auto max-w-[62%] text-right">{{ paymentStatus }}</dd>
          </div>
        </dl>
      </div>
    </section>
  </div>
</template>
