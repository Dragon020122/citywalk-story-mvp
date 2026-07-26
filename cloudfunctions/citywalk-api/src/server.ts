import { createApp, createDefaultDependencies } from './app.js'

const dependencies = createDefaultDependencies()
const app = createApp(dependencies)

app.listen(dependencies.config.port, () => {
  dependencies.logger.info('api_server_started', {
    port: dependencies.config.port,
    environment: dependencies.config.nodeEnvironment,
    contentMode: dependencies.config.contentMode,
    databaseEnabled: dependencies.repositories.databaseStatus.enabled,
  })
})
