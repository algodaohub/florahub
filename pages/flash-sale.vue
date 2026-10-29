<script setup lang="ts">
import type { HomeData } from '~/types'

const { data, pending } = await useFetch<HomeData>('/api/home', {
  key: 'home',
  lazy: !import.meta.server
})

const flashSale = computed(() => data.value?.flashSale ?? null)
const { label: countdown } = useCountdown(computed(() => flashSale.value?.endsAt ?? null))

useHead({ title: 'Ưu đãi hôm nay' })
</script>

<template>
  <div class="container-page py-6">
    <header class="card flex flex-wrap items-center justify-between gap-4 p-5">
      <div>
        <p class="chip">Flash sale</p>
        <h1 class="mt-2 t-page font-semibold">
          {{ flashSale?.title ?? 'Ưu đãi hôm nay' }}
        </h1>
        <p class="mt-1 t-body text-muted">Giá ưu đãi áp dụng đến khi hết khung giờ hoặc hết số lượng.</p>
      </div>
      <div class="rounded-xl2 bg-primary-soft px-4 py-3 text-center">
        <p class="t-micro uppercase tracking-wide text-primary/80">Kết thúc sau</p>
        <p class="mt-0.5 t-page font-semibold tabular-nums text-primary">{{ countdown }}</p>
      </div>
    </header>

    <div v-if="pending" class="mt-4">
      <SkeletonGrid :count="6" :columns="2" />
    </div>

    <div v-else-if="flashSale?.items.length" class="mt-4 grid grid-cols-2 gap-2.5">
      <ProductCard
        v-for="item in flashSale.items"
        :key="item.id"
        :product="item.product"
        :sale-price="item.salePrice"
      />
    </div>

    <EmptyState
      v-else
      class="mt-6"
      title="Chưa có ưu đãi"
      description="Khung giờ ưu đãi tiếp theo sẽ sớm được mở."
      action-label="Xem tất cả sản phẩm"
      action-to="/search"
    />
  </div>
</template>
