<script setup lang="ts">
import type { HomeData } from '~/types'

const { data, pending, error } = await useFetch<HomeData>('/api/home', {
  key: 'home',
  lazy: !import.meta.server
})

const { config } = useSite()
const hero = computed(() => config.value.content.hero)

const flashSale = computed(() => data.value?.flashSale ?? null)
const flashEnds = computed(() => flashSale.value?.endsAt ?? null)
const { label: countdown } = useCountdown(flashEnds)

const bannerTrack = ref<HTMLElement | null>(null)
const activeBanner = ref(0)

function onBannerScroll() {
  const track = bannerTrack.value
  if (!track || !track.clientWidth) return
  activeBanner.value = Math.round(track.scrollLeft / track.clientWidth)
}

function goToBanner(index: number) {
  const track = bannerTrack.value
  activeBanner.value = index
  if (track) track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' })
}

</script>

<template>
  <SkeletonHome v-if="pending" />

  <div v-else-if="error || !data" class="container-page py-10">
    <EmptyState title="Không tải được dữ liệu" description="Vui lòng thử lại sau ít phút." />
  </div>

  <div v-else>
    <section v-if="hero.enabled && !(data?.banners?.length)" class="container-page pt-3">
      <div class="relative overflow-hidden rounded-xl2 border border-hairline/70 shadow-card">
        <img v-if="hero.image" :src="hero.image" :alt="hero.title" width="960" height="320" fetchpriority="high" decoding="async" class="h-40 w-full object-cover" />
        <div class="bg-primary-soft/70 px-5 py-6" :class="hero.image ? 'text-center' : ''">
          <p v-if="hero.eyebrow" class="chip">{{ hero.eyebrow }}</p>
          <h1 class="mt-3 t-display leading-tight">{{ hero.title }}</h1>
          <p v-if="hero.subtitle" class="mt-2 t-body leading-relaxed text-ink/75">{{ hero.subtitle }}</p>
          <NuxtLink v-if="hero.ctaLabel" :to="hero.ctaHref || '/categories'" class="btn-primary mt-4">
            {{ hero.ctaLabel }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <section class="container-page pt-3">
      <div class="relative h-[170px] overflow-hidden rounded-xl2 border border-hairline/70 bg-paper-deep shadow-card">
        <div
          ref="bannerTrack"
          class="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto"
          @scroll.passive="onBannerScroll"
        >
          <NuxtLink
            v-for="banner in data?.banners ?? []"
            :key="banner.image"
            :to="banner.href"
            class="relative block h-full w-full shrink-0 snap-center"
          >
            <img
              :src="banner.image"
              :alt="banner.title"
              width="960"
              height="340"
              fetchpriority="high"
              decoding="async"
              class="h-full w-full object-cover"
            />
            <div class="absolute inset-0 bg-gradient-to-r from-paper via-paper/70 to-transparent" />
            <div class="absolute inset-y-0 left-0 flex max-w-[75%] flex-col justify-center p-4">
              <h1 class="mt-2 t-page leading-tight">{{ banner.title }}</h1>
              <p class="mt-1 line-clamp-2 max-w-[15rem] t-meta text-muted">{{ banner.subtitle }}</p>
            </div>
          </NuxtLink>
        </div>

        <div v-if="(data?.banners?.length ?? 0) > 1" class="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
          <button
            v-for="(banner, index) in data?.banners ?? []"
            :key="banner.image"
            type="button"
            class="h-1.5 rounded-full transition-all"
            :class="index === activeBanner ? 'w-5 bg-primary' : 'w-1.5 bg-ink/25'"
            :aria-label="`Banner ${index + 1}`"
            @click="goToBanner(index)"
          />
        </div>
      </div>
    </section>

    <section class="container-page mt-8" aria-labelledby="categories-title">
      <SectionHeader
        title="Danh mục"
        href="/categories"
      />
      <div class="no-scrollbar flex gap-2.5 overflow-x-auto pb-2">
        <NuxtLink
          v-for="category in data?.categories ?? []"
          :key="category.id"
          :to="`/category/${category.slug}`"
          class="group w-20 shrink-0 text-center"
        >
          <div class="aspect-square overflow-hidden rounded-full border border-hairline/70 bg-white shadow-soft">
            <img
              v-if="category.imageUrl"
              :src="category.imageUrl"
              :alt="category.name"
              width="80"
              height="80"
              loading="lazy"
              decoding="async"
              class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          </div>
          <p class="mt-2 t-meta font-semibold text-ink group-hover:text-primary">{{ category.name }}</p>
        </NuxtLink>
      </div>
    </section>

    <section v-if="flashSale?.items.length" class="container-page mt-8">
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="section-title">{{ flashSale?.title }}</h2>
        </div>
        <div class="flex items-center gap-3">
          <span class="rounded-full bg-primary-soft px-3 py-1.5 t-body font-semibold tabular-nums text-primary">
            {{ countdown }}
          </span>
          <NuxtLink to="/flash-sale" class="t-body font-semibold text-primary hover:underline">Xem tất cả</NuxtLink>
        </div>
      </div>

      <div class="no-scrollbar flex gap-2.5 overflow-x-auto pb-2">
        <div v-for="item in flashSale?.items ?? []" :key="item.id" class="w-40 shrink-0">
          <ProductCard :product="item.product" :sale-price="item.salePrice" />
        </div>
      </div>
    </section>

    <section class="container-page mt-8">
      <SectionHeader title="Dành riêng cho bạn" href="/search" link-label="Xem tất cả" />
      <div class="grid grid-cols-2 gap-2.5">
        <ProductCard v-for="product in data?.recommended ?? []" :key="product.id" :product="product" />
      </div>
    </section>


  </div>
</template>
