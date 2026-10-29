<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    href?: string
    linkLabel?: string
  }>(),
  { linkLabel: 'Xem tất cả' }
)
</script>

<template>
  <div class="mb-4 flex items-end justify-between gap-4">
    <div>
      <h2 class="section-title">{{ title }}</h2>
      <p v-if="subtitle" class="mt-1 t-body text-muted">{{ subtitle }}</p>
    </div>
    <NuxtLink
      v-if="href"
      :to="href"
      class="shrink-0 t-body font-semibold text-primary underline-offset-4 hover:underline"
    >
      {{ linkLabel }}
    </NuxtLink>
  </div>
</template>
