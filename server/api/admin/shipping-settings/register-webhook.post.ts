import { requireAdminMutation } from '~~/server/utils/admin'
import { deleteWebhook, registerWebhook } from '~~/server/utils/goship'
import { readStoreShippingPolicy } from '~~/server/utils/shipping-policy'
import {
  publicShippingSettings,
  readShippingSettings,
  saveShippingConnectionState
} from '~~/server/utils/shipping-settings'

function webhookUrlFromRequest(event: any) {
  const proto = String(getRequestHeader(event, 'x-forwarded-proto') ?? '').split(',')[0]?.trim() || 'https'
  const host = String(getRequestHeader(event, 'x-forwarded-host') ?? getRequestHeader(event, 'host') ?? '')
    .split(',')[0]
    ?.trim()
  if (!host) {
    throw createError({ statusCode: 400, statusMessage: 'Không xác định được domain để đăng ký webhook' })
  }
  return `${proto}://${host}/api/webhooks/goship`
}

function normalizeUrl(value: string) {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'URL webhook không hợp lệ' })
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw createError({ statusCode: 400, statusMessage: 'URL webhook phải dùng HTTPS' })
  }
  return parsed.toString()
}

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { adminOnly: true })

  const body = await readBody<{ url?: string }>(event).catch(() => null)
  const target = body?.url ? normalizeUrl(String(body.url).trim()) : webhookUrlFromRequest(event)
  const settings = await readShippingSettings()

  if (settings.webhookId && settings.webhookUrl === target) {
    return {
      webhook: { id: settings.webhookId, url: settings.webhookUrl },
      settings: publicShippingSettings(settings, await readStoreShippingPolicy(event))
    }
  }

  const webhook = await registerWebhook(target)
  if (settings.webhookId && settings.webhookId !== webhook.id) {
    await deleteWebhook(settings.webhookId).catch((error) => {
      console.warn('[goship] không xoá được webhook cũ', error instanceof Error ? error.message : error)
    })
  }

  const url = webhook.url || target
  await saveShippingConnectionState({ webhookId: webhook.id, webhookUrl: url })
  const fresh = await readShippingSettings()

  return {
    webhook: { id: webhook.id, url },
    settings: publicShippingSettings(fresh, await readStoreShippingPolicy(event))
  }
})
