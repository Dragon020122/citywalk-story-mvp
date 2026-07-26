import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import {
  GenreSchema,
  GeoPointSchema,
  PoiSchema,
  type Poi,
} from '../packages/shared/src/index.js'

const SHANGHAI_BOUNDS = {
  minimumLongitude: 120.85,
  maximumLongitude: 122.2,
  minimumLatitude: 30.65,
  maximumLatitude: 31.88,
} as const

const FORBIDDEN_PRIVATE_ACCESS_PATTERNS = [
  /进入.{0,8}(私人住宅|居民住宅|民宅)/iu,
  /(私人住宅|居民住宅|民宅).{0,8}(内部|室内)/iu,
  /enter.{0,20}(private residence|private home)/iu,
  /inside.{0,20}(private residence|private home)/iu,
]

const FORBIDDEN_STRANGER_PHOTO_PATTERNS = [
  /拍摄.{0,8}陌生人.{0,8}正脸/iu,
  /陌生人.{0,8}正脸.{0,8}(拍摄|照片)/iu,
  /(photograph|photo|capture).{0,20}stranger.{0,20}face/iu,
]

const RoutePackSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  city: z.literal('上海'),
  districts: z.array(z.string().trim().min(1)).min(1),
  description: z.string().trim().min(1),
  center: GeoPointSchema,
  supportedGenres: z.array(GenreSchema).min(1),
  themeTags: z.array(z.string().trim().min(1)).min(1),
  minimumPoiCount: z.number().int().positive(),
  recommendedDuration: z.union([
    z.literal(120),
    z.literal(180),
    z.literal(240),
  ]),
  notice: z.string().trim().min(1),
})

export type RoutePack = z.infer<typeof RoutePackSchema>
export type CsvRecord = Record<string, string>

export interface ValidationIssue {
  code: string
  message: string
  row?: number
  poiId?: string
  field?: string
}

export interface RoutePackValidationSummary {
  routePackId: string
  minimumPoiCount: number
  validPoiCount: number
  productionEligibleCount: number
  developmentMockCount: number
}

export interface PoiValidationReport {
  valid: boolean
  summary: {
    totalRows: number
    schemaValidPoiCount: number
    productionEligibleCount: number
    developmentMockCount: number
    errorCount: number
    warningCount: number
  }
  routePacks: RoutePackValidationSummary[]
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

export interface PoiValidationResult {
  pois: Poi[]
  report: PoiValidationReport
}

const parseCsvRows = (csvText: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let insideQuotes = false

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index]

    if (insideQuotes) {
      if (character === '"') {
        if (csvText[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          insideQuotes = false
        }
      } else {
        cell += character
      }
      continue
    }

    if (character === '"') {
      insideQuotes = true
    } else if (character === ',') {
      row.push(cell)
      cell = ''
    } else if (character === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (character !== '\r') {
      cell += character
    }
  }

  if (insideQuotes) {
    throw new Error('CSV contains an unterminated quoted field')
  }

  row.push(cell)
  rows.push(row)

  return rows.filter((candidate) =>
    candidate.some((value) => value.trim().length > 0),
  )
}

export const parseCsv = (csvText: string): CsvRecord[] => {
  const rows = parseCsvRows(csvText.replace(/^\uFEFF/u, ''))
  const headerRow = rows[0]

  if (!headerRow) {
    throw new Error('CSV is empty')
  }

  const headers = headerRow.map((header) => header.trim())
  if (headers.some((header) => header.length === 0)) {
    throw new Error('CSV contains an empty header')
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error('CSV contains duplicate headers')
  }

  return rows.slice(1).map((values, rowIndex) => {
    if (
      values.length > headers.length &&
      values.slice(headers.length).some((value) => value.trim().length > 0)
    ) {
      throw new Error(`CSV row ${rowIndex + 2} contains extra columns`)
    }

    return Object.fromEntries(
      headers.map((header, columnIndex) => [
        header,
        values[columnIndex]?.trim() ?? '',
      ]),
    )
  })
}

const parseArrayField = (value: string): string[] => {
  const trimmed = value.trim()
  if (!trimmed) {
    return []
  }

  if (trimmed.startsWith('[')) {
    const parsed: unknown = JSON.parse(trimmed)
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      throw new Error('Array field must contain only strings')
    }
    return parsed.map((item) => item.trim()).filter(Boolean)
  }

  return trimmed
    .split(/[|;]/u)
    .map((item) => item.trim())
    .filter(Boolean)
}

const parseBooleanField = (value: string): boolean | string => {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') {
    return true
  }
  if (normalized === 'false') {
    return false
  }
  return value
}

const parseNumberField = (value: string): number => {
  const trimmed = value.trim()
  return trimmed ? Number(trimmed) : Number.NaN
}

export const normalizePoiRecord = (record: CsvRecord): unknown => ({
  id: record.id?.trim() ?? '',
  routePackId: record.routePackId?.trim() ?? '',
  name: record.name?.trim() ?? '',
  shortName: record.shortName?.trim() ?? '',
  address: record.address?.trim() ?? '',
  longitude: parseNumberField(record.longitude ?? ''),
  latitude: parseNumberField(record.latitude ?? ''),
  category: record.category?.trim() ?? '',
  indoor: parseBooleanField(record.indoor ?? ''),
  publicAccess: parseBooleanField(record.publicAccess ?? ''),
  estimatedCostCny: parseNumberField(record.estimatedCostCny ?? ''),
  stayMinutes: parseNumberField(record.stayMinutes ?? ''),
  tags: parseArrayField(record.tags ?? ''),
  moodTags: parseArrayField(record.moodTags ?? ''),
  storyHooks: parseArrayField(record.storyHooks ?? ''),
  taskHooks: parseArrayField(record.taskHooks ?? ''),
  observationAnchors: parseArrayField(record.observationAnchors ?? ''),
  safetyNotes: parseArrayField(record.safetyNotes ?? ''),
  verificationStatus: record.verificationStatus?.trim() ?? '',
  verifiedAt: record.verifiedAt?.trim() || null,
  sourceUrls: parseArrayField(record.sourceUrls ?? ''),
  fallbackPoiIds: parseArrayField(record.fallbackPoiIds ?? ''),
})

const createIssue = (
  code: string,
  message: string,
  poi: Poi,
  field?: string,
): ValidationIssue => ({
  code,
  message,
  poiId: poi.id,
  ...(field ? { field } : {}),
})

const validatePoiRules = (poi: Poi): ValidationIssue[] => {
  const issues: ValidationIssue[] = []

  if (poi.verificationStatus === 'verified' && !poi.verifiedAt) {
    issues.push(
      createIssue(
        'VERIFIED_AT_REQUIRED',
        'Verified POI must include verifiedAt',
        poi,
        'verifiedAt',
      ),
    )
  }

  if (
    poi.verificationStatus === 'verified' &&
    poi.sourceUrls.length === 0
  ) {
    issues.push(
      createIssue(
        'SOURCE_URL_REQUIRED',
        'Verified POI must include at least one source URL',
        poi,
        'sourceUrls',
      ),
    )
  }

  const withinShanghai =
    poi.longitude >= SHANGHAI_BOUNDS.minimumLongitude &&
    poi.longitude <= SHANGHAI_BOUNDS.maximumLongitude &&
    poi.latitude >= SHANGHAI_BOUNDS.minimumLatitude &&
    poi.latitude <= SHANGHAI_BOUNDS.maximumLatitude

  if (!withinShanghai) {
    issues.push(
      createIssue(
        'OUTSIDE_SHANGHAI_BOUNDS',
        'POI coordinates are outside the configured Shanghai bounds',
        poi,
        'longitude',
      ),
    )
  }

  if (poi.observationAnchors.length === 0) {
    issues.push(
      createIssue(
        'OBSERVATION_ANCHORS_REQUIRED',
        'POI must include at least one observation anchor',
        poi,
        'observationAnchors',
      ),
    )
  }

  if (poi.taskHooks.length < 2) {
    issues.push(
      createIssue(
        'TASK_HOOKS_INSUFFICIENT',
        'POI must include at least two task hooks',
        poi,
        'taskHooks',
      ),
    )
  }

  if (poi.fallbackPoiIds.length === 0) {
    issues.push(
      createIssue(
        'FALLBACK_REQUIRED',
        'POI must include at least one fallback POI id',
        poi,
        'fallbackPoiIds',
      ),
    )
  }

  if (poi.fallbackPoiIds.includes(poi.id)) {
    issues.push(
      createIssue(
        'SELF_FALLBACK',
        'POI cannot reference itself as a fallback',
        poi,
        'fallbackPoiIds',
      ),
    )
  }

  const searchableText = [
    poi.name,
    poi.shortName,
    poi.address,
    ...poi.storyHooks,
    ...poi.taskHooks,
    ...poi.observationAnchors,
    ...poi.safetyNotes,
  ].join(' ')

  if (
    FORBIDDEN_PRIVATE_ACCESS_PATTERNS.some((pattern) =>
      pattern.test(searchableText),
    )
  ) {
    issues.push(
      createIssue(
        'PRIVATE_RESIDENCE_ACCESS_FORBIDDEN',
        'POI content cannot require access inside a private residence',
        poi,
      ),
    )
  }

  if (
    FORBIDDEN_STRANGER_PHOTO_PATTERNS.some((pattern) =>
      pattern.test(searchableText),
    )
  ) {
    issues.push(
      createIssue(
        'STRANGER_FACE_PHOTO_FORBIDDEN',
        'POI content cannot require photographing a stranger face-on',
        poi,
      ),
    )
  }

  return issues
}

export const validatePoiCsv = (
  csvText: string,
  routePacks: RoutePack[],
): PoiValidationResult => {
  const records = parseCsv(csvText)
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const pois: Poi[] = []

  records.forEach((record, index) => {
    let normalized: unknown
    try {
      normalized = normalizePoiRecord(record)
    } catch (error) {
      errors.push({
        code: 'CSV_NORMALIZATION_ERROR',
        message: error instanceof Error ? error.message : 'CSV normalization failed',
        row: index + 2,
      })
      return
    }

    const parsed = PoiSchema.safeParse(normalized)
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        errors.push({
          code: 'SCHEMA_VALIDATION_ERROR',
          message: issue.message,
          row: index + 2,
          field: issue.path.join('.'),
          ...(record.id ? { poiId: record.id.trim() } : {}),
        })
      })
      return
    }

    pois.push(parsed.data)
  })

  const seenIds = new Set<string>()
  const seenCoordinates = new Map<string, string>()
  const allIds = new Set(pois.map((poi) => poi.id))
  const routePackIds = new Set(routePacks.map((routePack) => routePack.id))

  pois.forEach((poi) => {
    if (seenIds.has(poi.id)) {
      errors.push(createIssue('DUPLICATE_ID', `Duplicate POI id: ${poi.id}`, poi, 'id'))
    }
    seenIds.add(poi.id)

    const coordinateKey = `${poi.longitude.toFixed(6)},${poi.latitude.toFixed(6)}`
    const existingCoordinatePoiId = seenCoordinates.get(coordinateKey)
    if (existingCoordinatePoiId) {
      errors.push(
        createIssue(
          'DUPLICATE_COORDINATES',
          `Coordinates duplicate POI ${existingCoordinatePoiId}`,
          poi,
        ),
      )
    } else {
      seenCoordinates.set(coordinateKey, poi.id)
    }

    if (!routePackIds.has(poi.routePackId)) {
      errors.push(
        createIssue(
          'ROUTE_PACK_NOT_FOUND',
          `Unknown route pack: ${poi.routePackId}`,
          poi,
          'routePackId',
        ),
      )
    }

    poi.fallbackPoiIds.forEach((fallbackPoiId) => {
      if (!allIds.has(fallbackPoiId)) {
        errors.push(
          createIssue(
            'FALLBACK_REFERENCE_NOT_FOUND',
            `Fallback POI does not exist: ${fallbackPoiId}`,
            poi,
            'fallbackPoiIds',
          ),
        )
      }
    })

    errors.push(...validatePoiRules(poi))

    if (poi.verificationStatus === 'mock' && !poi.id.startsWith('mock_')) {
      errors.push(
        createIssue(
          'MOCK_ID_PREFIX_REQUIRED',
          'Mock POI ids must start with mock_',
          poi,
          'id',
        ),
      )
    }
    if (
      poi.id.startsWith('mock_') &&
      poi.verificationStatus !== 'mock'
    ) {
      errors.push(
        createIssue(
          'MOCK_STATUS_REQUIRED',
          'POI ids starting with mock_ must use mock verification status',
          poi,
          'verificationStatus',
        ),
      )
    }
  })

  const routePackSummaries = routePacks.map((routePack) => {
    const routePois = pois.filter(
      (poi) =>
        poi.routePackId === routePack.id &&
        (poi.verificationStatus === 'verified' ||
          poi.verificationStatus === 'mock'),
    )
    const productionEligibleCount = routePois.filter(
      (poi) => poi.verificationStatus === 'verified',
    ).length
    const developmentMockCount = routePois.filter(
      (poi) => poi.verificationStatus === 'mock',
    ).length

    if (routePois.length < routePack.minimumPoiCount) {
      errors.push({
        code: 'ROUTE_PACK_MINIMUM_POIS',
        message: `${routePack.id} requires ${routePack.minimumPoiCount} valid POIs but has ${routePois.length}`,
        field: 'minimumPoiCount',
      })
    }

    if (productionEligibleCount < routePack.minimumPoiCount) {
      warnings.push({
        code: 'ROUTE_PACK_NOT_PRODUCTION_READY',
        message: `${routePack.id} has ${productionEligibleCount} verified POIs; mock POIs are development-only`,
      })
    }

    return {
      routePackId: routePack.id,
      minimumPoiCount: routePack.minimumPoiCount,
      validPoiCount: routePois.length,
      productionEligibleCount,
      developmentMockCount,
    }
  })

  const productionEligibleCount = pois.filter(
    (poi) => poi.verificationStatus === 'verified',
  ).length
  const developmentMockCount = pois.filter(
    (poi) => poi.verificationStatus === 'mock',
  ).length

  return {
    pois,
    report: {
      valid: errors.length === 0,
      summary: {
        totalRows: records.length,
        schemaValidPoiCount: pois.length,
        productionEligibleCount,
        developmentMockCount,
        errorCount: errors.length,
        warningCount: warnings.length,
      },
      routePacks: routePackSummaries,
      errors,
      warnings,
    },
  }
}

export const loadRoutePacks = async (
  directoryPath: string,
): Promise<RoutePack[]> => {
  const fileNames = (await readdir(directoryPath))
    .filter((fileName) => fileName.endsWith('.json'))
    .sort()

  return Promise.all(
    fileNames.map(async (fileName) => {
      const filePath = path.join(directoryPath, fileName)
      const json: unknown = JSON.parse(await readFile(filePath, 'utf8'))
      return RoutePackSchema.parse(json)
    }),
  )
}

export const writeGeneratedContent = async (
  outputDirectory: string,
  result: PoiValidationResult,
): Promise<void> => {
  await mkdir(outputDirectory, { recursive: true })
  await Promise.all([
    writeFile(
      path.join(outputDirectory, 'pois.json'),
      `${JSON.stringify(result.pois, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      path.join(outputDirectory, 'poi-report.json'),
      `${JSON.stringify(result.report, null, 2)}\n`,
      'utf8',
    ),
  ])
}

const runCli = async (): Promise<void> => {
  const workspaceRoot = process.cwd()
  const inputPath = path.resolve(
    workspaceRoot,
    process.argv[2] ?? 'content/pois/mock-pois.csv',
  )
  const routePackDirectory = path.join(
    workspaceRoot,
    'content',
    'route-packs',
  )
  const outputDirectory = path.join(workspaceRoot, 'content', 'generated')

  const [csvText, routePacks] = await Promise.all([
    readFile(inputPath, 'utf8'),
    loadRoutePacks(routePackDirectory),
  ])
  const result = validatePoiCsv(csvText, routePacks)
  await writeGeneratedContent(outputDirectory, result)

  const summary = result.report.summary
  console.log(
    `POI validation: ${summary.schemaValidPoiCount}/${summary.totalRows} schema-valid, ${summary.productionEligibleCount} verified, ${summary.developmentMockCount} mock, ${summary.errorCount} errors, ${summary.warningCount} warnings`,
  )

  if (!result.report.valid) {
    result.report.errors.forEach((issue) => {
      console.error(
        `[${issue.code}]${issue.poiId ? ` ${issue.poiId}` : ''} ${issue.message}`,
      )
    })
    process.exitCode = 1
  }
}

const entryPath = process.argv[1]
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  runCli().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
