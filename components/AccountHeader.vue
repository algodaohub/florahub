<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    backTo?: string
  }>(),
  { backTo: '/account' }
)
</script>

<template>
  <header class="sticky top-0 z-30 -mx-3 mb-3 border-b border-hairline bg-paper/95 pt-[env(safe-area-inset-top)] shadow-[0_10px_22px_-22px_rgba(27,26,22,0.55)] backdrop-blur-md">
    <div class="relative flex h-[var(--header-h)] items-center justify-between gap-2 px-4">
      <NuxtLink :to="backTo" class="-ml-2 grid h-10 w-10 shrink-0 place-items-center text-ink" aria-label="Quay lại">
        <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
          <path d="m15 5-7 7 7 7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </NuxtLink>
      <div class="pointer-events-none absolute left-1/2 top-1/2 w-full max-w-[66%] -translate-x-1/2 -translate-y-1/2 text-center">
        <h1 class="t-page truncate">{{ title }}</h1>
        <p v-if="subtitle" class="t-meta text-muted truncate uppercase tracking-wide">{{ subtitle }}</p>
      </div>
      <div class="relative z-10 flex shrink-0 items-center">
        <slot name="action" />
      </div>
    </div>
  </header>
</template>
