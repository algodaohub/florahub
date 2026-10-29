import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const url = (process.env.POCKETBASE_URL || 'http://127.0.0.1:8091').replace(/\/$/, '')
const adminEmail = process.env.PB_ADMIN_EMAIL || 'admin@florahub.local'
const adminPassword = process.env.PB_ADMIN_PASSWORD || 'FloraHubAdmin123'
const dbPath = join(root, 'prisma', 'dev.db')

if (!existsSync(dbPath)) {
  throw new Error(`Không tìm thấy SQLite database tại ${dbPath}`)
}

// ---------------------------------------------------------------------------
// PocketBase HTTP
// ---------------------------------------------------------------------------

let token = ''

async function jsonFetch(path, { method = 'GET', body } = {}) {
  const headers = {}
  if (token) headers.Authorization = token
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data?.message || `${response.status} ${response.statusText}`)
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

async function authenticate() {
  const data = await jsonFetch('/api/admins/auth-with-password', {
    method: 'POST',
    body: { identity: adminEmail, password: adminPassword }
  })
  token = data.token
}

async function listAll(collection, { filter = '', sort = '', expand = '', fields = '' } = {}) {
  const items = []
  let page = 1
  let totalPages = 1

  do {
    const params = new URLSearchParams({ page: String(page), perPage: '500' })
    if (filter) params.set('filter', filter)
    if (sort) params.set('sort', sort)
    if (expand) params.set('expand', expand)
    if (fields) params.set('fields', fields)
    const data = await jsonFetch(`/api/collections/${collection}/records?${params.toString()}`)
    items.push(...data.items)
    totalPages = data.totalPages
    page += 1
  } while (page <= totalPages)

  return items
}

const createRecord = (collection, body) =>
  jsonFetch(`/api/collections/${collection}/records`, { method: 'POST', body })

const patchRecord = (collection, id, body) =>
  jsonFetch(`/api/collections/${collection}/records/${id}`, { method: 'PATCH', body })

const quoteFilter = (value) => `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

async function findRecord(collection, field, value) {
  const params = new URLSearchParams({
    perPage: '1',
    filter: `${field} = ${quoteFilter(value)}`
  })
  const data = await jsonFetch(`/api/collections/${collection}/records?${params.toString()}`)
  return data.items[0] ?? null
}

// ---------------------------------------------------------------------------
// Collection definitions
// ---------------------------------------------------------------------------

const text = (name, { required = false, unique = false } = {}) => ({
  system: false,
  name,
  type: 'text',
  required,
  presentable: false,
  unique,
  options: { min: null, max: null, pattern: '' }
})

const number = (name, { required = false, decimal = false, min = null } = {}) => ({
  system: false,
  name,
  type: 'number',
  required,
  presentable: false,
  unique: false,
  options: { min, max: null, noDecimal: !decimal }
})

const bool = (name) => ({
  system: false,
  name,
  type: 'bool',
  required: false,
  presentable: false,
  unique: false,
  options: {}
})

const date = (name, { required = false } = {}) => ({
  system: false,
  name,
  type: 'date',
  required,
  presentable: false,
  unique: false,
  options: { min: '', max: '' }
})

const relation = (name, target, { required = false, unique = false, display = ['name'] } = {}) => ({
  system: false,
  name,
  type: 'relation',
  required,
  presentable: false,
  unique,
  target,
  options: {
    collectionId: '',
    cascadeDelete: true,
    minSelect: null,
    maxSelect: 1,
    displayFields: display
  }
})

const PUBLIC_READ = {
  listRule: '',
  viewRule: '',
  createRule: null,
  updateRule: null,
  deleteRule: null
}

const ADMIN_ONLY = {
  listRule: null,
  viewRule: null,
  createRule: null,
  updateRule: null,
  deleteRule: null
}

function collectionDefinitions(collections) {
  const users = '_pb_users_auth_'
  const id = (name) => name

  return [
    {
      name: 'sellers',
      indexes: ['CREATE UNIQUE INDEX `idx_sellers_slug` ON `sellers` (`slug`)'],
      schema: [
        text('name', { required: true }),
        text('slug', { required: true, unique: true }),
        text('region'),
        number('rating', { decimal: true }),
        text('logo_url'),
        date('created_at'),
        text('legacy_id')
      ],
      rules: PUBLIC_READ
    },
    {
      name: 'categories',
      indexes: ['CREATE UNIQUE INDEX `idx_categories_slug` ON `categories` (`slug`)'],
      schema: [
        text('name', { required: true }),
        text('slug', { required: true, unique: true }),
        text('image_url'),
        number('sort_order'),
        date('created_at'),
        text('legacy_id')
      ],
      rules: PUBLIC_READ
    },
    {
      name: 'regions',
      schema: [text('name', { required: true }), text('currency_code'), number('tax_rate'), text('legacy_id')],
      rules: ADMIN_ONLY
    },
    {
      name: 'promotions',
      indexes: ['CREATE UNIQUE INDEX `idx_promotions_code` ON `promotions` (`code`)'],
      schema: [
        text('code', { required: true, unique: true }),
        text('type'),
        number('value'),
        bool('active'),
        date('created_at'),
        text('legacy_id')
      ],
      rules: ADMIN_ONLY
    },
    {
      name: 'banners',
      schema: [
        text('image', { required: true }),
        text('title', { required: true }),
        text('subtitle'),
        text('href'),
        number('sort_order'),
        bool('active'),
        date('created_at'),
        text('legacy_id')
      ],
      rules: PUBLIC_READ
    },
    {
      name: 'posts',
      indexes: ['CREATE UNIQUE INDEX `idx_posts_slug` ON `posts` (`slug`)'],
      schema: [
        text('slug', { required: true, unique: true }),
        text('title', { required: true }),
        text('excerpt'),
        text('body'),
        text('cover_url'),
        date('published_at'),
        date('created_at'),
        text('legacy_id')
      ],
      rules: PUBLIC_READ
    },
    {
      name: 'products',
      indexes: ['CREATE UNIQUE INDEX `idx_products_handle` ON `products` (`handle`)'],
      schema: [
        text('handle', { required: true, unique: true }),
        text('title', { required: true }),
        text('subtitle'),
        text('description'),
        relation('category', id('categories'), { required: true, display: ['name'] }),
        relation('seller', id('sellers'), { required: true, display: ['name'] }),
        text('thumbnail'),
        text('unit'),
        text('color'),
        text('status'),
        text('sales_channel_id'),
        date('created_at'),
        date('updated_at'),
        text('legacy_id')
      ],
      rules: PUBLIC_READ
    },
    {
      name: 'product_images',
      schema: [
        relation('product', id('products'), { required: true, display: ['title'] }),
        text('url', { required: true }),
        text('alt'),
        number('sort_order'),
        text('legacy_id')
      ],
      rules: PUBLIC_READ
    },
    {
      name: 'product_specs',
      schema: [
        relation('product', id('products'), { required: true, display: ['title'] }),
        text('name', { required: true }),
        text('value'),
        number('sort_order'),
        text('legacy_id')
      ],
      rules: PUBLIC_READ
    },
    {
      name: 'product_options',
      schema: [
        relation('product', id('products'), { required: true, display: ['title'] }),
        text('title', { required: true }),
        number('sort_order'),
        text('legacy_id')
      ],
      rules: PUBLIC_READ
    },
    {
      name: 'product_option_values',
      schema: [
        relation('option', id('product_options'), { required: true, display: ['title'] }),
        text('value', { required: true }),
        number('sort_order'),
        text('legacy_id')
      ],
      rules: PUBLIC_READ
    },
    {
      name: 'variants',
      indexes: ['CREATE UNIQUE INDEX `idx_variants_sku` ON `variants` (`sku`)'],
      schema: [
        relation('product', id('products'), { required: true, display: ['title'] }),
        text('title', { required: true }),
        text('sku', { required: true, unique: true }),
        number('price', { required: true }),
        number('compare_at_price'),
        number('inventory_quantity'),
        bool('manage_inventory'),
        text('options_json'),
        date('created_at'),
        text('legacy_id')
      ],
      rules: PUBLIC_READ
    },
    {
      name: 'price_trends',
      schema: [
        relation('product', id('products'), { required: true, display: ['title'] }),
        date('date', { required: true }),
        number('price'),
        text('legacy_id')
      ],
      rules: PUBLIC_READ
    },
    {
      name: 'stock_trends',
      schema: [
        relation('product', id('products'), { required: true, display: ['title'] }),
        date('date', { required: true }),
        number('stock'),
        text('legacy_id')
      ],
      rules: PUBLIC_READ
    },
    {
      name: 'reviews',
      schema: [
        relation('product', id('products'), { required: true, display: ['title'] }),
        relation('user', users, { display: ['email'] }),
        text('author_name', { required: true }),
        number('rating'),
        text('body'),
        date('created_at'),
        text('legacy_id')
      ],
      rules: PUBLIC_READ
    },
    {
      name: 'flash_sales',
      schema: [
        text('title', { required: true }),
        date('starts_at', { required: true }),
        date('ends_at', { required: true }),
        bool('active'),
        text('legacy_id')
      ],
      rules: PUBLIC_READ
    },
    {
      name: 'flash_sale_items',
      schema: [
        relation('flash_sale', id('flash_sales'), { required: true, display: ['title'] }),
        relation('product', id('products'), { required: true, display: ['title'] }),
        relation('variant', id('variants'), { required: true, display: ['title'] }),
        number('sale_price'),
        number('quantity_limit'),
        text('legacy_id')
      ],
      rules: PUBLIC_READ
    },
    {
      name: 'affiliates',
      indexes: [
        'CREATE UNIQUE INDEX `idx_affiliates_code` ON `affiliates` (`code`)',
        'CREATE UNIQUE INDEX `idx_affiliates_user` ON `affiliates` (`user`)'
      ],
      schema: [
        relation('user', users, { required: true, unique: true, display: ['email'] }),
        text('code', { required: true, unique: true }),
        number('commission_rate'),
        text('status'),
        date('created_at'),
        text('legacy_id')
      ],
      rules: ADMIN_ONLY
    },
    {
      name: 'carts',
      schema: [
        relation('user', users, { display: ['email'] }),
        text('email'),
        relation('region', id('regions'), { display: ['name'] }),
        date('created_at'),
        date('updated_at'),
        date('completed_at'),
        text('legacy_id')
      ],
      rules: ADMIN_ONLY
    },
    {
      name: 'cart_items',
      schema: [
        relation('cart', id('carts'), { required: true, display: ['id'] }),
        relation('product', id('products'), { required: true, display: ['title'] }),
        relation('variant', id('variants'), { required: true, display: ['title'] }),
        number('quantity'),
        number('unit_price'),
        text('legacy_id')
      ],
      rules: ADMIN_ONLY
    },
    {
      name: 'orders',
      schema: [
        relation('user', users, { display: ['email'] }),
        relation('affiliate', id('affiliates'), { display: ['code'] }),
        text('email', { required: true }),
        text('status'),
        text('payment_method'),
        text('payment_status'),
        number('subtotal'),
        number('shipping_total'),
        number('discount_total'),
        number('tax_total'),
        number('total'),
        number('affiliate_commission'),
        text('shipping_name'),
        text('shipping_phone'),
        text('shipping_address'),
        text('note'),
        date('created_at'),
        text('legacy_id')
      ],
      rules: ADMIN_ONLY
    },
    {
      name: 'order_items',
      schema: [
        relation('order', id('orders'), { required: true, display: ['id'] }),
        relation('product', id('products'), { required: true, display: ['title'] }),
        relation('variant', id('variants'), { required: true, display: ['title'] }),
        text('title'),
        text('variant_title'),
        text('thumbnail'),
        number('unit_price'),
        number('quantity'),
        text('legacy_id')
      ],
      rules: ADMIN_ONLY
    },
    {
      name: 'affiliate_clicks',
      schema: [
        relation('affiliate', id('affiliates'), { required: true, display: ['code'] }),
        text('path'),
        text('referrer'),
        date('created_at'),
        text('legacy_id')
      ],
      rules: ADMIN_ONLY
    },
    {
      name: 'affiliate_commissions',
      schema: [
        relation('affiliate', id('affiliates'), { required: true, display: ['code'] }),
        relation('order', id('orders'), { required: true, unique: true, display: ['id'] }),
        number('amount'),
        number('rate'),
        text('status'),
        date('created_at'),
        text('legacy_id')
      ],
      rules: ADMIN_ONLY
    }
  ]
}

function materializeField(field, collections) {
  if (field.type !== 'relation') return field

  const targetId =
    field.target === '_pb_users_auth_'
      ? collections.get('users')?.id ?? '_pb_users_auth_'
      : collections.get(String(field.target))?.id

  if (!targetId) {
    throw new Error(`Collection đích "${field.target}" chưa tồn tại cho trường ${field.name}`)
  }

  const { target, ...rest } = field
  return { ...rest, options: { ...field.options, collectionId: targetId } }
}

async function ensureCollections() {
  const existing = await jsonFetch('/api/collections?perPage=200')
  const collections = new Map(existing.items.map((item) => [item.name, item]))
  const definitions = collectionDefinitions(collections)

  // Pass 1: create every collection with its scalar fields only.
  for (const definition of definitions) {
    const current = collections.get(definition.name)
    if (!current) {
      const created = await jsonFetch('/api/collections', {
        method: 'POST',
        body: {
          name: definition.name,
          type: 'base',
          schema: definition.schema.filter((field) => field.type !== 'relation'),
          indexes: definition.indexes ?? [],
          ...definition.rules
        }
      })
      collections.set(definition.name, created)
      console.log(`+ collection ${definition.name}`)
    }
  }

  // Pass 2: now that every collection id is known, add missing fields (relations included).
  for (const definition of definitions) {
    const current = collections.get(definition.name)
    const fields = [...(current.schema ?? [])]
    const missing = definition.schema
      .filter((field) => !fields.some((item) => item.name === field.name))
      .map((field) => materializeField(field, collections))

    const currentIndexes = current.indexes ?? []
    const missingIndexes = (definition.indexes ?? []).filter((index) => !currentIndexes.includes(index))

    if (missing.length > 0 || missingIndexes.length > 0) {
      const patch = {}
      if (missing.length > 0) patch.schema = [...fields, ...missing]
      if (missingIndexes.length > 0) patch.indexes = [...currentIndexes, ...missingIndexes]

      const updated = await jsonFetch(`/api/collections/${current.id}`, {
        method: 'PATCH',
        body: patch
      })
      collections.set(definition.name, updated)
      const changes = [
        missing.length ? `+${missing.map((field) => field.name).join(', ')}` : '',
        missingIndexes.length ? `+${missingIndexes.length} index` : ''
      ].filter(Boolean)
      console.log(`~ collection ${definition.name} (${changes.join(' ')})`)
    }
  }

  return collections
}

// ---------------------------------------------------------------------------
// SQLite source rows
// ---------------------------------------------------------------------------

function rows(table) {
  const output = execFileSync('sqlite3', ['-json', dbPath, `SELECT * FROM "${table}"`], {
    encoding: 'utf8'
  }).trim()
  return output ? JSON.parse(output) : []
}

const iso = (value) => (value === null || value === undefined ? undefined : new Date(Number(value)).toISOString())
const clean = (object) => {
  const result = {}
  for (const [key, value] of Object.entries(object)) {
    if (value !== undefined) result[key] = value
  }
  return result
}

const legacyCache = new Map()
const oldIdMaps = new Map()

function mapFor(collection) {
  if (!oldIdMaps.has(collection)) oldIdMaps.set(collection, new Map())
  return oldIdMaps.get(collection)
}

async function loadLegacy(collection) {
  const records = await listAll(collection, { fields: 'id,legacy_id' })
  const byLegacy = new Map()
  for (const record of records) {
    if (record.legacy_id) byLegacy.set(record.legacy_id, record)
  }
  legacyCache.set(collection, byLegacy)
  return byLegacy
}

async function importRow(collection, oldId, body, matchField) {
  const byLegacy = legacyCache.get(collection) ?? (await loadLegacy(collection))
  let existing = byLegacy.get(oldId)

  if (!existing && matchField && body[matchField] !== undefined && body[matchField] !== '') {
    const found = await findRecord(collection, matchField, body[matchField])
    if (found) {
      existing = await patchRecord(collection, found.id, { legacy_id: oldId })
    }
  }

  if (existing) {
    byLegacy.set(oldId, existing)
    mapFor(collection).set(oldId, existing.id)
    return existing
  }

  const created = await createRecord(collection, clean({ ...body, legacy_id: oldId }))
  byLegacy.set(oldId, created)
  mapFor(collection).set(oldId, created.id)
  return created
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

async function main() {
  await authenticate()
  const collections = await ensureCollections()

  if (!collections.has('sellers')) throw new Error('Không tạo được collection sellers')

  // Users: map the Prisma ids to PocketBase auth records by email.
  const userMap = new Map()
  const pbUsers = await listAll('users')
  const usersByEmail = new Map(pbUsers.map((user) => [String(user.email).toLowerCase(), user]))

  for (const row of rows('User')) {
    const email = String(row.email).toLowerCase()
    let user = usersByEmail.get(email)
    if (!user) {
      const password = randomBytes(12).toString('base64url')
      const parts = String(row.name || '').trim().split(/\s+/)
      user = await createRecord('users', {
        email,
        password,
        passwordConfirm: password,
        first_name: parts.slice(1).join(' ') || parts[0] || '',
        last_name: parts.length > 1 ? parts[0] : '',
        verified: true
      })
      usersByEmail.set(email, user)
      console.log(`+ user ${email} (temporary password: ${password})`)
    }
    userMap.set(row.id, user.id)
    mapFor('users').set(row.id, user.id)
  }

  // Sellers / categories / regions
  for (const row of rows('Seller')) {
    await importRow(
      'sellers',
      row.id,
      clean({
        name: row.name,
        slug: row.slug,
        region: row.region ?? undefined,
        rating: Number(row.rating ?? 0),
        logo_url: row.logoUrl ?? undefined,
        created_at: iso(row.createdAt)
      }),
      'slug'
    )
  }

  for (const row of rows('Category')) {
    await importRow(
      'categories',
      row.id,
      clean({
        name: row.name,
        slug: row.slug,
        image_url: row.imageUrl ?? undefined,
        sort_order: Number(row.sortOrder ?? 0)
      }),
      'slug'
    )
  }

  for (const row of rows('Region')) {
    await importRow(
      'regions',
      row.id,
      clean({ name: row.name, currency_code: row.currencyCode, tax_rate: Number(row.taxRate ?? 0) }),
      'name'
    )
  }

  // Catalog
  for (const row of rows('Product')) {
    await importRow(
      'products',
      row.id,
      clean({
        handle: row.handle,
        title: row.title,
        subtitle: row.subtitle ?? undefined,
        description: row.description,
        category: mapFor('categories').get(row.categoryId),
        seller: mapFor('sellers').get(row.sellerId),
        thumbnail: row.thumbnail,
        unit: row.unit,
        color: row.color ?? undefined,
        status: row.status,
        sales_channel_id: row.salesChannelId ?? undefined,
        created_at: iso(row.createdAt),
        updated_at: iso(row.updatedAt)
      }),
      'handle'
    )
  }

  for (const row of rows('ProductImage')) {
    await importRow(
      'product_images',
      row.id,
      clean({
        product: mapFor('products').get(row.productId),
        url: row.url,
        alt: row.alt ?? undefined,
        sort_order: Number(row.sortOrder ?? 0)
      })
    )
  }

  for (const row of rows('ProductSpec')) {
    await importRow(
      'product_specs',
      row.id,
      clean({
        product: mapFor('products').get(row.productId),
        name: row.name,
        value: row.value,
        sort_order: Number(row.sortOrder ?? 0)
      })
    )
  }

  for (const row of rows('ProductOption')) {
    await importRow(
      'product_options',
      row.id,
      clean({
        product: mapFor('products').get(row.productId),
        title: row.title,
        sort_order: Number(row.sortOrder ?? 0)
      })
    )
  }

  for (const row of rows('ProductOptionValue')) {
    await importRow(
      'product_option_values',
      row.id,
      clean({
        option: mapFor('product_options').get(row.optionId),
        value: row.value,
        sort_order: Number(row.sortOrder ?? 0)
      })
    )
  }

  for (const row of rows('Variant')) {
    await importRow(
      'variants',
      row.id,
      clean({
        product: mapFor('products').get(row.productId),
        title: row.title,
        sku: row.sku,
        price: Number(row.price ?? 0),
        compare_at_price: row.compareAtPrice === null ? undefined : Number(row.compareAtPrice),
        inventory_quantity: Number(row.inventoryQuantity ?? 0),
        manage_inventory: Boolean(row.manageInventory),
        options_json: row.optionsJson || '[]',
        created_at: iso(row.createdAt)
      }),
      'sku'
    )
  }

  for (const row of rows('PriceTrend')) {
    await importRow(
      'price_trends',
      row.id,
      clean({
        product: mapFor('products').get(row.productId),
        date: iso(row.date),
        price: Number(row.price ?? 0)
      })
    )
  }

  for (const row of rows('StockTrend')) {
    await importRow(
      'stock_trends',
      row.id,
      clean({
        product: mapFor('products').get(row.productId),
        date: iso(row.date),
        stock: Number(row.stock ?? 0)
      })
    )
  }

  for (const row of rows('Review')) {
    await importRow(
      'reviews',
      row.id,
      clean({
        product: mapFor('products').get(row.productId),
        user: row.userId ? userMap.get(row.userId) : undefined,
        author_name: row.authorName,
        rating: Number(row.rating ?? 0),
        body: row.body,
        created_at: iso(row.createdAt)
      })
    )
  }

  // Content and commerce
  for (const row of rows('Promotion')) {
    await importRow(
      'promotions',
      row.id,
      clean({
        code: row.code,
        type: row.type,
        value: Number(row.value ?? 0),
        active: Boolean(row.active),
        created_at: iso(row.createdAt)
      }),
      'code'
    )
  }

  for (const row of rows('Banner')) {
    await importRow(
      'banners',
      row.id,
      clean({
        image: row.image,
        title: row.title,
        subtitle: row.subtitle ?? '',
        href: row.href ?? '/categories',
        sort_order: Number(row.sortOrder ?? 0),
        active: Boolean(row.active),
        created_at: iso(row.createdAt)
      }),
      'title'
    )
  }

  for (const row of rows('Post')) {
    await importRow(
      'posts',
      row.id,
      clean({
        slug: row.slug,
        title: row.title,
        excerpt: row.excerpt,
        body: row.body,
        cover_url: row.coverUrl,
        published_at: iso(row.publishedAt),
        created_at: iso(row.createdAt)
      }),
      'slug'
    )
  }

  for (const row of rows('FlashSale')) {
    await importRow(
      'flash_sales',
      row.id,
      clean({
        title: row.title,
        starts_at: iso(row.startsAt),
        ends_at: iso(row.endsAt),
        active: Boolean(row.active)
      })
    )
  }

  for (const row of rows('FlashSaleItem')) {
    await importRow(
      'flash_sale_items',
      row.id,
      clean({
        flash_sale: mapFor('flash_sales').get(row.flashSaleId),
        product: mapFor('products').get(row.productId),
        variant: mapFor('variants').get(row.variantId),
        sale_price: Number(row.salePrice ?? 0),
        quantity_limit: Number(row.quantityLimit ?? 0)
      })
    )
  }

  for (const row of rows('Affiliate')) {
    await importRow(
      'affiliates',
      row.id,
      clean({
        user: userMap.get(row.userId),
        code: row.code,
        commission_rate: Number(row.commissionRate ?? 0),
        status: row.status,
        created_at: iso(row.createdAt)
      }),
      'code'
    )
  }

  for (const row of rows('Cart')) {
    await importRow(
      'carts',
      row.id,
      clean({
        user: row.userId ? userMap.get(row.userId) : undefined,
        email: row.email ?? undefined,
        region: row.regionId ? mapFor('regions').get(row.regionId) : undefined,
        created_at: iso(row.createdAt),
        updated_at: iso(row.updatedAt),
        completed_at: iso(row.completedAt)
      })
    )
  }

  for (const row of rows('CartItem')) {
    await importRow(
      'cart_items',
      row.id,
      clean({
        cart: mapFor('carts').get(row.cartId),
        product: mapFor('products').get(row.productId),
        variant: mapFor('variants').get(row.variantId),
        quantity: Number(row.quantity ?? 0),
        unit_price: Number(row.unitPrice ?? 0)
      })
    )
  }

  for (const row of rows('Order')) {
    const user = row.userId ? userMap.get(row.userId) : usersByEmail.get(String(row.email).toLowerCase())?.id
    await importRow(
      'orders',
      row.id,
      clean({
        user,
        affiliate: row.affiliateId ? mapFor('affiliates').get(row.affiliateId) : undefined,
        email: row.email,
        status: row.status,
        subtotal: Number(row.subtotal ?? 0),
        shipping_total: Number(row.shippingTotal ?? 0),
        discount_total: Number(row.discountTotal ?? 0),
        tax_total: Number(row.taxTotal ?? 0),
        total: Number(row.total ?? 0),
        affiliate_commission: Number(row.affiliateCommission ?? 0),
        shipping_name: row.shippingName,
        shipping_phone: row.shippingPhone,
        shipping_address: row.shippingAddress,
        note: row.note ?? undefined,
        created_at: iso(row.createdAt)
      })
    )
  }

  for (const row of rows('OrderItem')) {
    await importRow(
      'order_items',
      row.id,
      clean({
        order: mapFor('orders').get(row.orderId),
        product: mapFor('products').get(row.productId),
        variant: mapFor('variants').get(row.variantId),
        title: row.title,
        variant_title: row.variantTitle,
        thumbnail: row.thumbnail,
        unit_price: Number(row.unitPrice ?? 0),
        quantity: Number(row.quantity ?? 0)
      })
    )
  }

  for (const row of rows('AffiliateClick')) {
    await importRow(
      'affiliate_clicks',
      row.id,
      clean({
        affiliate: mapFor('affiliates').get(row.affiliateId),
        path: row.path,
        referrer: row.referrer ?? undefined,
        created_at: iso(row.createdAt)
      })
    )
  }

  for (const row of rows('AffiliateCommission')) {
    await importRow(
      'affiliate_commissions',
      row.id,
      clean({
        affiliate: mapFor('affiliates').get(row.affiliateId),
        order: mapFor('orders').get(row.orderId),
        amount: Number(row.amount ?? 0),
        rate: Number(row.rate ?? 0),
        status: row.status,
        created_at: iso(row.createdAt)
      })
    )
  }

  // Addresses already existed in PocketBase. Only add rows that are not there yet.
  const pbAddresses = await listAll('addresses')
  for (const row of rows('Address')) {
    const userId = userMap.get(row.userId)
    if (!userId) continue
    const duplicate = pbAddresses.some(
      (address) =>
        address.user === userId &&
        address.line1 === row.line1 &&
        address.phone === row.phone &&
        address.recipient === row.recipient
    )
    if (duplicate) continue
    const created = await createRecord('addresses', {
      user: userId,
      label: row.label ?? 'Địa chỉ',
      recipient: row.recipient,
      phone: row.phone,
      line1: row.line1,
      ward: row.ward ?? '',
      district: row.district ?? '',
      city: row.city,
      is_default: Boolean(row.isDefault)
    })
    pbAddresses.push(created)
  }

  const summary = [
    ['sellers', 'Seller'],
    ['categories', 'Category'],
    ['products', 'Product'],
    ['variants', 'Variant'],
    ['reviews', 'Review'],
    ['carts', 'Cart'],
    ['orders', 'Order'],
    ['affiliates', 'Affiliate'],
    ['promotions', 'Promotion'],
    ['posts', 'Post']
  ]

  console.log('\nĐã chuyển dữ liệu sang PocketBase:')
  for (const [collection, table] of summary) {
    console.log(`  ${collection.padEnd(14)} ${rows(table).length}`)
  }
  console.log(`\nAdmin: ${url}/_/  (${adminEmail})`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
