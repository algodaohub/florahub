<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    label?: string
  }>(),
  { min: 1, max: 99, label: 'Số lượng' }
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function setValue(value: number) {
  const next = Math.min(props.max, Math.max(props.min, Number.isFinite(value) ? value : props.min))
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="inline-flex items-center rounded-full border border-hairline bg-white/80 p-1">
    <button
      type="button"
      class="grid h-8 w-8 place-items-center rounded-full t-section text-ink transition hover:bg-paper-deep disabled:opacity-30"
      :aria-label="`Giảm ${label.toLowerCase()}`"
      :disabled="modelValue <= min"
      @click="setValue(modelValue - 1)"
    >
      −
    </button>
    <input
      :value="modelValue"
      type="number"
      inputmode="numeric"
      :min="min"
      :max="max"
      :aria-label="label"
      class="w-10 appearance-none bg-transparent text-center t-body font-medium outline-none"
      @input="setValue(Number(($event.target as HTMLInputElement).value))"
    />
    <button
      type="button"
      class="grid h-8 w-8 place-items-center rounded-full t-section text-ink transition hover:bg-paper-deep disabled:opacity-30"
      :aria-label="`Tăng ${label.toLowerCase()}`"
      :disabled="modelValue >= max"
      @click="setValue(modelValue + 1)"
    >
      +
    </button>
  </div>
</template>

<style scoped>
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}
</style>
