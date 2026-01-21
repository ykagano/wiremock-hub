import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from './generated/prisma/client.js'
import { projectRoutes } from './routes/projects.js'
import { stubRoutes } from './routes/stubs.js'
import { wiremockInstanceRoutes } from './routes/wiremock-instances.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Initialize Prisma with better-sqlite3 driver adapter (Prisma v7)
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./data/wiremock-hub.db',
})
const prisma = new PrismaClient({ adapter })

const fastify = Fastify({
  logger: true
})

// Register plugins
await fastify.register(cors, {
  origin: true,
  credentials: true
})

// Decorate fastify with prisma
fastify.decorate('prisma', prisma)

// Register routes
await fastify.register(projectRoutes, { prefix: '/api/projects' })
await fastify.register(stubRoutes, { prefix: '/api/stubs' })
await fastify.register(wiremockInstanceRoutes, { prefix: '/api/wiremock-instances' })

// Health check
fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  // __dirname is /app/packages/backend/dist
  // Check for public directory first (Docker), then fall back to frontend/dist (local)
  const publicPath = path.join(__dirname, '../public')
  const frontendPath = path.join(__dirname, '../../frontend/dist')

  const staticPath = existsSync(publicPath) ? publicPath : frontendPath

  await fastify.register(fastifyStatic, {
    root: staticPath,
    prefix: '/',
  })

  // SPA fallback - serve index.html for all non-API routes
  fastify.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      reply.code(404).send({ error: 'Not Found' })
    } else {
      reply.sendFile('index.html')
    }
  })
}

// Graceful shutdown
const closeGracefully = async (signal: string) => {
  console.log(`Received signal to terminate: ${signal}`)
  await fastify.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', () => closeGracefully('SIGINT'))
process.on('SIGTERM', () => closeGracefully('SIGTERM'))

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10)
    const host = process.env.HOST || '0.0.0.0'

    await fastify.listen({ port, host })
    console.log(`Server is running on http://${host}:${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()

// Type augmentation for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}
