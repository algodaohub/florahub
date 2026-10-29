type OpenOptions = {
  variantId?: string
  quantity?: number
}

/**
 * One add-to-cart bottom sheet for the whole app.
 * Product cards open it so the shopper can pick a grade/quantity before adding.
 */
export function useAddToCartSheet() {
  const open = useState<boolean>('add-sheet-open', () => false)
  const handle = useState<string>('add-sheet-handle', () => '')
  const presetVariantId = useState<string>('add-sheet-variant', () => '')
  const presetQuantity = useState<number>('add-sheet-quantity', () => 1)

  function openSheet(productHandle: string, options: OpenOptions = {}) {
    handle.value = productHandle
    presetVariantId.value = options.variantId ?? ''
    presetQuantity.value = Math.max(1, options.quantity ?? 1)
    open.value = true
  }

  function closeSheet() {
    open.value = false
  }

  return { open, handle, presetVariantId, presetQuantity, openSheet, closeSheet }
}
