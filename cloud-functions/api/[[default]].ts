import { createRequire } from 'node:module'
import { app } from '../../cloudfunctions/citywalk-api/src/index.js'

const require = createRequire(import.meta.url)

// Fail during cold start if EdgeOne omitted a runtime dependency. Do not expose
// package paths in API responses.
require.resolve('ws')

// EdgeOne Makers mounts this catch-all Express function at /api.
export default app
