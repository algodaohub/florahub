<script setup lang="ts">
import type { Post } from '~/types'

const { data: posts, pending } = await useFetch<Post[]>('/api/posts', { lazy: !import.meta.server })

useHead({ title: 'Tin tức & hướng dẫn' })
</script>

<template>
  <div class="container-page py-6">
    <header class="max-w-2xl">
      <p class="chip">Cẩm nang</p>
      <h1 class="mt-3 t-page font-semibold">Tin tức & hướng dẫn</h1>
      <p class="mt-2 t-body text-muted">Kinh nghiệm chọn sản phẩm, bảo quản và vận hành cửa hàng.</p>
    </header>

    <SkeletonPosts v-if="pending" />

    <div v-else-if="posts?.length" class="mt-4 grid gap-3">
      <NuxtLink
        v-for="post in posts"
        :key="post.id"
        :to="`/posts/${post.slug}`"
        class="group card overflow-hidden"
      >
        <div class="aspect-[16/9] overflow-hidden bg-paper-deep">
          <img
            :src="post.coverUrl"
            :alt="post.title"
            width="800"
            height="450"
            loading="lazy"
            decoding="async"
            class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        </div>
        <div class="p-4">
          <p class="t-micro uppercase tracking-wide text-muted">{{ formatDate(post.publishedAt) }}</p>
          <h2 class="mt-1 t-section font-semibold group-hover:text-primary">{{ post.title }}</h2>
          <p class="mt-1 line-clamp-3 t-body text-muted">{{ post.excerpt }}</p>
          <span class="mt-3 inline-block t-body font-medium text-primary">Đọc tiếp →</span>
        </div>
      </NuxtLink>
    </div>

    <EmptyState
      v-else
      class="mt-6"
      title="Chưa có bài viết"
      description="Nội dung đang được cập nhật."
      action-label="Về trang chủ"
      action-to="/"
    />
  </div>
</template>
