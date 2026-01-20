import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  migrate: {
    adapter: async () => {
      const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3')
      return new PrismaBetterSqlite3({
        url: process.env.DATABASE_URL || `file:${path.resolve('./data/wiremock-hub.db')}`,
      })
    },
  },
})
