<script setup lang="ts">
import type { Category } from '~/types'

const { data: categories } = await useFetch<Category[]>('/api/categories', { key: 'categories' })

const activeSlug = computed(() => categories.value?.[0]?.slug ?? '')

useHead(() => ({ title: 'Danh mục' }))
</script>

<template>
  <div>
    <CategoryBrowser v-if="categories?.length" :categories="categories" :slug="activeSlug" />

    <template v-else>
      <PageHeader title="Danh mục" />
      <div class="px-3 pt-4">
        <EmptyState title="Chưa có danh mục" description="Danh mục sản phẩm sẽ xuất hiện tại đây." />
      </div>
    </template>
  </div>
</template>
