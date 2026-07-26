import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PoiSchema, type Poi } from '@citywalk/shared'
import { z } from 'zod'

export interface PoiSource {
  load(): Promise<Poi[]>
}

export class StaticPoiSource implements PoiSource {
  constructor(private readonly pois: readonly Poi[]) {}

  async load(): Promise<Poi[]> {
    return structuredClone([...this.pois])
  }
}

export class FilePoiSource implements PoiSource {
  constructor(
    private readonly candidatePaths: readonly string[] = [
      path.resolve(process.cwd(), 'content/generated/pois.json'),
      path.resolve(process.cwd(), '../../content/generated/pois.json'),
    ],
  ) {}

  async load(): Promise<Poi[]> {
    const failures: string[] = []

    for (const candidatePath of this.candidatePaths) {
      try {
        const json: unknown = JSON.parse(
          await readFile(candidatePath, 'utf8'),
        )
        return z.array(PoiSchema).parse(json)
      } catch (error) {
        failures.push(
          `${candidatePath}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        )
      }
    }

    throw new Error(`Unable to load POI data: ${failures.join('; ')}`)
  }
}
