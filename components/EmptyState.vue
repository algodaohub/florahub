<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
    actionLabel?: string
    actionTo?: string
  }>(),
  { actionLabel: 'Về trang chủ', actionTo: '/' }
)
</script>

<template>
  <div class="card flex flex-col items-center px-6 py-14 text-center">
    <div class="grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary">
      <svg viewBox="0 0 24 24" class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
        <path d="M12 21c4.5 0 8-3.2 8-7.2 0-4.4-4-7.3-8-10.8-4 3.5-8 6.4-8 10.8C4 17.8 7.5 21 12 21Z" stroke-linejoin="round" />
      </svg>
    </div>
    <h3 class="mt-4 t-section font-semibold">{{ title }}</h3>
    <p v-if="description" class="mt-1 max-w-sm t-body text-muted">{{ description }}</p>
    <NuxtLink :to="actionTo" class="btn-primary mt-5">{{ actionLabel }}</NuxtLink>
  </div>
</template>
