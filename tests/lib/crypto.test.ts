import { vi, describe, test, expect, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

const VALID_KEY = '0'.repeat(64) // 32-byte key as hex
const OTHER_KEY = 'f'.repeat(64) // different 32-byte key as hex

describe('lib/crypto', () => {
  beforeEach(() => {
    process.env.WEARABLE_TOKEN_KEY = VALID_KEY
    vi.resetModules()
  })

  test('encrypt then decrypt round-trips correctly', async () => {
    const { encrypt, decrypt } = await import('@/lib/crypto')
    const plaintext = 'super secret token'
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  test('ciphertext format has exactly three colon-separated segments', async () => {
    const { encrypt } = await import('@/lib/crypto')
    const ciphertext = encrypt('test')
    expect(ciphertext.split(':')).toHaveLength(3)
  })

  test('decrypt throws on tampered ciphertext', async () => {
    const { encrypt, decrypt } = await import('@/lib/crypto')
    const ciphertext = encrypt('hello')
    const [iv, tag, encrypted] = ciphertext.split(':')
    const tampered = `${iv}:${tag}:${encrypted.slice(0, -2)}ff`
    expect(() => decrypt(tampered)).toThrow()
  })

  test('decrypt throws on wrong key', async () => {
    const { encrypt } = await import('@/lib/crypto')
    const ciphertext = encrypt('hello')

    vi.resetModules()
    process.env.WEARABLE_TOKEN_KEY = OTHER_KEY
    const { decrypt } = await import('@/lib/crypto')
    expect(() => decrypt(ciphertext)).toThrow()
  })

  test('decrypt returns ciphertext unchanged when key is set but ciphertext is not in encrypted format', async () => {
    const { decrypt } = await import('@/lib/crypto')
    const plaintext = 'legacy-plaintext-token'
    expect(decrypt(plaintext)).toBe(plaintext)
  })

  test('missing WEARABLE_TOKEN_KEY causes encrypt to log a Sentry error and return plaintext unchanged', async () => {
    delete process.env.WEARABLE_TOKEN_KEY
    vi.resetModules()
    const sentry = await import('@sentry/nextjs')
    const { encrypt } = await import('@/lib/crypto')
    const plaintext = 'unencrypted-token'
    const result = encrypt(plaintext)
    expect(result).toBe(plaintext)
    expect(sentry.captureException).toHaveBeenCalled()
  })
})
