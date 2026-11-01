<script setup lang="ts">
import type { AdminOrderDetail } from '~/types/admin'
import { formatDateTime, formatOrderCode, formatVnd } from '~/utils/format'
import { commissionStatusMeta, paymentMethodLabel, paymentStatusMeta } from '~/utils/admin'
import { invoiceStatusMeta, vatRateLabel } from '~/utils/accounting'
import { buildVietQrUrl, formatBankAccount } from '~/utils/payments'
import { isSameLocationName } from '~/utils/locations'

definePageMeta({ layout: 'admin', middleware: 'admin', title: 'Chi tiết đơn hàng' })

const route = useRoute()
const requestFetch = useRequestFetch()
const id = String(route.params.id ?? '')

const { data, pending, error, refresh } = await useAsyncData<AdminOrderDetail>(
  `admin-order-${id}`,
  () => requestFetch<AdminOrderDetail>(`/api/admin/orders/${id}`)
)

const form = reactive({
  note: '',
  shippingName: '',
  shippingPhone: '',
  shippingAddress: '',
  shippingCity: '',
  shippingWard: '',
  shippingCityCode: '',
  shippingWardCode: ''
})

// Tách phần "số nhà, đường" khỏi chuỗi địa chỉ đầy đủ "…, phường, tỉnh" (cách ghép của checkout).
function splitStreetAddress(full: string, city = '', ward = '') {
  const street = String(full ?? '').trim()
  const suffix = [ward, city].filter(Boolean).join(', ')
  if (suffix && street.endsWith(suffix)) {
    return street.slice(0, street.length - suffix.length).replace(/[,\s]+$/, '')
  }
  return street
}

let hydrated = false
watch(
  data,
  (value) => {
    if (!value) return
    if (hydrated && detailsDirty.value) return // không nạp đè khi admin đang có chỉnh sửa chưa lưu
    const region = value.order.shippingRegion ?? { city: '', ward: '', cityCode: '', wardCode: '' }
    form.note = value.order.note ?? ''
    form.shippingName = value.order.shippingName ?? ''
    form.shippingPhone = value.order.shippingPhone ?? ''
    form.shippingCity = region.city
    form.shippingWard = region.ward
    form.shippingCityCode = region.cityCode
    form.shippingWardCode = region.wardCode
    form.shippingAddress = splitStreetAddress(value.order.shippingAddress ?? '', region.city, region.ward)
    hydrated = false
    nextTick(() => {
      hydrated = true
    })
  },
  { immediate: true }
)

// Đổi tỉnh/phường → ghép lại chuỗi địa chỉ y hệt checkout: "số nhà, phường, tỉnh".
// Bỏ các đuôi trùng tên vùng (cũ/mới/đã lưu, so khớp chuẩn hoá) trước khi ghép để không dồn suffix.
function stripRegionSuffix(street: string, names: string[]) {
  let parts = street.split(',').map((s) => s.trim())
  while (parts.length > 1 && names.some((n) => n && isSameLocationName(parts[parts.length - 1], n))) {
    parts = parts.slice(0, -1)
  }
  return parts.join(', ')
}

watch([() => form.shippingWard, () => form.shippingCity], ([ward, city], [oldWard, oldCity]) => {
  if (!ward && !city) return
  const street = stripRegionSuffix(form.shippingAddress.trim(), [
    oldWard,
    oldCity,
    savedRegion.value.ward,
    savedRegion.value.city,
    ward,
    city
  ])
  form.shippingAddress = [street, ward, city].filter(Boolean).join(', ')
})

const order = computed(() => data.value?.order ?? null)
const items = computed(() => data.value?.items ?? [])
const affiliate = computed(() => data.value?.affiliate ?? null)
const commission = computed(() => data.value?.commission ?? null)
const journal = computed(() => data.value?.journal ?? [])

const itemTotal = computed(() => items.value.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0))
const netRevenue = computed(() => Math.max(0, (order.value?.total ?? 0) - (order.value?.taxTotal ?? 0)))
// Cước hãng thật shop phải trả — giữ nguyên khi khách được freeship.
const carrierFee = computed(() => data.value?.shipping?.feeActual || data.value?.shipping?.feeQuoted || 0)

const STEPS = [
  { key: 'pending', label: 'Chờ xác nhận' },
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'shipping', label: 'Đang giao' },
  { key: 'completed', label: 'Hoàn tất' }
]
const stepIndex = computed(() => STEPS.findIndex((step) => step.key === order.value?.status))

const canMarkPaid = computed(
  () =>
    Boolean(order.value) &&
    order.value?.status !== 'cancelled' &&
    ['', 'pending', 'cod'].includes(order.value?.paymentStatus ?? '')
)
const canRefund = computed(() => order.value?.paymentStatus === 'paid')

const paymentQr = computed(() => data.value?.paymentQr ?? null)
const transferNote = computed(() => formatOrderCode(order.value?.id ?? ''))
const qrUrl = computed(() =>
  paymentQr.value
    ? buildVietQrUrl({ qr: paymentQr.value }, { amount: order.value?.total, addInfo: transferNote.value })
    : ''
)
const showQr = computed(
  () =>
    Boolean(paymentQr.value) &&
    order.value?.paymentMethod === 'qr' &&
    !['paid', 'refunded'].includes(order.value?.paymentStatus ?? '') &&
    order.value?.status !== 'cancelled'
)
const qrFailed = ref(false)
const copiedField = ref('')
async function copyText(label: string, value: string) {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    copiedField.value = label
    setTimeout(() => {
      copiedField.value = ''
    }, 1600)
  } catch {
    flash('Không sao chép được nội dung', 'error')
  }
}

const busy = ref(false)
const message = ref('')
const errorMessage = ref('')
const warning = ref('')
const copied = ref(false)

let flashTimer: ReturnType<typeof setTimeout> | null = null
function flash(text: string, kind: 'ok' | 'error' = 'ok') {
  if (kind === 'error') errorMessage.value = text
  else message.value = text
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    message.value = ''
    errorMessage.value = ''
  }, 5000)
}

function clearNotice() {
  message.value = ''
  errorMessage.value = ''
  warning.value = ''
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(order.value?.id ?? id)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    flash('Không sao chép được mã đơn', 'error')
  }
}

const savedRegion = computed(
  () => order.value?.shippingRegion ?? { city: '', ward: '', cityCode: '', wardCode: '' }
)

// Vùng đang đổi dở (đã chọn tỉnh, chưa chọn phường) — không lưu kẻo address mới + region cũ lệch nhau.
const regionTouched = computed(() => {
  const region = savedRegion.value
  const savedHasCodes = Boolean(region.cityCode || region.wardCode)
  return (
    form.shippingCity !== region.city ||
    form.shippingWard !== region.ward ||
    (savedHasCodes && (form.shippingCityCode !== region.cityCode || form.shippingWardCode !== region.wardCode))
  )
})

const detailsDirty = computed(() => {
  const current = order.value
  if (!current) return false
  const region = current.shippingRegion
  const savedHasCodes = Boolean(region?.cityCode || region?.wardCode)
  const codesChanged =
    form.shippingCityCode !== (region?.cityCode ?? '') || form.shippingWardCode !== (region?.wardCode ?? '')
  return (
    form.note !== (current.note ?? '') ||
    form.shippingName !== (current.shippingName ?? '') ||
    form.shippingPhone !== (current.shippingPhone ?? '') ||
    form.shippingAddress !== (current.shippingAddress ?? '') ||
    (savedHasCodes && codesChanged) ||
    // Đơn legacy chưa có mã vùng: chỉ tính là sửa khi admin chọn đủ cả tỉnh + phường.
    (!savedHasCodes && Boolean(form.shippingCityCode && form.shippingWardCode))
  )
})

async function request<T>(url: string, options: Record<string, unknown>): Promise<T | null> {
  busy.value = true
  clearNotice()
  try {
    const fetcher = $fetch as unknown as (input: string, init?: Record<string, unknown>) => Promise<unknown>
    return (await fetcher(url, options)) as T
  } catch (err: any) {
    flash(err?.data?.statusMessage || err?.statusMessage || 'Không thực hiện được thao tác.', 'error')
    return null
  } finally {
    busy.value = false
  }
}

const autoSaveState = ref<'idle' | 'dirty' | 'saving' | 'saved'>('idle')
let savedClearTimer: ReturnType<typeof setTimeout> | null = null
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

async function saveDetails() {
  if (busy.value) {
    // Đang lưu mà admin gõ tiếp — đợi lượt này xong rồi lưu tiếp, không bỏ thay đổi.
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = setTimeout(() => {
      autoSaveTimer = null
      void saveDetails()
    }, 500)
    return
  }
  if (!detailsDirty.value) {
    autoSaveState.value = 'idle'
    return
  }
  if (regionTouched.value && !(form.shippingCityCode && form.shippingWardCode)) {
    autoSaveState.value = 'dirty'
    return
  }
  autoSaveState.value = 'saving'
  const body: Record<string, unknown> = {
    note: form.note,
    shippingName: form.shippingName,
    shippingPhone: form.shippingPhone,
    shippingAddress: form.shippingAddress
  }
  // Server yêu cầu đủ cả hai mã khi có field vùng; gửi khi chọn đủ để backfill cho đơn legacy.
  if (form.shippingCityCode && form.shippingWardCode) {
    body.shippingCityCode = form.shippingCityCode
    body.shippingWardCode = form.shippingWardCode
    body.shippingCityName = form.shippingCity
    body.shippingWardName = form.shippingWard
  }
  const result = await request<{ warning?: string }>(`/api/admin/orders/${id}`, {
    method: 'PATCH',
    body
  })
  if (!result) {
    autoSaveState.value = 'dirty'
    return
  }
  await refresh()
  warning.value = result.warning ?? ''
  flash('Đã lưu thông tin đơn hàng.')
  autoSaveState.value = 'saved'
  if (savedClearTimer) clearTimeout(savedClearTimer)
  savedClearTimer = setTimeout(() => {
    autoSaveState.value = 'idle'
  }, 2500)
}

watch(
  () => [
    form.note,
    form.shippingName,
    form.shippingPhone,
    form.shippingAddress,
    form.shippingCityCode,
    form.shippingWardCode
  ],
  () => {
    if (!hydrated || !detailsDirty.value) return
    autoSaveState.value = 'dirty'
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = setTimeout(() => {
      autoSaveTimer = null
      void saveDetails()
    }, 700)
  }
)

onBeforeUnmount(() => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  if (savedClearTimer) clearTimeout(savedClearTimer)
})

const confirmPaid = ref(false)
async function markPaid() {
  const result = await request<{ warning?: string }>(`/api/admin/orders/${id}`, {
    method: 'PATCH',
    body: { paymentStatus: 'paid' }
  })
  confirmPaid.value = false
  if (!result) return
  await refresh()
  warning.value = result.warning ?? ''
  flash('Đã ghi nhận thanh toán.')
}

const refundOpen = ref(false)
const refundForm = reactive({ amount: 0, reason: '' })
const refundAmountInput = ref<HTMLInputElement | null>(null)
function openRefund() {
  refundForm.amount = order.value?.total ?? 0
  refundForm.reason = ''
  refundOpen.value = true
  nextTick(() => refundAmountInput.value?.select())
}

watch([confirmPaid, refundOpen], ([paid, refund]) => {
  if (!import.meta.client) return
  document.body.classList.toggle('overflow-hidden', paid || refund)
})

function onEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (refundOpen.value) refundOpen.value = false
  else if (confirmPaid.value) confirmPaid.value = false
}
onMounted(() => window.addEventListener('keydown', onEscape))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEscape)
  document.body.classList.remove('overflow-hidden')
})
async function submitRefund() {
  if (!refundForm.reason.trim()) {
    flash('Vui lòng nhập lý do hoàn tiền.', 'error')
    return
  }
  const result = await request<{ warning?: string }>(`/api/admin/orders/${id}/refund`, {
    method: 'POST',
    body: { amount: refundForm.amount, reason: refundForm.reason }
  })
  if (!result) return
  refundOpen.value = false
  await refresh()
  warning.value = result.warning ?? ''
  flash('Đã hoàn tiền và ghi bút toán.')
}

const cancelInvoiceOpen = ref(false)
const cancelInvoiceReason = ref('')
const invoiceDetailOpen = ref(false)
async function issueInvoice() {
  const result = await request<{ warning?: string }>(`/api/admin/orders/${id}/invoice`, {
    method: 'POST',
    body: { action: 'issue' }
  })
  if (!result) return
  await refresh()
  warning.value = result.warning ?? ''
  flash('Đã xuất hoá đơn.')
}
async function submitCancelInvoice() {
  if (cancelInvoiceReason.value.trim().length < 3) {
    flash('Vui lòng nhập lý do huỷ hoá đơn.', 'error')
    return
  }
  const result = await request<{ warning?: string }>(`/api/admin/orders/${id}/invoice`, {
    method: 'POST',
    body: { action: 'cancel', reason: cancelInvoiceReason.value }
  })
  if (!result) return
  cancelInvoiceOpen.value = false
  cancelInvoiceReason.value = ''
  await refresh()
  warning.value = result.warning ?? ''
  flash('Đã huỷ hoá đơn, số hoá đơn được giữ nguyên.')
}

function orderCode(value: string) {
  return `#${value.slice(-6).toUpperCase()}`
}

useHead(() => ({ title: order.value ? `Đơn ${orderCode(order.value.id)}` : 'Chi tiết đơn hàng' }))
</script>

<template>
  <div class="w-full space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <NuxtLink to="/admin/orders" class="text-xs font-medium text-slate-500 hover:text-slate-800">
          ← Danh sách đơn
        </NuxtLink>
        <div v-if="order" class="mt-1 flex flex-wrap items-center gap-2">
          <h2 class="text-lg font-semibold">Đơn {{ orderCode(order.id) }}</h2>
          <button
            type="button"
            class="rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50"
            @click="copyCode"
          >
            {{ copied ? 'Đã chép' : 'Chép mã' }}
          </button>
          <AdminBadge v-bind="paymentStatusMeta(order.paymentStatus)" />
        </div>
        <p v-if="order" class="text-sm text-slate-500">
          Tạo lúc {{ formatDateTime(order.createdAt) }} · {{ items.length }} món ·
          <span class="font-semibold text-slate-700">{{ formatVnd(order.total) }}</span>
        </p>
      </div>
      <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <button
          v-if="order && canMarkPaid"
          type="button"
          class="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50 sm:w-auto"
          :disabled="busy"
          @click="confirmPaid = true"
        >
          Đánh dấu đã thanh toán
        </button>
        <button
          v-if="order && canRefund"
          type="button"
          class="w-full rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-50 sm:w-auto"
          :disabled="busy"
          @click="openRefund"
        >
          Hoàn tiền
        </button>
        <div class="flex items-center justify-end gap-2">
          <NuxtLink
            v-if="order"
            :to="`/orders/${order.id}`"
            target="_blank"
            class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Xem như khách ↗
          </NuxtLink>
        </div>
      </div>
    </div>

    <div
      v-if="message"
      class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
    >
      {{ message }}
    </div>
    <div v-if="errorMessage" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ errorMessage }}
    </div>
    <div v-if="warning" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Lưu đơn thành công nhưng kế toán cần kiểm tra: {{ warning }}
    </div>

    <div v-if="error" class="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
      Không tải được đơn hàng. {{ (error as any)?.data?.statusMessage || '' }}
    </div>

    <div v-else-if="pending && !order" class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div class="space-y-4">
        <div class="h-40 animate-pulse rounded-xl bg-white" />
        <div class="h-52 animate-pulse rounded-xl bg-white" />
      </div>
      <div class="space-y-4">
        <div class="h-44 animate-pulse rounded-xl bg-white" />
        <div class="h-36 animate-pulse rounded-xl bg-white" />
      </div>
    </div>

    <template v-else-if="order">
      <section
        v-if="order.status === 'cancelled'"
        class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
      >
        Đơn đã huỷ{{ order.cancelledAt ? ` lúc ${formatDateTime(order.cancelledAt)}` : '' }}. Không thể chuyển trạng
        thái tiếp.
      </section>
      <section
        v-else
        class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm"
      >
        <template v-for="(step, index) in STEPS" :key="step.key">
          <span
            class="flex items-center gap-1.5 text-xs font-medium"
            :class="index === stepIndex ? 'text-emerald-700' : index < stepIndex ? 'text-slate-500' : 'text-slate-400'"
          >
            <span
              class="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold"
              :class="
                index < stepIndex
                  ? 'bg-emerald-100 text-emerald-700'
                  : index === stepIndex
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-400'
              "
            >
              <template v-if="index < stepIndex">✓</template>
              <template v-else>{{ index + 1 }}</template>
            </span>
            {{ step.label }}
          </span>
          <span v-if="index < STEPS.length - 1" class="h-px w-4 shrink-0 bg-slate-200 sm:w-8" aria-hidden="true" />
        </template>
      </section>

      <div class="grid w-full gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div class="min-w-0 space-y-4">
          <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 class="text-sm font-semibold">Sản phẩm</h3>
              <span class="text-xs text-slate-400">{{ items.length }} món</span>
            </div>
            <div class="w-full overflow-x-auto">
              <table class="w-full text-left text-sm sm:min-w-[560px]">
                <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th class="px-4 py-2 font-semibold">Sản phẩm</th>
                    <th class="hidden px-4 py-2 text-right font-semibold sm:table-cell">Đơn giá</th>
                    <th class="hidden px-4 py-2 text-center font-semibold sm:table-cell">SL</th>
                    <th class="px-4 py-2 text-right font-semibold">Thành tiền</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="item in items" :key="item.id">
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-3">
                        <img
                          v-if="item.thumbnail"
                          :src="item.thumbnail"
                          :alt="item.title"
                          width="40"
                          height="40"
                          loading="lazy"
                          class="h-10 w-10 rounded-lg border border-slate-200 object-cover"
                        />
                        <div class="min-w-0">
                          <p class="truncate font-medium text-slate-800">{{ item.title }}</p>
                          <p v-if="item.variantTitle" class="text-[11px] text-slate-500">{{ item.variantTitle }}</p>
                          <p class="mt-0.5 text-[11px] text-slate-500 sm:hidden">
                            {{ item.quantity }} × {{ formatVnd(item.unitPrice) }}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td class="hidden px-4 py-3 text-right text-slate-600 sm:table-cell">{{ formatVnd(item.unitPrice) }}</td>
                    <td class="hidden px-4 py-3 text-center text-slate-600 sm:table-cell">{{ item.quantity }}</td>
                    <td class="px-4 py-3 text-right font-semibold tabular-nums">
                      {{ formatVnd(item.unitPrice * item.quantity) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <AdminOrderShippingCard
            v-if="data?.shipping"
            :order-id="id"
            :shipping="data.shipping"
            :events="data.shipmentEvents"
            :order-status="order.status"
            :details-dirty="detailsDirty"
            @refresh="refresh"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <h4 class="text-sm font-semibold">Người nhận & ghi chú</h4>
                <span v-if="autoSaveState === 'dirty'" class="text-[11px] font-medium text-amber-600">Chưa lưu</span>
                <span v-else-if="autoSaveState === 'saving'" class="text-[11px] font-medium text-slate-500">Đang lưu…</span>
                <span v-else-if="autoSaveState === 'saved'" class="text-[11px] font-medium text-emerald-600">✓ Đã lưu</span>
              </div>
            </div>
            <div class="mt-3 grid gap-2 sm:grid-cols-2">
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-600">Người nhận</span>
                <input
                  v-model="form.shippingName"
                  class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-600">Điện thoại</span>
                <input
                  v-model="form.shippingPhone"
                  class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <div class="sm:col-span-2">
                <AddressRegionFields
                  v-model:city="form.shippingCity"
                  v-model:ward="form.shippingWard"
                  v-model:city-code="form.shippingCityCode"
                  v-model:ward-code="form.shippingWardCode"
                  dense
                  id-prefix="admin-order-region"
                />
                <p class="mt-1 text-[11px] text-slate-400">
                  Chọn đúng tỉnh/phường để báo giá cước. Đổi vùng sẽ báo giá lại.
                </p>
              </div>
              <label class="block sm:col-span-2">
                <span class="mb-1 block text-xs font-medium text-slate-600">Địa chỉ</span>
                <textarea
                  v-model="form.shippingAddress"
                  rows="2"
                  class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label class="block sm:col-span-2">
                <span class="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
                  Ghi chú nội bộ
                  <span class="font-normal text-slate-400">· gửi kèm vận đơn</span>
                </span>
                <textarea
                  v-model="form.note"
                  rows="2"
                  class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Ví dụ: khách dặn giao buổi chiều…"
                />
              </label>
            </div>
          </AdminOrderShippingCard>

          <section
            v-if="order.status === 'completed' || order.taxInvoiceNumber"
            class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-sm font-semibold">Hoá đơn & bút toán</h3>
              <AdminBadge v-bind="invoiceStatusMeta(order.taxInvoiceStatus)" />
            </div>

            <dl class="mt-2 space-y-1.5 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-slate-500">Số hoá đơn</dt>
                <dd class="font-mono text-xs font-semibold">
                  {{ order.taxInvoiceNumber || 'Chưa xuất' }}
                </dd>
              </div>
              <div v-if="order.taxInvoiceIssuedAt" class="flex justify-between gap-3">
                <dt class="text-slate-500">Ngày xuất</dt>
                <dd>{{ formatDateTime(order.taxInvoiceIssuedAt) }}</dd>
              </div>
              <div v-if="order.taxInvoiceCancelledReason" class="flex justify-between gap-3">
                <dt class="text-slate-500">Lý do huỷ</dt>
                <dd class="max-w-[60%] text-right text-rose-700">{{ order.taxInvoiceCancelledReason }}</dd>
              </div>
            </dl>

            <div class="mt-3 flex flex-wrap gap-2">
              <button
                v-if="order.taxInvoiceNumber"
                type="button"
                class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                @click="invoiceDetailOpen = true"
              >
                Xem chi tiết hoá đơn
              </button>
              <button
                v-if="order.status === 'completed' && order.taxInvoiceStatus !== 'issued'"
                type="button"
                class="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                :disabled="busy"
                @click="issueInvoice"
              >
                {{ order.taxInvoiceStatus === 'cancelled' ? 'Xuất hoá đơn thay thế' : 'Xuất hoá đơn' }}
              </button>
              <button
                v-if="order.taxInvoiceStatus === 'issued' && !cancelInvoiceOpen"
                type="button"
                class="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                :disabled="busy"
                @click="cancelInvoiceOpen = true"
              >
                Huỷ hoá đơn
              </button>
            </div>

            <div v-if="cancelInvoiceOpen" class="mt-3 rounded-lg border border-rose-200 bg-rose-50/60 p-3">
              <p class="text-[11px] text-rose-700">
                Số hoá đơn {{ order.taxInvoiceNumber }} được giữ nguyên, chỉ đánh dấu đã huỷ.
              </p>
              <input
                v-model="cancelInvoiceReason"
                class="mt-2 w-full rounded-lg border border-rose-300 px-3 py-2 text-sm outline-none focus:border-rose-500"
                placeholder="Lý do huỷ hoá đơn"
              />
              <div class="mt-2 flex gap-2">
                <button
                  type="button"
                  class="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  :disabled="busy"
                  @click="submitCancelInvoice"
                >
                  Xác nhận huỷ
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                  @click="cancelInvoiceOpen = false"
                >
                  Bỏ
                </button>
              </div>
            </div>

            <div class="mt-3 overflow-x-auto">
              <table v-if="journal.length" class="w-full min-w-[420px] text-left text-xs">
                <thead class="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th class="px-2 py-1.5 font-semibold">TK</th>
                    <th class="px-2 py-1.5 font-semibold">Diễn giải</th>
                    <th class="px-2 py-1.5 text-right font-semibold">Nợ</th>
                    <th class="px-2 py-1.5 text-right font-semibold">Có</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="line in journal" :key="line.id">
                    <td class="px-2 py-1.5 whitespace-nowrap">
                      <span class="font-semibold">{{ line.account }}</span>
                      <span class="text-slate-400"> · {{ line.accountName }}</span>
                    </td>
                    <td class="px-2 py-1.5 text-slate-600">{{ line.description }}</td>
                    <td class="px-2 py-1.5 text-right tabular-nums">{{ line.debit ? formatVnd(line.debit) : '—' }}</td>
                    <td class="px-2 py-1.5 text-right tabular-nums">{{ line.credit ? formatVnd(line.credit) : '—' }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="text-xs text-slate-400">Chưa có bút toán cho đơn này.</p>
            </div>

            <NuxtLink to="/admin/accounting" class="mt-3 inline-block text-xs font-semibold text-emerald-700 hover:underline">
              Mở sổ kế toán →
            </NuxtLink>
          </section>
        </div>

        <div class="min-w-0 space-y-4 xl:sticky xl:top-20 xl:self-start">
          <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold">Thanh toán</h3>
              <AdminBadge v-bind="paymentStatusMeta(order.paymentStatus)" />
            </div>

            <dl class="mt-3 space-y-1.5 border-b border-slate-100 pb-3 text-sm">
              <div class="flex justify-between text-slate-600">
                <dt>Tạm tính</dt>
                <dd class="tabular-nums">{{ formatVnd(order.subtotal || itemTotal) }}</dd>
              </div>
              <div v-if="order.discountTotal" class="flex justify-between text-slate-600">
                <dt>Giảm giá</dt>
                <dd class="tabular-nums text-emerald-700">−{{ formatVnd(order.discountTotal) }}</dd>
              </div>
              <div class="flex justify-between text-slate-600">
                <dt>Phí giao hàng (khách trả)</dt>
                <dd class="tabular-nums">{{ order.shippingTotal ? formatVnd(order.shippingTotal) : 'Miễn phí' }}</dd>
              </div>
              <div v-if="carrierFee > 0" class="flex justify-between text-slate-600">
                <dt>Phí hãng (shop trả)</dt>
                <dd class="tabular-nums">{{ formatVnd(carrierFee) }}</dd>
              </div>
              <div v-if="order.taxTotal" class="flex justify-between text-slate-500">
                <dt>Trong đó VAT ({{ vatRateLabel(order.taxRate) }})</dt>
                <dd class="tabular-nums">{{ formatVnd(order.taxTotal) }}</dd>
              </div>
              <div v-if="order.taxTotal" class="flex justify-between text-slate-500">
                <dt>Doanh thu chưa thuế</dt>
                <dd class="tabular-nums">{{ formatVnd(netRevenue) }}</dd>
              </div>
              <div class="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold">
                <dt>Tổng cộng</dt>
                <dd class="tabular-nums">{{ formatVnd(order.total) }}</dd>
              </div>
            </dl>

            <dl class="mt-3 space-y-1.5 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-slate-500">Phương thức</dt>
                <dd class="font-medium">{{ paymentMethodLabel(order.paymentMethod) }}</dd>
              </div>
              <div v-if="order.paidAt" class="flex justify-between gap-3">
                <dt class="text-slate-500">Đã thanh toán</dt>
                <dd class="font-medium">{{ formatDateTime(order.paidAt) }}</dd>
              </div>
              <div v-if="order.sepayTransactionId" class="flex justify-between gap-3">
                <dt class="text-slate-500">Mã giao dịch</dt>
                <dd class="font-mono text-xs">{{ order.sepayTransactionId }}</dd>
              </div>
              <div v-if="order.sepayOrderId" class="flex justify-between gap-3">
                <dt class="text-slate-500">Mã SePay</dt>
                <dd class="font-mono text-xs">{{ order.sepayOrderId }}</dd>
              </div>
              <div v-if="order.refundedAmount" class="flex justify-between gap-3">
                <dt class="text-slate-500">Đã hoàn</dt>
                <dd class="font-semibold text-violet-700">
                  {{ formatVnd(order.refundedAmount) }}
                  <span v-if="order.refundedAt" class="block text-[11px] font-normal text-slate-400">
                    {{ formatDateTime(order.refundedAt) }}
                  </span>
                </dd>
              </div>
            </dl>

            <p v-if="order.paymentStatus === 'paid'" class="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
              Đã thanh toán — chỉ có thể hoàn tiền.
            </p>
            <p
              v-else-if="order.paymentStatus === 'refunded'"
              class="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-[11px] text-violet-800"
            >
              Đơn đã hoàn tiền, trạng thái thanh toán không thay đổi được nữa.
            </p>
            <p
              v-else-if="order.paymentStatus === 'pending'"
              class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800"
            >
              {{
                showQr
                  ? 'Khách chưa thanh toán — quét QR bên dưới hoặc đánh dấu thủ công khi tiền về.'
                  : 'Khách chưa thanh toán. Đánh dấu thủ công khi tiền về.'
              }}
            </p>

            <div v-if="showQr" class="mt-3">
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                <img
                  v-if="qrUrl && !qrFailed"
                  :src="qrUrl"
                  alt="Mã QR chuyển khoản"
                  width="200"
                  height="200"
                  loading="lazy"
                  class="mx-auto h-48 w-48 rounded-lg bg-white object-contain"
                  @error="qrFailed = true"
                />
                <p v-else class="py-6 text-[11px] text-slate-500">
                  Không tải được mã QR. Chuyển khoản theo thông tin bên dưới.
                </p>
                <p class="mt-1 text-[11px] text-slate-500">Quét mã để thanh toán đúng số tiền</p>
              </div>
              <dl v-if="paymentQr" class="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 px-3 text-sm">
                <div class="flex justify-between gap-3 py-2">
                  <dt class="text-slate-500">Ngân hàng</dt>
                  <dd class="text-right font-medium">{{ paymentQr.bankName || paymentQr.bankId }}</dd>
                </div>
                <div class="flex items-center justify-between gap-3 py-2">
                  <dt class="text-slate-500">Số tài khoản</dt>
                  <dd class="flex min-w-0 items-center gap-1.5">
                    <span class="truncate font-medium">{{ formatBankAccount(paymentQr.accountNo) }}</span>
                    <button
                      type="button"
                      class="shrink-0 text-[11px] font-semibold text-emerald-700 hover:underline"
                      @click="copyText('account', paymentQr.accountNo)"
                    >
                      {{ copiedField === 'account' ? 'Đã chép' : 'Chép' }}
                    </button>
                  </dd>
                </div>
                <div v-if="paymentQr.accountName" class="flex justify-between gap-3 py-2">
                  <dt class="text-slate-500">Chủ tài khoản</dt>
                  <dd class="truncate text-right font-medium">{{ paymentQr.accountName }}</dd>
                </div>
                <div class="flex items-center justify-between gap-3 py-2">
                  <dt class="text-slate-500">Nội dung</dt>
                  <dd class="flex min-w-0 items-center gap-1.5">
                    <span class="truncate font-mono text-xs font-semibold">{{ transferNote }}</span>
                    <button
                      type="button"
                      class="shrink-0 text-[11px] font-semibold text-emerald-700 hover:underline"
                      @click="copyText('note', transferNote)"
                    >
                      {{ copiedField === 'note' ? 'Đã chép' : 'Chép' }}
                    </button>
                  </dd>
                </div>
              </dl>
            </div>
            <p
              v-else-if="
                order.paymentMethod === 'sepay' && !['paid', 'refunded'].includes(order.paymentStatus)
              "
              class="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600"
            >
              Khách thanh toán qua cổng SePay. Dùng "Xem như khách" để mở lại trang thanh toán của đơn.
            </p>
            <p
              v-else-if="
                order.paymentMethod === 'qr' &&
                !paymentQr &&
                !['paid', 'refunded'].includes(order.paymentStatus) &&
                order.status !== 'cancelled'
              "
              class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800"
            >
              Chưa cấu hình tài khoản nhận chuyển khoản.
              <NuxtLink to="/admin/payments" class="font-semibold underline">Cấu hình ngay</NuxtLink>
            </p>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold">Tiếp thị liên kết</h3>
              <AdminBadge
                v-if="affiliate"
                :label="affiliate.status === 'active' ? 'Đang hoạt động' : affiliate.status || '—'"
                :tone="affiliate.status === 'active' ? 'green' : 'gray'"
              />
            </div>
            <template v-if="affiliate">
              <dl class="mt-2 divide-y divide-slate-100 text-sm">
                <div class="flex justify-between gap-3 py-2">
                  <dt class="text-slate-500">Mã giới thiệu</dt>
                  <dd class="font-mono text-xs font-semibold text-violet-700">{{ affiliate.code }}</dd>
                </div>
                <div class="flex justify-between gap-3 py-2">
                  <dt class="text-slate-500">Người giới thiệu</dt>
                  <dd class="min-w-0 text-right">
                    <p class="truncate font-medium">{{ affiliate.referrerName || '—' }}</p>
                    <p class="truncate text-[11px] text-slate-500">{{ affiliate.referrerEmail }}</p>
                  </dd>
                </div>
                <div class="flex justify-between gap-3 py-2">
                  <dt class="text-slate-500">Tỷ lệ hoa hồng</dt>
                  <dd class="font-medium">{{ commission?.rate ?? affiliate.rate }}%</dd>
                </div>
                <div v-if="commission" class="flex justify-between gap-3 py-2">
                  <dt class="text-slate-500">Hoa hồng</dt>
                  <dd class="flex items-center gap-2">
                    <span class="font-semibold tabular-nums">{{ formatVnd(commission.amount) }}</span>
                    <AdminBadge v-bind="commissionStatusMeta(commission.status)" />
                  </dd>
                </div>
                <div v-if="commission?.eligibleAt && commission.status === 'pending'" class="flex justify-between gap-3 py-2">
                  <dt class="text-slate-500">Dự kiến duyệt</dt>
                  <dd class="font-medium">{{ formatDateTime(commission.eligibleAt) }}</dd>
                </div>
              </dl>
            </template>
            <p v-else class="mt-2 text-sm text-slate-400">Đơn này không qua affiliate.</p>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 class="text-sm font-semibold">Thông tin khác</h3>
            <dl class="mt-2 space-y-1.5 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-slate-500">Email đơn</dt>
                <dd class="truncate font-medium">{{ order.email }}</dd>
              </div>
              <div v-if="data?.customer" class="flex justify-between gap-3">
                <dt class="text-slate-500">Khách</dt>
                <dd class="truncate font-medium">{{ data.customer.displayName }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-slate-500">Mã đơn</dt>
                <dd class="font-mono text-xs">{{ order.id }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-slate-500">Cập nhật</dt>
                <dd class="text-xs text-slate-500">{{ formatDateTime(order.updatedAt) }}</dd>
              </div>
              <div v-if="order.completedAt" class="flex justify-between gap-3">
                <dt class="text-slate-500">Hoàn tất</dt>
                <dd class="text-xs text-slate-500">{{ formatDateTime(order.completedAt) }}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </template>

    <div
      v-if="order && confirmPaid"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-paid-title"
      @click.self="confirmPaid = false"
    >
      <div class="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h3 id="confirm-paid-title" class="text-base font-semibold">Xác nhận thanh toán</h3>
        <p class="mt-2 text-sm text-slate-600">
          Ghi nhận đã nhận <span class="font-semibold text-slate-900">{{ formatVnd(order.total) }}</span> cho đơn
          {{ orderCode(order.id) }}? Sau bước này không thể chuyển về chờ thanh toán.
        </p>
        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            @click="confirmPaid = false"
          >
            Bỏ
          </button>
          <button
            type="button"
            class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            :disabled="busy"
            @click="markPaid"
          >
            Xác nhận đã thanh toán
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="order && refundOpen"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-title"
      @click.self="refundOpen = false"
    >
      <div class="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <h3 id="refund-title" class="text-base font-semibold">Hoàn tiền đơn {{ orderCode(order.id) }}</h3>
        <p class="mt-1 text-[11px] text-slate-500">
          Đã thanh toán {{ formatVnd(order.total) }}. Hoàn toàn phần sẽ huỷ hoá đơn (giữ số), bút toán 5212/3331 ghi tự động.
        </p>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Số tiền hoàn</span>
            <input
              ref="refundAmountInput"
              v-model.number="refundForm.amount"
              type="number"
              min="1"
              :max="order.total"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Lý do</span>
            <input
              v-model="refundForm.reason"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              placeholder="Ví dụ: khách trả hàng, sai mẫu…"
            />
          </label>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            @click="refundOpen = false"
          >
            Bỏ
          </button>
          <button
            type="button"
            class="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
            :disabled="busy"
            @click="submitRefund"
          >
            Xác nhận hoàn tiền
          </button>
        </div>
      </div>
    </div>

    <AdminInvoiceDetail :order-id="id" :open="invoiceDetailOpen" @close="invoiceDetailOpen = false" />
  </div>
</template>
