import { FastifyInstance } from 'fastify'

export async function healthRoutes(fastify: FastifyInstance) {
  // Health check
  fastify.get('/', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })
}
