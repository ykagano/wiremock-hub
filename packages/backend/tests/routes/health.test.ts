import { describe, it, expect } from 'vitest'
import { getTestApp } from '../setup.js'

describe('GET /api/health', () => {
  it('should return status ok', async () => {
    const app = await getTestApp()

    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      status: 'ok',
    })
  })
})
