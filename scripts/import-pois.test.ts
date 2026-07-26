import { describe, expect, it } from 'vitest'
import { PoiSchema } from '../packages/shared/src/index.js'
import {
  normalizePoiRecord,
  parseCsv,
  validatePoiCsv,
  type CsvRecord,
  type RoutePack,
} from './import-pois.js'

const headers = [
  'id',
  'routePackId',
  'name',
  'shortName',
  'address',
  'longitude',
  'latitude',
  'category',
  'indoor',
  'publicAccess',
  'estimatedCostCny',
  'stayMinutes',
  'walkMinutes',
  'tags',
  'moodTags',
  'storyHooks',
  'taskHooks',
  'observationAnchors',
  'safetyNotes',
  'verificationStatus',
  'verifiedAt',
  'sourceUrls',
  'fallbackPoiIds',
] as const

const routePack: RoutePack = {
  id: 'test-route',
  name: '测试路线包',
  city: '上海',
  districts: ['测试区'],
  description: '仅用于自动化测试。',
  center: {
    longitude: 121.47,
    latitude: 31.23,
  },
  supportedGenres: ['mystery'],
  themeTags: ['test'],
  minimumPoiCount: 1,
  recommendedDuration: 120,
  notice: '不包含正式地点。',
}

const createRecord = (
  id: string,
  fallbackPoiIds: string,
  overrides: Partial<CsvRecord> = {},
): CsvRecord => ({
  id,
  routePackId: routePack.id,
  name: `模拟节点 ${id}`,
  shortName: id,
  address: '开发测试地址，不对应真实地点',
  longitude: id.endsWith('1') ? '121.4701' : '121.4702',
  latitude: id.endsWith('1') ? '31.2301' : '31.2302',
  category: 'mock',
  indoor: 'false',
  publicAccess: 'true',
  estimatedCostCny: '0',
  stayMinutes: '15',
  walkMinutes: '5',
  tags: ' development | test ',
  moodTags: 'quiet',
  storyHooks: 'fiction-only',
  taskHooks: ' observe | journal ',
  observationAnchors: ' shape | color ',
  safetyNotes: 'stay-public',
  verificationStatus: 'mock',
  verifiedAt: '',
  sourceUrls: '',
  fallbackPoiIds,
  ...overrides,
})

const escapeCsvCell = (value: string): string =>
  /[",\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value

const createCsv = (records: CsvRecord[]): string =>
  [
    headers.join(','),
    ...records.map((record) =>
      headers.map((header) => escapeCsvCell(record[header] ?? '')).join(','),
    ),
  ].join('\n')

describe('POI CSV parsing', () => {
  it('parses quoted fields and trims array values', () => {
    const csv = createCsv([
      createRecord('mock_1', 'mock_2', {
        address: '测试地址, 不对应真实地点',
      }),
      createRecord('mock_2', 'mock_1'),
    ])

    const records = parseCsv(csv)
    const parsed = PoiSchema.parse(normalizePoiRecord(records[0] ?? {}))

    expect(parsed.address).toBe('测试地址, 不对应真实地点')
    expect(parsed.tags).toEqual(['development', 'test'])
    expect(parsed.taskHooks).toEqual(['observe', 'journal'])
  })
})

describe('POI content validation', () => {
  it('rejects invalid coordinates', () => {
    const csv = createCsv([
      createRecord('mock_1', 'mock_2', { longitude: '181' }),
      createRecord('mock_2', 'mock_1'),
    ])

    const result = validatePoiCsv(csv, [routePack])

    expect(result.report.errors.some(
      (issue) => issue.code === 'SCHEMA_VALIDATION_ERROR',
    )).toBe(true)
  })

  it('rejects duplicate ids', () => {
    const csv = createCsv([
      createRecord('mock_1', 'mock_1'),
      createRecord('mock_1', 'mock_1', {
        longitude: '121.4702',
        latitude: '31.2302',
      }),
    ])

    const result = validatePoiCsv(csv, [routePack])

    expect(
      result.report.errors.some((issue) => issue.code === 'DUPLICATE_ID'),
    ).toBe(true)
  })

  it('rejects a verified POI without a source URL', () => {
    const csv = createCsv([
      createRecord('verified_1', 'mock_2', {
        verificationStatus: 'verified',
        verifiedAt: '2026-07-26T08:00:00+08:00',
        sourceUrls: '',
      }),
      createRecord('mock_2', 'verified_1'),
    ])

    const result = validatePoiCsv(csv, [routePack])

    expect(
      result.report.errors.some(
        (issue) => issue.code === 'SOURCE_URL_REQUIRED',
      ),
    ).toBe(true)
  })

  it('rejects a POI without a fallback', () => {
    const csv = createCsv([
      createRecord('mock_1', ''),
      createRecord('mock_2', 'mock_1'),
    ])

    const result = validatePoiCsv(csv, [routePack])

    expect(
      result.report.errors.some((issue) => issue.code === 'FALLBACK_REQUIRED'),
    ).toBe(true)
  })

  it('does not use mock POIs as fallback in verified mode', () => {
    const csv = createCsv([
      createRecord('mock_1', 'mock_2'),
      createRecord('mock_2', 'mock_1'),
    ])

    const result = validatePoiCsv(csv, [routePack], 'verified')

    expect(result.pois).toEqual([])
    expect(
      result.report.errors.some(
        (issue) => issue.code === 'INSUFFICIENT_VERIFIED_POIS',
      ),
    ).toBe(true)
  })
})
