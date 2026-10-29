#!/usr/bin/env node
/**
 * CLI cho agent/terminal: tìm sản phẩm FloraHub, xem chi tiết, hoặc gọi trợ lý.
 *
 *   node scripts/florahub-cli.mjs search "hoa hồng" --limit 5
 *   node scripts/florahub-cli.mjs product hoa-hong-phan-pastel
 *   node scripts/florahub-cli.mjs chat "hoa sinh nhật dưới 500k" --shop
 *
 * Base URL: FLORAHUB_URL (mặc định http://localhost:4321).
 */

const base = (process.env.FLORAHUB_URL || 'http://localhost:4321').replace(/\/$/, '')

const args = process.argv.slice(2)
const command = args[0] || 'help'
const flags = new Set()
const words = []
let limit = 10

for (let index = 1; index < args.length; index += 1) {
  const item = args[index]
  if (item === '--limit') {
    limit = Math.min(Math.max(Number(args[++index]) || 10, 1), 24)
    continue
  }
  if (item.startsWith('--')) {
    flags.add(item)
    continue
  }
  words.push(item)
}

const json = flags.has('--json')

const money = new Intl.NumberFormat('vi-VN')

async function api(path, init) {
  const response = await fetch(`${base}${path}`, init)
  const text = await response.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { message: text }
  }
  if (!response.ok) {
    throw new Error(data?.statusMessage || data?.message || `HTTP ${response.status}`)
  }
  return data
}

function printProducts(products) {
  if (!products.length) {
    console.log('Không tìm thấy sản phẩm phù hợp.')
    return
  }
  for (const product of products) {
    const seller = typeof product.seller === 'string' ? product.seller : product.seller?.name || ''
    const url = product.url || `${base}/product/${encodeURIComponent(product.handle)}`
    console.log(`- ${product.title} — ${money.format(product.price)}₫ · ${seller} · ${product.inStock ? 'còn hàng' : 'hết hàng'}`)
    console.log(`  ${url}`)
  }
}

async function main() {
  if (command === 'help' || flags.has('--help')) {
    console.log(`FloraHub CLI — ${base}

  search <từ khoá> [--limit N] [--json]   Tìm sản phẩm
  product <handle> [--json]               Chi tiết sản phẩm
  chat <câu hỏi> [--json]                 Gọi trợ lý tư vấn
`)
    return
  }

  if (command === 'search') {
    const query = words.join(' ').trim()
    if (!query) throw new Error('Nhập từ khoá: search "hoa hồng"')
    const data = await api(`/api/agent/catalog?q=${encodeURIComponent(query)}&limit=${limit}`)
    if (json) return console.log(JSON.stringify(data, null, 2))
    console.log(`${data.store.name} · ${data.total} sản phẩm cho "${query}"`)
    printProducts(data.products)
    return
  }

  if (command === 'product') {
    const handle = words[0]
    if (!handle) throw new Error('Nhập handle sản phẩm')
    const data = await api('/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'get_product', arguments: { handle } }
      })
    })
    const text = data?.result?.content?.[0]?.text ?? ''
    if (json) return console.log(JSON.stringify(data.result?.structuredContent ?? { raw: text }, null, 2))
    console.log(text)
    return
  }

  if (command === 'chat') {
    const message = words.join(' ').trim()
    if (!message) throw new Error('Nhập câu hỏi')
    const data = await api('/api/assistant/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message })
    })
    if (json) return console.log(JSON.stringify(data, null, 2))
    console.log(data.reply)
    if (data.products?.length) {
      console.log('\nSản phẩm phù hợp:')
      printProducts(data.products)
    }
    return
  }

  throw new Error(`Lệnh không hợp lệ: ${command}`)
}

main().catch((error) => {
  console.error(`Lỗi: ${error.message}`)
  process.exit(1)
})
