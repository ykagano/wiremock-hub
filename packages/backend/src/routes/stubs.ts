import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import axios from 'axios'
import type { Mapping } from '@wiremock-hub/shared'

const createStubSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().optional(),
  description: z.string().optional(),
  mapping: z.object({}).passthrough() // WireMock mapping JSON
})

const updateStubSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  mapping: z.object({}).passthrough().optional(),
  isActive: z.boolean().optional()
})

const syncStubSchema = z.object({
  instanceId: z.string().uuid()
})

export async function stubRoutes(fastify: FastifyInstance) {
  // Helper to check project exists
  async function checkProjectExists(projectId: string) {
    const project = await fastify.prisma.project.findUnique({
      where: { id: projectId }
    })
    return project
  }

  // List stubs for a project
  fastify.get('/', async (request: FastifyRequest<{ Querystring: { projectId: string } }>, reply: FastifyReply) => {
    const { projectId } = request.query

    if (!projectId) {
      return reply.status(400).send({
        success: false,
        error: 'projectId is required'
      })
    }

    const project = await checkProjectExists(projectId)
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: 'Project not found'
      })
    }

    const stubs = await fastify.prisma.stub.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' }
    })

    return reply.send({
      success: true,
      data: stubs
    })
  })

  // Get single stub
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params

    const stub = await fastify.prisma.stub.findUnique({
      where: { id },
      include: { project: true }
    })

    if (!stub) {
      return reply.status(404).send({
        success: false,
        error: 'Stub not found'
      })
    }

    return reply.send({
      success: true,
      data: stub
    })
  })

  // Create stub
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createStubSchema.parse(request.body)

      const project = await checkProjectExists(body.projectId)
      if (!project) {
        return reply.status(404).send({
          success: false,
          error: 'Project not found'
        })
      }

      const stub = await fastify.prisma.stub.create({
        data: {
          name: body.name,
          description: body.description,
          mapping: body.mapping,
          projectId: body.projectId
        }
      })

      return reply.status(201).send({
        success: true,
        data: stub
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors
        })
      }
      throw error
    }
  })

  // Update stub
  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params
      const body = updateStubSchema.parse(request.body)

      const existing = await fastify.prisma.stub.findUnique({
        where: { id }
      })

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: 'Stub not found'
        })
      }

      const updateData: any = { ...body }
      if (body.mapping) {
        updateData.version = existing.version + 1
      }

      const stub = await fastify.prisma.stub.update({
        where: { id },
        data: updateData
      })

      return reply.send({
        success: true,
        data: stub
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors
        })
      }
      throw error
    }
  })

  // Delete stub
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params

    const existing = await fastify.prisma.stub.findUnique({
      where: { id }
    })

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: 'Stub not found'
      })
    }

    await fastify.prisma.stub.delete({
      where: { id }
    })

    return reply.send({
      success: true,
      message: 'Stub deleted successfully'
    })
  })

  // Sync stub to WireMock instance
  fastify.post('/:id/sync', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params
      const body = syncStubSchema.parse(request.body)

      const stub = await fastify.prisma.stub.findUnique({
        where: { id },
        include: { project: true }
      })

      if (!stub) {
        return reply.status(404).send({
          success: false,
          error: 'Stub not found'
        })
      }

      const instance = await fastify.prisma.wiremockInstance.findFirst({
        where: {
          id: body.instanceId,
          projectId: stub.projectId
        }
      })

      if (!instance) {
        return reply.status(404).send({
          success: false,
          error: 'WireMock instance not found'
        })
      }

      // Send mapping to WireMock
      const mapping = stub.mapping as unknown as Mapping
      const wiremockUrl = `${instance.url}/__admin/mappings`

      try {
        if (mapping.id || mapping.uuid) {
          // Update existing mapping
          const mappingId = mapping.id || mapping.uuid
          await axios.put(`${wiremockUrl}/${mappingId}`, mapping)
        } else {
          // Create new mapping
          const response = await axios.post(wiremockUrl, mapping)

          // Update stub with WireMock-assigned ID
          if (response.data?.id) {
            await fastify.prisma.stub.update({
              where: { id },
              data: {
                mapping: { ...mapping, id: response.data.id } as object
              }
            })
          }
        }

        return reply.send({
          success: true,
          message: 'Stub synced to WireMock successfully'
        })
      } catch (wiremockError: any) {
        return reply.status(502).send({
          success: false,
          error: 'Failed to sync with WireMock',
          details: wiremockError.message
        })
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors
        })
      }
      throw error
    }
  })

  // Export stubs for a project
  fastify.get('/export', async (request: FastifyRequest<{ Querystring: { projectId: string } }>, reply: FastifyReply) => {
    const { projectId } = request.query

    if (!projectId) {
      return reply.status(400).send({
        success: false,
        error: 'projectId is required'
      })
    }

    const project = await checkProjectExists(projectId)
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: 'Project not found'
      })
    }

    // Use createdAt asc to preserve the original creation order for import
    const stubs = await fastify.prisma.stub.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' }
    })

    const exportData = {
      version: '1.0',
      projectName: project.name,
      exportedAt: new Date().toISOString(),
      stubs: stubs.map((stub: typeof stubs[number]) => ({
        name: stub.name,
        description: stub.description,
        isActive: stub.isActive,
        mapping: stub.mapping
      }))
    }

    return reply.send(exportData)
  })

  // Import stubs for a project
  fastify.post('/import', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const importSchema = z.object({
        projectId: z.string().uuid(),
        data: z.object({
          version: z.string().optional(),
          projectName: z.string().optional(),
          exportedAt: z.string().optional(),
          stubs: z.array(z.object({
            name: z.string().nullable().optional(),
            description: z.string().nullable().optional(),
            isActive: z.boolean().optional().default(true),
            mapping: z.object({
              request: z.object({}).passthrough(),
              response: z.object({}).passthrough()
            }).passthrough()
          }))
        })
      })

      const body = importSchema.parse(request.body)

      const project = await checkProjectExists(body.projectId)
      if (!project) {
        return reply.status(404).send({
          success: false,
          error: 'Project not found'
        })
      }

      const results = {
        imported: 0,
        skipped: 0,
        errors: [] as string[]
      }

      for (const stubData of body.data.stubs) {
        try {
          await fastify.prisma.stub.create({
            data: {
              projectId: body.projectId,
              name: stubData.name,
              description: stubData.description,
              isActive: stubData.isActive,
              mapping: stubData.mapping as object
            }
          })
          results.imported++
        } catch (e: any) {
          results.skipped++
          results.errors.push(e.message || 'Unknown error')
        }
      }

      return reply.send({
        success: true,
        data: results
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors
        })
      }
      throw error
    }
  })

  // Sync all stubs to a WireMock instance
  fastify.post('/sync-all', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = z.object({
        projectId: z.string().uuid(),
        instanceId: z.string().uuid(),
        resetBeforeSync: z.boolean().optional().default(true)
      }).parse(request.body)

      const project = await checkProjectExists(body.projectId)
      if (!project) {
        return reply.status(404).send({
          success: false,
          error: 'Project not found'
        })
      }

      const instance = await fastify.prisma.wiremockInstance.findFirst({
        where: {
          id: body.instanceId,
          projectId: body.projectId
        }
      })

      if (!instance) {
        return reply.status(404).send({
          success: false,
          error: 'WireMock instance not found'
        })
      }

      // Reset WireMock mappings before sync if requested
      if (body.resetBeforeSync) {
        try {
          await axios.post(`${instance.url}/__admin/mappings/reset`, {}, {
            timeout: 10000
          })
        } catch (error: any) {
          return reply.status(502).send({
            success: false,
            error: 'Failed to reset WireMock mappings',
            details: error.message
          })
        }
      }

      const stubs = await fastify.prisma.stub.findMany({
        where: {
          projectId: body.projectId,
          isActive: true
        }
      })

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[]
      }

      // Sync stubs in chunks for better performance
      const chunkSize = 10
      for (let i = 0; i < stubs.length; i += chunkSize) {
        const chunk = stubs.slice(i, i + chunkSize)
        const chunkResults = await Promise.allSettled(
          chunk.map(async (stub: typeof stubs[number]) => {
            const mapping = stub.mapping as unknown as Mapping
            const wiremockUrl = `${instance.url}/__admin/mappings`
            // Always POST since we reset mappings
            await axios.post(wiremockUrl, mapping)
            return stub.id
          })
        )

        for (const result of chunkResults) {
          if (result.status === 'fulfilled') {
            results.success++
          } else {
            results.failed++
            results.errors.push(result.reason?.message || 'Unknown error')
          }
        }
      }

      return reply.send({
        success: true,
        data: results
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors
        })
      }
      throw error
    }
  })
}
