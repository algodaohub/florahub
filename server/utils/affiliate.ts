import { pbFirst, pbQuote, type PbRecord } from './pocketbase'

export const AFFILIATE_COOKIE = 'affiliate_ref'
export const DEFAULT_COMMISSION_RATE = 5

export function generateAffiliateCode(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
    .toUpperCase()
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${base || 'SHARE'}${suffix}`.slice(0, 12)
}

export async function findAffiliateByCode(code: string) {
  if (!code) return null
  return pbFirst<PbRecord>('affiliates', { filter: `code = ${pbQuote(code.toUpperCase())}` })
}

export async function findAffiliateByUser(userId: string) {
  if (!userId) return null
  return pbFirst<PbRecord>('affiliates', { filter: `user = ${pbQuote(userId)}` })
}
