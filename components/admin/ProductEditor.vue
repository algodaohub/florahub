<script setup lang="ts">
import type {
  AdminMedia,
  AdminOptions,
  AdminProductDetail,
  AdminProductFaq,
  AdminProductHighlight,
  AdminVariant,
  ProductType
} from '~/types/admin'
import { formatVnd } from '~/utils/format'

const props = defineProps<{ productId?: string }>()
const isEdit = computed(() => Boolean(props.productId))

const requestFetch = useRequestFetch()
const route = useRoute()
const router = useRouter()

const { data: options } = await useAsyncData<AdminOptions>('admin-options', () =>
  requestFetch<AdminOptions>('/api/admin/options')
)

const { data: aiConfig } = await useAsyncData<{ model: string; models: string[] }>('admin-ai', () =>
  requestFetch<{ model: string; models: string[] }>('/api/admin/ai')
)
const aiModel = ref('')

const detail = ref<AdminProductDetail | null>(null)
const loading = ref(isEdit.value)
const loadError = ref('')

const TYPE_TABS: Array<{ value: ProductType; label: string; hint: string }> = [
  { value: 'physical', label: 'Vật lý', hint: 'Giao hàng, tồn kho, cân nặng' },
  { value: 'digital', label: 'Sản phẩm số', hint: 'Tệp tải xuống, bản quyền' },
  { value: 'service', label: 'Dịch vụ', hint: 'Thời lượng, địa điểm, sức chứa' }
]

const form = reactive({
  title: '',
  handle: '',
  subtitle: '',
  description: '',
  category: '',
  seller: '',
  thumbnail: '',
  unit: 'sản phẩm',
  color: '',
  status: 'draft',
  type: 'physical' as ProductType,
  requiresShipping: true,
  weightGrams: 0,
  seoTitle: '',
  seoDescription: '',
  seoKeywords: '',
  canonicalUrl: '',
  aeoSummary: '',
  geoServiceAreas: '',
  highlights: [] as AdminProductHighlight[],
  faq: [] as AdminProductFaq[],
  digitalFileName: '',
  digitalDownloadLimit: 0,
  digitalExpiryDays: 0,
  digitalLicense: '',
  serviceDuration: 0,
  serviceLocation: '',
  serviceCapacity: 0,
  serviceBookingNote: ''
})

/* -------------------------------- Tabs -------------------------------- */

const TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'media', label: 'Ảnh & video' },
  { key: 'variants', label: 'Biến thể' },
  { key: 'content', label: 'Nội dung' },
  { key: 'seo', label: 'SEO • AEO • GEO' }
] as const

type TabKey = (typeof TABS)[number]['key']

function initialTab(): TabKey {
  const q = String(route.query.tab ?? '')
  return TABS.some((tab) => tab.key === q) ? (q as TabKey) : 'overview'
}

const activeTab = ref<TabKey>(initialTab())

watch(activeTab, (tab) => {
  router.replace({ query: { ...route.query, tab } })
})

/* ------------------------------ Type lock ------------------------------ */

const lockedType = computed(() => (isEdit.value ? detail.value?.product.type ?? null : null))
const canSelectType = computed(() => !lockedType.value)
const activeTypeHint = computed(() => TYPE_TABS.find((tab) => tab.value === form.type)?.hint ?? '')
const typeLabel = computed(() => TYPE_TABS.find((tab) => tab.value === form.type)?.label ?? 'Vật lý')

function selectType(value: ProductType) {
  if (!canSelectType.value) return
  form.type = value
}

type VariantDraft = {
  key: string
  id?: string
  title: string
  sku: string
  price: number
  compareAtPrice: number | null
  inventoryQuantity: number
  manageInventory: boolean
}

const variants = ref<VariantDraft[]>([])
const removedVariantIds = ref<string[]>([])
const originalVariants = ref<AdminVariant[]>([])

const handleTouched = ref(false)
let keySeed = 0

function nextKey() {
  keySeed += 1
  return `v${Date.now()}-${keySeed}`
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

watch(
  () => form.title,
  (value) => {
    if (handleTouched.value || isEdit.value) return
    form.handle = slugify(value)
  }
)

function addVariant() {
  variants.value.push({
    key: nextKey(),
    title: variants.value.length === 0 ? 'Mặc định' : `Phân loại ${variants.value.length + 1}`,
    sku: '',
    price: 0,
    compareAtPrice: null,
    inventoryQuantity: 0,
    manageInventory: true
  })
}

function removeVariant(index: number) {
  const variant = variants.value[index]
  if (!variant) return
  if (variant.id) removedVariantIds.value.push(variant.id)
  variants.value.splice(index, 1)
}

/* ------------------------------- Media ------------------------------- */

const MAX_PHOTOS = 20
const MAX_VIDEOS = 2
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 25 * 1024 * 1024

const media = ref<AdminMedia[]>([])
const uploading = ref(false)
const uploadLabel = ref('')
const mediaError = ref('')
const photoInput = ref<HTMLInputElement | null>(null)
const videoInput = ref<HTMLInputElement | null>(null)
const dragId = ref('')

const photoCount = computed(() => media.value.filter((item) => item.type === 'image').length)
const videoCount = computed(() => media.value.filter((item) => item.type === 'video').length)
const photoRemaining = computed(() => Math.max(0, MAX_PHOTOS - photoCount.value))
const videoRemaining = computed(() => Math.max(0, MAX_VIDEOS - videoCount.value))
const firstImage = computed(() => media.value.find((item) => item.type === 'image') ?? null)
const previewImage = computed(() => firstImage.value?.thumbUrl || form.thumbnail)

function openPicker(kind: 'image' | 'video') {
  if (!isEdit.value) {
    mediaError.value = 'Lưu sản phẩm trước khi tải ảnh/video.'
    return
  }
  mediaError.value = ''
  if (kind === 'video') videoInput.value?.click()
  else photoInput.value?.click()
}

async function uploadFiles(files: FileList | File[] | null, kind: 'image' | 'video') {
  if (!files) return
  if (!props.productId) {
    mediaError.value = 'Lưu sản phẩm trước khi tải ảnh/video.'
    return
  }

  mediaError.value = ''
  const list = Array.from(files)
  const remaining = kind === 'video' ? videoRemaining.value : photoRemaining.value
  if (remaining <= 0) {
    mediaError.value = kind === 'video' ? 'Đã đủ 2 video.' : 'Đã đủ 20 ảnh.'
    return
  }

  const accepted = list.slice(0, remaining)
  const maxBytes = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  uploading.value = true

  try {
    for (const [index, file] of accepted.entries()) {
      if (file.size > maxBytes) {
        mediaError.value = `${file.name}: tệp vượt quá ${kind === 'video' ? '25 MB' : '10 MB'}.`
        continue
      }
      if (!file.type.startsWith(`${kind}/`)) {
        mediaError.value = `${file.name}: không đúng định dạng ${kind === 'video' ? 'video' : 'ảnh'}.`
        continue
      }

      uploadLabel.value = `Đang tải ${index + 1}/${accepted.length}…`
      const body = new FormData()
      body.set('file', file)
      body.set('type', kind)

      const result = await $fetch<{ media: AdminMedia }>(`/api/admin/products/${props.productId}/media`, {
        method: 'POST',
        body
      })
      media.value.push(result.media)
    }
  } catch (error: any) {
    mediaError.value = error?.data?.statusMessage || 'Không tải được tệp. Kiểm tra dung lượng và định dạng.'
  } finally {
    uploading.value = false
    uploadLabel.value = ''
    if (photoInput.value) photoInput.value.value = ''
    if (videoInput.value) videoInput.value.value = ''
  }
}

function onPick(event: Event, kind: 'image' | 'video') {
  const input = event.target as HTMLInputElement
  void uploadFiles(input.files, kind)
}

function onDrop(event: DragEvent) {
  mediaError.value = ''
  const files = event.dataTransfer?.files
  if (!files?.length) return
  const images = Array.from(files).filter((file) => file.type.startsWith('image/'))
  const videos = Array.from(files).filter((file) => file.type.startsWith('video/'))
  if (images.length) void uploadFiles(images, 'image')
  if (videos.length) void uploadFiles(videos, 'video')
}

function startDrag(event: DragEvent, item: AdminMedia) {
  dragId.value = item.id
  event.dataTransfer?.setData('text/plain', item.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function dropOn(event: DragEvent, target: AdminMedia) {
  event.preventDefault()
  const id = dragId.value || event.dataTransfer?.getData('text/plain') || ''
  dragId.value = ''
  if (!id || id === target.id) return

  const list = [...media.value]
  const from = list.findIndex((item) => item.id === id)
  const to = list.findIndex((item) => item.id === target.id)
  if (from < 0 || to < 0) return

  const [moved] = list.splice(from, 1)
  if (!moved) return
  list.splice(to, 0, moved)
  media.value = list
  void persistOrder()
}

function moveItem(item: AdminMedia, direction: -1 | 1) {
  const list = [...media.value]
  const index = list.findIndex((entry) => entry.id === item.id)
  const next = index + direction
  if (index < 0 || next < 0 || next >= list.length) return
  const [moved] = list.splice(index, 1)
  if (!moved) return
  list.splice(next, 0, moved)
  media.value = list
  void persistOrder()
}

async function persistOrder() {
  if (!props.productId) return
  mediaError.value = ''
  try {
    await $fetch(`/api/admin/products/${props.productId}/media/order`, {
      method: 'PUT',
      body: { ids: media.value.map((item) => item.id) }
    })
    media.value = media.value.map((item, index) => ({ ...item, sortOrder: index }))
    if (firstImage.value) form.thumbnail = firstImage.value.url
  } catch (error: any) {
    mediaError.value = error?.data?.statusMessage || 'Không lưu được thứ tự media.'
  }
}

async function toggleFeatured(item: AdminMedia) {
  mediaError.value = ''
  try {
    const result = await $fetch<{ media: AdminMedia }>(`/api/admin/media/${item.id}`, {
      method: 'PATCH',
      body: { isFeatured: !item.isFeatured }
    })
    replaceMedia(result.media)
  } catch (error: any) {
    mediaError.value = error?.data?.statusMessage || 'Không cập nhật được media.'
  }
}

async function saveAlt(item: AdminMedia) {
  try {
    const result = await $fetch<{ media: AdminMedia }>(`/api/admin/media/${item.id}`, {
      method: 'PATCH',
      body: { alt: item.alt }
    })
    replaceMedia(result.media)
  } catch (error: any) {
    mediaError.value = error?.data?.statusMessage || 'Không lưu được mô tả ảnh.'
  }
}

function replaceMedia(next: AdminMedia) {
  media.value = media.value.map((item) => (item.id === next.id ? next : item))
}

async function removeMedia(item: AdminMedia) {
  if (!window.confirm(`Xoá ${item.type === 'video' ? 'video' : 'ảnh'} này?`)) return
  mediaError.value = ''
  try {
    await $fetch(`/api/admin/media/${item.id}`, { method: 'DELETE' })
    media.value = media.value.filter((entry) => entry.id !== item.id)
    media.value = media.value.map((entry, index) => ({ ...entry, sortOrder: index }))
    form.thumbnail = firstImage.value?.url ?? ''
  } catch (error: any) {
    mediaError.value = error?.data?.statusMessage || 'Không xoá được media.'
  }
}

function formatDuration(seconds: number) {
  if (!seconds) return ''
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/* ---------------------------- Digital file ---------------------------- */

const digitalInput = ref<HTMLInputElement | null>(null)
const digitalBusy = ref(false)

function pickDigitalFile() {
  if (!isEdit.value) {
    errorMessage.value = 'Lưu sản phẩm trước khi tải tệp sản phẩm số.'
    return
  }
  digitalInput.value?.click()
}

async function onDigitalFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !props.productId) return
  if (file.size > 50 * 1024 * 1024) {
    errorMessage.value = 'Tệp sản phẩm số tối đa 50 MB.'
    return
  }
  digitalBusy.value = true
  errorMessage.value = ''
  try {
    const body = new FormData()
    body.set('file', file)
    const result = await $fetch<{ fileName: string }>(`/api/admin/products/${props.productId}/digital-file`, {
      method: 'POST',
      body
    })
    form.digitalFileName = result.fileName
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không tải được tệp sản phẩm số.'
  } finally {
    digitalBusy.value = false
    input.value = ''
  }
}

async function removeDigitalFile() {
  if (!props.productId || !form.digitalFileName) return
  if (!window.confirm('Xoá tệp sản phẩm số?')) return
  digitalBusy.value = true
  try {
    await $fetch(`/api/admin/products/${props.productId}/digital-file`, { method: 'DELETE' })
    form.digitalFileName = ''
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không xoá được tệp.'
  } finally {
    digitalBusy.value = false
  }
}

/* --------------------------- Highlights / FAQ -------------------------- */

function addHighlight() {
  if (form.highlights.length >= 10) return
  form.highlights.push({ title: '', description: '' })
}

function removeHighlight(index: number) {
  form.highlights.splice(index, 1)
}

function addFaq() {
  if (form.faq.length >= 20) return
  form.faq.push({ question: '', answer: '' })
}

function removeFaq(index: number) {
  form.faq.splice(index, 1)
}

/* -------------------------------- Load -------------------------------- */

async function load() {
  if (!props.productId) {
    addVariant()
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    const data = await requestFetch<AdminProductDetail>(`/api/admin/products/${props.productId}`)
    detail.value = data
    form.title = data.product.title ?? ''
    form.handle = data.product.handle ?? ''
    form.subtitle = data.product.subtitle ?? ''
    form.description = data.product.description ?? ''
    form.category = data.product.category ?? ''
    form.seller = data.product.seller ?? ''
    form.thumbnail = data.product.thumbnail ?? ''
    form.unit = data.product.unit || 'sản phẩm'
    form.color = data.product.color ?? ''
    form.status = data.product.status || 'draft'
    form.type = data.product.type || 'physical'
    form.requiresShipping = data.product.requiresShipping
    form.weightGrams = data.product.weightGrams || 0
    form.seoTitle = data.product.seoTitle
    form.seoDescription = data.product.seoDescription
    form.seoKeywords = data.product.seoKeywords
    form.canonicalUrl = data.product.canonicalUrl
    form.aeoSummary = data.product.aeoSummary
    form.geoServiceAreas = data.product.geoServiceAreas || ''
    form.highlights = data.product.highlights.map((item) => ({ ...item }))
    form.faq = data.product.faq.map((item) => ({ ...item }))
    form.digitalFileName = data.product.digitalFileName || ''
    form.digitalDownloadLimit = data.product.digitalDownloadLimit || 0
    form.digitalExpiryDays = data.product.digitalExpiryDays || 0
    form.digitalLicense = data.product.digitalLicense
    form.serviceDuration = data.product.serviceDuration || 0
    form.serviceLocation = data.product.serviceLocation
    form.serviceCapacity = data.product.serviceCapacity || 0
    form.serviceBookingNote = data.product.serviceBookingNote
    originalVariants.value = data.variants
    variants.value = data.variants.map((variant) => ({ ...variant, key: nextKey() }))
    media.value = data.media
  } catch (error: any) {
    loadError.value = error?.data?.statusMessage || 'Không tải được sản phẩm.'
  } finally {
    loading.value = false
  }
}

await load()

const busy = ref(false)
const message = ref('')
const errorMessage = ref('')

/* ------------------------------ AI (tách theo focus) ------------------------------ */

type AiFocus = 'content' | 'seo' | 'aeo' | 'geo'

const aiBusy = ref<'' | AiFocus>('')

const AI_FIELD_MAP: Record<AiFocus, string[]> = {
  content: ['subtitle', 'description', 'highlights', 'faq'],
  seo: ['seoTitle', 'seoDescription', 'seoKeywords'],
  aeo: ['aeoSummary', 'faq'],
  geo: ['geoServiceAreas', 'aeoSummary']
}

const AI_FOCUS_LABEL: Record<AiFocus, string> = {
  content: 'nội dung bán hàng',
  seo: 'SEO',
  aeo: 'AEO',
  geo: 'GEO'
}

function aiExistingContext(focus: AiFocus) {
  if (focus === 'content') {
    return [form.subtitle, form.description, form.highlights.map((h) => `${h.title}: ${h.description}`).join('\n')]
      .filter(Boolean)
      .join('\n')
      .slice(0, 1200)
  }
  if (focus === 'seo') {
    return [form.seoTitle, form.seoDescription, form.seoKeywords].filter(Boolean).join('\n').slice(0, 600)
  }
  if (focus === 'aeo') {
    return [form.aeoSummary, form.faq.map((f) => `${f.question} — ${f.answer}`).join('\n')]
      .filter(Boolean)
      .join('\n')
      .slice(0, 1200)
  }
  return [form.geoServiceAreas, form.serviceLocation, form.aeoSummary].filter(Boolean).join('\n').slice(0, 800)
}

function applyAiResult(focus: AiFocus, result: Record<string, unknown>) {
  const pick = (key: string) => (AI_FIELD_MAP[focus].includes(key) ? result[key] : undefined)

  const subtitle = pick('subtitle')
  if (typeof subtitle === 'string' && subtitle) form.subtitle = subtitle
  const description = pick('description')
  if (typeof description === 'string' && description) form.description = description
  const highlights = pick('highlights')
  if (Array.isArray(highlights) && highlights.length) form.highlights = highlights as AdminProductHighlight[]
  const faq = pick('faq')
  if (Array.isArray(faq) && faq.length) form.faq = faq as AdminProductFaq[]
  const seoTitle = pick('seoTitle')
  if (typeof seoTitle === 'string' && seoTitle) form.seoTitle = seoTitle
  const seoDescription = pick('seoDescription')
  if (typeof seoDescription === 'string' && seoDescription) form.seoDescription = seoDescription
  const seoKeywords = pick('seoKeywords')
  if (typeof seoKeywords === 'string' && seoKeywords) form.seoKeywords = seoKeywords
  const aeoSummary = pick('aeoSummary')
  if (typeof aeoSummary === 'string' && aeoSummary) form.aeoSummary = aeoSummary
  const geoServiceAreas = pick('geoServiceAreas')
  if (typeof geoServiceAreas === 'string' && geoServiceAreas) form.geoServiceAreas = geoServiceAreas
}

async function generateWithAi(focus: AiFocus) {
  if (aiBusy.value) return
  if (!form.title.trim()) {
    errorMessage.value = 'Nhập tên sản phẩm trước khi gen AI.'
    activeTab.value = 'overview'
    return
  }
  aiBusy.value = focus
  errorMessage.value = ''
  try {
    const category = options.value?.categories?.find((item) => item.id === form.category)
    const seller = options.value?.sellers?.find((item) => item.id === form.seller)
    const result = await $fetch<Record<string, unknown>>('/api/admin/products/ai-generate', {
      method: 'POST',
      body: {
        title: form.title.trim(),
        type: form.type,
        focus,
        categoryName: category?.name ?? '',
        sellerName: seller?.name ?? '',
        existingContext: aiExistingContext(focus),
        model: aiModel.value || undefined
      }
    })
    applyAiResult(focus, result)
    message.value = `Đã gen ${AI_FOCUS_LABEL[focus]} bằng AI. Kiểm tra và chỉnh lại trước khi lưu.`
    setTimeout(() => {
      message.value = ''
    }, 4000)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không gen được nội dung AI.'
  } finally {
    aiBusy.value = ''
  }
}

function aiButtonLabel(focus: AiFocus) {
  return aiBusy.value === focus ? 'Đang gen…' : `✨ Gen ${AI_FOCUS_LABEL[focus]}`
}

/* -------------------------------- Save -------------------------------- */

function validate() {
  if (!form.title.trim()) return 'Nhập tên sản phẩm.'
  if (!form.handle.trim()) return 'Nhập handle (đường dẫn).'
  if (!form.category) return 'Chọn danh mục.'
  if (!form.seller) return 'Chọn nhà cung cấp.'
  for (const [index, variant] of variants.value.entries()) {
    if (!variant.sku.trim()) return `Biến thể ${index + 1}: nhập SKU.`
    if (!variant.price || variant.price <= 0) return `Biến thể ${index + 1}: giá phải lớn hơn 0.`
  }
  return ''
}

function corePayload() {
  return {
    title: form.title.trim(),
    handle: form.handle.trim(),
    subtitle: form.subtitle.trim(),
    description: form.description.trim(),
    category: form.category,
    seller: form.seller,
    unit: form.unit.trim() || 'sản phẩm',
    color: form.color.trim(),
    status: form.status,
    requiresShipping: form.requiresShipping,
    weightGrams: Number(form.weightGrams) || 0,
    seoTitle: form.seoTitle.trim(),
    seoDescription: form.seoDescription.trim(),
    seoKeywords: form.seoKeywords.trim(),
    canonicalUrl: form.canonicalUrl.trim(),
    aeoSummary: form.aeoSummary.trim(),
    geoServiceAreas: form.geoServiceAreas.trim(),
    highlights: form.highlights,
    faq: form.faq,
    digitalDownloadLimit: Number(form.digitalDownloadLimit) || 0,
    digitalExpiryDays: Number(form.digitalExpiryDays) || 0,
    digitalLicense: form.digitalLicense.trim(),
    serviceDuration: Number(form.serviceDuration) || 0,
    serviceLocation: form.serviceLocation.trim(),
    serviceCapacity: Number(form.serviceCapacity) || 0,
    serviceBookingNote: form.serviceBookingNote.trim()
  }
}

async function save() {
  if (busy.value) return
  errorMessage.value = ''
  const invalid = validate()
  if (invalid) {
    errorMessage.value = invalid
    return
  }

  busy.value = true
  try {
    let productId = props.productId

    if (productId) {
      await $fetch(`/api/admin/products/${productId}`, { method: 'PATCH', body: corePayload() })
    } else {
      const created = await $fetch<{ product: { id: string } }>('/api/admin/products', {
        method: 'POST',
        body: { ...corePayload(), type: form.type }
      })
      productId = created.product.id
    }

    for (const id of removedVariantIds.value) {
      await $fetch(`/api/admin/variants/${id}`, { method: 'DELETE' })
    }
    removedVariantIds.value = []

    for (const variant of variants.value) {
      const body = {
        title: variant.title.trim() || 'Mặc định',
        sku: variant.sku.trim(),
        price: variant.price,
        compareAtPrice: variant.compareAtPrice ?? 0,
        inventoryQuantity: variant.inventoryQuantity,
        manageInventory: variant.manageInventory
      }
      if (variant.id) {
        await $fetch(`/api/admin/variants/${variant.id}`, { method: 'PATCH', body })
      } else {
        const created = await $fetch<{ variant: AdminVariant }>(`/api/admin/products/${productId}/variants`, {
          method: 'POST',
          body
        })
        variant.id = created.variant.id
      }
    }

    await router.push({
      path: `/admin/products/${productId}`,
      query: productId === props.productId ? { tab: activeTab.value, saved: '1' } : { saved: '1' }
    })
    if (props.productId) {
      await load()
      message.value = 'Đã lưu thay đổi.'
      setTimeout(() => {
        message.value = ''
      }, 2600)
    }
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.statusMessage || 'Không lưu được sản phẩm.'
  } finally {
    busy.value = false
  }
}

async function removeProduct() {
  if (!props.productId) return
  if (!window.confirm('Xoá sản phẩm này cùng toàn bộ biến thể? Thao tác không hoàn tác được.')) return
  busy.value = true
  try {
    await $fetch(`/api/admin/products/${props.productId}`, { method: 'DELETE' })
    await router.push('/admin/products')
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không xoá được sản phẩm.'
  } finally {
    busy.value = false
  }
}

const variantStock = computed(() => variants.value.reduce((sum, variant) => sum + (variant.inventoryQuantity || 0), 0))
const minVariantPrice = computed(() => (variants.value.length ? Math.min(...variants.value.map((v) => v.price || 0)) : 0))

const dirty = computed(() => {
  if (!props.productId) return true
  if (!detail.value) return false
  const original = detail.value.product
  return (
    JSON.stringify(corePayload()) !==
      JSON.stringify({
        title: original.title ?? '',
        handle: original.handle ?? '',
        subtitle: original.subtitle ?? '',
        description: original.description ?? '',
        category: original.category,
        seller: original.seller,
        unit: original.unit ?? '',
        color: original.color ?? '',
        status: original.status,
        requiresShipping: original.requiresShipping,
        weightGrams: original.weightGrams,
        seoTitle: original.seoTitle,
        seoDescription: original.seoDescription,
        seoKeywords: original.seoKeywords,
        canonicalUrl: original.canonicalUrl,
        aeoSummary: original.aeoSummary,
        geoServiceAreas: original.geoServiceAreas ?? '',
        highlights: original.highlights,
        faq: original.faq,
        digitalDownloadLimit: original.digitalDownloadLimit,
        digitalExpiryDays: original.digitalExpiryDays,
        digitalLicense: original.digitalLicense,
        serviceDuration: original.serviceDuration,
        serviceLocation: original.serviceLocation,
        serviceCapacity: original.serviceCapacity,
        serviceBookingNote: original.serviceBookingNote
      }) ||
    removedVariantIds.value.length > 0 ||
    JSON.stringify(variants.value.map(({ key, ...rest }) => rest)) !== JSON.stringify(originalVariants.value)
  )
})

function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => window.addEventListener('beforeunload', warnBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload))

if (route.query.saved === '1') {
  message.value = 'Đã tạo sản phẩm. Thêm ảnh/video và biến thể để hoàn tất.'
  setTimeout(() => {
    message.value = ''
  }, 4000)
}
</script>

<template>
  <div class="w-full">
    <!-- Sticky header: tên, loại, trạng thái, lưu -->
    <div
      class="sticky top-0 z-30 -mx-4 mb-3 border-b border-slate-200 bg-slate-50/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6"
    >
      <div class="flex flex-wrap items-center gap-2">
        <NuxtLink to="/admin/products" class="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-800">
          ← Sản phẩm
        </NuxtLink>

        <input
          v-model="form.title"
          class="min-w-[180px] flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-base font-semibold outline-none hover:border-slate-300 focus:border-emerald-600 focus:bg-white"
          :placeholder="isEdit ? 'Sản phẩm' : 'Tên sản phẩm'"
          aria-label="Tên sản phẩm"
        />

        <span
          v-if="isEdit"
          class="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
          title="Loại sản phẩm đã khoá sau khi tạo"
        >
          🔒 {{ typeLabel }}
        </span>

        <select
          v-model="form.status"
          class="shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium outline-none focus:border-emerald-600"
          aria-label="Trạng thái"
        >
          <option value="published">Đang bán</option>
          <option value="draft">Nháp</option>
          <option value="archived">Đã ẩn</option>
        </select>

        <a
          v-if="isEdit && form.handle"
          :href="`/product/${form.handle}`"
          target="_blank"
          class="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          Xem trang ↗
        </a>

        <button
          v-if="isEdit"
          type="button"
          class="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          :disabled="busy"
          @click="removeProduct"
        >
          Xoá
        </button>

        <button
          type="button"
          class="shrink-0 rounded-lg bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
          :disabled="busy"
          @click="save"
        >
          {{ busy ? 'Đang lưu…' : isEdit ? (dirty ? 'Lưu thay đổi' : 'Lưu') : 'Tạo sản phẩm' }}
        </button>
      </div>

      <!-- Tabs -->
      <nav class="mt-2 flex gap-1 overflow-x-auto text-sm" aria-label="Các phần của sản phẩm">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          type="button"
          class="whitespace-nowrap border-b-2 px-3 py-1.5 font-medium transition"
          :class="
            activeTab === tab.key
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
          "
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <span v-if="tab.key === 'media' && media.length" class="ml-1 text-[11px] text-slate-400">{{ media.length }}</span>
          <span v-if="tab.key === 'variants' && variants.length" class="ml-1 text-[11px] text-slate-400">
            {{ variants.length }}
          </span>
        </button>
      </nav>

      <div v-if="message" class="mt-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">{{ message }}</div>
      <div v-if="errorMessage" class="mt-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700">{{ errorMessage }}</div>
    </div>

    <div v-if="loadError" class="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{{ loadError }}</div>
    <div v-else-if="loading" class="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
      Đang tải sản phẩm…
    </div>

    <div v-else class="space-y-4">
      <!-- ============================== TỔNG QUAN ============================== -->
      <div v-show="activeTab === 'overview'" class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 class="text-sm font-semibold">Thông tin chung</h3>
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-600">Handle (đường dẫn) *</span>
              <input
                v-model="form.handle"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-600"
                placeholder="bo-hong-pastel"
                @input="handleTouched = true"
              />
            </label>

            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-600">Đơn vị</span>
              <input
                v-model="form.unit"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                placeholder="bó / cành / hộp"
              />
            </label>

            <label class="block">
              <span class="mb-1 flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Danh mục *</span>
                <NuxtLink to="/admin/categories" class="font-medium text-emerald-700 hover:underline">Quản lý</NuxtLink>
              </span>
              <select
                v-model="form.category"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              >
                <option value="">Chọn danh mục</option>
                <option v-for="category in options?.categories ?? []" :key="category.id" :value="category.id">
                  {{ category.parent ? `${category.parent.name} / ` : '' }}{{ category.name }}{{
                    category.isActive === false ? ' (ẩn)' : ''
                  }}
                </option>
              </select>
            </label>

            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-600">Nhà cung cấp *</span>
              <select
                v-model="form.seller"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              >
                <option value="">Chọn nhà cung cấp</option>
                <option v-for="seller in options?.sellers ?? []" :key="seller.id" :value="seller.id">
                  {{ seller.name }}
                </option>
              </select>
            </label>

            <label class="block sm:col-span-2">
              <span class="mb-1 block text-xs font-medium text-slate-600">Mô tả ngắn (one-line)</span>
              <input
                v-model="form.subtitle"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                placeholder="Một dòng hiển thị dưới tên — hoặc bấm ✨ Gen Nội dung ở tab Nội dung"
              />
            </label>

            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-600">Màu chủ đạo</span>
              <input
                v-model="form.color"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                placeholder="hồng / trắng / vàng"
              />
            </label>
          </div>
        </section>

        <!-- Loại sản phẩm + thuộc tính theo loại -->
        <div class="space-y-4">
          <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold">Loại sản phẩm</h3>
              <span
                v-if="lockedType"
                class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500"
                title="Đã xác định khi lưu — không thể đổi loại"
              >
                🔒 Đã khoá
              </span>
            </div>
            <div class="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
              <button
                v-for="tab in TYPE_TABS"
                :key="tab.value"
                type="button"
                class="rounded-md px-2 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed"
                :class="
                  form.type === tab.value
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : canSelectType
                      ? 'text-slate-500 hover:text-slate-700'
                      : 'text-slate-300'
                "
                :disabled="!canSelectType && form.type !== tab.value"
                @click="selectType(tab.value)"
              >
                {{ tab.label }}
              </button>
            </div>
            <p class="mt-2 text-[11px] leading-relaxed text-slate-500">
              <template v-if="lockedType">
                Sản phẩm đã chốt loại <strong>{{ typeLabel }}</strong>. Không đổi sang loại khác — cần đổi thì tạo sản
                phẩm mới.
              </template>
              <template v-else>{{ activeTypeHint }}. Loại sẽ bị khoá ngay sau khi tạo sản phẩm.</template>
            </p>

            <!-- Physical -->
            <div v-if="form.type === 'physical'" class="mt-3 flex items-center gap-3">
              <label class="flex items-center gap-2 text-xs font-medium text-slate-600">
                <input v-model="form.requiresShipping" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
                Cần giao hàng
              </label>
              <label class="block flex-1">
                <span class="mb-1 block text-[11px] font-medium text-slate-500">Cân nặng (g)</span>
                <input
                  v-model.number="form.weightGrams"
                  type="number"
                  min="0"
                  step="10"
                  class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-600"
                  placeholder="0"
                />
              </label>
            </div>

            <!-- Digital -->
            <div v-else-if="form.type === 'digital'" class="mt-3 space-y-3">
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p class="text-xs font-medium text-slate-600">Tệp sản phẩm số</p>
                <p v-if="form.digitalFileName" class="mt-1 truncate font-mono text-[11px] text-slate-700">
                  {{ form.digitalFileName }}
                </p>
                <p v-else class="mt-1 text-[11px] text-slate-400">Chưa có tệp (tối đa 50 MB).</p>
                <input ref="digitalInput" type="file" class="hidden" @change="onDigitalFile" />
                <div class="mt-2 flex gap-2">
                  <button
                    type="button"
                    class="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    :disabled="digitalBusy"
                    @click="pickDigitalFile"
                  >
                    {{ form.digitalFileName ? 'Thay tệp' : 'Tải tệp' }}
                  </button>
                  <button
                    v-if="form.digitalFileName"
                    type="button"
                    class="rounded-md px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                    :disabled="digitalBusy"
                    @click="removeDigitalFile"
                  >
                    Xoá
                  </button>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <label class="block">
                  <span class="mb-1 block text-[11px] font-medium text-slate-500">Giới hạn tải</span>
                  <input
                    v-model.number="form.digitalDownloadLimit"
                    type="number"
                    min="0"
                    class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-600"
                    placeholder="0 = ∞"
                  />
                </label>
                <label class="block">
                  <span class="mb-1 block text-[11px] font-medium text-slate-500">Hết hạn (ngày)</span>
                  <input
                    v-model.number="form.digitalExpiryDays"
                    type="number"
                    min="0"
                    class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-600"
                    placeholder="0 = ∞"
                  />
                </label>
              </div>
              <label class="block">
                <span class="mb-1 block text-[11px] font-medium text-slate-500">Giấy phép / điều khoản</span>
                <textarea
                  v-model="form.digitalLicense"
                  rows="2"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                  placeholder="Phạm vi sử dụng, cấm chia sẻ lại…"
                />
              </label>
            </div>

            <!-- Service -->
            <div v-else class="mt-3 space-y-3">
              <div class="grid grid-cols-2 gap-2">
                <label class="block">
                  <span class="mb-1 block text-[11px] font-medium text-slate-500">Thời lượng (phút)</span>
                  <input
                    v-model.number="form.serviceDuration"
                    type="number"
                    min="0"
                    class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-600"
                    placeholder="60"
                  />
                </label>
                <label class="block">
                  <span class="mb-1 block text-[11px] font-medium text-slate-500">Sức chứa</span>
                  <input
                    v-model.number="form.serviceCapacity"
                    type="number"
                    min="0"
                    class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-600"
                    placeholder="10"
                  />
                </label>
              </div>
              <label class="block">
                <span class="mb-1 block text-[11px] font-medium text-slate-500">Địa điểm</span>
                <input
                  v-model="form.serviceLocation"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                  placeholder="Quận 1, TP.HCM / Trực tuyến"
                />
              </label>
              <label class="block">
                <span class="mb-1 block text-[11px] font-medium text-slate-500">Ghi chú đặt lịch</span>
                <textarea
                  v-model="form.serviceBookingNote"
                  rows="2"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                  placeholder="Thời gian phục vụ, cần đặt trước bao lâu…"
                />
              </label>
            </div>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 class="text-sm font-semibold">Ảnh bìa &amp; giá</h3>
            <div v-if="previewImage" class="mt-2 overflow-hidden rounded-lg border border-slate-200">
              <img :src="previewImage" alt="Xem trước bìa" class="h-36 w-full object-cover" loading="lazy" />
            </div>
            <p v-else class="mt-2 rounded-lg border border-dashed border-slate-300 px-3 py-5 text-center text-xs text-slate-400">
              Chưa có ảnh bìa — thêm ở tab “Ảnh &amp; video”
            </p>
            <dl class="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-slate-500">
              <div class="rounded-lg bg-slate-50 px-1 py-2">
                <dt>Ảnh</dt>
                <dd class="text-sm font-semibold text-slate-700">{{ photoCount }}</dd>
              </div>
              <div class="rounded-lg bg-slate-50 px-1 py-2">
                <dt>Tồn kho</dt>
                <dd class="text-sm font-semibold text-slate-700">{{ variantStock }}</dd>
              </div>
              <div class="rounded-lg bg-slate-50 px-1 py-2">
                <dt>Giá từ</dt>
                <dd class="text-sm font-semibold text-slate-700">{{ variants.length ? formatVnd(minVariantPrice) : '—' }}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      <!-- ============================== MEDIA ============================== -->
      <section v-show="activeTab === 'media'" class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-sm font-semibold">Ảnh &amp; video</h3>
            <p class="text-[11px] text-slate-500">Ảnh đầu tiên là ảnh bìa mặc định. Kéo thả để sắp xếp.</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              :disabled="photoRemaining === 0 || uploading"
              @click="openPicker('image')"
            >
              + Thêm ảnh (còn {{ photoRemaining }})
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              :disabled="videoRemaining === 0 || uploading"
              @click="openPicker('video')"
            >
              + Thêm video (còn {{ videoRemaining }})
            </button>
          </div>
        </div>

        <input ref="photoInput" type="file" accept="image/*" multiple class="hidden" @change="onPick($event, 'image')" />
        <input ref="videoInput" type="file" accept="video/*" class="hidden" @change="onPick($event, 'video')" />

        <div class="p-4">
          <div
            v-if="!isEdit"
            class="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500"
          >
            Bấm “Tạo sản phẩm” trước, sau đó tải lên tối đa 20 ảnh và 2 video.
          </div>

          <div v-else>
            <div
              class="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500"
              @dragover.prevent
              @drop.prevent="onDrop"
            >
              <template v-if="uploading">{{ uploadLabel }}</template>
              <template v-else>
                Kéo thả ảnh/video vào đây hoặc chọn tệp.
                <span class="block text-[11px] text-slate-400">Ảnh ≤ 10 MB · Video ≤ 25 MB · 20 ảnh + 2 video</span>
              </template>
            </div>

            <p v-if="mediaError" class="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{{ mediaError }}</p>

            <div v-if="media.length === 0" class="mt-3 rounded-lg border border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
              Chưa có ảnh/video. Ảnh đầu tiên sẽ tự động làm ảnh bìa.
            </div>

            <ul v-else class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <li
                v-for="(item, index) in media"
                :key="item.id"
                class="group relative overflow-hidden rounded-xl border bg-slate-50"
                :class="[
                  item.id === dragId ? 'border-emerald-500 opacity-60' : 'border-slate-200',
                  item.type === 'image' && item.id === firstImage?.id ? 'ring-2 ring-emerald-500' : ''
                ]"
                draggable="true"
                @dragstart="startDrag($event, item)"
                @dragover.prevent
                @drop.prevent="dropOn($event, item)"
              >
                <div class="relative aspect-[4/3]">
                  <img
                    v-if="item.type === 'image'"
                    :src="item.thumbUrl || item.url"
                    :alt="item.alt || form.title"
                    class="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <video
                    v-else
                    :src="item.url"
                    :poster="item.posterUrl || undefined"
                    class="h-full w-full bg-black object-cover"
                    muted
                    playsinline
                    preload="metadata"
                  />
                  <span
                    v-if="item.type === 'image' && item.id === firstImage?.id"
                    class="absolute left-1.5 top-1.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                  >
                    Ảnh bìa
                  </span>
                  <span
                    v-if="item.type === 'video'"
                    class="absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                  >
                    Video {{ formatDuration(item.duration) }}
                  </span>
                  <button
                    type="button"
                    class="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100"
                    aria-label="Xoá media"
                    @click="removeMedia(item)"
                  >
                    ×
                  </button>
                </div>

                <div class="space-y-1.5 px-2 py-2">
                  <div class="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      class="rounded px-1 py-0.5 text-[10px] font-semibold"
                      :class="item.isFeatured ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'"
                      @click="toggleFeatured(item)"
                    >
                      {{ item.isFeatured ? '★ Nổi bật' : '☆ Nổi bật' }}
                    </button>
                    <span class="flex gap-0.5">
                      <button
                        type="button"
                        class="rounded px-1 text-xs text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                        :disabled="index === 0"
                        aria-label="Di chuyển lên"
                        @click="moveItem(item, -1)"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        class="rounded px-1 text-xs text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                        :disabled="index === media.length - 1"
                        aria-label="Di chuyển xuống"
                        @click="moveItem(item, 1)"
                      >
                        →
                      </button>
                    </span>
                  </div>
                  <input
                    v-model="item.alt"
                    class="w-full rounded border border-slate-200 px-1.5 py-1 text-[11px] outline-none focus:border-emerald-600"
                    placeholder="Mô tả ảnh (alt)"
                    @blur="saveAlt(item)"
                  />
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- ============================== BIẾN THỂ ============================== -->
      <section v-show="activeTab === 'variants'" class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h3 class="text-sm font-semibold">Biến thể &amp; tồn kho</h3>
            <p class="text-[11px] text-slate-500">
              {{
                form.type === 'service'
                  ? 'Mỗi biến thể là một gói dịch vụ; tồn kho = số chỗ còn lại.'
                  : 'Mỗi biến thể có SKU riêng; giá hiển thị lấy theo biến thể.'
              }}
              Tổng tồn: <strong>{{ variantStock }}</strong>
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
            @click="addVariant"
          >
            + Biến thể
          </button>
        </div>

        <div v-if="variants.length === 0" class="px-4 py-8 text-center text-sm text-slate-400">
          Chưa có biến thể. Thêm ít nhất một biến thể để bán được sản phẩm.
        </div>

        <div v-else class="w-full overflow-x-auto">
          <table class="w-full min-w-[720px] text-left text-sm">
            <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-3 py-2 font-semibold">Tên</th>
                <th class="px-3 py-2 font-semibold">SKU</th>
                <th class="px-3 py-2 font-semibold">Giá</th>
                <th class="px-3 py-2 font-semibold">Giá gốc</th>
                <th class="px-3 py-2 font-semibold">Tồn</th>
                <th class="px-3 py-2" />
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(variant, index) in variants" :key="variant.key">
                <td class="px-3 py-2">
                  <input
                    v-model="variant.title"
                    class="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-emerald-600"
                  />
                </td>
                <td class="px-3 py-2">
                  <input
                    v-model="variant.sku"
                    class="w-full rounded-md border border-slate-200 px-2 py-1.5 font-mono text-xs outline-none focus:border-emerald-600"
                    placeholder="SKU"
                  />
                </td>
                <td class="px-3 py-2">
                  <input
                    v-model.number="variant.price"
                    type="number"
                    min="0"
                    step="1000"
                    class="w-28 rounded-md border border-slate-200 px-2 py-1.5 text-right text-sm outline-none focus:border-emerald-600"
                  />
                </td>
                <td class="px-3 py-2">
                  <input
                    v-model.number="variant.compareAtPrice"
                    type="number"
                    min="0"
                    step="1000"
                    class="w-28 rounded-md border border-slate-200 px-2 py-1.5 text-right text-sm outline-none focus:border-emerald-600"
                    placeholder="—"
                  />
                </td>
                <td class="px-3 py-2">
                  <input
                    v-model.number="variant.inventoryQuantity"
                    type="number"
                    step="1"
                    class="w-20 rounded-md border border-slate-200 px-2 py-1.5 text-right text-sm outline-none focus:border-emerald-600"
                  />
                </td>
                <td class="px-3 py-2 text-right">
                  <button
                    type="button"
                    class="rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    @click="removeVariant(index)"
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="border-t border-slate-100 px-4 py-3 text-right">
          <button
            type="button"
            class="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            :disabled="busy"
            @click="save"
          >
            {{ busy ? 'Đang lưu…' : 'Lưu biến thể' }}
          </button>
        </div>
      </section>

      <!-- ============================== NỘI DUNG ============================== -->
      <div v-show="activeTab === 'content'" class="space-y-4">
        <section class="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="text-sm font-semibold text-indigo-800">✨ AI viết nội dung bán hàng</h3>
              <p class="text-[11px] text-indigo-600">
                Dựa trên tên sản phẩm + tài liệu huấn luyện của cửa hàng. Ghi đè: mô tả ngắn, mô tả chi tiết, điểm nổi
                bật, FAQ.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <select
                v-if="(aiConfig?.models?.length ?? 0) > 1"
                v-model="aiModel"
                class="max-w-[180px] rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs outline-none focus:border-indigo-500"
                aria-label="Model AI"
              >
                <option value="">Mặc định: {{ aiConfig?.model }}</option>
                <option v-for="model in aiConfig?.models ?? []" :key="model" :value="model">{{ model }}</option>
              </select>
              <NuxtLink to="/admin/ai" class="text-xs font-medium text-indigo-500 hover:text-indigo-800">Cấu hình</NuxtLink>
              <button
                type="button"
                class="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                :disabled="Boolean(aiBusy) || !form.title.trim()"
                @click="generateWithAi('content')"
              >
                {{ aiButtonLabel('content') }}
              </button>
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div class="border-b border-slate-200 px-4 py-3">
            <h3 class="text-sm font-semibold">Mô tả chi tiết</h3>
          </div>
          <div class="p-4">
            <textarea
              v-model="form.description"
              rows="8"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-emerald-600"
              placeholder="Mô tả thành phần, chất liệu, cách dùng, điểm khác biệt…"
            />
            <span class="mt-1 block text-[11px] text-slate-400">{{ form.description.trim().length }} ký tự</span>
          </div>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h3 class="text-sm font-semibold">Điểm nổi bật</h3>
              <p class="text-[11px] text-slate-500">Hiển thị dạng danh sách trên trang sản phẩm (tối đa 10).</p>
            </div>
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              :disabled="form.highlights.length >= 10"
              @click="addHighlight"
            >
              + Điểm
            </button>
          </div>
          <div class="space-y-2 p-4">
            <p v-if="form.highlights.length === 0" class="text-sm text-slate-400">Chưa có điểm nổi bật.</p>
            <div v-for="(item, index) in form.highlights" :key="`hl-${index}`" class="flex gap-2">
              <div class="grid flex-1 gap-2 sm:grid-cols-[220px_1fr]">
                <input
                  v-model="item.title"
                  class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
                  placeholder="Tiêu đề ngắn"
                />
                <input
                  v-model="item.description"
                  class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
                  placeholder="Mô tả chi tiết"
                />
              </div>
              <button
                type="button"
                class="rounded-md px-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                @click="removeHighlight(index)"
              >
                Xoá
              </button>
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h3 class="text-sm font-semibold">Câu hỏi thường gặp (FAQ)</h3>
              <p class="text-[11px] text-slate-500">Dùng cho JSON-LD FAQPage và nội dung trên trang (tối đa 20).</p>
            </div>
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              :disabled="form.faq.length >= 20"
              @click="addFaq"
            >
              + Câu hỏi
            </button>
          </div>
          <div class="space-y-3 p-4">
            <p v-if="form.faq.length === 0" class="text-sm text-slate-400">Chưa có câu hỏi.</p>
            <div v-for="(item, index) in form.faq" :key="`faq-${index}`" class="rounded-lg border border-slate-200 p-3">
              <div class="flex items-start gap-2">
                <input
                  v-model="item.question"
                  class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium outline-none focus:border-emerald-600"
                  placeholder="Câu hỏi"
                />
                <button
                  type="button"
                  class="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  @click="removeFaq(index)"
                >
                  Xoá
                </button>
              </div>
              <textarea
                v-model="item.answer"
                rows="2"
                class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
                placeholder="Câu trả lời ngắn, trực tiếp."
              />
            </div>
          </div>
        </section>
      </div>

      <!-- ============================== SEO • AEO • GEO ============================== -->
      <div v-show="activeTab === 'seo'" class="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
        <!-- SEO -->
        <section class="rounded-xl border border-sky-200 bg-white shadow-sm">
          <div class="flex items-center justify-between gap-2 border-b border-sky-100 bg-sky-50/60 px-4 py-3">
            <div>
              <h3 class="text-sm font-semibold text-sky-800">SEO — công cụ tìm kiếm</h3>
              <p class="text-[11px] text-sky-600">Tiêu đề &amp; meta cho Google.</p>
            </div>
            <button
              type="button"
              class="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
              :disabled="Boolean(aiBusy) || !form.title.trim()"
              @click="generateWithAi('seo')"
            >
              {{ aiButtonLabel('seo') }}
            </button>
          </div>
          <div class="space-y-3 p-4">
            <label class="block">
              <span class="mb-1 flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Tiêu đề SEO</span>
                <span class="text-[11px] font-normal" :class="form.seoTitle.length > 60 ? 'text-amber-600' : 'text-slate-400'">
                  {{ form.seoTitle.length }}/60
                </span>
              </span>
              <input
                v-model="form.seoTitle"
                maxlength="120"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                placeholder="Để trống sẽ dùng tên sản phẩm"
              />
            </label>
            <label class="block">
              <span class="mb-1 flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Meta description</span>
                <span
                  class="text-[11px] font-normal"
                  :class="form.seoDescription.length > 160 ? 'text-amber-600' : 'text-slate-400'"
                >
                  {{ form.seoDescription.length }}/160
                </span>
              </span>
              <textarea
                v-model="form.seoDescription"
                rows="2"
                maxlength="320"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                placeholder="Một câu mô tả hấp dẫn, có từ khoá chính."
              />
            </label>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-600">Từ khoá</span>
                <input
                  v-model="form.seoKeywords"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                  placeholder="hoa hồng, bó hoa, quà tặng"
                />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-600">Canonical URL</span>
                <input
                  v-model="form.canonicalUrl"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-sky-500"
                  placeholder="https://florahub.vn/product/…"
                />
              </label>
            </div>
          </div>
        </section>

        <!-- AEO -->
        <section class="rounded-xl border border-violet-200 bg-white shadow-sm">
          <div class="flex items-center justify-between gap-2 border-b border-violet-100 bg-violet-50/60 px-4 py-3">
            <div>
              <h3 class="text-sm font-semibold text-violet-800">AEO — câu trả lời AI</h3>
              <p class="text-[11px] text-violet-600">Cho Google AI Overview / ChatGPT trích dẫn.</p>
            </div>
            <button
              type="button"
              class="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              :disabled="Boolean(aiBusy) || !form.title.trim()"
              @click="generateWithAi('aeo')"
            >
              {{ aiButtonLabel('aeo') }}
            </button>
          </div>
          <div class="space-y-3 p-4">
            <label class="block">
              <span class="mb-1 flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Tóm tắt trả lời nhanh</span>
                <span class="text-[11px] font-normal" :class="form.aeoSummary.length > 500 ? 'text-amber-600' : 'text-slate-400'">
                  {{ form.aeoSummary.length }}/1200
                </span>
              </span>
              <textarea
                v-model="form.aeoSummary"
                rows="5"
                maxlength="1200"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-violet-500"
                placeholder="2–4 câu trả lời trực tiếp: sản phẩm là gì, dành cho ai, khác biệt chính, thời gian giao/nhận."
              />
            </label>
            <div class="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
              FAQ phục vụ AEO đang chỉnh ở tab
              <button type="button" class="font-semibold text-violet-700 hover:underline" @click="activeTab = 'content'">
                Nội dung
              </button>. Lệnh <em>Gen AEO</em> sẽ viết lại cả tóm tắt lẫn FAQ.
            </div>
          </div>
        </section>

        <!-- GEO -->
        <section class="rounded-xl border border-teal-200 bg-white shadow-sm lg:col-span-2">
          <div class="flex items-center justify-between gap-2 border-b border-teal-100 bg-teal-50/60 px-4 py-3">
            <div>
              <h3 class="text-sm font-semibold text-teal-800">GEO — khu vực phục vụ &amp; công cụ AI địa phương</h3>
              <p class="text-[11px] text-teal-600">
                Khu vực phục vụ để trợ lý AI và tìm kiếm địa phương giới thiệu khi khách hỏi “mua hoa ở đâu”.
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              :disabled="Boolean(aiBusy) || !form.title.trim()"
              @click="generateWithAi('geo')"
            >
              {{ aiButtonLabel('geo') }}
            </button>
          </div>
          <div class="grid gap-3 p-4 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1 flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Khu vực phục vụ</span>
                <span class="text-[11px] font-normal text-slate-400">{{ form.geoServiceAreas.length }}/500</span>
              </span>
              <textarea
                v-model="form.geoServiceAreas"
                rows="2"
                maxlength="500"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                placeholder="Quận 1, Quận 3, Thủ Đức, TP.HCM…"
              />
            </label>
            <p class="self-end text-[11px] leading-relaxed text-slate-400">
              <em>Gen GEO</em> gợi ý khu vực hợp lý cho cửa hàng hoa nội thành, rồi viết tóm tắt “sẵn sàng địa phương”
              vào ô AEO phía trên — kiểm tra lại trước khi lưu.
            </p>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
