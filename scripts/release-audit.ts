import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const runtimeRoots = [
  resolve(projectRoot, 'apps/web/src'),
  resolve(projectRoot, 'apps/web/public'),
  resolve(projectRoot, 'cloudfunctions/citywalk-api/src'),
]
const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.svg',
  '.ts',
  '.tsx',
])
const failures: string[] = []

const walk = (path: string): string[] => {
  if (!existsSync(path)) return []
  if (!statSync(path).isDirectory()) return [path]
  return readdirSync(path).flatMap((entry) => walk(resolve(path, entry)))
}

const runtimeFiles = runtimeRoots
  .flatMap(walk)
  .filter((path) => textExtensions.has(extname(path)))
  .filter((path) => !/\.(test|spec)\.[cm]?[jt]sx?$/u.test(path))

const reportMatch = (
  path: string,
  content: string,
  pattern: RegExp,
  label: string,
) => {
  if (pattern.test(content)) {
    failures.push(`${label}: ${relative(projectRoot, path)}`)
  }
}

const forbiddenRuntimePatterns: Array<[RegExp, string]> = [
  [/dangerouslySetInnerHTML/u, '发现 dangerouslySetInnerHTML'],
  [/\beval\s*\(/u, '发现 eval 调用'],
  [/\b(?:new\s+)?Function\s*\(/u, '发现 Function 构造器'],
  [/\bSecretId\b/iu, '发现 SecretId'],
  [/\bSecretKey\b/iu, '发现 SecretKey'],
]
const forbiddenNetworkPatterns: Array<[RegExp, string]> = [
  [/(?:fonts|maps)\.googleapis\.com/iu, '发现 Google 运行时资源'],
  [/\bgoogle(?:apis)?\.(?:com|cn)\b/iu, '发现 Google 运行时资源'],
  [/\bmapbox\.(?:com|cn)\b/iu, '发现 Mapbox 运行时资源'],
  [/\bopenai\.com\b/iu, '发现 OpenAI 运行时资源'],
  [/\bunsplash\.com\b/iu, '发现 Unsplash 运行时资源'],
  [/\bpexels\.com\b/iu, '发现 Pexels 运行时资源'],
  [/\b(?:unpkg|cdnjs|jsdelivr)\.(?:com|net)\b/iu, '发现海外 CDN'],
  [/\b(?:githubusercontent|github)\.com\b/iu, '发现 GitHub 运行时资源'],
]

for (const path of runtimeFiles) {
  const content = readFileSync(path, 'utf8')
  for (const [pattern, label] of forbiddenRuntimePatterns) {
    reportMatch(path, content, pattern, label)
  }
  for (const [pattern, label] of forbiddenNetworkPatterns) {
    reportMatch(path, content, pattern, label)
  }
}

const trackedFiles = execFileSync('git', ['ls-files'], {
  cwd: projectRoot,
  encoding: 'utf8',
})
  .split(/\r?\n/u)
  .filter(Boolean)
const trackedEnvironmentFiles = trackedFiles.filter(
  (path) =>
    /(^|\/)\.env(?:\.|$)/u.test(path) && !path.endsWith('.env.example'),
)
if (trackedEnvironmentFiles.length > 0) {
  failures.push(`发现已提交的真实环境文件: ${trackedEnvironmentFiles.join(', ')}`)
}

const webSource = runtimeFiles
  .filter((path) => path.includes(resolve('apps/web/src')))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n')
if (/\bFormData\s*\(/u.test(webSource)) {
  failures.push('客户端出现 FormData 上传路径，需确认照片不会上传')
}

const apiClientSource = [
  resolve(projectRoot, 'apps/web/src/api-client.ts'),
  resolve(projectRoot, 'apps/web/src/persistence/sync-queue.ts'),
]
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n')
if (/\blocalPhotos\b|\bLocalPhotoRecord\b/u.test(apiClientSource)) {
  failures.push('API 或同步队列引用本地照片表')
}

const appSource = readFileSync(
  resolve(projectRoot, 'cloudfunctions/citywalk-api/src/app.ts'),
  'utf8',
)
for (const requiredGuard of [
  'express.json({ limit: config.jsonBodyLimit })',
  'rateLimit({',
  'cors({',
  'validateBody',
  'errorHandler',
]) {
  if (!appSource.includes(requiredGuard)) {
    failures.push(`API 安全基线缺失: ${requiredGuard}`)
  }
}

const middlewareSource = readFileSync(
  resolve(projectRoot, 'cloudfunctions/citywalk-api/src/middleware.ts'),
  'utf8',
)
if (!middlewareSource.includes("createHash('sha256')")) {
  failures.push('客户端标识未使用 SHA-256 匿名化')
}

const aiValidationSources = [
  'story-workflow.ts',
  'generate-blueprint.ts',
  'generate-story-graph.ts',
].map((file) =>
  readFileSync(
    resolve(projectRoot, 'cloudfunctions/citywalk-api/src/ai', file),
    'utf8',
  ),
)
for (const [source, schemaEvidence] of [
  [aiValidationSources[0], 'GenerateStoryResponseSchema.parse'],
  [aiValidationSources[1], 'parseAiJson(output, StoryBlueprintSchema)'],
  [aiValidationSources[2], 'parseAiJson(input.rawOutput, StoryGraphSchema)'],
] as const) {
  if (!source?.includes(schemaEvidence)) {
    failures.push(`AI 输出 Schema 校验证据缺失: ${schemaEvidence}`)
  }
}

const distDirectory = resolve(projectRoot, 'apps/web/dist/assets')
if (existsSync(distDirectory)) {
  const bundle = walk(distDirectory)
    .filter((path) => ['.js', '.css'].includes(extname(path)))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n')
  for (const marker of [
    'TENCENT_MAP_SERVER_KEY',
    'CLOUDBASE_ENV_ID',
    'SecretId',
    'SecretKey',
  ]) {
    if (bundle.includes(marker)) {
      failures.push(`Vite bundle 泄露服务端配置标记: ${marker}`)
    }
  }
  for (const [pattern, label] of forbiddenNetworkPatterns) {
    if (pattern.test(bundle)) failures.push(`${label}: apps/web/dist/assets`)
  }
}

if (failures.length > 0) {
  console.error('发布审查失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(
    `发布审查通过：扫描 ${runtimeFiles.length} 个运行时文件；密钥、危险执行、输入/输出校验、照片本地化与国内网络基线均符合要求。`,
  )
}
