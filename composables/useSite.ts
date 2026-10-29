import type { SiteSettings } from '~/types'
import type { StoreConfig, StoreRecordMeta } from '~/types/store'
import { defaultConfig } from '~/utils/store-presets'
import { setMoneyFormat } from '~/utils/format'

const emptySettings: SiteSettings = {
  siteName: '',
  tagline: '',
  description: '',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '',
  primaryDarkColor: '',
  primarySoftColor: '',
  accentColor: '',
  accentSoftColor: '',
  paperColor: '',
  paperDeepColor: '',
  inkColor: '',
  mutedColor: '',
  hairlineColor: '',
  discountColor: '',
  hotline: '',
  email: '',
  address: '',
  currency: 'VND',
  locale: 'vi-VN',
  affiliateCommissionRate: 5
}

export type SitePayload = SiteSettings & {
  config: StoreConfig
  store: StoreRecordMeta | null
  resolvedBy: 'domain' | 'default' | 'fallback'
}

export function useSite() {
  const site = useState<SiteSettings>('site-settings', () => emptySettings)
  const config = useState<StoreConfig>('store-config', () => defaultConfig)
  const store = useState<StoreRecordMeta | null>('store-meta', () => null)
  const resolvedBy = useState<'domain' | 'default' | 'fallback'>('store-resolved-by', () => 'fallback')
  const ready = useState<boolean>('site-settings-ready', () => false)
  const loading = useState<boolean>('site-settings-loading', () => false)

  async function load(force = false) {
    if (loading.value) return
    if (ready.value && !force) return
    loading.value = true
    try {
      // On the server, forward the incoming request headers so multi-domain
      // stores resolve to the right config on the very first render.
      const fetcher = import.meta.server
        ? (useRequestFetch() as unknown as <T>(url: string) => Promise<T>)
        : ($fetch as unknown as <T>(url: string) => Promise<T>)
      const data = await fetcher<SitePayload>('/api/site')
      site.value = data
      config.value = data.config ?? defaultConfig
      store.value = data.store ?? null
      resolvedBy.value = data.resolvedBy ?? 'fallback'
      setMoneyFormat(data.currency, data.locale)
      ready.value = true
    } finally {
      loading.value = false
    }
  }

  return { site, config, store, resolvedBy, ready, loading, load }
}
