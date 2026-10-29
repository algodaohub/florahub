<script setup lang="ts">
import type { ProductDetail } from '~/types'

const route = useRoute()
const router = useRouter()
const handle = computed(() => String(route.params.handle ?? ''))

const { data: product, pending, error } = await useFetch<ProductDetail>(
  () => `/api/products/${handle.value}`,
  { lazy: !import.meta.server }
)

const selectedVariantId = ref('')
const quantity = ref(1)
const activeIndex = ref(0)
const galleryTrack = ref<HTMLElement | null>(null)
const lightbox = ref(false)
const reviewsOpen = ref(false)

watch(
  product,
  (value) => {
    if (!value) return
    selectedVariantId.value = value.variants[0]?.id ?? ''
    activeIndex.value = 0
    quantity.value = 1
    reviewsOpen.value = false
    if (galleryTrack.value) galleryTrack.value.scrollLeft = 0
  },
  { immediate: true }
)

const { site, config } = useSite()
const { add, pending: cartPending, count } = useCart()

const selectedVariant = computed(
  () => product.value?.variants.find((variant) => variant.id === selectedVariantId.value) ?? product.value?.variants[0]
)
const price = computed(() => selectedVariant.value?.price ?? 0)
const compareAt = computed(() => selectedVariant.value?.compareAtPrice ?? null)
const discount = computed(() => discountPercent(price.value, compareAt.value))
const gallery = computed(() => {
  const media = product.value?.media ?? []
  if (media.length) return media
  return product.value?.thumbnail
    ? [
        {
          id: 'thumb',
          type: 'image' as const,
          url: product.value.thumbnail,
          thumbUrl: product.value.thumbnail,
          posterUrl: '',
          alt: product.value.title,
          isFeatured: false,
          duration: 0
        }
      ]
    : []
})
const activeMedia = computed(() => gallery.value[activeIndex.value] ?? gallery.value[0] ?? null)
const stock = computed(() => selectedVariant.value?.inventoryQuantity ?? 0)
const total = computed(() => price.value * quantity.value)
const canAdd = computed(() => Boolean(selectedVariant.value) && stock.value > 0)

const isPhysical = computed(() => product.value?.type === 'physical')
const isDigital = computed(() => product.value?.type === 'digital')
const isService = computed(() => product.value?.type === 'service')

const typeLabel = computed(() => {
  if (isDigital.value) return 'Sản phẩm số'
  if (isService.value) return 'Dịch vụ'
  return 'Sản phẩm vật lý'
})

const shippingNote = computed(() => {
  if (isDigital.value) return 'Nhận tệp/liên kết tải ngay sau khi thanh toán thành công.'
  if (isService.value) {
    return product.value?.service.location
      ? `Phục vụ tại ${product.value.service.location}. ${product.value.service.bookingNote || ''}`.trim()
      : product.value?.service.bookingNote || 'Đặt lịch sau khi hoàn tất đơn hàng.'
  }
  const shipping = config.value.shipping
  if (!shipping.enabled) return 'Miễn phí giao hàng'
  if (shipping.freeShippingThreshold > 0) {
    return `Phí vận chuyển tính khi thanh toán · Miễn phí từ ${formatVnd(shipping.freeShippingThreshold)}`
  }
  return 'Phí vận chuyển tính khi thanh toán'
})

const requestUrl = useRequestURL()
const canonicalUrl = computed(
  () => product.value?.seo.canonicalUrl || `${requestUrl.origin}/product/${product.value?.handle ?? handle.value}`
)

function absoluteUrl(value: string) {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `${requestUrl.origin}${value.startsWith('/') ? '' : '/'}${value}`
}

function goBack() {
  if (import.meta.client && window.history.length > 1) router.back()
  else router.push('/')
}

function goToImage(index: number) {
  const track = galleryTrack.value
  activeIndex.value = index
  if (track) track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' })
}

function onGalleryScroll() {
  const track = galleryTrack.value
  if (!track || !track.clientWidth) return
  const index = Math.round(track.scrollLeft / track.clientWidth)
  activeIndex.value = Math.min(gallery.value.length - 1, Math.max(0, index))
}

async function onAdd() {
  if (!canAdd.value) return
  await add(selectedVariant.value!.id, quantity.value)
}

const seoTitle = computed(() => product.value?.seo.title || product.value?.title || 'Sản phẩm')
const seoDescription = computed(
  () =>
    product.value?.seo.description ||
    product.value?.aeoSummary ||
    (product.value?.description ? product.value.description.slice(0, 160) : '')
)
const seoImage = computed(() => {
  const first = product.value?.media.find((item) => item.type === 'image')
  return absoluteUrl(first?.url || product.value?.thumbnail || '')
})

useHead(() => ({
  title: seoTitle.value,
  link: [{ rel: 'canonical', href: canonicalUrl.value }],
  meta: [
    ...(seoDescription.value ? [{ name: 'description', content: seoDescription.value }] : []),
    ...(product.value?.seo.keywords ? [{ name: 'keywords', content: product.value.seo.keywords }] : []),
    { property: 'og:type', content: 'product' },
    { property: 'og:title', content: seoTitle.value },
    ...(seoDescription.value ? [{ property: 'og:description', content: seoDescription.value }] : []),
    { property: 'og:url', content: canonicalUrl.value },
    ...(seoImage.value ? [{ property: 'og:image', content: seoImage.value }] : []),
    { name: 'twitter:card', content: 'summary_large_image' }
  ]
}))

const jsonLd = computed(() => {
  const value = product.value
  if (!value) return []
  const url = canonicalUrl.value
  const images = value.media.filter((item) => item.type === 'image').map((item) => absoluteUrl(item.url))
  const productSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: value.title,
    description: value.seo.description || value.aeoSummary || value.description,
    sku: selectedVariant.value?.sku || value.variants[0]?.sku || undefined,
    image: images.length ? images : seoImage.value ? [seoImage.value] : undefined,
    url,
    brand: { '@type': 'Brand', name: value.seller?.name || site.value.siteName },
    category: value.category?.name,
    ...(value.highlights.length
      ? { additionalProperty: value.highlights.map((item) => ({ '@type': 'PropertyValue', name: item.title, value: item.description })) }
      : {}),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'VND',
      price: price.value,
      availability: stock.value > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition'
    },
    ...(value.reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: value.rating,
            reviewCount: value.reviewCount
          }
        }
      : {})
  }

  const schemas: Record<string, unknown>[] = [productSchema]
  if (value.faq.length) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: value.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer }
      }))
    })
  }
  return schemas
})

useHead(() => ({
  script: jsonLd.value.map((schema) => ({
    type: 'application/ld+json',
    innerHTML: JSON.stringify(schema).replace(/</g, '\\u003c')
  }))
}))
</script>

<template>
  <div>
    <PageHeader
      :title="product?.title ?? 'Chi tiết sản phẩm'"
      :subtitle="selectedVariant?.title ?? ''"
      back
      @back="goBack"
    >
      <template #right>
        <NuxtLink
          to="/cart"
          class="relative grid h-10 w-10 shrink-0 place-items-center text-ink"
          :aria-label="`Giỏ hàng — ${count} sản phẩm`"
        >
          <AppIcon name="bag" size="h-[22px] w-[22px]" />
          <span
            v-if="count > 0"
            class="absolute right-0 top-0 grid h-4 min-w-[1rem] place-items-center rounded-full bg-discount px-1 t-micro font-semibold text-white"
          >
            {{ count > 99 ? '99+' : count }}
          </span>
        </NuxtLink>
      </template>
    </PageHeader>

    <SkeletonProduct v-if="pending" />

    <div v-else-if="error || !product" class="container-page pt-4">
      <EmptyState title="Không tìm thấy sản phẩm" description="Sản phẩm có thể đã hết hàng hoặc đổi đường dẫn." />
    </div>

    <div v-else class="pb-[calc(96px+env(safe-area-inset-bottom))]">
      <nav class="t-meta text-muted flex items-center gap-1.5 px-4 py-3" aria-label="Đường dẫn">
        <NuxtLink to="/" class="shrink-0 hover:text-primary">Trang chủ</NuxtLink>
        <span aria-hidden="true">›</span>
        <NuxtLink :to="`/category/${product.category.slug}`" class="shrink-0 hover:text-primary">
          {{ product.category.name }}
        </NuxtLink>
        <span aria-hidden="true">›</span>
        <span class="truncate text-ink/70">{{ product.title }}</span>
      </nav>

      <section aria-label="Hình ảnh sản phẩm">
        <div class="relative bg-paper-deep">
          <div
            ref="galleryTrack"
            class="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
            @scroll.passive="onGalleryScroll"
          >
            <div
              v-for="(item, index) in gallery"
              :key="item.id"
              class="h-[34dvh] max-h-[320px] min-h-[200px] w-full shrink-0 snap-center bg-black"
            >
              <video
                v-if="item.type === 'video'"
                :src="item.url"
                :poster="item.posterUrl || undefined"
                class="h-full w-full object-contain"
                controls
                playsinline
                preload="metadata"
              />
              <img
                v-else
                :src="item.url"
                :alt="item.alt ?? product.title"
                width="480"
                height="600"
                :fetchpriority="index === 0 ? 'high' : 'auto'"
                decoding="async"
                class="h-full w-full object-cover"
              />
            </div>
          </div>

          <span
            v-if="gallery.length > 1"
            class="absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 t-micro font-medium tabular-nums text-white backdrop-blur-sm"
          >
            {{ activeIndex + 1 }} / {{ gallery.length }}
          </span>

          <button
            v-if="activeMedia?.type === 'image'"
            type="button"
            class="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-ink shadow-soft backdrop-blur-sm"
            aria-label="Xem ảnh lớn"
            @click="lightbox = true"
          >
            <AppIcon name="expand" size="h-[18px] w-[18px]" />
          </button>

          <div
            v-if="gallery.length > 1"
            class="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5"
          >
            <button
              v-for="(image, index) in gallery"
              :key="image.id"
              type="button"
              class="h-1.5 rounded-full transition-all"
              :class="index === activeIndex ? 'w-5 bg-primary' : 'w-1.5 bg-ink/25'"
              :aria-label="`Ảnh ${index + 1}`"
              :aria-current="index === activeIndex"
              @click="goToImage(index)"
            />
          </div>
        </div>

        <div v-if="gallery.length > 1" class="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2.5">
          <button
            v-for="(item, index) in gallery"
            :key="item.id"
            type="button"
            class="relative h-14 w-14 shrink-0 overflow-hidden rounded-[10px] border-2 bg-paper-deep transition"
            :class="index === activeIndex ? 'border-primary' : 'border-transparent'"
            :aria-label="`Chọn ${item.type === 'video' ? 'video' : 'ảnh'} ${index + 1}`"
            :aria-current="index === activeIndex"
            @click="goToImage(index)"
          >
            <video
              v-if="item.type === 'video'"
              :src="item.url"
              :poster="item.posterUrl || undefined"
              class="h-full w-full object-cover"
              muted
              playsinline
              preload="metadata"
            />
            <img
              v-else
              :src="item.thumbUrl || item.url"
              :alt="item.alt ?? product.title"
              width="64"
              height="64"
              loading="lazy"
              decoding="async"
              class="h-full w-full object-cover"
            />
            <span
              v-if="item.type === 'video'"
              class="pointer-events-none absolute inset-0 grid place-items-center bg-black/25 text-white"
            >
              <AppIcon name="play" size="h-5 w-5" />
            </span>
          </button>
        </div>
      </section>

      <section class="px-4 pt-3">
        <div class="flex flex-wrap items-end gap-2">
          <p class="t-price-lg">{{ formatVnd(price) }}</p>
          <span class="t-meta text-muted pb-0.5">/{{ product.unit }}</span>
          <span v-if="compareAt && compareAt > price" class="t-meta text-muted pb-0.5 line-through">
            {{ formatVnd(compareAt) }}
          </span>
          <span v-if="discount" class="mb-0.5 rounded-full bg-discount px-2 py-0.5 t-micro font-semibold text-white">
            -{{ discount }}%
          </span>
        </div>
        <span class="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 t-micro font-medium text-primary">
          {{ typeLabel }}
          <template v-if="isService && product.service.duration"> · {{ product.service.duration }} phút</template>
        </span>

        <div class="mt-3 rounded-[16px] border border-hairline/70 bg-white/70 p-4">
          <p class="t-body leading-relaxed text-ink/75">{{ product.description }}</p>

          <ul v-if="product.highlights.length" class="mt-3 space-y-2 border-t border-hairline/70 pt-3">
            <li v-for="(item, index) in product.highlights" :key="`hl-${index}`" class="flex gap-2">
              <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <span class="t-body min-w-0 text-ink/75">
                <strong v-if="item.title" class="font-semibold text-ink">{{ item.title }}</strong>
                <template v-if="item.title && item.description"> — </template>
                {{ item.description }}
              </span>
            </li>
          </ul>

          <div v-if="product.aeoSummary" class="mt-3 rounded-[12px] bg-primary-soft/60 p-3">
            <p class="t-micro font-semibold uppercase tracking-wide text-primary">Tóm tắt nhanh</p>
            <p class="t-body mt-1 leading-relaxed text-ink/75">{{ product.aeoSummary }}</p>
          </div>

          <div class="mt-3 divide-y divide-hairline/70 border-t border-hairline/70">
            <NuxtLink to="/about" class="flex items-center gap-3 py-3">
              <span class="t-meta text-muted w-[96px] shrink-0">Nhà cung cấp</span>
              <span class="t-body min-w-0 flex-1 truncate text-right font-medium">{{ site.siteName }}</span>
              <AppIcon name="chevron" size="h-4 w-4" class="shrink-0 text-muted" />
            </NuxtLink>

            <NuxtLink :to="`/search?seller=${product.seller.slug}`" class="flex items-center gap-3 py-3">
              <span class="t-meta text-muted w-[96px] shrink-0">Gian hàng</span>
              <span class="t-body min-w-0 flex-1 truncate text-right font-medium">{{ product.seller.name }}</span>
              <AppIcon name="chevron" size="h-4 w-4" class="shrink-0 text-muted" />
            </NuxtLink>

            <button
              type="button"
              class="flex w-full items-center gap-3 py-3 text-left"
              :aria-expanded="reviewsOpen"
              @click="reviewsOpen = !reviewsOpen"
            >
              <span class="t-meta text-muted w-[96px] shrink-0">Đánh giá</span>
              <span class="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                <StarRating :rating="product.rating" />
                <span class="t-body font-medium">{{ product.rating.toFixed(1) }}</span>
                <span class="t-meta text-muted">({{ product.reviewCount }} đánh giá)</span>
              </span>
              <AppIcon
                name="chevron"
                size="h-4 w-4"
                class="shrink-0 text-muted transition"
                :class="reviewsOpen ? 'rotate-90' : ''"
              />
            </button>
          </div>

          <div v-if="reviewsOpen" class="mt-1 border-t border-hairline/70 pt-1">
            <div v-if="product.reviews.length" class="divide-y divide-hairline/60">
              <article v-for="review in product.reviews" :key="review.id" class="py-3">
                <div class="flex items-center justify-between gap-3">
                  <p class="t-body font-medium">{{ review.authorName }}</p>
                  <StarRating :rating="review.rating" />
                </div>
                <p class="t-body mt-1.5 text-muted">{{ review.body }}</p>
                <p class="t-micro mt-1.5 text-muted/80">{{ formatDate(review.createdAt) }}</p>
              </article>
            </div>
            <p v-else class="t-body py-4 text-center text-muted">Chưa có đánh giá cho sản phẩm này.</p>
          </div>
        </div>
      </section>

      <section class="mx-4 mt-4 rounded-[16px] border border-hairline/70 bg-white/70 p-4">
        <div v-if="product.variants.length > 1">
          <div class="flex items-center justify-between gap-2">
            <h2 class="t-title">Chọn quy cách</h2>
            <span class="t-meta text-muted">{{ selectedVariant?.title }}</span>
          </div>
          <div class="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Chọn quy cách">
            <label
              v-for="variant in product.variants"
              :key="variant.id"
              class="cursor-pointer rounded-[10px] border px-3 py-2 transition"
              :class="
                selectedVariantId === variant.id
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-hairline bg-white/70 text-ink hover:border-primary/40'
              "
            >
              <input v-model="selectedVariantId" type="radio" name="variant" :value="variant.id" class="sr-only" />
              <span class="t-body block font-medium">{{ variant.title }}</span>
              <span class="t-micro block opacity-80">{{ formatVnd(variant.price) }}/{{ product.unit }}</span>
            </label>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3" :class="product.variants.length > 1 ? 'mt-4 border-t border-hairline/60 pt-4' : ''">
          <div class="min-w-0">
            <p class="t-title">Số lượng</p>
            <p class="t-meta mt-0.5" :class="stock > 0 ? 'text-muted' : 'text-discount'">
              {{ stock > 0 ? `Còn ${stock} ${product.unit}` : 'Tạm hết hàng' }}
            </p>
          </div>
          <QuantityStepper v-model="quantity" :max="Math.max(1, stock)" label="Số lượng" />
        </div>
      </section>

      <section class="mt-3 flex items-start gap-3 px-4">
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <AppIcon name="truck" size="h-4 w-4" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="t-title">{{ isDigital ? 'Nhận sản phẩm' : isService ? 'Đặt lịch' : 'Giao hàng' }}</p>
          <p class="t-meta text-muted mt-0.5 leading-relaxed">{{ shippingNote }}</p>
        </div>
      </section>

      <section v-if="product.specs.length" class="mx-4 mt-4 rounded-[16px] border border-hairline/70 bg-white/70 p-4">
        <h2 class="t-section">Thông tin sản phẩm</h2>
        <dl class="mt-2 divide-y divide-hairline/70">
          <div v-for="spec in product.specs" :key="spec.id" class="grid grid-cols-[96px_1fr] gap-3 py-2.5">
            <dt class="t-meta text-muted">{{ spec.name }}</dt>
            <dd class="t-body font-medium">{{ spec.value }}</dd>
          </div>
          <div v-if="isPhysical && product.weightGrams" class="grid grid-cols-[96px_1fr] gap-3 py-2.5">
            <dt class="t-meta text-muted">Cân nặng</dt>
            <dd class="t-body font-medium">{{ product.weightGrams }} g</dd>
          </div>
        </dl>
      </section>

      <section v-if="isDigital" class="mx-4 mt-4 rounded-[16px] border border-hairline/70 bg-white/70 p-4">
        <h2 class="t-section">Thông tin sản phẩm số</h2>
        <dl class="mt-2 divide-y divide-hairline/70">
          <div class="grid grid-cols-[96px_1fr] gap-3 py-2.5">
            <dt class="t-meta text-muted">Hình thức</dt>
            <dd class="t-body font-medium">Tệp số nhận sau thanh toán</dd>
          </div>
          <div v-if="product.digital.downloadLimit" class="grid grid-cols-[96px_1fr] gap-3 py-2.5">
            <dt class="t-meta text-muted">Lượt tải</dt>
            <dd class="t-body font-medium">Tối đa {{ product.digital.downloadLimit }} lần</dd>
          </div>
          <div v-if="product.digital.expiryDays" class="grid grid-cols-[96px_1fr] gap-3 py-2.5">
            <dt class="t-meta text-muted">Hiệu lực</dt>
            <dd class="t-body font-medium">{{ product.digital.expiryDays }} ngày sau khi mua</dd>
          </div>
          <div v-if="product.digital.license" class="grid grid-cols-[96px_1fr] gap-3 py-2.5">
            <dt class="t-meta text-muted">Giấy phép</dt>
            <dd class="t-body whitespace-pre-line font-medium">{{ product.digital.license }}</dd>
          </div>
        </dl>
      </section>

      <section v-if="isService" class="mx-4 mt-4 rounded-[16px] border border-hairline/70 bg-white/70 p-4">
        <h2 class="t-section">Thông tin dịch vụ</h2>
        <dl class="mt-2 divide-y divide-hairline/70">
          <div v-if="product.service.duration" class="grid grid-cols-[96px_1fr] gap-3 py-2.5">
            <dt class="t-meta text-muted">Thời lượng</dt>
            <dd class="t-body font-medium">{{ product.service.duration }} phút</dd>
          </div>
          <div v-if="product.service.location" class="grid grid-cols-[96px_1fr] gap-3 py-2.5">
            <dt class="t-meta text-muted">Địa điểm</dt>
            <dd class="t-body font-medium">{{ product.service.location }}</dd>
          </div>
          <div v-if="product.service.capacity" class="grid grid-cols-[96px_1fr] gap-3 py-2.5">
            <dt class="t-meta text-muted">Sức chứa</dt>
            <dd class="t-body font-medium">{{ product.service.capacity }} khách / buổi</dd>
          </div>
          <div v-if="product.service.bookingNote" class="grid grid-cols-[96px_1fr] gap-3 py-2.5">
            <dt class="t-meta text-muted">Đặt lịch</dt>
            <dd class="t-body whitespace-pre-line font-medium">{{ product.service.bookingNote }}</dd>
          </div>
        </dl>
      </section>

      <section v-if="product.faq.length" class="mx-4 mt-4 rounded-[16px] border border-hairline/70 bg-white/70 p-4">
        <h2 class="t-section">Câu hỏi thường gặp</h2>
        <div class="mt-2 divide-y divide-hairline/70">
          <details v-for="(item, index) in product.faq" :key="`faq-${index}`" class="group py-2.5">
            <summary class="t-body flex cursor-pointer list-none items-start justify-between gap-3 font-medium">
              <span class="min-w-0">{{ item.question }}</span>
              <AppIcon name="chevron" size="h-4 w-4" class="mt-0.5 shrink-0 text-muted transition group-open:rotate-90" />
            </summary>
            <p class="t-body mt-2 whitespace-pre-line text-muted">{{ item.answer }}</p>
          </details>
        </div>
      </section>

    </div>

    <div
      v-if="product"
      class="fixed inset-x-0 bottom-0 z-30 mx-auto w-full border-t border-hairline/70 bg-paper/95 pt-2 backdrop-blur"
      :style="{ maxWidth: 'var(--shell-max)' }"
    >
      <div class="flex items-center gap-2.5 px-4 pb-[calc(0.65rem+env(safe-area-inset-bottom))]">
        <NuxtLink
          to="/"
          class="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-hairline bg-white/80 text-ink"
          aria-label="Trang chủ"
        >
          <AppIcon name="home" size="h-5 w-5" />
        </NuxtLink>
        <NuxtLink
          to="/cart"
          class="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-hairline bg-white/80 text-ink"
          :aria-label="`Giỏ hàng — ${count} sản phẩm`"
        >
          <AppIcon name="bag" size="h-5 w-5" />
          <span
            v-if="count > 0"
            class="absolute -right-1 -top-1 grid h-4 min-w-[1rem] place-items-center rounded-full bg-discount px-1 t-micro font-semibold text-white"
          >
            {{ count > 99 ? '99+' : count }}
          </span>
        </NuxtLink>
        <button
          type="button"
          class="btn-primary h-11 min-w-0 flex-1 px-5"
          :disabled="cartPending || !canAdd"
          @click="onAdd"
        >
          {{ cartPending ? 'Đang thêm...' : canAdd ? 'Thêm vào giỏ hàng' : 'Hết hàng' }}
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="lightbox && activeMedia?.type === 'image'"
        class="fixed inset-0 z-[70] flex flex-col bg-black/95"
        role="dialog"
        aria-modal="true"
        aria-label="Xem ảnh sản phẩm"
        @click.self="lightbox = false"
      >
        <div class="flex items-center justify-between px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <span class="t-meta font-medium tabular-nums text-white/80">
            {{ activeIndex + 1 }} / {{ gallery.length }}
          </span>
          <button
            type="button"
            class="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"
            aria-label="Đóng"
            @click="lightbox = false"
          >
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <div class="flex min-h-0 flex-1 items-center justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <img
            :src="activeMedia.url"
            :alt="activeMedia.alt ?? product?.title ?? ''"
            class="max-h-full max-w-full rounded-[12px] object-contain"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>
