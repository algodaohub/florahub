import type { H3Event } from 'h3'

export const PB_URL = (process.env.POCKETBASE_URL || 'http://127.0.0.1:8091').replace(/\/$/, '')
export const PB_TOKEN_COOKIE = 'pb_token'
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7
const ADMIN_TOKEN_TTL = 50 * 60 * 1000

export type PbUserRecord = {
  id: string
  email: string
  name?: string
  avatar?: string
  first_name?: string
  last_name?: string
  phone?: string
  verified?: boolean
  created?: string
  updated?: string
}

export type PbAuthResponse = {
  token: string
  record: PbUserRecord
}

export type AuthUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  displayName: string
  phone: string
  avatar: string | null
  verified: boolean
}

export type PbList<T> = {
  page: number
  perPage: number
  totalItems: number
  totalPages: number
  items: T[]
}

export type PbRecord = Record<string, any> & { id: string }

export type PbQueryOptions = {
  filter?: string
  sort?: string
  expand?: string
  fields?: string
  perPage?: number
  page?: number
}

type PbRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  token?: string | null
  body?: unknown
}

/** PB trả message chung cho lỗi validate; chi tiết từng field nằm ở `data`. */
function pbErrorMessage(data: any) {
  const base = String(data?.message ?? '').trim() || 'PocketBase trả về lỗi'
  const details = data?.data
  if (!details || typeof details !== 'object') return base
  const reasons = Object.entries(details)
    .map(([field, info]: [string, any]) => {
      const reason = String(info?.message ?? '').trim()
      return reason ? `${field}: ${reason}` : ''
    })
    .filter(Boolean)
  return reasons.length ? `${base} (${reasons.join('; ')})` : base
}

export async function pbFetch<T>(path: string, options: PbRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (options.token) headers.Authorization = options.token

  let response: Response
  try {
    response = await fetch(`${PB_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Không kết nối được PocketBase' })
  }

  const text = await response.text()
  let data: any = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text }
    }
  }

  if (!response.ok) {
    throw createError({
      statusCode: response.status < 500 ? response.status : 502,
      statusMessage: pbErrorMessage(data)
    })
  }

  return data as T
}

let adminTokenCache: { token: string; expiresAt: number } | null = null
let adminTokenPromise: Promise<string> | null = null

async function adminLogin() {
  const identity = process.env.PB_ADMIN_EMAIL || 'admin@florahub.local'
  const password = process.env.PB_ADMIN_PASSWORD || 'FloraHubAdmin123'
  const data = await pbFetch<{ token: string }>('/api/admins/auth-with-password', {
    method: 'POST',
    body: { identity, password }
  })
  adminTokenCache = { token: data.token, expiresAt: Date.now() + ADMIN_TOKEN_TTL }
  return data.token
}

export async function getPbAdminToken() {
  if (adminTokenCache && adminTokenCache.expiresAt > Date.now()) return adminTokenCache.token
  if (!adminTokenPromise) {
    adminTokenPromise = adminLogin().finally(() => {
      adminTokenPromise = null
    })
  }
  return adminTokenPromise
}

export async function pbAdminFetch<T>(path: string, options: PbRequestOptions = {}): Promise<T> {
  const token = await getPbAdminToken()
  try {
    return await pbFetch<T>(path, { ...options, token })
  } catch (error: any) {
    if (error?.statusCode === 401 || error?.statusCode === 403) {
      adminTokenCache = null
      const fresh = await getPbAdminToken()
      return pbFetch<T>(path, { ...options, token: fresh })
    }
    throw error
  }
}

export function pbQuote(value: unknown) {
  return `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export async function pbListPage<T = PbRecord>(collection: string, options: PbQueryOptions = {}): Promise<PbList<T>> {
  const params = new URLSearchParams({
    page: String(options.page ?? 1),
    perPage: String(options.perPage ?? 200)
  })
  if (options.filter) params.set('filter', options.filter)
  if (options.sort) params.set('sort', options.sort)
  if (options.expand) params.set('expand', options.expand)
  if (options.fields) params.set('fields', options.fields)
  return pbAdminFetch<PbList<T>>(`/api/collections/${collection}/records?${params.toString()}`)
}

export async function pbListAll<T = PbRecord>(collection: string, options: PbQueryOptions = {}): Promise<T[]> {
  const perPage = Math.min(500, Math.max(1, options.perPage ?? 200))
  const first = await pbListPage<T>(collection, { ...options, page: 1, perPage })
  if (first.totalPages <= 1) return first.items

  const items = [...first.items]
  for (let page = 2; page <= first.totalPages; page += 1) {
    const next = await pbListPage<T>(collection, { ...options, page, perPage })
    items.push(...next.items)
  }
  return items
}

export async function pbFirst<T = PbRecord>(collection: string, options: PbQueryOptions = {}): Promise<T | null> {
  const result = await pbListPage<T>(collection, { ...options, perPage: 1 })
  return result.items[0] ?? null
}

export async function pbGetRecord<T = PbRecord>(collection: string, id: string): Promise<T | null> {
  try {
    return await pbAdminFetch<T>(`/api/collections/${collection}/records/${encodeURIComponent(id)}`)
  } catch (error: any) {
    if (error?.statusCode === 404) return null
    throw error
  }
}

export async function pbCreate<T = PbRecord>(collection: string, body: Record<string, unknown>): Promise<T> {
  return pbAdminFetch<T>(`/api/collections/${collection}/records`, { method: 'POST', body })
}

export async function pbUpdate<T = PbRecord>(
  collection: string,
  id: string,
  body: Record<string, unknown>
): Promise<T> {
  return pbAdminFetch<T>(`/api/collections/${collection}/records/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body
  })
}

export async function pbDelete(collection: string, id: string): Promise<void> {
  await pbAdminFetch<void>(`/api/collections/${collection}/records/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })
}

export async function pbDeleteWhere(collection: string, filter: string): Promise<number> {
  const records = await pbListAll<PbRecord>(collection, { filter, fields: 'id' })
  for (const record of records) {
    await pbDelete(collection, record.id)
  }
  return records.length
}

export function toAuthUser(record: PbUserRecord): AuthUser {
  const firstName = String(record.first_name ?? '').trim()
  const lastName = String(record.last_name ?? '').trim()
  const displayName = [lastName, firstName].filter(Boolean).join(' ') || record.name || record.email.split('@')[0] || 'Khách hàng'
  return {
    id: record.id,
    email: record.email,
    firstName,
    lastName,
    displayName,
    phone: String(record.phone ?? ''),
    avatar: record.avatar || null,
    verified: Boolean(record.verified)
  }
}

export async function authWithPassword(identity: string, password: string) {
  return pbFetch<PbAuthResponse>('/api/collections/users/auth-with-password', {
    method: 'POST',
    body: { identity, password }
  })
}

export async function createUser(input: {
  email: string
  password: string
  firstName: string
  lastName: string
  phone: string
}) {
  return pbFetch<PbUserRecord>('/api/collections/users/records', {
    method: 'POST',
    body: {
      email: input.email,
      password: input.password,
      passwordConfirm: input.password,
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone
    }
  })
}

export async function refreshAuth(token: string) {
  return pbFetch<PbAuthResponse>('/api/collections/users/auth-refresh', {
    method: 'POST',
    token
  })
}

export async function updateUserRecord(id: string, token: string, body: Record<string, unknown>) {
  return pbFetch<PbUserRecord>(`/api/collections/users/records/${id}`, {
    method: 'PATCH',
    token,
    body
  })
}

export async function requestPasswordReset(email: string) {
  return pbFetch<void>('/api/collections/users/request-password-reset', {
    method: 'POST',
    body: { email }
  })
}

export async function listRecords<T>(collection: string, token: string, filter?: string, perPage = 100) {
  const params = new URLSearchParams({ perPage: String(perPage), sort: '-created' })
  if (filter) params.set('filter', filter)
  return pbFetch<PbList<T>>(`/api/collections/${collection}/records?${params.toString()}`, { token })
}

export async function getRecord<T>(collection: string, id: string, token: string) {
  return pbFetch<T>(`/api/collections/${collection}/records/${id}`, { token })
}

export async function createRecord<T>(collection: string, token: string, body: Record<string, unknown>) {
  return pbFetch<T>(`/api/collections/${collection}/records`, { method: 'POST', token, body })
}

export async function updateRecord<T>(collection: string, id: string, token: string, body: Record<string, unknown>) {
  return pbFetch<T>(`/api/collections/${collection}/records/${id}`, { method: 'PATCH', token, body })
}

export async function deleteRecord(collection: string, id: string, token: string) {
  return pbFetch<void>(`/api/collections/${collection}/records/${id}`, { method: 'DELETE', token })
}

export function setAuthCookie(event: H3Event, token: string) {
  setCookie(event, PB_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_MAX_AGE
  })
}

export function clearAuthCookie(event: H3Event) {
  deleteCookie(event, PB_TOKEN_COOKIE, { path: '/' })
}

export async function requirePbUser(event: H3Event) {
  const token = getCookie(event, PB_TOKEN_COOKIE)
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Bạn cần đăng nhập' })

  try {
    const auth = await refreshAuth(token)
    if (auth.token !== token) setAuthCookie(event, auth.token)
    return { token: auth.token, record: auth.record, user: toAuthUser(auth.record) }
  } catch {
    clearAuthCookie(event)
    throw createError({ statusCode: 401, statusMessage: 'Phiên đăng nhập đã hết hạn' })
  }
}

export async function optionalPbUser(event: H3Event) {
  const token = getCookie(event, PB_TOKEN_COOKIE)
  if (!token) return null
  try {
    const auth = await refreshAuth(token)
    return { token: auth.token, record: auth.record, user: toAuthUser(auth.record) }
  } catch {
    return null
  }
}
