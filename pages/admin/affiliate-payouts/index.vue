<script setup lang="ts">
import type { AdminAffiliatePayoutList, AdminAffiliateReconcileResult } from '~/types/admin'
import { formatDate, formatVnd } from '~/utils/format'
import { payoutStatusMeta } from '~/utils/admin'

definePageMeta({ layout: 'admin', middleware: 'admin', title: 'Phiếu chi hoa hồng' })

const route = useRoute()
const router = useRouter()
const requestFetch = useRequestFetch()

const perPage = 25
const page = ref(Math.max(1, Number(route.query.page ?? 1) || 1))
const filters = reactive({
  status: String(route.query.status ?? ''),
  from: String(route.query.from ?? ''),
  to: String(route.query.to ?? '')
})

const query = computed(() => ({
  status: filters.status,
  from: filters.from,
  to: filters.to,
  page: page.value,
  perPage
}))

const { data, pending, error, refresh } = await useAsyncData<AdminAffiliatePayoutList>(
  'admin-affiliate-payouts',
  () => requestFetch<AdminAffiliatePayoutList>('/api/admin/affiliate-payouts', { query: query.value }),
  { watch: [query] }
)

const items = computed(() => data.value?.items ?? [])
const summary = computed(() => data.value?.summary ?? { draft: 0, paid: 0, paidNet: 0 })
const policy = computed(() => data.value?.policy ?? { threshold: 0, autoReconcile: true })
const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => data.value?.totalPages ?? 1)

const reconciling = ref(false)
const reconcileError = ref('')
const reconcileResult = ref<AdminAffiliateReconcileResult | null>(null)

async function runReconcile() {
  if (reconciling.value) return
  reconciling.value = true
  reconcileError.value = ''
  reconcileResult.value = null
  try {
    const response = await $fetch<{ result: AdminAffiliateReconcileResult }>(
      '/api/admin/affiliate-payouts/reconcile',
      { method: 'POST' }
    )
    reconcileResult.value = response.result
    await refresh()
  } catch (err) {
    reconcileError.value = apiErrorMessage(err, 'Không chạy được đối soát. Vui lòng thử lại.')
  } finally {
    reconciling.value = false
  }
}

watch(filters, () => {
  page.value = 1
})

watch(
  [filters, page],
  () => {
    router.replace({
      query: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
        ...(page.value > 1 ? { page: String(page.value) } : {})
      }
    })
  },
  { deep: true }
)

function resetFilters() {
  filters.status = ''
  filters.from = ''
  filters.to = ''
  page.value = 1
}

const hasFilters = computed(() => Boolean(filters.status || filters.from || filters.to))

useHead({ title: 'Phiếu chi hoa hồng' })
</script>

<template>
  <div class="w-full space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-lg font-semibold">Phiếu chi hoa hồng</h2>
        <p class="text-sm text-slate-500">
          {{ total }} phiếu · lập nháp, xác nhận chi và lưu chứng từ đối soát.
        </p>
        <p class="mt-1 text-xs text-slate-400">
          Hạn mức chi trả:
          <strong class="text-slate-600">
            {{ policy.threshold > 0 ? formatVnd(policy.threshold) : 'Không giới hạn' }}
          </strong>
          · {{ policy.autoReconcile ? 'Tự động đối soát hàng tháng' : 'Đối soát thủ công' }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          :disabled="pending"
          @click="refresh()"
        >
          {{ pending ? 'Đang tải…' : 'Làm mới' }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          :disabled="reconciling"
          @click="runReconcile"
        >
          {{ reconciling ? 'Đang đối soát…' : 'Chạy đối soát' }}
        </button>
        <NuxtLink
          to="/admin/affiliates"
          class="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
        >
          Cộng tác viên
        </NuxtLink>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-3">
      <template v-if="pending">
        <div v-for="tile in 3" :key="tile" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="h-3 w-24 animate-pulse rounded bg-slate-100" />
          <div class="mt-2 h-6 w-28 animate-pulse rounded bg-slate-100" />
        </div>
      </template>
      <template v-else>
        <AdminStatTile label="Phiếu nháp" :value="`${summary.draft} phiếu`" hint="Chờ xác nhận chi" tone="amber" />
        <AdminStatTile label="Phiếu đã chi" :value="`${summary.paid} phiếu`" hint="Đã khoá hoa hồng" tone="emerald" />
        <AdminStatTile label="Tổng thực chi" :value="formatVnd(summary.paidNet)" hint="Sau khấu trừ TNCN" tone="sky" />
      </template>
    </div>

    <div v-if="error" class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      <p>Không tải được danh sách phiếu chi.</p>
      <button type="button" class="mt-2 rounded-lg border border-rose-300 px-3 py-1 text-xs font-semibold" @click="refresh()">
        Thử lại
      </button>
    </div>

    <div v-if="reconcileError" class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">
      {{ reconcileError }}
    </div>

    <div
      v-if="reconcileResult"
      class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
      role="status"
    >
      <p class="font-semibold">
        Đã chạy đối soát
        {{ reconcileResult.periodFrom ? formatDate(reconcileResult.periodFrom) : '—' }} →
        {{ reconcileResult.periodTo ? formatDate(reconcileResult.periodTo) : '—' }}
      </p>
      <p class="mt-1 text-xs text-emerald-700">
        Duyệt {{ reconcileResult.approvedLines }} dòng ({{ formatVnd(reconcileResult.approvedGross) }}) ·
        Lập mới {{ reconcileResult.created }} phiếu · Cộng vào nháp {{ reconcileResult.toppedUp }} phiếu
      </p>
      <p class="mt-1 text-xs text-emerald-700">
        Chưa đạt hạn mức: {{ reconcileResult.skippedThreshold }} CTV ·
        Thiếu ngân hàng: {{ reconcileResult.skippedNoBank }} CTV ·
        Lỗi: {{ reconcileResult.errors }}
      </p>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div class="flex flex-col gap-2 border-b border-slate-200 p-3 lg:flex-row lg:items-center">
        <select v-model="filters.status" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <option value="">Mọi trạng thái</option>
          <option value="draft">Phiếu nháp</option>
          <option value="paid">Đã chi</option>
          <option value="cancelled">Đã huỷ</option>
        </select>
        <label class="flex items-center gap-2 text-xs text-slate-500">
          <span>Từ</span>
          <input v-model="filters.from" type="date" class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700" />
        </label>
        <label class="flex items-center gap-2 text-xs text-slate-500">
          <span>Đến</span>
          <input v-model="filters.to" type="date" class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700" />
        </label>
        <button
          v-if="hasFilters"
          type="button"
          class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50"
          @click="resetFilters"
        >
          Xoá lọc
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[940px] text-left text-sm">
          <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-3 py-2 font-semibold">Số phiếu</th>
              <th class="px-3 py-2 font-semibold">Cộng tác viên</th>
              <th class="px-3 py-2 text-right font-semibold">Tổng hoa hồng</th>
              <th class="px-3 py-2 text-right font-semibold">TNCN</th>
              <th class="px-3 py-2 text-right font-semibold">Thực chi</th>
              <th class="px-3 py-2 text-center font-semibold">Dòng</th>
              <th class="px-3 py-2 font-semibold">Trạng thái</th>
              <th class="px-3 py-2 font-semibold">Ngày lập</th>
              <th class="px-3 py-2 text-right font-semibold"> </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <template v-if="pending">
              <tr v-for="row in 6" :key="`skeleton-${row}`">
                <td class="px-3 py-3"><div class="h-4 w-24 animate-pulse rounded bg-slate-100" /></td>
                <td class="px-3 py-3">
                  <div class="h-4 w-36 animate-pulse rounded bg-slate-100" />
                  <div class="mt-1.5 h-3 w-28 animate-pulse rounded bg-slate-100" />
                </td>
                <td class="px-3 py-3"><div class="ml-auto h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                <td class="px-3 py-3"><div class="ml-auto h-4 w-16 animate-pulse rounded bg-slate-100" /></td>
                <td class="px-3 py-3"><div class="ml-auto h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                <td class="px-3 py-3"><div class="mx-auto h-4 w-8 animate-pulse rounded bg-slate-100" /></td>
                <td class="px-3 py-3"><div class="h-5 w-20 animate-pulse rounded-full bg-slate-100" /></td>
                <td class="px-3 py-3"><div class="h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                <td class="px-3 py-3"><div class="ml-auto h-7 w-16 animate-pulse rounded bg-slate-100" /></td>
              </tr>
            </template>
            <tr v-else-if="items.length === 0">
              <td colspan="9" class="px-3 py-10 text-center">
                <p class="text-sm font-medium text-slate-600">Không có phiếu chi phù hợp.</p>
                <p class="mt-1 text-xs text-slate-400">
                  {{ hasFilters ? 'Thử xoá bộ lọc để xem toàn bộ.' : 'Lập phiếu chi từ trang chi tiết cộng tác viên.' }}
                </p>
              </td>
            </tr>
            <template v-else>
              <tr v-for="item in items" :key="item.id" class="hover:bg-slate-50/60">
                <td class="px-3 py-3">
                  <p class="font-mono text-xs font-semibold text-slate-800">{{ item.number }}</p>
                  <p v-if="item.reference" class="text-[11px] text-slate-400">{{ item.reference }}</p>
                </td>
                <td class="px-3 py-3">
                  <p class="font-medium text-slate-800">{{ item.affiliateName || item.affiliateCode }}</p>
                  <p class="text-xs text-slate-500">
                    <span class="font-mono">{{ item.affiliateCode }}</span>
                    <template v-if="item.affiliateEmail"> · {{ item.affiliateEmail }}</template>
                  </p>
                </td>
                <td class="px-3 py-3 text-right tabular-nums text-slate-700">{{ formatVnd(item.grossTotal) }}</td>
                <td class="px-3 py-3 text-right tabular-nums text-rose-700">−{{ formatVnd(item.taxTotal) }}</td>
                <td class="px-3 py-3 text-right font-semibold tabular-nums">{{ formatVnd(item.netTotal) }}</td>
                <td class="px-3 py-3 text-center text-slate-600">{{ item.commissionCount }}</td>
                <td class="px-3 py-3"><AdminBadge v-bind="payoutStatusMeta(item.status)" /></td>
                <td class="px-3 py-3 text-xs text-slate-500">
                  {{ item.createdAt ? formatDate(item.createdAt) : '—' }}
                  <p v-if="item.paidAt" class="text-[11px] text-emerald-700">Chi {{ formatDate(item.paidAt) }}</p>
                </td>
                <td class="px-3 py-3 text-right">
                  <NuxtLink
                    :to="`/admin/affiliate-payouts/${item.id}`"
                    class="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-white"
                  >
                    Chi tiết
                  </NuxtLink>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <AdminPagination
        v-if="!pending && data"
        :page="page"
        :total-pages="totalPages"
        :total="total"
        :per-page="perPage"
        @update:page="page = $event"
      />
    </div>
  </div>
</template>
