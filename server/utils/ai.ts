import { pbCreate, pbFirst, pbUpdate, type PbRecord } from './pocketbase'

export type AiProvider = '9router' | 'openai' | 'anthropic' | 'custom'

export type AiSettings = {
  provider: AiProvider
  baseUrl: string
  model: string
  models: string[]
  apiKey: string
}

export const AI_COLLECTION = 'ai_settings'
export const NINE_ROUTER_BASE_URL = 'http://127.0.0.1:20128/v1'
export const NINE_ROUTER_DEFAULT_MODEL = 'oc/deepseek-v4.1-flash-free'

const PROVIDERS: AiProvider[] = ['9router', 'openai', 'anthropic', 'custom']

const PRESETS: Record<AiProvider, { baseUrl: string; model: string; models: string[] }> = {
  '9router': {
    baseUrl: NINE_ROUTER_BASE_URL,
    model: NINE_ROUTER_DEFAULT_MODEL,
    models: [
      NINE_ROUTER_DEFAULT_MODEL,
      'oc/glm-5.3-flash-free',
      'nvidia/z-ai/glm-5.2'
    ]
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1']
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-haiku-4-5',
    models: ['claude-haiku-4-5', 'claude-sonnet-4-5']
  },
  custom: {
    baseUrl: '',
    model: '',
    models: []
  }
}

type AiRecord = PbRecord & {
  provider?: string
  base_url?: string
  api_key?: string
  model?: string
  models?: unknown
}

function env(name: string, fallback = '') {
  return String(process.env[name] ?? fallback).trim()
}

function inferProvider(): AiProvider {
  const raw = env('AI_PROVIDER').toLowerCase()
  if (PROVIDERS.includes(raw as AiProvider)) return raw as AiProvider
  if (env('ANTHROPIC_AUTH_TOKEN')) return 'anthropic'
  if (env('AI_BASE_URL').includes(':20128')) return '9router'
  if (env('AI_API_KEY')) return 'openai'
  return '9router'
}

function splitModels(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
    : String(value ?? '')
        .split(/[\n,]/)
        .map((item) => item.trim())

  return [...new Set(list.map((item) => String(item).trim()).filter(Boolean))].slice(0, 40)
}

export function presetForProvider(provider: AiProvider) {
  return PRESETS[provider]
}

/** Cấu hình từ biến môi trường. 9router local là mặc định khi chưa có bản ghi trong DB. */
export function envAiSettings(): AiSettings {
  const provider = inferProvider()
  const preset = PRESETS[provider]
  const model = env('AI_MODEL', preset.model)
  const configured = splitModels(env('AI_MODELS'))
  const baseUrl =
    provider === '9router'
      ? env('AI_BASE_URL', NINE_ROUTER_BASE_URL)
      : provider === 'anthropic'
        ? env('AI_BASE_URL', env('ANTHROPIC_BASE_URL', preset.baseUrl))
        : env('AI_BASE_URL', preset.baseUrl)

  return {
    provider,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    model,
    models: configured.length ? configured : [...new Set([model, ...preset.models].filter(Boolean))],
    apiKey: provider === 'anthropic' ? env('AI_API_KEY', env('ANTHROPIC_AUTH_TOKEN')) : env('AI_API_KEY', env('9ROUTER_API_KEY'))
  }
}

export type AiSettingsInput = Omit<Partial<AiSettings>, 'models'> & { models?: unknown }

export function normalizeAiSettings(input: AiSettingsInput): AiSettings {
  const provider = PROVIDERS.includes(input.provider as AiProvider) ? (input.provider as AiProvider) : '9router'
  const preset = PRESETS[provider]
  const baseUrl = String(input.baseUrl ?? preset.baseUrl).trim().replace(/\/+$/, '')
  const model = String(input.model ?? preset.model).trim().slice(0, 160)
  const models = splitModels(input.models)

  return {
    provider,
    baseUrl: /^https?:\/\/.+/i.test(baseUrl) ? baseUrl : preset.baseUrl,
    model: model || preset.model,
    models: models.length ? models : [...new Set([model || preset.model, ...preset.models].filter(Boolean))].slice(0, 40),
    apiKey: String(input.apiKey ?? '').trim().slice(0, 500)
  }
}

function recordToSettings(record: AiRecord, fallback: AiSettings): AiSettings {
  const provider = (record.provider as AiProvider) || fallback.provider
  return normalizeAiSettings({
    provider,
    baseUrl: record.base_url || fallback.baseUrl,
    // Key trong DB thắng; chưa có thì dùng .env nếu cùng provider.
    apiKey: record.api_key || (provider === fallback.provider ? fallback.apiKey : ''),
    model: record.model || fallback.model,
    models: record.models ?? fallback.models
  })
}

/** Đọc cấu hình AI đang dùng. Chưa migrate collection → dùng biến môi trường. */
export async function readAiSettings(): Promise<AiSettings> {
  const fallback = envAiSettings()
  try {
    const record = await pbFirst<AiRecord>(AI_COLLECTION, { sort: '-updated' })
    return record ? recordToSettings(record, fallback) : fallback
  } catch {
    return fallback
  }
}

/** Lưu cấu hình. `apiKey` rỗng nghĩa là giữ key cũ. */
export async function saveAiSettings(input: AiSettingsInput): Promise<AiSettings> {
  const fallback = envAiSettings()
  const record = await pbFirst<AiRecord>(AI_COLLECTION, { sort: '-updated' })
  const current = record ? recordToSettings(record, fallback) : fallback
  const provider = input.provider ?? current.provider
  const enteredKey = String(input.apiKey ?? '').trim()
  // Chỉ kế thừa key từ .env khi cùng provider và DB chưa có key.
  const envKey = !record?.api_key && provider === fallback.provider ? fallback.apiKey : ''

  const next = normalizeAiSettings({
    ...input,
    provider,
    baseUrl: input.baseUrl ?? current.baseUrl,
    model: input.model ?? current.model,
    models: input.models ?? current.models,
    apiKey: enteredKey || String(record?.api_key ?? '') || envKey
  })

  if (!/^https?:\/\/.+/i.test(next.baseUrl)) {
    throw createError({ statusCode: 400, statusMessage: 'Nhập Base URL hợp lệ (bắt đầu bằng http:// hoặc https://)' })
  }
  if (!next.model) throw createError({ statusCode: 400, statusMessage: 'Nhập model mặc định' })

  const body = {
    provider: next.provider,
    base_url: next.baseUrl,
    api_key: next.apiKey,
    model: next.model,
    models: next.models
  }

  if (record) await pbUpdate(AI_COLLECTION, record.id, body)
  else await pbCreate(AI_COLLECTION, body)

  return next
}

export function publicAiSettings(settings: AiSettings, availableModels?: string[]) {
  return {
    provider: settings.provider,
    baseUrl: settings.baseUrl,
    model: settings.model,
    models: settings.models,
    availableModels: availableModels ?? settings.models,
    hasKey: Boolean(settings.apiKey),
    keyHint: settings.apiKey ? `••••${settings.apiKey.slice(-4)}` : '',
    defaultProvider: '9router' as const
  }
}

/** Hỏi endpoint /models để lấy danh sách model khách có thể chọn. */
export async function listAiModels(settings: AiSettings): Promise<string[]> {
  if (!settings.apiKey || settings.provider === 'anthropic') return settings.models

  try {
    const response = await fetch(`${settings.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${settings.apiKey}` },
      signal: AbortSignal.timeout(5000)
    })
    if (!response.ok) return settings.models
    const data = (await response.json()) as { data?: Array<{ id?: unknown }> }
    const ids = (data.data ?? [])
      .map((item) => String(item?.id ?? '').trim())
      .filter((id) => id && !/(embed|asr|tts|whisper|rerank|moderation)/i.test(id))

    return ids.length ? [...new Set([...settings.models, ...ids])].slice(0, 200) : settings.models
  } catch {
    return settings.models
  }
}

async function parseResponse(response: Response) {
  const text = await response.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { message: text }
  }
  if (!response.ok) {
    throw createError({
      statusCode: response.status < 500 ? response.status : 502,
      statusMessage: data?.error?.message || data?.message || 'AI trả về lỗi'
    })
  }
  return data
}

export async function callAi(settings: AiSettings, prompt: string, model?: string): Promise<string> {
  if (!settings.apiKey) {
    throw createError({
      statusCode: 503,
      statusMessage:
        settings.provider === '9router'
          ? 'Chưa có API key 9router. Cài `npm install -g 9router`, lấy key trong dashboard localhost:20128 rồi lưu tại /admin/ai.'
          : 'Chưa có API key AI. Lưu cấu hình tại /admin/ai.'
    })
  }

  const selected = String(model ?? '').trim().slice(0, 160) || settings.model
  const anthropic = settings.provider === 'anthropic'

  if (anthropic) {
    const base = settings.baseUrl.replace(/\/v1$/i, '').replace(/\/+$/, '')
    const data = await parseResponse(
      await fetch(`${base}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': settings.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: selected,
          max_tokens: 6000,
          temperature: 0.4,
          messages: [{ role: 'user', content: prompt }]
        })
      })
    )
    const block = Array.isArray(data.content) ? data.content.find((item: any) => item.type === 'text') : null
    return String(block?.text ?? '')
  }

  const data = await parseResponse(
    await fetch(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: selected,
        temperature: 0.4,
        max_tokens: 6000,
        messages: [{ role: 'user', content: prompt }]
      })
    })
  )
  return String(data?.choices?.[0]?.message?.content ?? '')
}
