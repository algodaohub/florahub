import { requireAdminMutation } from '~~/server/utils/admin'
import { readStoreShippingPolicy } from '~~/server/utils/shipping-policy'
import { saveStoreConfig } from '~~/server/utils/store'
import type { StoreShippingPolicy } from '~/types/store'

function bool(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

function num(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function text(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function carriers(value: unknown) {
  if (!Array.isArray(value)) return undefined
  return value.map((item) => String(item ?? '').trim().toLowerCase()).filter(Boolean)
}

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { adminOnly: true })

  const body = await readBody<Record<string, unknown>>(event)
  const patch: Partial<StoreShippingPolicy> = {}

  const enabled = bool(body?.enabled)
  if (enabled !== undefined) patch.enabled = enabled
  const allowCustomerChoice = bool(body?.allowCustomerChoice)
  if (allowCustomerChoice !== undefined) patch.allowCustomerChoice = allowCustomerChoice
  const autoStrategy = text(body?.autoStrategy)
  if (autoStrategy !== undefined) patch.autoStrategy = autoStrategy as StoreShippingPolicy['autoStrategy']
  const preferredCarrier = text(body?.preferredCarrier)
  if (preferredCarrier !== undefined) patch.preferredCarrier = preferredCarrier
  const maxOptions = num(body?.maxOptions)
  if (maxOptions !== undefined) patch.maxOptions = maxOptions
  const allowedCarriers = carriers(body?.allowedCarriers)
  if (allowedCarriers !== undefined) patch.allowedCarriers = allowedCarriers
  const blockedCarriers = carriers(body?.blockedCarriers)
  if (blockedCarriers !== undefined) patch.blockedCarriers = blockedCarriers
  const markupPercent = num(body?.markupPercent)
  if (markupPercent !== undefined) patch.markupPercent = markupPercent
  const freeShippingThreshold = num(body?.freeShippingThreshold)
  if (freeShippingThreshold !== undefined) patch.freeShippingThreshold = freeShippingThreshold
  const fallbackBehavior = text(body?.fallbackBehavior)
  if (fallbackBehavior !== undefined) patch.fallbackBehavior = fallbackBehavior as StoreShippingPolicy['fallbackBehavior']
  const fallbackFee = num(body?.fallbackFee)
  if (fallbackFee !== undefined) patch.fallbackFee = fallbackFee
  const showEta = bool(body?.showEta)
  if (showEta !== undefined) patch.showEta = showEta
  const showSuccessRate = bool(body?.showSuccessRate)
  if (showSuccessRate !== undefined) patch.showSuccessRate = showSuccessRate
  const absorbFeeDifference = bool(body?.absorbFeeDifference)
  if (absorbFeeDifference !== undefined) patch.absorbFeeDifference = absorbFeeDifference

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Không có thay đổi để lưu' })
  }

  await saveStoreConfig(event, { shipping: patch })
  return { policy: await readStoreShippingPolicy(event) }
})
