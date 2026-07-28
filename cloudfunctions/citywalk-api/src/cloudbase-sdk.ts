import { createRequire } from 'node:module'

type CloudBaseSdk = typeof import('@cloudbase/node-sdk')

const require = createRequire(import.meta.url)

type RuntimeCloudBaseSdk = CloudBaseSdk & {
  default?: CloudBaseSdk
}

export const initializeCloudBase: CloudBaseSdk['init'] = (...args) => {
  // CloudBase is only used by verified/live mode. Keeping the require here
  // lets the Mock EdgeOne entry start without resolving its optional peers.
  const runtimeCloudBaseSdk =
    require('@cloudbase/node-sdk') as RuntimeCloudBaseSdk
  const init = runtimeCloudBaseSdk.init ?? runtimeCloudBaseSdk.default?.init
  if (!init) {
    throw new Error('CloudBase SDK init is unavailable')
  }
  return init(...args)
}
