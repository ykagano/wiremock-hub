import { defineConfig } from 'prisma/config'
import { getDatabaseUrl } from './src/utils/database.js'

// From packages/backend/ -> 2 levels up to project root
const databaseUrl = getDatabaseUrl(__dirname, 2)

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
  migrate: {
    adapter: async () => {
      const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3')
      return new PrismaBetterSqlite3({
        url: databaseUrl,
      })
    },
  },
})
