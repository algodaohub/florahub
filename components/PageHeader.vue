<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    back?: boolean
    backTo?: RouteLocationRaw
    capitalize?: boolean
  }>(),
  { title: '', subtitle: '', back: false, backTo: '', capitalize: false }
)

const emit = defineEmits<{ back: [] }>()
const attrs = useAttrs()
const router = useRouter()

function goBack() {
  if (props.backTo) {
    router.push(props.backTo)
    return
  }
  if (attrs.onBack) {
    emit('back')
    return
  }
  if (import.meta.client && window.history.length > 1) {
    router.back()
    return
  }
  router.push('/')
}
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-hairline bg-paper/95 pt-[env(safe-area-inset-top)] shadow-[0_10px_22px_-22px_rgba(27,26,22,0.55)] backdrop-blur-md">
    <div class="relative flex h-[var(--header-h)] items-center justify-between gap-2 px-4">
      <div class="relative z-10 flex min-w-0 items-center gap-1.5">
        <button
          v-if="back"
          type="button"
          class="-ml-2 grid h-10 w-10 shrink-0 place-items-center text-ink"
          aria-label="Quay lại"
          @click="goBack"
        >
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
            <path d="m15 5-7 7 7 7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <slot name="left" />
      </div>

      <div class="pointer-events-none absolute left-1/2 top-1/2 w-full max-w-[66%] -translate-x-1/2 -translate-y-1/2 text-center">
        <h1 class="t-page truncate" :class="capitalize ? 'capitalize' : ''">{{ title }}</h1>
        <p v-if="subtitle" class="t-meta text-muted truncate">{{ subtitle }}</p>
      </div>

      <div class="relative z-10 flex shrink-0 items-center gap-1.5">
        <slot name="right" />
      </div>
    </div>
  </header>
</template>
