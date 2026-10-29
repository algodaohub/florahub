import { requireAdminMutation } from '~~/server/utils/admin'
import { readStoreShippingPolicy } from '~~/server/utils/shipping-policy'
import {
  publicShippingSettings,
  saveShippingSettings,
  type ShippingSettingsInput
} from '~~/server/utils/shipping-settings'

function optionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function optionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function optionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { adminOnly: true })

  const body = await readBody<Record<string, unknown>>(event)
  const rawPickup = body?.pickup && typeof body.pickup === 'object' ? (body.pickup as Record<string, unknown>) : {}
  const rawParcel = body?.parcel && typeof body.parcel === 'object' ? (body.parcel as Record<string, unknown>) : {}

  const input: ShippingSettingsInput = {
    enabled: optionalBoolean(body?.enabled),
    accessToken: optionalString(body?.accessToken),
    clientId: optionalString(body?.clientId),
    clientSecret: optionalString(body?.clientSecret),
    apiBaseUrl: optionalString(body?.apiBaseUrl),
    codEnabled: optionalBoolean(body?.codEnabled),
    autoAdvance: optionalBoolean(body?.autoAdvance),
    quoteTtlSeconds: optionalNumber(body?.quoteTtlSeconds),
    rateCacheSeconds: optionalNumber(body?.rateCacheSeconds),
    quoteRateLimitPerMinute: optionalNumber(body?.quoteRateLimitPerMinute),
    addressFallback: optionalString(body?.addressFallback),
    pickup: {
      name: optionalString(rawPickup.name),
      phone: optionalString(rawPickup.phone),
      street: optionalString(rawPickup.street),
      ward: optionalString(rawPickup.ward),
      district: optionalString(rawPickup.district),
      city: optionalString(rawPickup.city),
      wardCode: optionalString(rawPickup.wardCode),
      districtCode: optionalString(rawPickup.districtCode),
      cityCode: optionalString(rawPickup.cityCode)
    },
    parcel: {
      defaultWeight: optionalNumber(rawParcel.defaultWeight),
      defaultItemWeight: optionalNumber(rawParcel.defaultItemWeight),
      packagingWeight: optionalNumber(rawParcel.packagingWeight),
      length: optionalNumber(rawParcel.length),
      width: optionalNumber(rawParcel.width),
      height: optionalNumber(rawParcel.height)
    }
  }

  const saved = await saveShippingSettings(input)
  return publicShippingSettings(saved, await readStoreShippingPolicy(event))
})
