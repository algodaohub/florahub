<script setup lang="ts">
import type { AdminOptions, AdminProductList } from '~/types/admin'
import { formatVnd } from '~/utils/format'
import { productStatusMeta } from '~/utils/admin'

definePageMeta({ layout: 'admin', middleware: 'admin', title: 'Sản phẩm' })

const route = useRoute()
const router = useRouter()
const requestFetch = useRequestFetch()

const perPage = 25
const page = ref(Math.max(1, Number(route.query.page ?? 1) || 1))
const filters = reactive({
  q: String(route.query.q ?? ''),
  category: String(route.query.category ?? ''),
  seller: String(route.query.seller ?? ''),
  status: String(route.query.status ?? ''),
  type: String(route.query.type ?? ''),
  sort: String(route.query.sort ?? 'newest')
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
  () => [filters.category, filters.seller, filters.status, filters.type, filters.sort],
  () => {
    applied.category = filters.category
    applied.seller = filters.seller
    applied.status = filters.status
    applied.type = filters.type
    applied.sort = filters.sort
    page.value = 1
  }
)

const query = computed(() => ({
  q: applied.q,
  category: applied.category,
  seller: applied.seller,
  status: applied.status,
  type: applied.type,
  sort: applied.sort,
  page: page.value,
  perPage
}))

const { data, pending, error, refresh } = await useAsyncData<AdminProductList>(
  'admin-products',
  () => requestFetch<AdminProductList>('/api/admin/products', { query: query.value }),
  { watch: [query] }
)

const { data: options } = await useAsyncData<AdminOptions>('admin-options', () =>
  requestFetch<AdminOptions>('/api/admin/options')
)

const items = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => data.value?.totalPages ?? 1)

watch(
  [applied, page],
  () => {
    router.replace({
      query: {
        ...(applied.q ? { q: applied.q } : {}),
        ...(applied.category ? { category: applied.category } : {}),
        ...(applied.seller ? { seller: applied.seller } : {}),
        ...(applied.status ? { status: applied.status } : {}),
        ...(applied.type ? { type: applied.type } : {}),
        ...(applied.sort !== 'newest' ? { sort: applied.sort } : {}),
        ...(page.value > 1 ? { page: String(page.value) } : {})
      }
    })
  },
  { deep: true }
)

function resetFilters() {
  Object.assign(filters, { q: '', category: '', seller: '', status: '', type: '', sort: 'newest' })
  Object.assign(applied, { q: '', category: '', seller: '', status: '', type: '', sort: 'newest' })
  page.value = 1
}

const hasFilters = computed(
  () => Boolean(applied.q || applied.category || applied.seller || applied.status || applied.type || applied.sort !== 'newest')
)

function priceLabel(product: (typeof items.value)[number]) {
  if (!product.variantCount) return '—'
  if (product.minPrice === product.maxPrice) return formatVnd(product.minPrice)
  return `${formatVnd(product.minPrice)} – ${formatVnd(product.maxPrice)}`
}

useHead({ title: 'Sản phẩm' })
</script>

<template>
  <div class="w-full space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-lg font-semibold">Sản phẩm</h2>
        <p class="text-sm text-slate-500">{{ total }} sản phẩm · quản lý biến thể, giá và tồn kho.</p>
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
          to="/admin/products/new"
          class="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
        >
          + Thêm sản phẩm
        </NuxtLink>
      </div>
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
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" stroke-linecap="round" />
          </svg>
          <input
            v-model="filters.q"
            type="search"
            class="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            placeholder="Tìm tên sản phẩm hoặc handle…"
          />
        </div>

        <select
          v-model="filters.category"
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
        >
          <option value="">Mọi danh mục</option>
          <option v-for="category in options?.categories ?? []" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>

        <select
          v-model="filters.seller"
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
        >
          <option value="">Mọi nhà bán</option>
          <option v-for="seller in options?.sellers ?? []" :key="seller.id" :value="seller.id">
            {{ seller.name }}
          </option>
        </select>

        <select
          v-model="filters.status"
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
        >
          <option value="">Mọi trạng thái</option>
          <option value="published">Đang bán</option>
          <option value="draft">Nháp</option>
          <option value="archived">Đã ẩn</option>
        </select>

        <select
          v-model="filters.type"
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
        >
          <option value="">Mọi loại</option>
          <option value="physical">Vật lý</option>
          <option value="digital">Sản phẩm số</option>
          <option value="service">Dịch vụ</option>
        </select>

        <select
          v-model="filters.sort"
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
        >
          <option value="newest">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
          <option value="title">Tên A→Z</option>
          <option value="updated">Vừa cập nhật</option>
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

      <div v-if="error" class="p-6 text-sm text-rose-700">
        Không tải được sản phẩm. {{ (error as any)?.data?.statusMessage || '' }}
      </div>

      <div v-else class="w-full overflow-x-auto">
        <table class="w-full min-w-[960px] text-left text-sm">
          <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-2.5 font-semibold">Sản phẩm</th>
              <th class="px-4 py-2.5 font-semibold">Danh mục</th>
              <th class="px-4 py-2.5 text-right font-semibold">Giá</th>
              <th class="px-4 py-2.5 text-right font-semibold">Tồn kho</th>
              <th class="px-4 py-2.5 font-semibold">Trạng thái</th>
              <th class="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="pending && items.length === 0">
              <td colspan="6" class="px-4 py-10 text-center text-sm text-slate-400">Đang tải sản phẩm…</td>
            </tr>
            <tr v-else-if="items.length === 0">
              <td colspan="6" class="px-4 py-12 text-center">
                <p class="text-sm font-medium text-slate-600">Chưa có sản phẩm nào khớp bộ lọc</p>
                <NuxtLink to="/admin/products/new" class="mt-2 inline-block text-xs font-semibold text-emerald-700 underline">
                  Thêm sản phẩm đầu tiên
                </NuxtLink>
              </td>
            </tr>
            <tr v-for="product in items" :key="product.id" class="hover:bg-slate-50/70">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <img
                    v-if="product.thumbnail"
                    :src="product.thumbnail"
                    :alt="product.title"
                    width="40"
                    height="40"
                    loading="lazy"
                    class="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover"
                  />
                  <span
                    v-else
                    class="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-[10px] text-slate-400"
                  >
                    ảnh
                  </span>
                  <div class="min-w-0">
                    <NuxtLink
                      :to="`/admin/products/${product.id}`"
                      class="block truncate font-medium text-slate-800 hover:text-emerald-700 hover:underline"
                    >
                      {{ product.title }}
                    </NuxtLink>
                    <p class="truncate font-mono text-[11px] text-slate-400">
                      {{ product.handle }} · {{ product.variantCount }} biến thể ·
                      {{ product.type === 'digital' ? 'sản phẩm số' : product.type === 'service' ? 'dịch vụ' : 'vật lý' }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-xs text-slate-600">
                <p>{{ product.category?.name ?? '—' }}</p>
                <p class="text-slate-400">{{ product.seller?.name ?? '—' }}</p>
              </td>
              <td class="px-4 py-3 text-right text-xs font-semibold text-slate-700">{{ priceLabel(product) }}</td>
              <td class="px-4 py-3 text-right text-xs">
                <span
                  class="font-semibold"
                  :class="product.stock <= 0 ? 'text-rose-600' : product.stock < 10 ? 'text-amber-600' : 'text-slate-700'"
                >
                  {{ product.stock }}
                </span>
                <span class="ml-1 text-slate-400">{{ product.unit }}</span>
              </td>
              <td class="px-4 py-3">
                <AdminBadge v-bind="productStatusMeta(product.status)" />
              </td>
              <td class="px-4 py-3 text-right">
                <NuxtLink
                  :to="`/admin/products/${product.id}`"
                  class="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-white"
                >
                  Sửa
                </NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

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
