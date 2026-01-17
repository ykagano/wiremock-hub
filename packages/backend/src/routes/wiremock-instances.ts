import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import axios from 'axios'

const createInstanceSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  url: z.string().url()
})

const updateInstanceSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  isActive: z.boolean().optional()
})

const importStubSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  urlMatchType: z.enum(['url', 'urlPath', 'urlPattern', 'urlPathPattern']),
  urlPattern: z.string().min(1),
  matchHeaders: z.array(z.string()).optional().default([]),
  bodyMatchType: z.enum(['equalTo', 'equalToJson', 'contains', 'matches']).optional(),
  bodyMatchOptions: z.object({
    ignoreArrayOrder: z.boolean().optional(),
    ignoreExtraElements: z.boolean().optional()
  }).optional(),
  responseHeaders: z.array(z.string()).optional().default([]),
  enableTemplating: z.boolean().optional().default(false)
})

export async function wiremockInstanceRoutes(fastify: FastifyInstance) {
  // Helper to check project exists
  async function checkProjectExists(projectId: string) {
    const project = await fastify.prisma.project.findUnique({
      where: { id: projectId }
    })
    return project
  }

  // List instances for a project
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

    const instances = await fastify.prisma.wiremockInstance.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    })

    return reply.send({
      success: true,
      data: instances
    })
  })

  // Get single instance with health status
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params

    const instance = await fastify.prisma.wiremockInstance.findUnique({
      where: { id },
      include: { project: true }
    })

    if (!instance) {
      return reply.status(404).send({
        success: false,
        error: 'Instance not found'
      })
    }

    // Check WireMock health
    let isHealthy = false
    try {
      const response = await axios.get(`${instance.url}/__admin/mappings`, {
        timeout: 5000
      })
      isHealthy = response.status === 200
    } catch {
      isHealthy = false
    }

    return reply.send({
      success: true,
      data: {
        ...instance,
        isHealthy
      }
    })
  })

  // Create instance
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createInstanceSchema.parse(request.body)

      const project = await checkProjectExists(body.projectId)
      if (!project) {
        return reply.status(404).send({
          success: false,
          error: 'Project not found'
        })
      }

      const instance = await fastify.prisma.wiremockInstance.create({
        data: body
      })

      return reply.status(201).send({
        success: true,
        data: instance
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

  // Update instance
  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params
      const body = updateInstanceSchema.parse(request.body)

      const existing = await fastify.prisma.wiremockInstance.findUnique({
        where: { id }
      })

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: 'Instance not found'
        })
      }

      const instance = await fastify.prisma.wiremockInstance.update({
        where: { id },
        data: body
      })

      return reply.send({
        success: true,
        data: instance
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

  // Delete instance
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params

    const existing = await fastify.prisma.wiremockInstance.findUnique({
      where: { id }
    })

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: 'Instance not found'
      })
    }

    await fastify.prisma.wiremockInstance.delete({
      where: { id }
    })

    return reply.send({
      success: true,
      message: 'Instance deleted successfully'
    })
  })

  // Get mappings from WireMock instance
  fastify.get('/:id/mappings', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params

    const instance = await fastify.prisma.wiremockInstance.findUnique({
      where: { id },
      include: { project: true }
    })

    if (!instance) {
      return reply.status(404).send({
        success: false,
        error: 'Instance not found'
      })
    }

    try {
      const response = await axios.get(`${instance.url}/__admin/mappings`, {
        timeout: 10000
      })

      return reply.send({
        success: true,
        data: response.data
      })
    } catch (error: any) {
      return reply.status(502).send({
        success: false,
        error: 'Failed to fetch mappings from WireMock',
        details: error.message
      })
    }
  })

  // Get requests from WireMock instance
  fastify.get('/:id/requests', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params

    const instance = await fastify.prisma.wiremockInstance.findUnique({
      where: { id },
      include: { project: true }
    })

    if (!instance) {
      return reply.status(404).send({
        success: false,
        error: 'Instance not found'
      })
    }

    try {
      const response = await axios.get(`${instance.url}/__admin/requests`, {
        timeout: 10000
      })

      return reply.send({
        success: true,
        data: response.data
      })
    } catch (error: any) {
      return reply.status(502).send({
        success: false,
        error: 'Failed to fetch requests from WireMock',
        details: error.message
      })
    }
  })

  // Get unmatched requests from WireMock instance
  // NOTE: This route must be registered BEFORE /:id/requests/:requestId to avoid matching 'unmatched' as requestId
  fastify.get('/:id/requests/unmatched', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params

    const instance = await fastify.prisma.wiremockInstance.findUnique({
      where: { id },
      include: { project: true }
    })

    if (!instance) {
      return reply.status(404).send({
        success: false,
        error: 'Instance not found'
      })
    }

    try {
      const response = await axios.get(`${instance.url}/__admin/requests/unmatched`, {
        timeout: 10000
      })

      // Normalize unmatched requests to match the format of /__admin/requests
      // WireMock's /unmatched returns flat request objects without the 'request' wrapper
      const normalizedRequests = (response.data.requests || []).map((req: any, index: number) => ({
        id: req.id || `unmatched-${index}-${req.loggedDate}`,
        request: {
          url: req.url,
          absoluteUrl: req.absoluteUrl,
          method: req.method,
          clientIp: req.clientIp,
          headers: req.headers,
          cookies: req.cookies,
          body: req.body,
          bodyAsBase64: req.bodyAsBase64,
          loggedDate: req.loggedDate,
          loggedDateString: req.loggedDateString,
          queryParams: req.queryParams,
          formParams: req.formParams,
          protocol: req.protocol,
          scheme: req.scheme,
          host: req.host,
          port: req.port
        },
        wasMatched: false
      }))

      return reply.send({
        success: true,
        data: {
          requests: normalizedRequests,
          requestJournalDisabled: response.data.requestJournalDisabled
        }
      })
    } catch (error: any) {
      return reply.status(502).send({
        success: false,
        error: 'Failed to fetch unmatched requests from WireMock',
        details: error.message
      })
    }
  })

  // Get single request from WireMock instance
  fastify.get('/:id/requests/:requestId', async (request: FastifyRequest<{ Params: { id: string; requestId: string } }>, reply: FastifyReply) => {
    const { id, requestId } = request.params

    const instance = await fastify.prisma.wiremockInstance.findUnique({
      where: { id },
      include: { project: true }
    })

    if (!instance) {
      return reply.status(404).send({
        success: false,
        error: 'Instance not found'
      })
    }

    try {
      const response = await axios.get(`${instance.url}/__admin/requests/${requestId}`, {
        timeout: 10000
      })

      return reply.send({
        success: true,
        data: response.data
      })
    } catch (error: any) {
      if (error.response?.status === 404) {
        return reply.status(404).send({
          success: false,
          error: 'Request not found'
        })
      }
      return reply.status(502).send({
        success: false,
        error: 'Failed to fetch request from WireMock',
        details: error.message
      })
    }
  })

  // Import request as stub
  fastify.post('/:id/requests/:requestId/import', async (request: FastifyRequest<{ Params: { id: string; requestId: string } }>, reply: FastifyReply) => {
    const { id, requestId } = request.params

    try {
      const body = importStubSchema.parse(request.body)

      const instance = await fastify.prisma.wiremockInstance.findUnique({
        where: { id },
        include: { project: true }
      })

      if (!instance) {
        return reply.status(404).send({
          success: false,
          error: 'Instance not found'
        })
      }

      // Verify project exists
      const project = await fastify.prisma.project.findUnique({
        where: { id: body.projectId }
      })

      if (!project) {
        return reply.status(404).send({
          success: false,
          error: 'Project not found'
        })
      }

      // Fetch the request from WireMock
      let wiremockRequest
      try {
        const response = await axios.get(`${instance.url}/__admin/requests/${requestId}`, {
          timeout: 10000
        })
        wiremockRequest = response.data
      } catch (error: any) {
        if (error.response?.status === 404) {
          return reply.status(404).send({
            success: false,
            error: 'Request not found'
          })
        }
        throw error
      }

      // Generate mapping from request
      const mapping = generateMapping(wiremockRequest, body)

      // Create stub in database
      const stub = await fastify.prisma.stub.create({
        data: {
          projectId: body.projectId,
          name: body.name,
          mapping: mapping as object
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

  // Clear requests from WireMock instance
  fastify.delete('/:id/requests', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params

    const instance = await fastify.prisma.wiremockInstance.findUnique({
      where: { id },
      include: { project: true }
    })

    if (!instance) {
      return reply.status(404).send({
        success: false,
        error: 'Instance not found'
      })
    }

    try {
      await axios.delete(`${instance.url}/__admin/requests`, {
        timeout: 10000
      })

      return reply.send({
        success: true,
        message: 'Request log cleared successfully'
      })
    } catch (error: any) {
      return reply.status(502).send({
        success: false,
        error: 'Failed to clear requests from WireMock',
        details: error.message
      })
    }
  })

  // Reset WireMock instance
  fastify.post('/:id/reset', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params

    const instance = await fastify.prisma.wiremockInstance.findUnique({
      where: { id },
      include: { project: true }
    })

    if (!instance) {
      return reply.status(404).send({
        success: false,
        error: 'Instance not found'
      })
    }

    try {
      // Delete all mappings from WireMock
      await axios.delete(`${instance.url}/__admin/mappings`, {
        timeout: 10000
      })

      return reply.send({
        success: true,
        message: 'WireMock instance reset successfully'
      })
    } catch (error: any) {
      return reply.status(502).send({
        success: false,
        error: 'Failed to reset WireMock instance',
        details: error.message
      })
    }
  })
}

interface ImportOptions {
  name: string
  urlMatchType: 'url' | 'urlPath' | 'urlPattern' | 'urlPathPattern'
  urlPattern: string
  matchHeaders: string[]
  bodyMatchType?: 'equalTo' | 'equalToJson' | 'contains' | 'matches'
  bodyMatchOptions?: {
    ignoreArrayOrder?: boolean
    ignoreExtraElements?: boolean
  }
  responseHeaders: string[]
  enableTemplating: boolean
}

interface WireMockLoggedRequest {
  request: {
    method: string
    url: string
    headers: Record<string, string>
    body?: string
  }
  response?: {
    status: number
    headers?: Record<string, string>
    body?: string
  }
  responseDefinition?: {
    status: number
    headers?: Record<string, string>
    body?: string
  }
}

function generateMapping(wiremockRequest: WireMockLoggedRequest, options: ImportOptions): Record<string, unknown> {
  const mapping: Record<string, unknown> = {
    name: options.name,
    request: {
      method: wiremockRequest.request.method,
      [options.urlMatchType]: options.urlPattern
    },
    response: {
      status: wiremockRequest.response?.status || wiremockRequest.responseDefinition?.status || 200
    }
  }

  const requestMapping = mapping.request as Record<string, unknown>
  const responseMapping = mapping.response as Record<string, unknown>

  // Header matching
  if (options.matchHeaders.length > 0) {
    const headers: Record<string, { equalTo: string }> = {}
    for (const header of options.matchHeaders) {
      const headerValue = wiremockRequest.request.headers[header]
      if (headerValue) {
        headers[header] = { equalTo: headerValue }
      }
    }
    if (Object.keys(headers).length > 0) {
      requestMapping.headers = headers
    }
  }

  // Body matching
  if (options.bodyMatchType && wiremockRequest.request.body) {
    const bodyPattern: Record<string, unknown> = {}

    if (options.bodyMatchType === 'equalToJson') {
      try {
        bodyPattern.equalToJson = JSON.parse(wiremockRequest.request.body)
        if (options.bodyMatchOptions?.ignoreArrayOrder) {
          bodyPattern.ignoreArrayOrder = true
        }
        if (options.bodyMatchOptions?.ignoreExtraElements) {
          bodyPattern.ignoreExtraElements = true
        }
      } catch {
        bodyPattern.equalTo = wiremockRequest.request.body
      }
    } else {
      bodyPattern[options.bodyMatchType] = wiremockRequest.request.body
    }

    requestMapping.bodyPatterns = [bodyPattern]
  }

  // Response headers
  const sourceHeaders = wiremockRequest.response?.headers || wiremockRequest.responseDefinition?.headers
  if (options.responseHeaders.length > 0 && sourceHeaders) {
    const headers: Record<string, string> = {}
    for (const header of options.responseHeaders) {
      if (sourceHeaders[header]) {
        headers[header] = sourceHeaders[header]
      }
    }
    if (Object.keys(headers).length > 0) {
      responseMapping.headers = headers
    }
  }

  // Response body
  const sourceBody = wiremockRequest.response?.body || wiremockRequest.responseDefinition?.body
  if (sourceBody) {
    try {
      responseMapping.jsonBody = JSON.parse(sourceBody)
    } catch {
      responseMapping.body = sourceBody
    }
  }

  // Templating
  if (options.enableTemplating) {
    responseMapping.transformers = ['response-template']
  }

  return mapping
}
