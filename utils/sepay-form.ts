type SepayCheckoutResponse = {
  paid: boolean
  action?: string
  fields?: Record<string, string>
}

/** Cổng thanh toán nhận form POST rồi 302; trình duyệt phải tự submit, không dùng fetch. */
export function submitSepayForm(action: string, fields: Record<string, string>) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = action
  form.style.display = 'none'

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }

  document.body.appendChild(form)
  form.submit()
}

/**
 * Lấy form đã ký từ server rồi chuyển khách sang SePay.
 * Trả `false` khi đơn đã thanh toán (không cần chuyển hướng).
 */
export async function startSepayCheckout(orderId: string) {
  const result = await $fetch<SepayCheckoutResponse>(
    `/api/orders/${encodeURIComponent(orderId)}/sepay-checkout`,
    { method: 'POST' }
  )
  if (result.paid) return false
  if (!result.action || !result.fields) {
    throw new Error('Phản hồi cổng thanh toán không hợp lệ')
  }

  submitSepayForm(result.action, result.fields)
  return true
}
