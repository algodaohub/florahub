<script setup lang="ts">
import type { BadgeTone } from '~/utils/admin'

const props = withDefaults(defineProps<{ label: string; tone?: BadgeTone }>(), { tone: 'gray' })

const tones: Record<BadgeTone, string> = {
  gray: 'bg-slate-100 text-slate-600 ring-slate-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200'
}
</script>

<template>
  <span
    class="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset"
    :class="tones[props.tone]"
  >
    {{ props.label }}
  </span>
</template>
