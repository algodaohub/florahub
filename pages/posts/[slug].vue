<script setup lang="ts">
import type { Post } from '~/types'

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))

const { data: post, pending, error } = await useFetch<Post>(
  () => `/api/posts/${slug.value}`,
  { lazy: !import.meta.server }
)

const paragraphs = computed(() => post.value?.body.split('\n').map((line) => line.trim()).filter(Boolean) ?? [])

useHead(() => ({
  title: post.value ? post.value.title : 'Bài viết',
  meta: post.value ? [{ name: 'description', content: post.value.excerpt }] : []
}))
</script>

<template>
  <div v-if="pending" class="container-page">
    <SkeletonArticle />
  </div>

  <div v-else-if="error || !post" class="container-page py-10">
    <EmptyState
      title="Không tìm thấy bài viết"
      description="Bài viết có thể đã được di chuyển."
      action-label="Xem tất cả bài viết"
      action-to="/posts"
    />
  </div>

  <article v-else class="container-page py-6">
    <nav class="t-meta text-muted" aria-label="Đường dẫn">
      <NuxtLink to="/" class="hover:text-primary">Trang chủ</NuxtLink>
      <span class="px-1.5">/</span>
      <NuxtLink to="/posts" class="hover:text-primary">Cẩm nang</NuxtLink>
      <span class="px-1.5">/</span>
      <span class="text-ink">{{ post.title }}</span>
    </nav>

    <header class="mx-auto mt-4 max-w-3xl">
      <p class="t-meta uppercase tracking-wide text-muted">{{ formatDate(post.publishedAt) }}</p>
      <h1 class="mt-2 t-page font-semibold leading-tight">{{ post.title }}</h1>
      <p class="mt-3 t-section text-muted">{{ post.excerpt }}</p>
    </header>

    <div class="mx-auto mt-6 max-w-4xl overflow-hidden rounded-xl2 border border-hairline/70">
      <img :src="post.coverUrl" :alt="post.title" width="960" height="480" fetchpriority="high" decoding="async" class="aspect-[16/8] w-full object-cover" />
    </div>

    <div class="prose-flora mx-auto mt-6 max-w-3xl">
      <p v-for="(paragraph, index) in paragraphs" :key="index">{{ paragraph }}</p>
    </div>

    <div class="mx-auto mt-8 max-w-3xl">
      <NuxtLink to="/posts" class="btn-ghost">← Về danh sách bài viết</NuxtLink>
    </div>
  </article>
</template>
