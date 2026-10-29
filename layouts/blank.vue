<script setup lang="ts">
import '~/assets/css/fonts.css'

const { site } = useSite()
</script>

<template>
  <div class="min-h-[100dvh] bg-paper-deep">
    <div class="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-paper shadow-[0_0_60px_-20px_rgba(43,42,38,0.35)]">
      <header class="flex items-center justify-between px-3 py-3">
        <NuxtLink to="/" class="flex min-w-0 items-center gap-2" :aria-label="`${site.siteName} — Trang chủ`">
          <img
            v-if="site.logoUrl"
            :src="site.logoUrl"
            :alt="site.siteName"
            width="36"
            height="36"
            decoding="async"
            class="h-9 w-9 shrink-0 rounded-full object-cover"
          />
          <span v-else class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary t-body font-semibold text-white">
            {{ site.siteName.slice(0, 1) }}
          </span>
          <span class="truncate t-section font-semibold tracking-tight">{{ site.siteName }}</span>
        </NuxtLink>
        <NuxtLink to="/" class="t-meta font-medium text-muted">Về trang chủ</NuxtLink>
      </header>

      <main class="flex flex-1 items-start justify-center px-3 pb-8 pt-1">
        <slot />
      </main>

      <footer class="pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center t-micro text-muted">
        © {{ new Date().getFullYear() }} {{ site.siteName }}
      </footer>
    </div>
  </div>
</template>
