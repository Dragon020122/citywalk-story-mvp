import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('EdgeOne Makers deployment configuration', () => {
  it('keeps the API function namespace ahead of the SPA fallback contract', async () => {
    const file = await readFile(resolve('edgeone.json'), 'utf8')
    const config: unknown = JSON.parse(file)

    expect(config).toMatchObject({
      outputDirectory: 'apps/web/dist',
      rewrites: [{ source: '/*', destination: '/index.html' }],
      cloudFunctions: { nodejs: { maxDuration: 60 } },
    })
    expect(file).not.toContain('//')
    expect(
      await readFile(resolve('cloud-functions/api/[[default]].ts'), 'utf8'),
    ).toContain('export default app')
  })
})
