import { once } from 'node:events'
import { createServer as createHttpServer } from 'node:http'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createServer as createViteServer, type ViteDevServer } from 'vite'
import { createApp } from '../cloudfunctions/citywalk-api/src/app.js'

let apiServer: ReturnType<typeof createHttpServer> | undefined
let viteServer: ViteDevServer | undefined

afterEach(async () => {
  await viteServer?.close()
  await new Promise<void>((resolveClose) => apiServer?.close(() => resolveClose()))
  viteServer = undefined
  apiServer = undefined
})

describe('Vite /api proxy', () => {
  it('strips /api before forwarding health requests to Express', async () => {
    apiServer = createHttpServer(createApp())
    apiServer.listen(0, '127.0.0.1')
    await once(apiServer, 'listening')
    const apiAddress = apiServer.address()
    if (!apiAddress || typeof apiAddress === 'string') {
      throw new Error('Test API did not bind a TCP port')
    }

    viteServer = await createViteServer({
      root: resolve('apps/web'),
      configFile: false,
      logLevel: 'error',
      server: {
        host: '127.0.0.1',
        port: 0,
        proxy: {
          '/api': {
            target: `http://127.0.0.1:${apiAddress.port}`,
            rewrite: (path) => path.replace(/^\/api/u, ''),
          },
        },
      },
    })
    await viteServer.listen()
    const viteAddress = viteServer.httpServer?.address()
    if (!viteAddress || typeof viteAddress === 'string') {
      throw new Error('Test Vite server did not bind a TCP port')
    }

    const response = await fetch(`http://127.0.0.1:${viteAddress.port}/api/health`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ status: 'ok' })
  })
})
