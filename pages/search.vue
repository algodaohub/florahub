<script setup lang="ts">
import type { Category, ProductListResponse } from '~/types'

const route = useRoute()

const q = computed(() => String(route.query.q ?? '').trim())
const seller = computed(() => String(route.query.seller ?? '').trim())

const searchInput = ref(q.value)
const sort = ref('newest')
const category = ref('')
const page = ref(1)

watch(q, (value) => {
  searchInput.value = value
  page.value = 1
})

watch([q, seller], () => {
  page.value = 1
})

const query = computed(() => ({
  q: q.value || undefined,
  seller: seller.value || undefined,
  category: category.value || undefined,
  sort: sort.value,
  page: page.value,
  limit: 12
}))

const { data, pending } = await useFetch<ProductListResponse>('/api/products', { query })
const { data: categories } = await useFetch<Category[]>('/api/categories', { key: 'categories' })

function submitSearch() {
  navigateTo({ path: '/search', query: searchInput.value.trim() ? { q: searchInput.value.trim() } : {} })
}

function chooseCategory(slug: string) {
  category.value = category.value === slug ? '' : slug
  page.value = 1
}

function loadMore() {
  page.value += 1
}

useHead(() => ({ title: q.value ? `Tìm “${q.value}”` : 'Tìm kiếm' }))
</script>

<template>
  <div class="container-page py-3" :data-pending="pending">
    <header>
      <h1 class="t-page font-semibold">
        {{ q ? `Kết quả cho “${q}”` : 'Tìm kiếm' }}
      </h1>
      <p class="mt-0.5 t-meta text-muted">{{ data?.total ?? 0 }} sản phẩm</p>
    </header>

    <form class="mt-3 flex gap-2" role="search" @submit.prevent="submitSearch">
      <div class="relative flex-1">
        <input
          v-model="searchInput"
          type="search"
          class="field py-2.5 pl-9 t-body"
          placeholder="Tìm sản phẩm..."
          aria-label="Tìm kiếm sản phẩm"
        />
        <svg viewBox="0 0 24 24" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" stroke-linecap="round" />
        </svg>
      </div>
      <button type="submit" class="btn-primary px-4 py-2 t-meta">Tìm</button>
    </form>

    <div class="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
      <button type="button" class="chip shrink-0" :class="!category ? 'chip-active' : ''" @click="chooseCategory('')">Tất cả</button>
      <button v-for="item in categories ?? []" :key="item.id" type="button" class="chip shrink-0" :class="category === item.slug ? 'chip-active' : ''" @click="chooseCategory(item.slug)">
        {{ item.name }}
      </button>
    </div>

    <div class="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
      <button v-for="option in [{ value: 'newest', label: 'Liên quan' }, { value: 'price-asc', label: 'Giá thấp' }, { value: 'price-desc', label: 'Giá cao' }, { value: 'name', label: 'Tên A-Z' }]" :key="option.value" type="button" class="chip shrink-0" :class="sort === option.value ? 'chip-active' : ''" @click="sort = option.value; page = 1">
        {{ option.label }}
      </button>
    </div>

    <div v-if="pending" class="mt-3">
      <SkeletonGrid :count="6" :columns="2" />
    </div>

    <template v-else>
      <div v-if="data?.items.length" class="mt-3 grid grid-cols-2 gap-2.5">
        <ProductCard v-for="product in data?.items ?? []" :key="product.id" :product="product" />
      </div>
      <EmptyState
        v-else
        class="mt-6"
        title="Không tìm thấy sản phẩm"
        description="Thử từ khoá ngắn hơn, bỏ bộ lọc hoặc chọn danh mục khác."
        action-label="Xem danh mục"
        action-to="/categories"
      />

      <div v-if="data?.hasMore" class="mt-6 flex justify-center">
        <button type="button" class="btn-ghost" @click="loadMore">Tải thêm sản phẩm</button>
      </div>
    </template>
  </div>
</template>
