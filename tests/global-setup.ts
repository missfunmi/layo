import { execSync } from 'child_process'

export default function setup() {
  // Prisma migrate deploy requires an explicit username in the connection string;
  // postgresql://localhost/layo_test fails (P1010) for the migration engine even
  // though it works for PrismaPg at runtime. Fall back to USER-qualified URL.
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ??
    `postgresql://${process.env.USER ?? 'postgres'}@localhost/layo_test`
  execSync('npx prisma migrate deploy', { stdio: 'pipe' })
}
