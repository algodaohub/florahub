import { storePresets } from '~~/utils/store-presets'

export default defineEventHandler(() => ({
  presets: storePresets,
  defaultPreset: 'vuon-nha'
}))
