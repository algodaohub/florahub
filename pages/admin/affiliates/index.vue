<script setup lang="ts">
import type { AdminAffiliateList } from '~/types/admin'
import { formatVnd } from '~/utils/format'
import type { BadgeTone } from '~/utils/admin'

definePageMeta({ layout: 'admin', middleware: 'admin', title: 'Cộng tác viên' })

const route = useRoute()
const router = useRouter()
const requestFetch = useRequestFetch()

const perPage = 25
const page = ref(Math.max(1, Number(route.query.page ?? 1) || 1))
const filters = reactive({
  q: String(route.query.q ?? ''),
  status: String(route.query.status ?? '')
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
  () => filters.status,
  (value) => {
    applied.status = value
    page.value = 1
  }
)

const query = computed(() => ({
  q: applied.q,
  status: applied.status,
  page: page.value,
  perPage
}))

const { data, pending, error, refresh } = await useAsyncData<AdminAffiliateList>(
  'admin-affiliates',
  () => requestFetch<AdminAffiliateList>('/api/admin/affiliates', { query: query.value }),
  { watch: [query] }
)

const items = computed(() => data.value?.items ?? [])
const summary = computed(() => data.value?.summary ?? { affiliates: 0, active: 0, pending: 0, approved: 0, processing: 0, paid: 0 })
const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => data.value?.totalPages ?? 1)

watch(
  [applied, page],
  () => {
    router.replace({
      query: {
        ...(applied.q ? { q: applied.q } : {}),
        ...(applied.status ? { status: applied.status } : {}),
        ...(page.value > 1 ? { page: String(page.value) } : {})
      }
    })
  },
  { deep: true }
)

const AFFILIATE_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  active: { label: 'Hoạt động', tone: 'green' },
  suspended: { label: 'Tạm dừng', tone: 'rose' }
}

function affiliateStatusMeta(status: string) {
  return AFFILIATE_STATUS_META[status] ?? { label: status || '—', tone: 'gray' as BadgeTone }
}

function resetFilters() {
  filters.q = ''
  filters.status = ''
  applied.q = ''
  applied.status = ''
  page.value = 1
}

const hasFilters = computed(() => Boolean(applied.q || applied.status))

useHead({ title: 'Cộng tác viên' })
</script>

<template>
  <div class="w-full space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-lg font-semibold">Cộng tác viên</h2>
        <p class="text-sm text-slate-500">{{ total }} cộng tác viên · theo dõi hoa hồng và đối soát chi trả.</p>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          :disabled="pending"
          @click="refresh()"
        >
          {{ pending ? 'Đang tải…' : 'Làm mới' }}
        </button>
        <NuxtLink
          to="/admin/affiliate-payouts"
          class="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
        >
          Phiếu chi hoa hồng
        </NuxtLink>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <template v-if="pending">
        <div v-for="tile in 5" :key="tile" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="h-3 w-24 animate-pulse rounded bg-slate-100" />
          <div class="mt-2 h-6 w-28 animate-pulse rounded bg-slate-100" />
        </div>
      </template>
      <template v-else>
        <AdminStatTile
          label="CTV hoạt động"
          :value="`${summary.active}/${summary.affiliates}`"
          hint="Tổng số hồ sơ cộng tác viên"
          tone="emerald"
        />
        <AdminStatTile label="Chờ duyệt" :value="formatVnd(summary.pending)" hint="Chưa hết thời gian giữ" tone="amber" />
        <AdminStatTile label="Khả dụng" :value="formatVnd(summary.approved)" hint="Sẵn sàng lập phiếu chi" tone="sky" />
        <AdminStatTile label="Đang chi trả" :value="formatVnd(summary.processing)" hint="Trong phiếu nháp" tone="violet" />
        <AdminStatTile label="Đã chi trả" :value="formatVnd(summary.paid)" hint="Hoa hồng đã khoá" tone="emerald" />
      </template>
    </div>

    <div v-if="error" class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      <p>Không tải được danh sách cộng tác viên.</p>
      <button type="button" class="mt-2 rounded-lg border border-rose-300 px-3 py-1 text-xs font-semibold" @click="refresh()">
        Thử lại
      </button>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div class="flex flex-col gap-2 border-b border-slate-200 p-3 lg:flex-row lg:items-center">
        <div class="relative flex-1">
          <svg
            viewBox="0 0 24 24"
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" stroke-linecap="round" />
          </svg>
          <input
            v-model="filters.q"
            type="search"
            placeholder="Tìm mã CTV, tên hoặc email…"
            class="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <select
          v-model="filters.status"
          class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        >
          <option value="">Mọi trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="suspended">Tạm dừng</option>
        </select>
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
        <table class="w-full min-w-[880px] text-left text-sm">
          <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-3 py-2 font-semibold">Cộng tác viên</th>
              <th class="px-3 py-2 font-semibold">Tỷ lệ</th>
              <th class="px-3 py-2 font-semibold">Trạng thái</th>
              <th class="px-3 py-2 text-right font-semibold">Khả dụng</th>
              <th class="px-3 py-2 text-right font-semibold">Đang chi</th>
              <th class="px-3 py-2 text-right font-semibold">Đã chi</th>
              <th class="px-3 py-2 font-semibold">Ngân hàng</th>
              <th class="px-3 py-2 text-right font-semibold"> </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <template v-if="pending">
              <tr v-for="row in 6" :key="`skeleton-${row}`">
                <td class="px-3 py-3">
                  <div class="h-4 w-36 animate-pulse rounded bg-slate-100" />
                  <div class="mt-1.5 h-3 w-48 animate-pulse rounded bg-slate-100" />
                </td>
                <td class="px-3 py-3"><div class="h-4 w-12 animate-pulse rounded bg-slate-100" /></td>
                <td class="px-3 py-3"><div class="h-5 w-20 animate-pulse rounded-full bg-slate-100" /></td>
                <td class="px-3 py-3"><div class="ml-auto h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                <td class="px-3 py-3"><div class="ml-auto h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                <td class="px-3 py-3"><div class="ml-auto h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                <td class="px-3 py-3"><div class="h-4 w-32 animate-pulse rounded bg-slate-100" /></td>
                <td class="px-3 py-3"><div class="ml-auto h-7 w-16 animate-pulse rounded bg-slate-100" /></td>
              </tr>
            </template>

            <tr v-else-if="items.length === 0">
              <td colspan="8" class="px-3 py-10 text-center">
                <p class="text-sm font-medium text-slate-600">Không có cộng tác viên phù hợp.</p>
                <p class="mt-1 text-xs text-slate-400">
                  {{ hasFilters ? 'Thử xoá bộ lọc để xem toàn bộ.' : 'Cộng tác viên sẽ xuất hiện khi khách tham gia chương trình.' }}
                </p>
              </td>
            </tr>

            <template v-else>
              <tr v-for="item in items" :key="item.id" class="hover:bg-slate-50/60">
                <td class="px-3 py-3">
                  <p class="font-semibold text-slate-800">{{ item.name || item.code }}</p>
                  <p class="text-xs text-slate-500">
                    <span class="font-mono">{{ item.code }}</span>
                    <template v-if="item.email"> · {{ item.email }}</template>
                  </p>
                </td>
                <td class="px-3 py-3">
                  <p class="font-semibold text-slate-700">{{ item.effectiveRate }}%</p>
                  <p class="text-[11px] text-slate-400">{{ item.customRate ? 'Tỷ lệ riêng' : 'Theo cửa hàng' }}</p>
                </td>
                <td class="px-3 py-3">
                  <AdminBadge v-bind="affiliateStatusMeta(item.status)" />
                </td>
                <td class="px-3 py-3 text-right tabular-nums text-slate-700">{{ formatVnd(item.stats.approved) }}</td>
                <td class="px-3 py-3 text-right tabular-nums text-slate-700">{{ formatVnd(item.stats.processing) }}</td>
                <td class="px-3 py-3 text-right tabular-nums text-slate-700">{{ formatVnd(item.stats.paid) }}</td>
                <td class="px-3 py-3">
                  <template v-if="item.bankReady">
                    <p class="text-xs font-medium text-slate-700">{{ item.bankName || '—' }}</p>
                    <p class="text-[11px] text-slate-400">{{ item.bankAccountMasked }}</p>
                  </template>
                  <span v-else class="text-xs text-amber-700">Chưa cập nhật</span>
                </td>
                <td class="px-3 py-3 text-right">
                  <NuxtLink
                    :to="`/admin/affiliates/${item.id}`"
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
