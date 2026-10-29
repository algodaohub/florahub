export default defineEventHandler((event) => {
  setHeader(event, 'access-control-allow-origin', '*')
  setHeader(event, 'access-control-allow-methods', 'POST, OPTIONS')
  setHeader(event, 'access-control-allow-headers', 'content-type, mcp-protocol-version, mcp-session-id')
  setResponseStatus(event, 204)
  return null
})
