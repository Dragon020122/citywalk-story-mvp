export const GENERATION_MODES = ['server', 'client-mock'] as const
export type GenerationMode = (typeof GENERATION_MODES)[number]

const configuredMode = import.meta.env.VITE_GENERATION_MODE

export const getGenerationMode = (): GenerationMode => {
  if (configuredMode === undefined || configuredMode === '') return 'server'
  if (configuredMode === 'server' || configuredMode === 'client-mock') {
    return configuredMode
  }
  if (import.meta.env.DEV) {
    throw new Error(`Invalid VITE_GENERATION_MODE: ${configuredMode}`)
  }
  return 'server'
}
