import { PB_URL, getPbAdminToken, pbAdminFetch, type PbRecord } from './pocketbase'

type RealtimeEvent = { action?: string; record?: PbRecord }

/**
 * Mở kênh realtime PocketBase cho một record và gọi `onChange` mỗi khi record thay đổi.
 * Trả về hàm đóng kết nối (gọi khi client SSE ngắt).
 */
export async function watchRecord(
  collection: string,
  id: string,
  onChange: (record: PbRecord) => void,
  signal?: AbortSignal
): Promise<() => void> {
  const token = await getPbAdminToken()
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', abort, { once: true })

  const detach = () => signal?.removeEventListener('abort', abort)

  let response: Response
  try {
    response = await fetch(`${PB_URL}/api/realtime`, {
      headers: { Authorization: token, Accept: 'text/event-stream' },
      signal: controller.signal
    })
  } catch {
    detach()
    throw createError({ statusCode: 502, statusMessage: 'Không kết nối được realtime PocketBase' })
  }

  if (!response.ok || !response.body) {
    controller.abort()
    detach()
    throw createError({ statusCode: 502, statusMessage: 'PocketBase từ chối kênh realtime' })
  }

  const topic = `${collection}/${id}`
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let clientId = ''

  const loop = (async () => {
    try {
      while (!controller.signal.aborted) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let split = buffer.indexOf('\n\n')
        while (split >= 0) {
          const block = buffer.slice(0, split)
          buffer = buffer.slice(split + 2)
          split = buffer.indexOf('\n\n')

          const lines = block.split('\n')
          const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim() ?? ''
          const data = lines
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('')
          if (!data) continue

          if (event === 'PB_CONNECT') {
            if (clientId) continue
            try {
              clientId = String(JSON.parse(data)?.clientId ?? '')
            } catch {
              clientId = ''
            }
            if (clientId) {
              await pbAdminFetch('/api/realtime', {
                method: 'POST',
                body: { clientId, subscriptions: [topic] }
              })
            }
            continue
          }

          if (event !== topic) continue
          try {
            const parsed = JSON.parse(data) as RealtimeEvent
            if (parsed?.record) onChange(parsed.record)
          } catch {
            // bỏ qua event không hợp lệ
          }
        }
      }
    } catch {
      // bị huỷ hoặc mất kết nối — phía SSE sẽ tự reconnect
    } finally {
      detach()
      try {
        reader.releaseLock()
      } catch {}
      controller.abort()
    }
  })()

  return () => {
    controller.abort()
    void loop
  }
}
