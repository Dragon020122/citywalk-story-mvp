import type { ApiLogger } from './repositories/index.js'

export const consoleLogger: ApiLogger = {
  info(message, context) {
    console.info(message, context ?? {})
  },
  warn(message, context) {
    console.warn(message, context ?? {})
  },
  error(message, context) {
    console.error(message, context ?? {})
  },
}
