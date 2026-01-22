import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
})

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional()
})

const bulkUpdateInstancesSchema = z.object({
  instances: z.array(
    z.object({
      name: z.string().min(1),
      url: z.string().url()
    })
  )
})

export async function projectRoutes(fastify: FastifyInstance) {
  // List projects
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const projects = await fastify.prisma.project.findMany({
      include: {
        wiremockInstances: true,
        _count: {
          select: { stubs: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })

    return reply.send({
      success: true,
      data: projects.map((p: typeof projects[number]) => ({
        ...p,
        stubCount: p._count.stubs
      }))
    })
  })

  // Get single project
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params

    const project = await fastify.prisma.project.findUnique({
      where: { id },
      include: {
        wiremockInstances: true,
        stubs: {
          orderBy: { updatedAt: 'desc' }
        }
      }
    })

    if (!project) {
      return reply.status(404).send({
        success: false,
        error: 'Project not found'
      })
    }

    return reply.send({
      success: true,
      data: project
    })
  })

  // Create project
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createProjectSchema.parse(request.body)

      const project = await fastify.prisma.project.create({
        data: body,
        include: {
          wiremockInstances: true
        }
      })

      return reply.status(201).send({
        success: true,
        data: project
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

  // Update project
  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params
      const body = updateProjectSchema.parse(request.body)

      const existing = await fastify.prisma.project.findUnique({
        where: { id }
      })

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: 'Project not found'
        })
      }

      const project = await fastify.prisma.project.update({
        where: { id },
        data: body,
        include: {
          wiremockInstances: true
        }
      })

      return reply.send({
        success: true,
        data: project
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

  // Delete project
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params

    const existing = await fastify.prisma.project.findUnique({
      where: { id }
    })

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: 'Project not found'
      })
    }

    await fastify.prisma.project.delete({
      where: { id }
    })

    return reply.send({
      success: true,
      message: 'Project deleted successfully'
    })
  })

  // Bulk update instances for a project
  fastify.post('/:id/instances/bulk-update', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params
      const body = bulkUpdateInstancesSchema.parse(request.body)

      // Check if project exists
      const existing = await fastify.prisma.project.findUnique({
        where: { id }
      })

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: 'Project not found'
        })
      }

      // Use transaction to delete all existing instances and create new ones
      const result = await fastify.prisma.$transaction(async (tx) => {
        // Count existing instances before deletion
        const deletedCount = await tx.wiremockInstance.count({
          where: { projectId: id }
        })

        // Delete all existing instances for this project
        await tx.wiremockInstance.deleteMany({
          where: { projectId: id }
        })

        // Create new instances
        const createdInstances = await Promise.all(
          body.instances.map((instance) =>
            tx.wiremockInstance.create({
              data: {
                projectId: id,
                name: instance.name,
                url: instance.url
              }
            })
          )
        )

        return {
          deleted: deletedCount,
          created: createdInstances.length,
          instances: createdInstances
        }
      })

      return reply.send({
        success: true,
        data: result
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
