import type { Cart } from '~/types'

/** Nạp Vant theo nhu cầu: toast chỉ xuất hiện sau thao tác, không cần nằm trong bundle đầu. */
async function showToastLazy(message: string) {
  if (!import.meta.client) return
  const { showToast } = await import('vant')
  showToast({ message, position: 'bottom' })
}

const emptyCart = (): Cart => ({
  id: null,
  items: [],
  count: 0,
  subtotal: 0,
  shipping: 0,
  total: 0
})

export function useCart() {
  const cart = useState<Cart>('cart', emptyCart)
  const initialized = useState<boolean>('cart-initialized', () => false)
  const pending = useState<boolean>('cart-pending', () => false)

  async function refresh() {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    cart.value = await $fetch<Cart>('/api/cart', { headers })
    initialized.value = true
  }

  async function ensure() {
    if (initialized.value) return
    await refresh()
  }

  async function add(variantId: string, quantity = 1) {
    pending.value = true
    try {
      cart.value = await $fetch<Cart>('/api/cart/items', {
        method: 'POST',
        body: { variantId, quantity }
      })
      void showToastLazy('Đã thêm vào giỏ hàng')
    } finally {
      pending.value = false
    }
  }

  async function updateItem(itemId: string, quantity: number) {
    pending.value = true
    try {
      cart.value = await $fetch<Cart>(`/api/cart/items/${itemId}`, {
        method: 'PATCH',
        body: { quantity }
      })
    } finally {
      pending.value = false
    }
  }

  async function clear() {
    pending.value = true
    try {
      cart.value = await $fetch<Cart>('/api/cart', { method: 'DELETE' })
      void showToastLazy('Đã xoá giỏ hàng')
    } finally {
      pending.value = false
    }
  }

  async function removeItem(itemId: string) {
    pending.value = true
    try {
      cart.value = await $fetch<Cart>(`/api/cart/items/${itemId}`, { method: 'DELETE' })
      void showToastLazy('Đã xoá khỏi giỏ hàng')
    } finally {
      pending.value = false
    }
  }

  return {
    cart,
    pending,
    count: computed(() => cart.value.count),
    items: computed(() => cart.value.items),
    subtotal: computed(() => cart.value.subtotal),
    shipping: computed(() => cart.value.shipping),
    total: computed(() => cart.value.total),
    refresh,
    ensure,
    add,
    updateItem,
    removeItem,
    clear
  }
}
