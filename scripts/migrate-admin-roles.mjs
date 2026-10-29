#!/usr/bin/env node
/**
 * Thêm trường `role` vào collection `users` và cấp quyền quản trị.
 *
 * - role: customer | staff | admin (mặc định customer)
 * - Chỉ tài khoản staff/admin mới đăng nhập được /admin.
 *
 * Cách dùng:
 *   node scripts/migrate-admin-roles.mjs                      # thêm field + cấp admin cho demo@florahub.vn
 *   node scripts/migrate-admin-roles.mjs --admin a@x.vn,b@x.vn
 *   node scripts/migrate-admin-roles.mjs --staff c@x.vn
 *   node scripts/migrate-admin-roles.mjs --check              # chỉ xem, không ghi
 */
const url = (process.env.POCKETBASE_URL || 'http://127.0.0.1:8091').replace(/\/$/, '')
const adminEmail = process.env.PB_ADMIN_EMAIL || 'admin@florahub.local'
const adminPassword = process.env.PB_ADMIN_PASSWORD || 'FloraHubAdmin123'
const checkOnly = process.argv.includes('--check')

function flag(name) {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return []
  return String(process.argv[index + 1] || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

const adminEmails = flag('admin')
const staffEmails = flag('staff')
const fallbackAdmins = (process.env.ADMIN_EMAILS || 'demo@florahub.vn')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)

const targetAdmins = adminEmails.length ? adminEmails : fallbackAdmins

const FIELD = {
  system: false,
  id: 'usersrole0000001',
  name: 'role',
  type: 'select',
  required: false,
  presentable: false,
  unique: false,
  options: { maxSelect: 1, values: ['customer', 'staff', 'admin'] }
}

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
  const text = await response.text()
  const data = text ? JSON.parse(text) : {}
  if (!response.ok) {
    throw new Error(data?.message || `${response.status} ${response.statusText}`)
  }
  return data
}

const auth = await jsonFetch('/api/admins/auth-with-password', {
  method: 'POST',
  body: { identity: adminEmail, password: adminPassword }
})
token = auth.token

const collection = await jsonFetch('/api/collections/users')
const hasRole = (collection.schema ?? []).some((field) => field.name === 'role')

console.log(`users.role: ${hasRole ? 'đã có' : 'chưa có'}`)

if (!hasRole && checkOnly) {
  console.log('… chạy lại không có --check để thêm field')
  process.exit(0)
}

if (!hasRole) {
  await jsonFetch('/api/collections/users', {
    method: 'PATCH',
    body: { schema: [...(collection.schema ?? []), FIELD] }
  })
  console.log('✔ đã thêm field users.role')
}

const records = (await jsonFetch('/api/collections/users/records?perPage=500&fields=id,email,role')).items
let changed = 0

for (const record of records) {
  const email = String(record.email ?? '').toLowerCase()
  let next = String(record.role ?? '').trim()

  if (targetAdmins.includes(email)) next = 'admin'
  else if (staffEmails.includes(email)) next = 'staff'
  else if (!next) next = 'customer'

  if (next === record.role) continue
  if (checkOnly) {
    console.log(`… ${email}: ${record.role || '∅'} → ${next}`)
    continue
  }

  await jsonFetch(`/api/collections/users/records/${record.id}`, {
    method: 'PATCH',
    body: { role: next }
  })
  changed += 1
  console.log(`✔ ${email}: ${record.role || '∅'} → ${next}`)
}

console.log(
  checkOnly
    ? '… chỉ kiểm tra, không ghi'
    : `Xong. ${changed} tài khoản được cập nhật. Admin: ${targetAdmins.join(', ') || '—'}`
)
