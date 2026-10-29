import type { StoreConfig, StorePreset } from '~/types/store'

export const defaultConfig: StoreConfig = {
  brand: {
    name: 'FloraHub',
    tagline: 'Hoa tươi mỗi ngày',
    description: 'Hoa tươi cắt cành, giỏ hoa và quà tặng giao trong ngày.',
    logoUrl: '',
    faviconUrl: '',
    hotline: '',
    email: '',
    address: ''
  },
  tone: 'am-ap',
  colors: {
    primary: '#3F6B4F',
    primaryDark: '#2E523C',
    primarySoft: '#E5EDE6',
    onPrimary: '#FFFFFF',
    accent: '#B9764A',
    accentSoft: '#F3E5DA',
    paper: '#F7F3EB',
    paperDeep: '#EFE8DB',
    ink: '#2B2A26',
    muted: '#7C766B',
    hairline: '#E3DCCE',
    discount: '#B4553F'
  },
  typography: {
    displayFont: 'be-vietnam',
    bodyFont: 'be-vietnam',
    displayWeight: 600,
    headingTracking: '-0.01em'
  },
  shape: {
    cardRadius: 20,
    buttonRadius: 999,
    inputRadius: 999,
    imageRadius: 18,
    shadow: 'soft'
  },
  layout: {
    shellWidth: 480,
    gutter: 12,
    headerStyle: 'classic',
    showTagline: false,
    assistantInHeader: true,
    announcement: { enabled: false, text: '', href: '' },
    productGridColumns: 3,
    productCardStyle: 'soft',
    bottomNav: { enabled: true, items: ['home', 'categories', 'cart', 'account'] },
    footer: { enabled: false, text: '' }
  },
  features: {
    affiliate: true,
    wallet: true,
    reviews: true,
    flashSale: true,
    wishlist: false,
    trackOrder: true,
    currency: 'VND',
    locale: 'vi-VN',
    taxRate: 0,
    affiliateCommissionRate: 5,
    minOrderQuantity: 0
  },
  shipping: {
    enabled: true,
    allowCustomerChoice: true,
    autoStrategy: 'cheapest',
    preferredCarrier: '',
    maxOptions: 3,
    allowedCarriers: [],
    blockedCarriers: [],
    markupPercent: 0,
    freeShippingThreshold: 500000,
    fallbackBehavior: 'flat',
    fallbackFee: 30000,
    showEta: true,
    showSuccessRate: false,
    absorbFeeDifference: true
  },
  seo: {
    titleTemplate: '',
    description: 'Hoa tươi cắt cành, giỏ hoa và quà tặng giao trong ngày.',
    keywords: 'hoa tươi, hoa hồng, giỏ hoa, quà tặng',
    ogImage: ''
  },
  content: {
    hero: {
      enabled: true,
      eyebrow: 'FloraHub',
      title: 'Hoa tươi mỗi ngày',
      subtitle: 'Chọn bó hoa hợp gu, giao tận cửa trong ngày.',
      ctaLabel: 'Xem danh mục',
      ctaHref: '/categories',
      image: ''
    }
  },
  payments: {
    method: 'qr',
    qr: {
      enabled: true,
      bankId: '',
      bankName: '',
      accountNo: '',
      accountName: '',
      template: 'compact2'
    },
    sepay: { enabled: false }
  }
}

type PresetSeed = Omit<StorePreset, 'config'> & {
  tone: StoreConfig['tone']
  colors: StoreConfig['colors']
  typography: StoreConfig['typography']
  shape: StoreConfig['shape']
  layout?: Partial<StoreConfig['layout']>
}

const seeds: PresetSeed[] = [
  {
    id: 'vuon-nha',
    name: 'Vườn nhà',
    description: 'Olive ấm, giấy kraft, serif mềm — phong cách hoa vườn.',
    swatches: ['#3F6B4F', '#B9764A', '#F7F3EB', '#2B2A26'],
    tone: 'am-ap',
    colors: { ...defaultConfig.colors },
    typography: { ...defaultConfig.typography },
    shape: { ...defaultConfig.shape }
  },
  {
    id: 'hong-pastel',
    name: 'Hồng pastel',
    description: 'Hồng phấn, viền mảnh, bo tròn lớn — hợp shop quà tặng.',
    swatches: ['#C2708B', '#A9705A', '#FDF4F3', '#3B2B31'],
    tone: 'pastel',
    colors: {
      primary: '#C2708B',
      primaryDark: '#A0526B',
      primarySoft: '#FBE7EC',
      onPrimary: '#FFFFFF',
      accent: '#A9705A',
      accentSoft: '#F6E6DD',
      paper: '#FDF4F3',
      paperDeep: '#F6E7E5',
      ink: '#3B2B31',
      muted: '#8C7379',
      hairline: '#EFDCDD',
      discount: '#C0464F'
    },
    typography: { displayFont: 'nunito', bodyFont: 'nunito', displayWeight: 600, headingTracking: '0em' },
    shape: { cardRadius: 24, buttonRadius: 999, inputRadius: 999, imageRadius: 22, shadow: 'soft' }
  },
  {
    id: 'toi-gian',
    name: 'Tối giản',
    description: 'Đen trắng, góc vuông vừa, typography rõ — thương hiệu hiện đại.',
    swatches: ['#1F1F1D', '#7A6A55', '#FAF9F6', '#1B1B19'],
    tone: 'toi-gian',
    colors: {
      primary: '#1F1F1D',
      primaryDark: '#000000',
      primarySoft: '#EFEDE8',
      onPrimary: '#FFFFFF',
      accent: '#7A6A55',
      accentSoft: '#F1EBE1',
      paper: '#FAF9F6',
      paperDeep: '#F1EFE9',
      ink: '#1B1B19',
      muted: '#77736A',
      hairline: '#E4E1D9',
      discount: '#A33B32'
    },
    typography: { displayFont: 'inter', bodyFont: 'inter', displayWeight: 600, headingTracking: '-0.02em' },
    shape: { cardRadius: 8, buttonRadius: 8, inputRadius: 8, imageRadius: 8, shadow: 'none' }
  },
  {
    id: 'sang-trong',
    name: 'Sang trọng',
    description: 'Đen và vàng đồng, serif thanh mảnh — hoa cao cấp, sự kiện.',
    swatches: ['#1C1A17', '#B08D4F', '#F6F2E9', '#201E1A'],
    tone: 'sang-trong',
    colors: {
      primary: '#1C1A17',
      primaryDark: '#000000',
      primarySoft: '#EDE7D9',
      onPrimary: '#FFFFFF',
      accent: '#B08D4F',
      accentSoft: '#F2E9D6',
      paper: '#F6F2E9',
      paperDeep: '#EDE6D6',
      ink: '#201E1A',
      muted: '#7E7666',
      hairline: '#E2D9C6',
      discount: '#9E3B2F'
    },
    typography: { displayFont: 'inter', bodyFont: 'inter', displayWeight: 500, headingTracking: '0.01em' },
    shape: { cardRadius: 4, buttonRadius: 4, inputRadius: 4, imageRadius: 4, shadow: 'soft' }
  },
  {
    id: 'nhiet-doi',
    name: 'Nhiệt đới',
    description: 'Xanh ngọc và cam san hô, tươi sáng — shop hoa trẻ trung.',
    swatches: ['#0F6E6A', '#E2703A', '#F2F7F4', '#16302C'],
    tone: 'tuoi-tre',
    colors: {
      primary: '#0F6E6A',
      primaryDark: '#0A4F4C',
      primarySoft: '#DDEFEC',
      onPrimary: '#FFFFFF',
      accent: '#E2703A',
      accentSoft: '#FBE8DC',
      paper: '#F2F7F4',
      paperDeep: '#E4EFE9',
      ink: '#16302C',
      muted: '#6C847E',
      hairline: '#D6E5DF',
      discount: '#C24A32'
    },
    typography: { displayFont: 'nunito', bodyFont: 'nunito', displayWeight: 700, headingTracking: '-0.01em' },
    shape: { cardRadius: 22, buttonRadius: 999, inputRadius: 999, imageRadius: 20, shadow: 'soft' }
  },
  {
    id: 'mong-man',
    name: 'Mộng mơ',
    description: 'Tím lavender và hồng phấn, bo tròn mềm — quà tặng lãng mạn.',
    swatches: ['#6B5CA5', '#C77FA8', '#F8F5FB', '#2C2740'],
    tone: 'pastel',
    colors: {
      primary: '#6B5CA5',
      primaryDark: '#554787',
      primarySoft: '#EAE6F7',
      onPrimary: '#FFFFFF',
      accent: '#C77FA8',
      accentSoft: '#F7E7F0',
      paper: '#F8F5FB',
      paperDeep: '#EEE9F5',
      ink: '#2C2740',
      muted: '#7F7893',
      hairline: '#E3DDF0',
      discount: '#B04E6E'
    },
    typography: { displayFont: 'nunito', bodyFont: 'nunito', displayWeight: 600, headingTracking: '0em' },
    shape: { cardRadius: 26, buttonRadius: 999, inputRadius: 999, imageRadius: 24, shadow: 'soft' }
  }
]

function buildPreset(seed: PresetSeed): StorePreset {
  return {
    id: seed.id,
    name: seed.name,
    description: seed.description,
    swatches: seed.swatches,
    config: {
      tone: seed.tone,
      colors: seed.colors,
      typography: seed.typography,
      shape: seed.shape,
      layout: seed.layout
        ? { ...defaultConfig.layout, ...seed.layout }
        : { ...defaultConfig.layout }
    } as StorePreset['config']
  }
}

export const storePresets: StorePreset[] = seeds.map(buildPreset)

export function findPreset(id: string) {
  return storePresets.find((preset) => preset.id === id)
}
