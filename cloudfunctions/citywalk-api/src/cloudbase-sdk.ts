import * as cloudBaseSdk from '@cloudbase/node-sdk'

type CloudBaseSdk = typeof import('@cloudbase/node-sdk')

const runtimeCloudBaseSdk = cloudBaseSdk as unknown as CloudBaseSdk & {
  default?: CloudBaseSdk
}

export const initializeCloudBase: CloudBaseSdk['init'] = (...args) => {
  const init = runtimeCloudBaseSdk.init ?? runtimeCloudBaseSdk.default?.init
  if (!init) {
    throw new Error('CloudBase SDK init is unavailable')
  }
  return init(...args)
}
