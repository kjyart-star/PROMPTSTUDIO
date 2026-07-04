import { lookup } from 'node:dns/promises'
import net from 'node:net'

/**
 * SSRF protection helper for server-side proxy fetches.
 *
 * Rejects non-http(s) URLs and any URL whose hostname resolves to a
 * private, loopback, link-local, or otherwise internal IP range. This
 * blocks cloud metadata endpoints (169.254.169.254), localhost, and
 * internal service addresses while still allowing arbitrary public CDNs.
 */

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true
  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true // loopback
  if (a === 0) return true // "this" network
  if (a === 169 && b === 254) return true // link-local (incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && b === 0 && parts[2] === 0) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true // multicast / reserved
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '::') return true // loopback / unspecified
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true // unique local
  if (lower.startsWith('fe80')) return true // link-local
  // IPv4-mapped IPv6 (::ffff:a.b.c.d)
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIPv4(mapped[1])
  return false
}

function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip)
  if (net.isIPv6(ip)) return isPrivateIPv6(ip)
  return true // unknown format -> treat as unsafe
}

/**
 * Validates that a user-supplied URL is safe to fetch server-side.
 * Returns the parsed URL on success, or throws on any unsafe input.
 */
export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are allowed')
  }

  const hostname = parsed.hostname

  // If the host is already a literal IP, validate it directly.
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) throw new Error('Access to internal addresses is not allowed')
    return parsed
  }

  // Resolve DNS and reject if any resolved address is private/internal.
  let addresses: { address: string }[]
  try {
    addresses = await lookup(hostname, { all: true })
  } catch {
    throw new Error('Unable to resolve host')
  }

  if (addresses.length === 0) throw new Error('Unable to resolve host')
  for (const { address } of addresses) {
    if (isPrivateIP(address)) throw new Error('Access to internal addresses is not allowed')
  }

  return parsed
}
