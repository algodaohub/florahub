import { PB_URL, getPbAdminToken } from '~~/server/utils/pocketbase'

const ALLOWED = new Set(['product_images', 'categories'])
const PASSTHROUGH = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'last-modified',
  'etag'
]

/**
 * Proxy media PocketBase qua cùng origin.
 * - Ảnh/video sản phẩm không cần mở PocketBase ra Internet.
 * - Hỗ trợ Range để tua video.
 */
export default defineEventHandler(async (event) => {
  const raw = String(getRouterParam(event, 'path') ?? '')
  const segments = raw
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))

  if (segments.length < 3) {
    throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy tệp' })
  }

  const [collection, recordId, ...rest] = segments
  if (!ALLOWED.has(collection)) {
    throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy tệp' })
  }

  const file = rest.join('/')
  const upstream = new URL(`${PB_URL}/api/files/${collection}/${encodeURIComponent(recordId)}/${encodeURIComponent(file)}`)

  const thumb = String(getQuery(event).thumb ?? '').trim()
  if (thumb) upstream.searchParams.set('thumb', thumb)

  const headers: Record<string, string> = { Authorization: await getPbAdminToken() }
  const range = getRequestHeader(event, 'range')
  if (range) headers.Range = range

  let response: Response
  try {
    response = await fetch(upstream, { headers })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Không tải được tệp từ PocketBase' })
  }

  if (!response.ok && response.status !== 206) {
    throw createError({
      statusCode: response.status === 404 ? 404 : 502,
      statusMessage: 'Không tìm thấy tệp'
    })
  }

  const outHeaders = new Headers()
  for (const name of PASSTHROUGH) {
    const value = response.headers.get(name)
    if (value) outHeaders.set(name, value)
  }
  outHeaders.set('cache-control', 'public, max-age=31536000, immutable')
  outHeaders.set('x-content-type-options', 'nosniff')

  return new Response(response.body, { status: response.status, headers: outHeaders })
})
