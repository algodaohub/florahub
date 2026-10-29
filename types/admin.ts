import type { AdminOrderShipping, AdminShipmentEvent } from './shipping'

export type AdminOrderListItem = {
  id: string
  email: string
  status: string
  paymentMethod: string
  paymentStatus: string
  total: number
  shippingName: string
  shippingPhone: string
  paidAt: string
  completedAt: string
  taxInvoiceNumber: string
  hasAffiliate: boolean
  affiliateCode: string
  shippingProvider: string
  shippingCarrier: string
  shippingCarrierName: string
  shippingService: string
  shippingCode: string
  shippingStatusCode: number
  shippingStatusText: string
  shippingReturning: boolean
  createdAt: string
  customerEmail: string | null
  itemCount: number
}

export type AdminOrderList = {
  page: number
  perPage: number
  total: number
  totalPages: number
  items: AdminOrderListItem[]
}

export type AdminOrderItem = {
  id: string
  title: string
  variantTitle: string | null
  thumbnail: string | null
  unitPrice: number
  quantity: number
}

export type AdminJournalLine = {
  id: string
  date: string
  refType: string
  account: string
  accountName: string
  description: string
  debit: number
  credit: number
  invoiceNumber: string
}

export type AdminOrderAffiliate = {
  code: string
  rate: number
  status: string
  referrerName: string
  referrerEmail: string
}

export type AdminOrderDetail = {
  order: {
    id: string
    email: string
    status: string
    paymentMethod: string
    paymentStatus: string
    subtotal: number
    shippingTotal: number
    discountTotal: number
    taxRate: number
    taxTotal: number
    total: number
    shippingName: string
    shippingPhone: string
    shippingAddress: string
    note: string
    paidAt: string
    completedAt: string
    cancelledAt: string
    refundedAt: string
    refundedAmount: number
    taxInvoiceNumber: string
    taxInvoiceIssuedAt: string
    taxInvoiceStatus: string
    taxInvoiceCancelledReason: string
    sepayTransactionId: string
    sepayOrderId: string
    accountingPostedAt: string
    createdAt: string
    updatedAt: string
  }
  customer: { id: string; email: string; displayName: string } | null
  affiliate: AdminOrderAffiliate | null
  commission: { amount: number; rate: number; status: string } | null
  journal: AdminJournalLine[]
  items: AdminOrderItem[]
  shipping: AdminOrderShipping
  shipmentEvents: AdminShipmentEvent[]
}

export type AdminOrderSummary = {
  totalOrders: number
  statusCounts: Record<string, number>
  pendingOrders: number
  pendingPayments: number
  paidToday: number
  completedToday: number
  revenueToday: number
  awaitingAmount: number
}

export type AdminAccountingSettings = {
  sellerName: string
  sellerTaxCode: string
  sellerAddress: string
  invoiceSymbol: string
  invoiceTemplate: string
  updatedAt: string
}

export type AdminAccountingCounter = {
  account: string
  name: string
  amount: number
}

export type AdminAccountingEntry = AdminJournalLine & {
  orderId: string
  orderCode: string
  customer: string
  counterAccounts: AdminAccountingCounter[]
}

export type AdminAccountingAccount = {
  account: string
  name: string
  openingDebit: number
  openingCredit: number
  periodDebit: number
  periodCredit: number
  closingDebit: number
  closingCredit: number
}

export type AdminAccountingInvoice = {
  id: string
  number: string
  issuedAt: string
  status: string
  cancelledReason: string
  customer: string
  email: string
  total: number
  taxTotal: number
  taxRate: number
  net: number
  paymentMethod: string
  paymentStatus: string
}

export type AdminInvoiceDetailLine = {
  id: string
  title: string
  variantTitle: string
  unitPrice: number
  quantity: number
}

export type AdminInvoiceDetail = {
  invoice: {
    number: string
    issuedAt: string
    status: string
    cancelledReason: string
    taxRate: number
    net: number
    taxTotal: number
    total: number
    subtotal: number
    discountTotal: number
    shippingTotal: number
    paymentMethod: string
    paymentStatus: string
    completedAt: string
    seller: {
      name: string
      taxCode: string
      address: string
      invoiceSymbol: string
      invoiceTemplate: string
    }
    buyer: {
      name: string
      phone: string
      address: string
      email: string
    }
    items: AdminInvoiceDetailLine[]
  }
}

export type AdminAccounting = {
  range: { from: string; to: string }
  vatRate: number
  settings: AdminAccountingSettings
  summary: {
    ordersCompleted: number
    grossSales: number
    netRevenue: number
    vatOutput: number
    cash: number
    bank: number
    receivable: number
    returns: number
    invoicesIssued: number
    invoicesCancelled: number
  }
  daily: Array<{ date: string; net: number; vat: number; gross: number }>
  accounts: AdminAccountingAccount[]
  entries: AdminAccountingEntry[]
  invoices: AdminAccountingInvoice[]
}

export type ProductType = 'physical' | 'digital' | 'service'

export type AdminMedia = {
  id: string
  type: 'image' | 'video'
  url: string
  thumbUrl: string
  posterUrl: string
  alt: string
  isFeatured: boolean
  sortOrder: number
  duration: number
  fileName: string
}

export type AdminProductHighlight = {
  title: string
  description: string
}

export type AdminProductFaq = {
  question: string
  answer: string
}

export type AdminVariant = {
  id: string
  title: string
  sku: string
  price: number
  compareAtPrice: number | null
  inventoryQuantity: number
  manageInventory: boolean
}

export type AdminProductListItem = {
  id: string
  handle: string
  title: string
  thumbnail: string | null
  status: string
  unit: string
  color: string | null
  type: ProductType
  category: { id: string; name: string } | null
  seller: { id: string; name: string } | null
  variantCount: number
  stock: number
  minPrice: number
  maxPrice: number
  createdAt: string
  updatedAt: string
}

export type AdminProductList = {
  page: number
  perPage: number
  total: number
  totalPages: number
  items: AdminProductListItem[]
}

export type AdminProductDetail = {
  product: {
    id: string
    handle: string
    title: string
    subtitle: string | null
    description: string | null
    category: string
    seller: string
    thumbnail: string | null
    unit: string
    color: string | null
    status: string
    type: ProductType
    requiresShipping: boolean
    weightGrams: number
    seoTitle: string
    seoDescription: string
    seoKeywords: string
    canonicalUrl: string
    aeoSummary: string
    highlights: AdminProductHighlight[]
    faq: AdminProductFaq[]
    digitalFileName: string | null
    digitalDownloadLimit: number
    digitalExpiryDays: number
    digitalLicense: string
    serviceDuration: number
    serviceLocation: string
    serviceCapacity: number
    serviceBookingNote: string
    createdAt: string
    updatedAt: string
  }
  variants: AdminVariant[]
  media: AdminMedia[]
  specs: Array<{ id: string; name: string; value: string; sortOrder: number }>
}

export type AdminCategory = {
  id: string
  name: string
  slug: string
  parent: { id: string; name: string } | null
  description: string
  imageUrl: string
  seoTitle: string
  seoDescription: string
  isActive: boolean
  sortOrder: number
  productCount: number
  updatedAt: string | null
}

export type AdminOptions = {
  categories: Array<{ id: string; name: string; slug: string; isActive?: boolean; parent?: { id: string; name: string } | null }>
  sellers: Array<{ id: string; name: string; slug: string }>
}
