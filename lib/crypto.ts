import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import * as Sentry from '@sentry/nextjs'

const ALGORITHM = 'aes-256-gcm'

export function encrypt(plaintext: string): string {
  const keyHex = process.env.WEARABLE_TOKEN_KEY
  if (!keyHex) {
    Sentry.captureException(new Error('WEARABLE_TOKEN_KEY is not set; storing token in plaintext'))
    return plaintext
  }
  const key = Buffer.from(keyHex, 'hex')
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(ciphertext: string): string {
  const keyHex = process.env.WEARABLE_TOKEN_KEY
  if (!keyHex) {
    return ciphertext
  }
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    return ciphertext
  }
  const [ivHex, tagHex, encryptedHex] = parts
  const key = Buffer.from(keyHex, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
