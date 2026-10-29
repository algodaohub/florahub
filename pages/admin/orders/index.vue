<script setup lang="ts">
import type { AdminOrderList, AdminOrderSummary } from '~/types/admin'
import { formatDateTime, formatVnd } from '~/utils/format'
import { orderStatusMeta, paymentMethodLabel, paymentStatusMeta } from '~/utils/admin'

definePageMeta({ layout: 'admin', middleware: 'admin', title: 'Đơn hàng' })

const route = useRoute()
const router = useRouter()
const requestFetch = useRequestFetch()

const perPage = 25
const page = ref(Math.max(1, Number(route.query.page ?? 1) || 1))
const filters = reactive({
  q: String(route.query.q ?? ''),
  status: String(route.query.status ?? ''),
  payment: String(route.query.payment ?? ''),
  from: String(route.query.from ?? ''),
  to: String(route.query.to ?? '')
})
const applied = reactive({ ...filters })

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => filters.q,
  (value) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      applied.q = value.trim()
      page.value = 1
    }, 300)
  }
)
watch(
  () => [filters.status, filters.payment, filters.from, filters.to],
  () => {
    applied.status = filters.status
    applied.payment = filters.payment
    applied.from = filters.from
    applied.to = filters.to
    page.value = 1
  }
)

const query = computed(() => ({
  q: applied.q,
  status: applied.status,
  payment: applied.payment,
  from: applied.from,
  to: applied.to,
  page: page.value,
  perPage
}))

const { data, pending, error, refresh } = await useAsyncData<AdminOrderList>(
  'admin-orders',
  () => requestFetch<AdminOrderList>('/api/admin/orders', { query: query.value }),
  { watch: [query] }
)

const { data: summary, refresh: refreshSummary } = await useAsyncData<AdminOrderSummary>(
  'admin-orders-summary',
  () => requestFetch<AdminOrderSummary>('/api/admin/orders/summary')
)

const items = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => data.value?.totalPages ?? 1)

function reloadAll() {
  refresh()
  refreshSummary()
}

watch(
  [applied, page],
  () => {
    router.replace({
      query: {
        ...(applied.q ? { q: applied.q } : {}),
        ...(applied.status ? { status: applied.status } : {}),
        ...(applied.payment ? { payment: applied.payment } : {}),
        ...(applied.from ? { from: applied.from } : {}),
        ...(applied.to ? { to: applied.to } : {}),
        ...(page.value > 1 ? { page: String(page.value) } : {})
      }
    })
  },
  { deep: true }
)

function resetFilters() {
  filters.q = ''
  filters.status = ''
  filters.payment = ''
  filters.from = ''
  filters.to = ''
  Object.assign(applied, filters)
  page.value = 1
}

const hasFilters = computed(() =>
  Boolean(applied.q || applied.status || applied.payment || applied.from || applied.to)
)

const STATUS_OPTIONS = ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'].map((value) => ({
  value,
  label: orderStatusMeta(value).label
}))

const statusChips = computed(() => [
  { value: '', label: 'Tất cả', count: summary.value?.totalOrders ?? 0 },
  ...STATUS_OPTIONS.map((option) => ({
    ...option,
    count: summary.value?.statusCounts?.[option.value] ?? 0
  }))
])

const PAYMENT_OPTIONS = [
  { value: '', label: 'Mọi thanh toán' },
  { value: 'pending', label: 'Chờ thanh toán' },
  { value: 'cod', label: 'Thu khi giao' },
  { value: 'paid', label: 'Đã thanh toán' },
  { value: 'refunded', label: 'Đã hoàn tiền' }
]

function localDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function applyPreset(days: number) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (days > 1) start.setDate(start.getDate() - (days - 1))
  filters.from = localDate(start)
  filters.to = localDate(now)
}

function clearDates() {
  filters.from = ''
  filters.to = ''
}

function orderCode(id: string) {
  return `#${id.slice(-6).toUpperCase()}`
}

useHead({ title: 'Đơn hàng' })
</script>

<template>
  <div class="w-full space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-lg font-semibold">Đơn hàng</h2>
        <p class="text-sm text-slate-500">
          Tổng {{ summary?.totalOrders ?? total }} đơn · cập nhật theo thời gian thực từ PocketBase.
        </p>
      </div>
      <button
        type="button"
        class="self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        :disabled="pending"
        @click="reloadAll()"
      >
        {{ pending ? 'Đang tải…' : 'Làm mới' }}
      </button>
    </div>

    <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <AdminStatTile
        label="Chờ xác nhận"
        tone="amber"
        :value="String(summary?.pendingOrders ?? '—')"
        hint="đơn mới cần xử lý"
      />
      <AdminStatTile
        label="Chờ thanh toán"
        tone="sky"
        :value="String(summary?.pendingPayments ?? '—')"
        :hint="summary ? `Cần thu ${formatVnd(summary.awaitingAmount)}` : ''"
      />
      <AdminStatTile
        label="Đã thanh toán hôm nay"
        tone="emerald"
        :value="String(summary?.paidToday ?? '—')"
        hint="giao dịch ghi nhận hôm nay"
      />
      <AdminStatTile
        label="Doanh thu hôm nay"
        tone="emerald"
        :value="summary ? formatVnd(summary.revenueToday) : '—'"
        :hint="summary ? `${summary.completedToday} đơn hoàn tất` : ''"
      />
    </div>

    <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div class="space-y-3 border-b border-slate-200 p-3">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div class="relative flex-1">
            <svg
              viewBox="0 0 24 24"
              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" stroke-linecap="round" />
            </svg>
            <input
              v-model="filters.q"
              type="search"
              class="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              placeholder="Tìm mã đơn, email, tên, số điện thoại…"
            />
          </div>

          <select
            v-model="filters.payment"
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
          >
            <option v-for="option in PAYMENT_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>

          <button
            v-if="hasFilters"
            type="button"
            class="rounded-lg px-2 py-2 text-xs font-medium text-slate-500 hover:text-slate-800"
            @click="resetFilters"
          >
            Xoá lọc
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <button
            v-for="chip in statusChips"
            :key="chip.value"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition"
            :class="
              filters.status === chip.value
                ? 'border-emerald-700 bg-emerald-700 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            "
            @click="filters.status = chip.value"
          >
            {{ chip.label }}
            <span
              class="rounded-full px-1.5 text-[10px] font-semibold"
              :class="filters.status === chip.value ? 'bg-white/20' : 'bg-slate-100 text-slate-500'"
            >
              {{ chip.count }}
            </span>
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span class="font-medium text-slate-400">Ngày tạo</span>
          <input
            v-model="filters.from"
            type="date"
            class="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-emerald-600"
            aria-label="Từ ngày"
          />
          <span>→</span>
          <input
            v-model="filters.to"
            type="date"
            class="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-emerald-600"
            aria-label="Đến ngày"
          />
          <button
            v-for="preset in [
              { label: 'Hôm nay', days: 1 },
              { label: '7 ngày', days: 7 },
              { label: '30 ngày', days: 30 }
            ]"
            :key="preset.days"
            type="button"
            class="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
            @click="applyPreset(preset.days)"
          >
            {{ preset.label }}
          </button>
          <button
            v-if="filters.from || filters.to"
            type="button"
            class="text-[11px] font-medium text-slate-400 hover:text-slate-700"
            @click="clearDates"
          >
            Bỏ ngày
          </button>
        </div>
      </div>

      <div v-if="error" class="p-6 text-sm text-rose-700">
        Không tải được danh sách đơn. {{ (error as any)?.data?.statusMessage || '' }}
      </div>

      <template v-else>
        <div class="hidden w-full overflow-x-auto md:block">
          <table class="w-full min-w-[900px] text-left text-sm">
            <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-2.5 font-semibold">Mã đơn</th>
                <th class="px-4 py-2.5 font-semibold">Khách hàng</th>
                <th class="px-4 py-2.5 font-semibold">Ngày</th>
                <th class="px-4 py-2.5 font-semibold">Thanh toán</th>
                <th class="px-4 py-2.5 font-semibold">Trạng thái</th>
                <th class="px-4 py-2.5 text-right font-semibold">Tổng</th>
                <th class="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <template v-if="pending && items.length === 0">
                <tr v-for="row in 6" :key="row">
                  <td colspan="7" class="px-4 py-3">
                    <div class="h-4 animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              </template>
              <tr v-else-if="items.length === 0">
                <td colspan="7" class="px-4 py-12 text-center">
                  <p class="text-sm font-medium text-slate-600">Không có đơn nào khớp bộ lọc</p>
                  <button
                    v-if="hasFilters"
                    type="button"
                    class="mt-2 text-xs font-semibold text-emerald-700 underline"
                    @click="resetFilters"
                  >
                    Xoá bộ lọc
                  </button>
                </td>
              </tr>
              <template v-else>
                <tr
                  v-for="order in items"
                  :key="order.id"
                  class="hover:bg-slate-50/70"
                  :class="order.status === 'pending' || order.paymentStatus === 'pending' ? 'bg-amber-50/30' : ''"
                >
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-1.5">
                      <NuxtLink
                        :to="`/admin/orders/${order.id}`"
                        class="font-mono text-xs font-semibold text-emerald-800 hover:underline"
                      >
                        {{ orderCode(order.id) }}
                      </NuxtLink>
                      <span
                        v-if="order.hasAffiliate"
                        class="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200"
                        :title="`Affiliate ${order.affiliateCode}`"
                      >
                        Aff
                      </span>
                    </div>
                    <p class="mt-0.5 text-[11px] text-slate-400">
                      {{ order.itemCount }} món<span v-if="order.taxInvoiceNumber"> · HĐ {{ order.taxInvoiceNumber }}</span>
                    </p>
                  </td>
                  <td class="px-4 py-3">
                    <p class="font-medium text-slate-800">{{ order.shippingName || '—' }}</p>
                    <p class="text-[11px] text-slate-500">{{ order.email }}</p>
                    <p v-if="order.shippingPhone" class="text-[11px] text-slate-400">{{ order.shippingPhone }}</p>
                  </td>
                  <td class="px-4 py-3 text-xs text-slate-500">{{ formatDateTime(order.createdAt) }}</td>
                  <td class="px-4 py-3">
                    <AdminBadge v-bind="paymentStatusMeta(order.paymentStatus)" />
                    <p class="mt-1 text-[11px] text-slate-400">{{ paymentMethodLabel(order.paymentMethod) }}</p>
                    <p v-if="order.paidAt" class="text-[11px] text-emerald-700">TT {{ formatDateTime(order.paidAt) }}</p>
                  </td>
                  <td class="px-4 py-3">
                    <AdminBadge v-bind="orderStatusMeta(order.status)" />
                    <p
                      v-if="order.shippingCarrierName || order.shippingStatusText || order.shippingReturning"
                      class="mt-1 text-[11px] text-slate-400"
                    >
                      <span class="font-medium text-slate-500">
                        {{ order.shippingCarrierName || order.shippingCarrier }}
                      </span>
                      <template v-if="order.shippingStatusText"> · {{ order.shippingStatusText }}</template>
                      <span v-if="order.shippingReturning" class="text-violet-600"> · Chuyển hoàn</span>
                    </p>
                  </td>
                  <td class="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">
                    {{ formatVnd(order.total) }}
                  </td>
                  <td class="px-4 py-3 text-right">
                    <NuxtLink
                      :to="`/admin/orders/${order.id}`"
                      class="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-white"
                    >
                      Mở
                      <span aria-hidden="true">›</span>
                    </NuxtLink>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div class="divide-y divide-slate-100 md:hidden">
          <div v-if="pending && items.length === 0" class="space-y-3 p-4">
            <div v-for="row in 4" :key="row" class="h-16 animate-pulse rounded-lg bg-slate-100" />
          </div>
          <div v-else-if="items.length === 0" class="px-4 py-12 text-center">
            <p class="text-sm font-medium text-slate-600">Không có đơn nào khớp bộ lọc</p>
            <button
              v-if="hasFilters"
              type="button"
              class="mt-2 text-xs font-semibold text-emerald-700 underline"
              @click="resetFilters"
            >
              Xoá bộ lọc
            </button>
          </div>
          <template v-else>
            <NuxtLink
              v-for="order in items"
              :key="order.id"
              :to="`/admin/orders/${order.id}`"
              class="block px-4 py-3 hover:bg-slate-50"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-800">
                    {{ orderCode(order.id) }}
                    <span
                      v-if="order.hasAffiliate"
                      class="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200"
                    >
                      Aff
                    </span>
                  </p>
                  <p class="mt-1 truncate text-sm font-medium text-slate-800">{{ order.shippingName || order.email }}</p>
                  <p class="truncate text-[11px] text-slate-500">{{ order.email }}</p>
                </div>
                <p class="shrink-0 text-sm font-semibold tabular-nums text-slate-800">{{ formatVnd(order.total) }}</p>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-1.5">
                <AdminBadge v-bind="orderStatusMeta(order.status)" />
                <AdminBadge v-bind="paymentStatusMeta(order.paymentStatus)" />
                <span class="text-[11px] text-slate-400">{{ paymentMethodLabel(order.paymentMethod) }}</span>
                <span v-if="order.shippingCarrierName" class="text-[11px] text-slate-400">
                  · {{ order.shippingCarrierName }}
                </span>
                <span v-if="order.shippingStatusText" class="text-[11px] text-slate-400">
                  · {{ order.shippingStatusText }}
                </span>
                <span v-if="order.shippingReturning" class="text-[11px] font-semibold text-violet-600">Chuyển hoàn</span>
              </div>
              <p class="mt-1 text-[11px] text-slate-400">{{ formatDateTime(order.createdAt) }}</p>
            </NuxtLink>
          </template>
        </div>
      </template>

      <AdminPagination
        :page="page"
        :total-pages="totalPages"
        :total="total"
        :per-page="perPage"
        @update:page="page = $event"
      />
    </div>
  </div>
</template>
