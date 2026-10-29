<script setup lang="ts">
import type { Category, ProductListResponse } from '~/types'

const props = defineProps<{
  categories: Category[]
  slug: string
  /** Show the back chevron (hidden on the bottom-nav entry point). */
  back?: boolean
}>()

const router = useRouter()
const search = ref('')
const navRef = ref<HTMLElement | null>(null)

const activeCategory = computed(() => props.categories.find((item) => item.slug === props.slug) ?? null)

const { data, pending } = await useAsyncData(
  `category-products:${props.slug}`,
  () =>
    $fetch<ProductListResponse>('/api/products', {
      query: { category: props.slug, limit: 48 }
    }),
  { lazy: !import.meta.server }
)

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

const items = computed(() => {
  const needle = normalizeText(search.value.trim())
  const list = data.value?.items ?? []
  if (!needle) return list
  return list.filter((product) =>
    normalizeText(`${product.title} ${product.subtitle ?? ''} ${product.color ?? ''}`).includes(needle)
  )
})

function centerActiveItem() {
  const nav = navRef.value
  if (!nav) return
  const active = nav.querySelector<HTMLElement>('[data-active="true"]')
  if (!active) return
  const target = active.offsetTop - nav.clientHeight / 2 + active.offsetHeight / 2
  nav.scrollTo({ top: Math.max(0, target) })
}

function goBack() {
  if (import.meta.client && window.history.length > 1) router.back()
  else router.push('/categories')
}

onMounted(() => nextTick(centerActiveItem))

watch(
  () => props.slug,
  async () => {
    search.value = ''
    await nextTick()
    centerActiveItem()
    if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
  }
)
</script>

<template>
  <div class="-mb-28">
    <PageHeader
      :title="activeCategory?.name ?? 'Danh mục'"
      :back="back"
      @back="goBack"
    />

    <div class="flex items-stretch">
      <nav
        ref="navRef"
        class="category-sidebar sticky top-[calc(var(--header-h)+env(safe-area-inset-top))] h-[calc(100dvh-var(--header-h)-env(safe-area-inset-top))] w-[84px] shrink-0 overflow-y-auto overscroll-contain border-r border-hairline/70 bg-white/40 pb-[calc(61px+env(safe-area-inset-bottom))]"
        aria-label="Danh mục sản phẩm"
      >
        <NuxtLink
          v-for="item in categories"
          :key="item.id"
          :to="`/category/${item.slug}`"
          :data-active="item.slug === slug ? 'true' : undefined"
          class="relative flex min-h-[54px] items-center justify-center border-b border-hairline/60 px-1.5 py-2.5 text-center t-meta font-semibold leading-[1.3] transition"
          :class="
            item.slug === slug
              ? 'bg-primary/[0.09] font-semibold text-ink'
              : 'text-ink/75 hover:bg-white/60'
          "
        >
          <span v-if="item.slug === slug" class="absolute inset-y-0 left-0 w-[3px] bg-primary" aria-hidden="true" />
          <span class="line-clamp-3">{{ item.name }}</span>
        </NuxtLink>
      </nav>

      <div class="min-w-0 flex-1 px-3 pb-[calc(76px+env(safe-area-inset-bottom))] pt-3">
        <label class="relative block">
          <span class="sr-only">Tìm nhóm hoa</span>
          <input
            v-model="search"
            type="search"
            class="h-12 w-full rounded-full border border-hairline bg-white/80 pl-10 pr-4 t-body text-ink shadow-soft outline-none transition placeholder:text-muted/80 focus:border-primary/40 focus:bg-white"
            placeholder="Tìm nhóm hoa..."
            autocomplete="off"
          />
          <svg
            viewBox="0 0 24 24"
            class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" stroke-linecap="round" />
          </svg>
        </label>

        <div v-if="pending" class="mt-4">
          <SkeletonGrid :count="9" :columns="3" tiles />
        </div>

        <template v-else>
          <ul
            v-if="items.length"
            class="mt-4 grid gap-x-3 gap-y-6"
            :style="{ gridTemplateColumns: 'repeat(var(--grid-cols), minmax(0, 1fr))' }"
          >
            <li v-for="product in items" :key="product.id" class="min-w-0">
              <NuxtLink :to="`/product/${product.handle}`" class="group flex flex-col items-center">
                <span class="block aspect-square w-[86%] overflow-hidden rounded-[16px] border border-hairline/50 bg-white">
                  <img
                    :src="product.thumbnail"
                    :alt="product.title"
                    width="160"
                    height="160"
                    loading="lazy"
                    decoding="async"
                    class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                  />
                </span>
                <span class="mt-2 line-clamp-2 w-full text-center t-body font-bold leading-[1.3] text-ink">
                  {{ product.title }}
                </span>
              </NuxtLink>
            </li>
          </ul>

          <div v-else class="mt-5 rounded-[16px] border border-dashed border-hairline bg-white/45 px-4 py-8 text-center">
            <p class="t-section">Không tìm thấy nhóm hoa</p>
            <p class="t-meta text-muted mt-1 leading-snug">Thử một từ khoá khác để xem thêm nhóm hoa.</p>
            <button v-if="search" type="button" class="btn-ghost mt-4" @click="search = ''">
              Xoá tìm kiếm
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
