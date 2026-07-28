const configuredBuildId =
  import.meta.env.VITE_APP_BUILD_SHA ?? import.meta.env.VITE_APP_BUILD_TIME

export const appBuildId = configuredBuildId?.trim().slice(0, 12) || 'local'
