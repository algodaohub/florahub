<script setup lang="ts">
import type { Category } from '~/types'

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))

const { data: categories } = await useFetch<Category[]>('/api/categories', { key: 'categories' })
const category = computed(() => categories.value?.find((item) => item.slug === slug.value))

useHead(() => ({ title: category.value?.name ?? 'Danh mục' }))
</script>

<template>
  <div>
    <CategoryBrowser v-if="categories?.length" :key="slug" :categories="categories" :slug="slug" back />

    <template v-else>
      <PageHeader :title="category?.name ?? 'Danh mục'" back />
      <div class="px-3 pt-4">
        <EmptyState title="Chưa có danh mục" description="Danh mục sản phẩm sẽ xuất hiện tại đây." />
      </div>
    </template>
  </div>
</template>
