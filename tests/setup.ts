import '@testing-library/jest-dom/vitest'

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://localhost/layo_test'
