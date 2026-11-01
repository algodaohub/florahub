<script setup lang="ts">
import type { AdminOrderShipping, AdminShipmentEvent, ShippingQuoteOption } from '~/types/shipping'
import { formatDateTime } from '~/utils/format'
import { shippingStatusMeta } from '~/utils/shipping'

const props = withDefaults(
  defineProps<{
    orderId: string
    shipping: AdminOrderShipping
    events?: AdminShipmentEvent[]
    orderStatus: string
    /** Form người nhận/ghi chú có thay đổi chưa lưu — chặn tạo vận đơn để ghi chú không bị bỏ sót. */
    detailsDirty?: boolean
  }>(),
  { events: () => [], detailsDirty: false }
)

const emit = defineEmits<{ refresh: [] }>()

const busy = ref(false)
const message = ref('')
const errorMessage = ref('')
const quoteOptions = ref<ShippingQuoteOption[]>([])
const selectedRateId = ref('')
const quoteLoading = ref(false)
const quoteLoaded = ref(false)
const confirmCancel = ref(false)

const hasShipment = computed(() => Boolean(props.shipping.shipmentId || props.shipping.code))
const shipmentCancelled = computed(() => props.shipping.statusText.includes('Đã huỷ vận đơn'))
const isFallback = computed(() => props.shipping.provider === 'fallback')
const missingCodes = computed(
  () => !props.shipping.cityCode || !props.shipping.districtCode || !props.shipping.wardCode
)
const closed = computed(() => ['cancelled', 'completed'].includes(props.orderStatus))
const badge = computed(() => shippingStatusMeta(props.shipping.statusCode, props.shipping.statusText))
const recentEvents = computed(() => props.events.slice(0, 5))
const needsQuote = computed(() => !hasShipment.value || shipmentCancelled.value)
const canQuote = computed(() => needsQuote.value && !closed.value && !isFallback.value && !missingCodes.value)
const canCancelShipment = computed(() => hasShipment.value && !shipmentCancelled.value && !closed.value)

async function loadQuote() {
  if (quoteLoading.value || busy.value) return
  quoteLoading.value = true
  errorMessage.value = ''
  try {
    const fetcher = $fetch as unknown as (input: string, init?: Record<string, unknown>) => Promise<unknown>
    const data = (await fetcher(`/api/admin/orders/${props.orderId}/shipping/quote`, {
      method: 'POST'
    })) as { options?: ShippingQuoteOption[] }
    quoteOptions.value = data?.options ?? []
    selectedRateId.value = matchCustomerRate(quoteOptions.value)
    quoteLoaded.value = true
    if (!quoteOptions.value.length) errorMessage.value = 'Goship không trả về phương án nào cho đơn này.'
  } catch (error: any) {
    quoteOptions.value = []
    selectedRateId.value = ''
    errorMessage.value = error?.data?.statusMessage || 'Không lấy được phương án vận chuyển.'
  } finally {
    quoteLoading.value = false
  }
}

/** Chọn đúng rate khách đã dùng: khớp rate id, rồi tới hãng + dịch vụ, cuối cùng là rate đầu. */
function matchCustomerRate(options: ShippingQuoteOption[]): string {
  if (!options.length) return ''
  const { rateId, carrier, service } = props.shipping
  if (rateId) {
    const exact = options.find((option) => option.id === rateId)
    if (exact) return exact.id
  }
  const byService = options.find((option) => option.carrier === carrier && option.service === service)
  return (byService ?? options[0]).id
}

onMounted(() => {
  if (canQuote.value) loadQuote()
})

watch(shipmentCancelled, (cancelled) => {
  if (!cancelled) return
  quoteLoaded.value = false
  if (canQuote.value) loadQuote()
})

// Admin sửa tỉnh/quận/phường → mã Goship đổi → báo giá lại ngay.
watch(
  () => [props.shipping.cityCode, props.shipping.districtCode, props.shipping.wardCode],
  () => {
    if (!canQuote.value) return
    quoteLoaded.value = false
    quoteOptions.value = []
    selectedRateId.value = ''
    loadQuote()
  }
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
  if (data.carrierError) {
    errorMessage.value = data.carrierError
    return
  }
  message.value = 'Đã tạo vận đơn Goship.'
  quoteOptions.value = []
  selectedRateId.value = ''
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
  <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-slate-200 px-4 py-3">
      <h3 class="text-sm font-semibold">Giao hàng & vận chuyển</h3>
      <AdminBadge v-if="hasShipment" v-bind="badge" class="max-w-full !whitespace-normal" />
    </div>

    <div class="border-b border-slate-200 p-4">
      <slot />
    </div>

    <div class="p-4">
      <h4 class="text-sm font-semibold">Đơn vị vận chuyển</h4>

      <template v-if="hasShipment && !shipmentCancelled">
        <div class="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-slate-800">
              {{ props.shipping.carrierName || props.shipping.carrier || 'Đơn vị vận chuyển' }}
            </p>
            <p v-if="props.shipping.service" class="text-[11px] text-slate-500">{{ props.shipping.service }}</p>
          </div>
          <div class="text-right">
            <a
              v-if="props.shipping.code && props.shipping.trackingUrl"
              :href="props.shipping.trackingUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="font-mono text-xs font-semibold text-emerald-700 hover:underline"
            >
              {{ props.shipping.code }} ↗
            </a>
            <span v-else-if="props.shipping.code" class="font-mono text-xs font-semibold">{{ props.shipping.code }}</span>
            <p v-if="props.shipping.updatedAt" class="mt-0.5 text-[11px] text-slate-400">
              Cập nhật {{ formatDateTime(props.shipping.updatedAt) }}
            </p>
          </div>
        </div>

        <p
          v-if="(props.shipping.feeActual || props.shipping.feeQuoted) > 0"
          class="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600"
        >
          <span>Shop trả cước VC</span>
          <span class="font-semibold tabular-nums">
            {{ formatVnd(props.shipping.feeActual || props.shipping.feeQuoted) }}
          </span>
        </p>

        <p v-if="props.shipping.returning" class="mt-2 rounded-lg bg-violet-50 px-3 py-2 text-[11px] text-violet-800">
          Hãng báo chuyển hoàn — kiểm tra và xử lý đơn thủ công.
        </p>

        <div v-if="!closed" class="mt-3 flex gap-2">
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
        <div v-if="confirmCancel" class="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
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

      <p v-else-if="closed" class="mt-2 text-[11px] text-slate-400">
        Đơn đã kết thúc — không thể tạo vận đơn.
      </p>

      <template v-else>
        <p v-if="missingCodes && !isFallback" class="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          Đơn thiếu mã địa chỉ Goship (tỉnh/quận/phường). Cập nhật địa chỉ giao hàng rồi báo giá lại.
        </p>
        <p
          v-else-if="isFallback"
          class="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600"
        >
          Đơn dùng phí giao dự phòng, shop tự sắp xếp vận chuyển. Chưa có địa chỉ chuẩn Goship
          (tỉnh/quận/phường) nên không thể báo giá hoặc tạo vận đơn tự động.
        </p>
        <template v-else>
          <p
            v-if="quoteLoading"
            class="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500"
          >
            Đang lấy phương án vận chuyển phù hợp…
          </p>
          <div v-else class="mt-3">
            <ShippingOptionList
              v-if="quoteOptions.length"
              v-model="selectedRateId"
              :options="quoteOptions"
              fee-mode="carrier"
              show-success-rate
              dense
            />
            <p
              v-else
              class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500"
            >
              {{
                quoteLoaded
                  ? 'Không có phương án nào — kiểm tra địa chỉ hoặc cấu hình Goship.'
                  : 'Nhấn "Báo giá lại" để lấy phương án vận chuyển.'
              }}
            </p>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              :disabled="busy || quoteLoading || !selectedRateId || props.detailsDirty"
              @click="createShipment"
            >
              {{ busy ? 'Đang tạo…' : 'Tạo vận đơn' }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              :disabled="quoteLoading || busy"
              @click="loadQuote"
            >
              {{ quoteLoaded ? 'Báo giá lại' : 'Báo giá' }}
            </button>
          </div>
          <p v-if="props.detailsDirty" class="mt-2 text-[11px] font-medium text-amber-700">
            Có thay đổi chưa lưu — bấm "Lưu" để ghi chú được gửi kèm vận đơn.
          </p>
        </template>
      </template>

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
    </div>
  </section>
</template>
