<script setup lang="ts">
const props = defineProps<{
  page: number
  totalPages: number
  total: number
  perPage: number
}>()

const emit = defineEmits<{ 'update:page': [value: number] }>()

const from = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.perPage + 1))
const to = computed(() => Math.min(props.page * props.perPage, props.total))

type PageCell = { value: number; gap: boolean }

const pages = computed<PageCell[]>(() => {
  const total = props.totalPages
  if (total <= 1) return []
  if (total <= 7) return Array.from({ length: total }, (_, index) => ({ value: index + 1, gap: false }))
  const current = props.page
  const set = new Set<number>([1, total, current, current - 1, current + 1])
  if (current <= 3) [2, 3, 4].forEach((value) => set.add(value))
  if (current >= total - 2) [total - 1, total - 2, total - 3].forEach((value) => set.add(value))
  const values = [...set].filter((value) => value >= 1 && value <= total).sort((a, b) => a - b)
  return values.map((value, index) => ({
    value,
    gap: index > 0 && value - values[index - 1]! > 1
  }))
})

function go(page: number) {
  if (page < 1 || page > props.totalPages || page === props.page) return
  emit('update:page', page)
}
</script>

<template>
  <div class="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <p class="text-xs text-slate-500">
      Hiển thị <strong class="text-slate-700">{{ from }}–{{ to }}</strong> trên <strong class="text-slate-700">{{ total }}</strong>
    </p>

    <div v-if="totalPages > 1" class="flex items-center gap-1">
      <button
        type="button"
        class="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 disabled:opacity-40"
        :disabled="page <= 1"
        @click="go(page - 1)"
      >
        Trước
      </button>
      <template v-for="cell in pages" :key="cell.value">
        <span v-if="cell.gap" class="px-1 text-xs text-slate-400">…</span>
        <button
          type="button"
          class="min-w-8 rounded-md border px-2 py-1 text-xs font-medium"
          :class="
            cell.value === page
              ? 'border-emerald-700 bg-emerald-700 text-white'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          "
          @click="go(cell.value)"
        >
          {{ cell.value }}
        </button>
      </template>
      <button
        type="button"
        class="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 disabled:opacity-40"
        :disabled="page >= totalPages"
        @click="go(page + 1)"
      >
        Sau
      </button>
    </div>
  </div>
</template>
