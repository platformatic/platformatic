export default function setupNestApplication(app) {
  app.setGlobalPrefix('/nested/base/dir/')
  globalThis.platformatic.notifyConfig({ basePath: '/nested/base/dir' })
}
