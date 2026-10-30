import type { JwtPayload } from './types'

const JWT_EXPIRY_SECONDS = 8 * 60 * 60 // 8 hours

// ─── Encode ──────────────────────────────────────────────────────────────────

function importHmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]
  )
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await importHmacKey(secret, 'sign')
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// crypto.subtle.verify compares in constant time (no timing leak on the signature)
async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const padded = signature.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - padded.length % 4) % 4))
  const sigBytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
  const key = await importHmacKey(secret, 'verify')
  return crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload))
}

function base64urlEncode(obj: object): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlDecode(str: string): unknown {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - padded.length % 4) % 4
  return JSON.parse(atob(padded + '='.repeat(padLen)))
}

export async function signJwt(
  payload: Omit<JwtPayload, 'exp'>,
  secret: string
): Promise<string> {
  const header = base64urlEncode({ alg: 'HS256', typ: 'JWT' })
  const body = base64urlEncode({ ...payload, exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY_SECONDS })
  const signature = await hmacSign(`${header}.${body}`, secret)
  return `${header}.${body}.${signature}`
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, body, signature] = parts as [string, string, string]
    const valid = await hmacVerify(`${header}.${body}`, signature, secret)
    if (!valid) return null
    const payload = base64urlDecode(body) as JwtPayload
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}
