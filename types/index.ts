import type { ShippingPublicPolicy } from './shipping'

export type Trend = {
  direction: 'up' | 'down' | 'flat'
  label: string
  percent: number
}

export type ProductCard = {
  id: string
  handle: string
  title: string
  subtitle: string | null
  thumbnail: string
  unit: string
  color: string | null
  type: ProductType
  price: number
  compareAtPrice: number | null
  discountPercent: number
  variantId: string | null
  variantTitle: string | null
  inStock: boolean
  seller: { name: string; slug: string; rating: number }
  category: { name: string; slug: string }
  trend: Trend
  createdAt: string
}

export type ProductType = 'physical' | 'digital' | 'service'

export type Category = {
  id: string
  name: string
  slug: string
  imageUrl: string | null
  description?: string
  parentId?: string | null
  seoTitle?: string
  seoDescription?: string
  productCount?: number
}

export type Banner = {
  image: string
  title: string
  subtitle: string
  href: string
}

export type FlashSaleItem = {
  id: string
  salePrice: number
  quantityLimit: number
  variantId: string
  product: ProductCard
}

export type FlashSale = {
  id: string
  title: string
  endsAt: string
  items: FlashSaleItem[]
}

export type Post = {
  id: string
  slug: string
  title: string
  excerpt: string
  body: string
  coverUrl: string
  publishedAt: string
}

export type HomeData = {
  banners: Banner[]
  categories: Category[]
  flashSale: FlashSale | null
  recommended: ProductCard[]
  posts: Post[]
}

export type ProductListResponse = {
  items: ProductCard[]
  total: number
  page: number
  limit: number
  hasMore: boolean
  colors: string[]
  filters: {
    q: string
    category: string
    seller: string
    color: string
    sort: string
    minPrice: number
    maxPrice: number
  }
}

export type CartItem = {
  id: string
  quantity: number
  unitPrice: number
  lineTotal: number
  product: {
    id: string
    handle: string
    title: string
    thumbnail: string
    unit: string
    seller: string
  }
  variant: {
    id: string
    title: string
    optionsJson: string
    inventoryQuantity: number
  }
}

export type Cart = {
  id: string | null
  items: CartItem[]
  count: number
  subtotal: number
  /** null khi phí vận chuyển chưa xác định (chờ báo giá Goship ở bước thanh toán). */
  shipping: number | null
  shippingPending?: boolean
  shippingRequired?: boolean
  shippingPolicy?: ShippingPublicPolicy
  total: number
}

export type ProductMedia = {
  id: string
  type: 'image' | 'video'
  url: string
  thumbUrl: string
  posterUrl: string
  alt: string | null
  isFeatured: boolean
  duration: number
}

export type ProductDetail = {
  id: string
  handle: string
  title: string
  subtitle: string | null
  description: string
  thumbnail: string
  unit: string
  status: string
  type: ProductType
  requiresShipping: boolean
  weightGrams: number
  category: Category
  seller: { id: string; name: string; slug: string; region: string | null; rating: number }
  media: ProductMedia[]
  images: Array<{ id: string; url: string; alt: string | null }>
  specs: Array<{ id: string; name: string; value: string }>
  highlights: Array<{ title: string; description: string }>
  faq: Array<{ question: string; answer: string }>
  seo: {
    title: string
    description: string
    keywords: string
    canonicalUrl: string
  }
  aeoSummary: string
  digital: {
    downloadLimit: number
    expiryDays: number
    license: string
  }
  service: {
    duration: number
    location: string
    capacity: number
    bookingNote: string
  }
  options: Array<{ id: string; title: string; values: Array<{ id: string; value: string }> }>
  variants: Array<{
    id: string
    title: string
    sku: string
    price: number
    compareAtPrice: number | null
    inventoryQuantity: number
    optionsJson: string
  }>
  reviews: Array<{ id: string; authorName: string; rating: number; body: string; createdAt: string }>
  priceTrends: Array<{ date: string; price: number }>
  stockTrends: Array<{ date: string; stock: number }>
  rating: number
  reviewCount: number
  trend: Trend
}

export type OrderDetail = {
  id: string
  email: string
  status: string
  subtotal: number
  shippingTotal: number
  discountTotal: number
  taxRate: number
  taxTotal: number
  total: number
  paymentMethod: string
  paymentStatus: string
  sepayInvoiceNumber?: string
  sepayOrderId?: string
  shippingName: string
  shippingPhone: string
  shippingAddress: string
  note: string | null
  createdAt: string
  items: Array<{
    id: string
    title: string
    variantTitle: string
    thumbnail: string
    unitPrice: number
    quantity: number
  }>
}

export type AuthUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  displayName: string
  phone: string
  avatar: string | null
  verified: boolean
}

export type Address = {
  id: string
  label: string
  recipient: string
  phone: string
  line1: string
  ward: string
  district: string
  city: string
  /** Mã tỉnh/thành theo danh mục Goship (lưu khi đã đối chiếu). */
  cityCode?: string
  districtCode?: string
  wardCode?: string
  isDefault: boolean
}

export type VietnamWard = {
  code: number
  name: string
  type: string
  codename: string
}

export type VietnamProvince = {
  code: number
  name: string
  type: string
  codename: string
  phoneCode: number
  wardCount: number
}

export type AccountNotification = {
  id: string
  title: string
  body: string
  read: boolean
  createdAt: string
}

export type Wallet = {
  id: string | null
  balance: number
  bankName: string
  bankAccount: string
  bankHolder: string
}

export type WalletTransaction = {
  id: string
  amount: number
  type: string
  status: string
  code: string
  note: string
  createdAt: string
}

export type AccountOrderSummary = {
  id: string
  status: string
  total: number
  itemCount: number
  shippingName: string
  createdAt: string
  preview: Array<{ id: string; title: string; thumbnail: string; quantity: number }>
}

export type SiteSettings = {
  siteName: string
  tagline: string
  description: string
  logoUrl: string
  faviconUrl: string
  primaryColor: string
  primaryDarkColor: string
  primarySoftColor: string
  accentColor: string
  accentSoftColor: string
  paperColor: string
  paperDeepColor: string
  inkColor: string
  mutedColor: string
  hairlineColor: string
  discountColor: string
  hotline: string
  email: string
  address: string
  currency: string
  locale: string
  affiliateCommissionRate: number
}

export type Affiliate = {
  id: string
  code: string
  commissionRate: number
  effectiveRate: number
  customRate: boolean
  status: string
  createdAt: string
  link: string
  bankName: string
  bankAccountNo: string
  bankAccountName: string
  taxCode: string
}

export type AffiliateCommission = {
  id: string
  amount: number
  rate: number
  status: string
  eligibleAt: string
  createdAt: string
  payoutId: string
  order: { id: string; total: number; status: string; createdAt: string }
}

export type AffiliatePayoutSummary = {
  id: string
  number: string
  status: string
  grossTotal: number
  taxRate: number
  taxTotal: number
  netTotal: number
  commissionCount: number
  method: string
  paidAt: string
  cancelledAt: string
  createdAt: string
}

export type AffiliateStatementLine = {
  commissionId: string
  orderId: string
  orderCode: string
  orderDate: string
  completedAt: string
  goodsTotal: number
  rate: number
  amount: number
}

export type AffiliateStatement = {
  number: string
  status: string
  issuedAt: string
  paidAt: string
  cancelledAt: string
  method: string
  reference: string
  note: string
  periodFrom: string
  periodTo: string
  seller: {
    name: string
    taxCode: string
    address: string
    phone: string
    email: string
    invoiceSymbol: string
    invoiceTemplate: string
  }
  affiliate: {
    name: string
    email: string
    code: string
    taxCode: string
    bankName: string
    bankAccountNo: string
    bankAccountName: string
  }
  lines: AffiliateStatementLine[]
  totals: {
    gross: number
    taxRate: number
    tax: number
    net: number
    count: number
    netInWords: string
  }
}

export type AffiliateSummary = {
  affiliate: Affiliate | null
  defaultRate: number
  holdDays: number
  attributionDays: number
  payoutThreshold: number
  autoReconcile: boolean
  stats: {
    clicks: number
    orders: number
    pending: number
    approved: number
    processing: number
    paid: number
    total: number
  }
  commissions: AffiliateCommission[]
  payouts: AffiliatePayoutSummary[]
}
