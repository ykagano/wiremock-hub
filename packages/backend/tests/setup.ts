import { beforeAll, afterAll, beforeEach } from 'vitest'
import { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { rm, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Test database path
const TEST_DB_DIR = path.join(__dirname, '../data-test')
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'test.db')
const TEST_DB_URL = `file:${TEST_DB_PATH}`

let app: FastifyInstance

export async function getTestApp(): Promise<FastifyInstance> {
  if (!app) {
    throw new Error('Test app not initialized. Make sure setup is complete.')
  }
  return app
}

beforeAll(async () => {
  // Clean up test database directory
  if (existsSync(TEST_DB_DIR)) {
    await rm(TEST_DB_DIR, { recursive: true })
  }
  await mkdir(TEST_DB_DIR, { recursive: true })

  // Build app with test database
  app = await buildApp({
    logger: false,
    databaseUrl: TEST_DB_URL,
  })

  // Run migrations using Prisma db push (creates tables from schema)
  const { execSync } = await import('child_process')
  execSync(`npx prisma db push --url "${TEST_DB_URL}"`, {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      DATABASE_URL: TEST_DB_URL,
    },
    stdio: 'pipe',
  })

  await app.ready()
})

afterAll(async () => {
  if (app) {
    await app.close()
  }

  // Clean up test database
  if (existsSync(TEST_DB_DIR)) {
    await rm(TEST_DB_DIR, { recursive: true })
  }
})
