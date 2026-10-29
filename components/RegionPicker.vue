<script setup lang="ts">
type RegionOption = {
  code: number | string
  name: string
}

const props = withDefaults(
  defineProps<{
    id?: string
    labelledby?: string
    modelValue: string
    options: RegionOption[]
    title?: string
    subtitle?: string
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
    disabled?: boolean
    loading?: boolean
    dense?: boolean
  }>(),
  {
    id: '',
    labelledby: '',
    title: 'Chọn đơn vị hành chính',
    subtitle: '',
    placeholder: 'Chọn',
    searchPlaceholder: 'Tìm kiếm...',
    emptyText: 'Không tìm thấy kết quả phù hợp',
    disabled: false,
    loading: false,
    dense: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [value: string, query: string]
}>()

const { config } = useSite()

const open = ref(false)
const query = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
let previousOverflow = ''

const selected = computed(
  () => props.options.find((option) => String(option.code) === props.modelValue) ?? null
)

const filtered = computed(() => {
  if (!query.value.trim()) return props.options
  return props.options.filter((option) => matchesLocationQuery(option.name, query.value))
})

function openPicker(initialQuery = '') {
  if (props.disabled) return
  query.value = typeof initialQuery === 'string' ? initialQuery : ''
  open.value = true
}

function closePicker() {
  open.value = false
}

function choose(option: RegionOption) {
  const keyword = query.value.trim()
  emit('update:modelValue', String(option.code))
  emit('select', String(option.code), keyword)
  closePicker()
}

// Cho phép mở picker từ bên ngoài (ví dụ: chọn tỉnh xong mở luôn phường/xã).
defineExpose({ open: openPicker, close: closePicker })

watch(open, async (value) => {
  if (!import.meta.client) return
  if (value) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Chờ DOM của sheet render xong rồi focus + cuộn tới lựa chọn hiện tại.
    await nextTick()
    searchInput.value?.focus({ preventScroll: true })
    await nextTick()
    listRef.value
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: 'center' })
    return
  }
  document.body.style.overflow = previousOverflow
})

// Gõ tìm kiếm mới luôn xem từ đầu danh sách.
watch(query, () => {
  if (listRef.value) listRef.value.scrollTop = 0
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) closePicker()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (import.meta.client && open.value && document.body.style.overflow === 'hidden') {
    document.body.style.overflow = previousOverflow
  }
})
</script>

<template>
  <div>
    <button
      :id="id || undefined"
      type="button"
      class="field flex w-full items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
      :class="[dense ? 'py-2 t-meta' : '', modelValue ? '' : 'text-muted']"
      :disabled="disabled"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-label="title"
      :aria-labelledby="labelledby || undefined"
      @click="openPicker()"
    >
      <span class="min-w-0 truncate">
        {{ selected?.name || (loading ? 'Đang tải...' : placeholder) }}
      </span>
      <AppIcon name="chevron" size="h-4 w-4 shrink-0 rotate-90 text-muted" />
    </button>

    <Teleport to="body">
      <Transition name="picker">
        <div v-if="open" class="fixed inset-0 z-[60]" role="dialog" aria-modal="true" :aria-label="title">
          <div class="absolute inset-0 bg-ink/40" @click="closePicker" />

          <div
            class="picker-panel absolute inset-x-0 bottom-0 mx-auto flex max-h-[82dvh] w-full flex-col rounded-t-3xl bg-paper shadow-[0_-20px_60px_-20px_rgba(27,26,22,0.45)]"
            :style="{ maxWidth: `${config.layout.shellWidth}px` }"
          >
            <div class="shrink-0">
              <div class="mx-auto mt-2 h-1 w-10 rounded-full bg-hairline" />
              <div class="flex items-start justify-between gap-3 px-4 pb-2 pt-3">
                <div class="min-w-0">
                  <h2 class="truncate t-section font-semibold">{{ title }}</h2>
                  <p v-if="subtitle" class="truncate t-micro text-muted">{{ subtitle }}</p>
                  <p class="t-micro text-muted">{{ filtered.length }} lựa chọn</p>
                </div>
                <button
                  type="button"
                  class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted active:bg-paper-deep"
                  aria-label="Đóng"
                  @click="closePicker"
                >
                  <AppIcon name="close" size="h-5 w-5" />
                </button>
              </div>

              <div class="relative px-4 pb-2.5">
                <input
                  ref="searchInput"
                  v-model="query"
                  type="search"
                  class="field h-10 py-2 pl-9 pr-9 text-base"
                  :placeholder="searchPlaceholder"
                  autocomplete="off"
                  enterkeyhint="search"
                />
                <AppIcon
                  name="search"
                  size="h-4 w-4"
                  class="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-muted"
                />
                <button
                  v-if="query"
                  type="button"
                  class="absolute right-6 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-paper-deep text-muted"
                  aria-label="Xoá tìm kiếm"
                  @click="query = ''"
                >
                  <AppIcon name="close" size="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div
              ref="listRef"
              role="listbox"
              class="picker-list min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
            >
              <p v-if="loading" class="px-3 py-8 text-center t-meta text-muted">Đang tải danh mục...</p>
              <p v-else-if="!filtered.length" class="px-3 py-8 text-center t-meta text-muted">
                {{ emptyText }}
              </p>
              <button
                v-for="option in filtered"
                :key="option.code"
                type="button"
                role="option"
                :aria-selected="String(option.code) === modelValue"
                :data-selected="String(option.code) === modelValue"
                class="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left t-body transition-colors active:bg-paper-deep"
                :class="
                  String(option.code) === modelValue
                    ? 'bg-primary-soft font-medium text-primary'
                    : 'text-ink'
                "
                @click="choose(option)"
              >
                <span class="min-w-0 truncate">{{ option.name }}</span>
                <AppIcon
                  v-if="String(option.code) === modelValue"
                  name="check"
                  size="h-4 w-4 shrink-0"
                />
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.picker-list {
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}

.picker-enter-active,
.picker-leave-active {
  transition: opacity 0.2s ease;
}

.picker-enter-active .picker-panel,
.picker-leave-active .picker-panel {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}

.picker-enter-from,
.picker-leave-to {
  opacity: 0;
}

.picker-enter-from .picker-panel,
.picker-leave-to .picker-panel {
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .picker-enter-active,
  .picker-leave-active,
  .picker-enter-active .picker-panel,
  .picker-leave-active .picker-panel {
    transition-duration: 0.01ms;
  }
}
</style>
