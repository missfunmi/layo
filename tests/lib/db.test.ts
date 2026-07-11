import { describe, test, expect } from 'vitest'
import { withExplicitSslMode } from '@/lib/db'

describe('withExplicitSslMode', () => {
  test('rewrites sslmode=require to sslmode=verify-full', () => {
    expect(withExplicitSslMode('postgresql://u:p@host/db?sslmode=require')).toBe(
      'postgresql://u:p@host/db?sslmode=verify-full'
    )
  })

  test('rewrites sslmode=prefer to sslmode=verify-full', () => {
    expect(withExplicitSslMode('postgresql://u:p@host/db?sslmode=prefer')).toBe(
      'postgresql://u:p@host/db?sslmode=verify-full'
    )
  })

  test('rewrites sslmode=verify-ca to sslmode=verify-full', () => {
    expect(withExplicitSslMode('postgresql://u:p@host/db?sslmode=verify-ca')).toBe(
      'postgresql://u:p@host/db?sslmode=verify-full'
    )
  })

  test('leaves sslmode=verify-full unchanged', () => {
    const url = 'postgresql://u:p@host/db?sslmode=verify-full'
    expect(withExplicitSslMode(url)).toBe(url)
  })

  test('leaves sslmode=disable unchanged', () => {
    const url = 'postgresql://u:p@host/db?sslmode=disable'
    expect(withExplicitSslMode(url)).toBe(url)
  })

  test('leaves a URL with no sslmode unchanged', () => {
    const url = 'postgresql://localhost/layo_dev'
    expect(withExplicitSslMode(url)).toBe(url)
  })

  test('leaves the string unchanged if uselibpqcompat is already set explicitly', () => {
    const url = 'postgresql://u:p@host/db?sslmode=require&uselibpqcompat=true'
    expect(withExplicitSslMode(url)).toBe(url)
  })

  test('rewrites sslmode when it is not the last query param, without touching others', () => {
    expect(withExplicitSslMode('postgresql://u:p@host/db?other=1&sslmode=require&extra=2')).toBe(
      'postgresql://u:p@host/db?other=1&sslmode=verify-full&extra=2'
    )
  })

  test('passes through undefined unchanged', () => {
    expect(withExplicitSslMode(undefined)).toBeUndefined()
  })
})
