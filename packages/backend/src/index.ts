import 'dotenv/config'
import fastifyStatic from '@fastify/static'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { buildApp } from './app.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const fastify = await buildApp({ logger: true })

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
