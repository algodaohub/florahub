<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    points: number[]
    direction?: 'up' | 'down' | 'flat'
    label?: string
  }>(),
  { direction: 'flat', label: 'Biến động' }
)

const stroke = computed(() => {
  if (props.direction === 'up') return '#B4553F'
  if (props.direction === 'down') return '#3F6B4F'
  return '#7C766B'
})

const geometry = computed(() => {
  const values = props.points.length > 1 ? props.points : [0, 0]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const width = 120
  const height = 36
  const step = width / (values.length - 1)

  const coords = values.map((value, index) => {
    const x = index * step
    const y = height - ((value - min) / span) * (height - 6) - 3
    return [x, y] as const
  })

  const line = coords.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${width} ${height} L0 ${height} Z`

  return { line, area, width, height }
})
</script>

<template>
  <svg
    :viewBox="`0 0 ${geometry.width} ${geometry.height}`"
    class="h-9 w-full"
    role="img"
    :aria-label="label"
    preserveAspectRatio="none"
  >
    <path :d="geometry.area" :fill="stroke" opacity="0.08" />
    <path :d="geometry.line" fill="none" :stroke="stroke" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
