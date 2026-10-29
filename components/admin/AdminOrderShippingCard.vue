<script setup lang="ts">
import type { AdminOrderShipping, AdminShipmentEvent, ShippingQuoteOption } from '~/types/shipping'
import { formatDateTime, formatVnd } from '~/utils/format'
import { shippingStatusMeta } from '~/utils/shipping'

const props = withDefaults(
  defineProps<{
    orderId: string
    shipping: AdminOrderShipping
    events?: AdminShipmentEvent[]
    orderStatus: string
    paymentStatus: string
    shippingTotal: number
  }>(),
  { events: () => [] }
)

const emit = defineEmits<{ refresh: [] }>()

const busy = ref(false)
const message = ref('')
const errorMessage = ref('')
const quoteOpen = ref(false)
const quoteOptions = ref<ShippingQuoteOption[]>([])
const selectedRateId = ref('')
const confirmCancel = ref(false)

const hasShipment = computed(() => Boolean(props.shipping.shipmentId || props.shipping.code))
const shipmentCancelled = computed(() => props.shipping.statusText === 'Đã huỷ vận đơn')
const isFallback = computed(() => props.shipping.provider === 'fallback')
const missingCodes = computed(
  () => !props.shipping.cityCode || !props.shipping.districtCode || !props.shipping.wardCode
)
const closed = computed(() => ['cancelled', 'completed'].includes(props.orderStatus))
const badge = computed(() => shippingStatusMeta(props.shipping.statusCode, props.shipping.statusText))
const feeDiff = computed(() => props.shipping.feeActual - props.shipping.feeQuoted)
const recentEvents = computed(() => props.events.slice(0, 5))
const canCreate = computed(() => !hasShipment.value && !closed.value && !missingCodes.value)
const canCancelShipment = computed(
  () => hasShipment.value && !shipmentCancelled.value && !['cancelled', 'completed'].includes(props.orderStatus)
)

async function request<T>(url: string, options: Record<string, unknown>): Promise<T | null> {
  if (busy.value) return null
  busy.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    const fetcher = $fetch as unknown as (input: string, init?: Record<string, unknown>) => Promise<unknown>
    return (await fetcher(url, options)) as T
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không thực hiện được thao tác vận chuyển.'
    return null
  } finally {
    busy.value = false
  }
}

async function requote() {
  const data = await request<{ options: ShippingQuoteOption[] }>(
    `/api/admin/orders/${props.orderId}/shipping/quote`,
    { method: 'POST' }
  )
  if (!data) return
  quoteOptions.value = data.options ?? []
  selectedRateId.value = data.options?.[0]?.id ?? ''
  quoteOpen.value = true
  if (!quoteOptions.value.length) errorMessage.value = 'Goship không trả về phương án nào cho đơn này.'
}

function closeQuote() {
  quoteOpen.value = false
  quoteOptions.value = []
  selectedRateId.value = ''
}

async function createShipment() {
  if (!selectedRateId.value) {
    errorMessage.value = 'Chọn một phương án vận chuyển trước.'
    return
  }
  const data = await request<{ carrierError?: string }>(`/api/admin/orders/${props.orderId}/shipping`, {
    method: 'POST',
    body: { rateId: selectedRateId.value }
  })
  if (!data) return
  if (data.carrierError) errorMessage.value = data.carrierError
  else message.value = 'Đã tạo vận đơn Goship.'
  closeQuote()
  emit('refresh')
}

async function syncShipment() {
  const data = await request<{ warning?: string; changed?: boolean }>(
    `/api/admin/orders/${props.orderId}/shipping/sync`,
    { method: 'POST' }
  )
  if (!data) return
  message.value = data.warning || (data.changed ? 'Đã cập nhật trạng thái đơn theo vận đơn.' : 'Vận đơn không đổi.')
  emit('refresh')
}

async function cancelShipment() {
  const data = await request<{ shipping: AdminOrderShipping }>(
    `/api/admin/orders/${props.orderId}/shipping/cancel`,
    { method: 'POST' }
  )
  confirmCancel.value = false
  if (!data) return
  message.value = 'Đã huỷ vận đơn trên Goship.'
  emit('refresh')
}
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold">Vận chuyển</h3>
      <AdminBadge v-bind="badge" />
    </div>

    <p
      v-if="missingCodes && !hasShipment && !isFallback"
      class="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800"
    >
      Đơn thiếu mã địa chỉ Goship (tỉnh/quận/phường). Cập nhật địa chỉ giao hàng rồi báo giá lại.
    </p>

    <dl class="mt-3 space-y-1.5 text-sm">
      <div class="flex justify-between gap-3">
        <dt class="text-slate-500">Phí khách trả</dt>
        <dd class="font-semibold">{{ formatVnd(props.shippingTotal) }}</dd>
      </div>
      <div v-if="props.shipping.feeQuoted" class="flex justify-between gap-3">
        <dt class="text-slate-500">Cước hãng báo</dt>
        <dd class="font-medium">{{ formatVnd(props.shipping.feeQuoted) }}</dd>
      </div>
      <div v-if="props.shipping.feeActual" class="flex justify-between gap-3">
        <dt class="text-slate-500">Cước thực tế</dt>
        <dd class="flex items-center gap-1.5 font-medium">
          {{ formatVnd(props.shipping.feeActual) }}
          <span
            v-if="feeDiff !== 0"
            class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
            :class="feeDiff > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'"
          >
            {{ feeDiff > 0 ? '+' : '' }}{{ formatVnd(feeDiff) }}
          </span>
        </dd>
      </div>
      <div v-if="props.shipping.cod" class="flex justify-between gap-3">
        <dt class="text-slate-500">COD thu hộ</dt>
        <dd class="font-medium">{{ formatVnd(props.shipping.cod) }}</dd>
      </div>
      <div v-if="props.shipping.chargeableWeight" class="flex justify-between gap-3">
        <dt class="text-slate-500">Cân tính phí</dt>
        <dd class="font-medium">{{ props.shipping.chargeableWeight }} g</dd>
      </div>
      <div v-if="props.shipping.carrierName || props.shipping.carrier" class="flex justify-between gap-3">
        <dt class="text-slate-500">Hãng / dịch vụ</dt>
        <dd class="text-right font-medium">
          {{ props.shipping.carrierName || props.shipping.carrier }}
          <span v-if="props.shipping.service" class="block text-[11px] font-normal text-slate-400">
            {{ props.shipping.service }}
          </span>
        </dd>
      </div>
      <div v-if="props.shipping.code" class="flex justify-between gap-3">
        <dt class="text-slate-500">Mã vận đơn</dt>
        <dd class="font-mono text-xs">
          <a
            v-if="props.shipping.trackingUrl"
            :href="props.shipping.trackingUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="font-semibold text-emerald-700 hover:underline"
          >
            {{ props.shipping.code }} ↗
          </a>
          <template v-else>{{ props.shipping.code }}</template>
        </dd>
      </div>
      <div v-if="props.shipping.updatedAt" class="flex justify-between gap-3">
        <dt class="text-slate-500">Cập nhật</dt>
        <dd class="text-xs text-slate-400">{{ formatDateTime(props.shipping.updatedAt) }}</dd>
      </div>
    </dl>

    <p v-if="props.shipping.returning" class="mt-2 rounded-lg bg-violet-50 px-3 py-2 text-[11px] text-violet-800">
      Hãng báo chuyển hoàn — kiểm tra và xử lý đơn thủ công.
    </p>

    <div v-if="!closed" class="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <template v-if="!hasShipment || shipmentCancelled">
        <p
          v-if="isFallback"
          class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600"
        >
          Đơn dùng phí giao dự phòng, shop tự sắp xếp vận chuyển. Chưa có địa chỉ chuẩn Goship
          (tỉnh/quận/phường) nên không thể báo giá hoặc tạo vận đơn tự động.
        </p>
        <button
          v-else-if="!quoteOpen"
          type="button"
          class="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          :disabled="busy || missingCodes"
          @click="requote"
        >
          {{ shipmentCancelled ? 'Tạo lại vận đơn' : props.shipping.carrierName ? 'Báo giá lại' : 'Chọn hãng & tạo vận đơn' }}
        </button>

        <div v-else class="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
          <ShippingOptionList
            v-model="selectedRateId"
            :options="quoteOptions"
            show-success-rate
            dense
          />
          <p v-if="!quoteOptions.length" class="text-[11px] text-slate-500">
            Không có phương án nào — thử kiểm tra địa chỉ hoặc cấu hình Goship.
          </p>
          <div class="mt-2 flex gap-2">
            <button
              type="button"
              class="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              :disabled="busy || !selectedRateId"
              @click="createShipment"
            >
              {{ busy ? 'Đang tạo…' : 'Tạo vận đơn' }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
              @click="closeQuote"
            >
              Bỏ
            </button>
          </div>
        </div>
        <p v-if="!canCreate && !shipmentCancelled && !missingCodes" class="text-[11px] text-slate-400">
          Đơn đã có vận đơn hoặc đã kết thúc.
        </p>
      </template>

      <template v-else>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            :disabled="busy"
            @click="syncShipment"
          >
            Đồng bộ
          </button>
          <button
            v-if="!confirmCancel"
            type="button"
            class="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            :disabled="busy || !canCancelShipment"
            @click="confirmCancel = true"
          >
            Huỷ vận đơn
          </button>
        </div>
        <div v-if="confirmCancel" class="rounded-lg border border-rose-200 bg-rose-50 p-3">
          <p class="text-[11px] text-rose-700">Huỷ vận đơn trên Goship? Thanh toán của đơn không thay đổi.</p>
          <div class="mt-2 flex gap-2">
            <button
              type="button"
              class="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              :disabled="busy"
              @click="cancelShipment"
            >
              Xác nhận huỷ
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
              @click="confirmCancel = false"
            >
              Bỏ
            </button>
          </div>
        </div>
      </template>
    </div>

    <div v-if="recentEvents.length" class="mt-3 border-t border-slate-100 pt-3">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Nhật ký vận đơn</p>
      <ul class="mt-2 space-y-1.5">
        <li v-for="event in recentEvents" :key="event.id" class="text-[11px] text-slate-500">
          <span class="font-medium text-slate-700">{{ event.statusText || `Mã ${event.statusCode}` }}</span>
          <span v-if="event.eventTime"> · {{ formatDateTime(event.eventTime) }}</span>
          <span v-if="event.message" class="block text-slate-400">{{ event.message }}</span>
        </li>
      </ul>
    </div>

    <p v-if="message" class="mt-2 text-[11px] font-medium text-emerald-700">{{ message }}</p>
    <p v-if="errorMessage" class="mt-2 text-[11px] font-medium text-rose-700">{{ errorMessage }}</p>
  </section>
</template>
