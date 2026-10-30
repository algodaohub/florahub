export type ShippingOptionBadge = 'cheapest' | 'fastest' | 'recommended' | 'fallback'

export type ShippingQuoteOption = {
  id: string
  carrier: string
  carrierName: string
  service: string
  /** Cước hãng báo (chưa markup/freeship). */
  fee: number
  /** Phí trước freeship (đã markup). */
  feeOriginal: number
  /** Phí khách thực trả sau freeship. */
  customerFee: number
  eta: string
  successRate: number | null
  badges: ShippingOptionBadge[]
  ownAccount: boolean
  codFee: number
}

export type ShippingQuoteMode = 'live' | 'fallback' | 'none'

export type ShippingDistrictOption = {
  code: string
  name: string
  wardCode: string
}

export type ShippingAddressResolution = {
  resolution: 'resolved' | 'ambiguous' | 'unresolved'
  city: string
  cityCode: string
  district: string
  districtCode: string
  ward: string
  wardCode: string
  districtOptions: ShippingDistrictOption[]
}

export type ShippingQuote = {
  quoteId: string
  expiresAt: string
  mode: ShippingQuoteMode
  serviceable: boolean
  requiresChoice: boolean
  selectedOptionId: string | null
  address: ShippingAddressResolution | null
  parcel: {
    actualWeight: number
    chargeableWeight: number
    length: number
    width: number
    height: number
  } | null
  freeShipping: { applied: boolean; threshold: number; remaining: number }
  options: ShippingQuoteOption[]
  optionCount: number
  fallback: string | null
  message: string
}

export type ShippingPublicPolicy = {
  enabled: boolean
  allowCustomerChoice: boolean
  freeShippingThreshold: number
  fallbackBehavior: 'flat' | 'block'
  fallbackFee: number
  codEnabled: boolean
  showEta: boolean
  showSuccessRate: boolean
  maxOptions: number
}

export type ShippingSecretState = { has: boolean; hint: string }

export type GoshipRegionValue = {
  cityCode: string
  cityName: string
  districtCode: string
  districtName: string
  wardCode: string
  wardName: string
}

export type PublicShippingSettings = {
  enabled: boolean
  apiBaseUrl: string
  accessToken: ShippingSecretState
  clientId: string
  clientSecret: ShippingSecretState
  pickup: {
    name: string
    phone: string
    street: string
    ward: string
    district: string
    city: string
    wardCode: string
    districtCode: string
    cityCode: string
  }
  parcel: {
    defaultWeight: number
    defaultItemWeight: number
    packagingWeight: number
    length: number
    width: number
    height: number
  }
  codEnabled: boolean
  autoAdvance: boolean
  quoteTtlSeconds: number
  rateCacheSeconds: number
  quoteRateLimitPerMinute: number
  addressFallback: 'flat' | 'ask_district' | 'block'
  webhook: {
    id: string
    url: string
  }
  lastVerifiedAt: string
  readiness: {
    api: boolean
    webhook: boolean
    pickup: boolean
    policy: boolean
  }
  policy: ShippingPublicPolicy & {
    autoStrategy: 'cheapest' | 'fastest' | 'preferred'
    preferredCarrier: string
    maxOptions: number
    markupPercent: number
    absorbFeeDifference: boolean
  }
}

export type AdminOrderShipping = {
  provider: string
  quoteId: string
  optionId: string
  carrier: string
  carrierName: string
  service: string
  shipmentId: string
  code: string
  trackingNumber: string
  trackingUrl: string
  statusCode: number
  statusText: string
  feeQuoted: number
  feeActual: number
  cod: number
  payer: number
  selectedManually: boolean
  chargeableWeight: number
  cityName: string
  districtName: string
  wardName: string
  cityCode: string
  districtCode: string
  wardCode: string
  returning: boolean
  createdAt: string
  updatedAt: string
}

export type AdminShipmentEvent = {
  id: string
  statusCode: number
  statusText: string
  message: string
  eventTime: string
  createdAt: string
}
