<script setup lang="ts">
type Tone = 'slate' | 'amber' | 'emerald' | 'sky' | 'rose' | 'violet'

const props = withDefaults(
  defineProps<{
    label: string
    value: string
    hint?: string
    tone?: Tone
    to?: string
  }>(),
  { tone: 'slate', hint: '', to: '' }
)

const tones: Record<Tone, string> = {
  slate: 'text-slate-900',
  amber: 'text-amber-700',
  emerald: 'text-emerald-700',
  sky: 'text-sky-700',
  rose: 'text-rose-700',
  violet: 'text-violet-700'
}
</script>

<template>
  <component
    :is="props.to ? 'NuxtLink' : 'div'"
    :to="props.to || undefined"
    class="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    :class="props.to ? 'transition hover:border-emerald-200 hover:shadow' : ''"
  >
    <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{{ props.label }}</p>
    <p class="mt-1 text-xl font-semibold tabular-nums" :class="tones[props.tone]">{{ props.value }}</p>
    <p v-if="props.hint" class="mt-0.5 text-[11px] text-slate-400">{{ props.hint }}</p>
  </component>
</template>
