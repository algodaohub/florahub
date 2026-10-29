export type StoreColorTokens = {
  primary: string
  primaryDark: string
  primarySoft: string
  onPrimary: string
  accent: string
  accentSoft: string
  paper: string
  paperDeep: string
  ink: string
  muted: string
  hairline: string
  discount: string
}

export type StoreFontKey = 'lora' | 'playfair' | 'nunito' | 'inter' | 'be-vietnam'

export type StoreTypography = {
  displayFont: StoreFontKey
  bodyFont: StoreFontKey
  displayWeight: number
  headingTracking: string
}

export type StoreShape = {
  cardRadius: number
  buttonRadius: number
  inputRadius: number
  imageRadius: number
  shadow: 'none' | 'soft' | 'strong'
}

export type StoreHeaderStyle = 'classic' | 'centered' | 'minimal'

export type StoreNavKey = 'home' | 'categories' | 'cart' | 'account' | 'assistant'

export type StoreLayout = {
  shellWidth: number
  gutter: number
  headerStyle: StoreHeaderStyle
  showTagline: boolean
  assistantInHeader: boolean
  announcement: {
    enabled: boolean
    text: string
    href: string
  }
  productGridColumns: number
  productCardStyle: 'soft' | 'flat' | 'bordered'
  bottomNav: {
    enabled: boolean
    items: StoreNavKey[]
  }
  footer: {
    enabled: boolean
    text: string
  }
}

export type StoreFeatures = {
  affiliate: boolean
  wallet: boolean
  reviews: boolean
  flashSale: boolean
  wishlist: boolean
  trackOrder: boolean
  currency: string
  locale: string
  taxRate: number
  affiliateCommissionRate: number
  /** Minimum total quantity per order (0 = no minimum). */
  minOrderQuantity: number
}

export type StoreShippingPolicy = {
  /** Bật tính phí vận chuyển động qua Goship. */
  enabled: boolean
  /** Cho phép khách chọn hãng/dịch vụ ở bước thanh toán. */
  allowCustomerChoice: boolean
  autoStrategy: 'cheapest' | 'fastest' | 'preferred'
  preferredCarrier: string
  /** Số phương án tối đa trả cho khách. */
  maxOptions: number
  allowedCarriers: string[]
  blockedCarriers: string[]
  /** Tỉ lệ cộng thêm trên phí hãng vận chuyển (%). */
  markupPercent: number
  /** Miễn phí vận chuyển khi giá trị sản phẩm đạt ngưỡng (0 = tắt). */
  freeShippingThreshold: number
  fallbackBehavior: 'flat' | 'block'
  fallbackFee: number
  showEta: boolean
  showSuccessRate: boolean
  /** Chịu phần chênh lệch khi phí thực tế cao hơn phí báo khách. */
  absorbFeeDifference: boolean
}

export type StoreSeo = {
  titleTemplate: string
  description: string
  keywords: string
  ogImage: string
}

export type StorePaymentMethod = 'qr' | 'cod' | 'sepay'

export type StorePaymentQrTemplate = 'compact' | 'compact2' | 'qr_only' | 'print'

export type StorePaymentQr = {
  enabled: boolean
  /** BIN (vd: 970436) hoặc mã ngân hàng VietQR (vd: VCB). */
  bankId: string
  bankName: string
  accountNo: string
  accountName: string
  template: StorePaymentQrTemplate
  /** Runtime-only: webhook ngân hàng đã cấu hình; không lưu DB. */
  webhookReady?: boolean
  /** Runtime-only: SePay Open API token đã cấu hình; không lưu DB. */
  apiReady?: boolean
}

export type StorePaymentSepay = {
  enabled: boolean
  /** Runtime-only: server inject khi trả config công khai; không lưu DB. */
  ready?: boolean
}

export type StorePayments = {
  /** Phương thức mặc định cho đơn hàng mới. */
  method: StorePaymentMethod
  qr: StorePaymentQr
  sepay: StorePaymentSepay
}

export type StoreContent = {
  hero: {
    eyebrow: string
    title: string
    subtitle: string
    ctaLabel: string
    ctaHref: string
    image: string
    enabled: boolean
  }
}

export type StoreBrand = {
  name: string
  tagline: string
  description: string
  logoUrl: string
  faviconUrl: string
  hotline: string
  email: string
  address: string
}

export type StoreTone = 'am-ap' | 'sang-trong' | 'toi-gian' | 'tuoi-tre' | 'pastel' | 'nong-nghiep'

export type StoreConfig = {
  brand: StoreBrand
  tone: StoreTone
  colors: StoreColorTokens
  typography: StoreTypography
  shape: StoreShape
  layout: StoreLayout
  features: StoreFeatures
  shipping: StoreShippingPolicy
  seo: StoreSeo
  content: StoreContent
  payments: StorePayments
}

export type StorePreset = {
  id: string
  name: string
  description: string
  swatches: string[]
  config: Omit<StoreConfig, 'brand' | 'seo' | 'content' | 'features' | 'shipping'> &
    Partial<Pick<StoreConfig, 'features'>>
}

export type StoreRecordMeta = {
  id: string
  name: string
  domain: string
  preset: string
  active: boolean
  /** Store fallback cho mọi host không khớp domain. */
  isDefault: boolean
  updatedAt: string
}

export type StoreConfigResponse = {
  config: StoreConfig
  store: StoreRecordMeta | null
  resolvedBy: 'domain' | 'default' | 'fallback'
}
