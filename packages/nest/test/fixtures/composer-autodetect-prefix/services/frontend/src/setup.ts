import { getNotifyConfig } from '@platformatic/globals'
export default function setupNestApplication (app) {
  app.setGlobalPrefix('/nested/base/dir/')
  getNotifyConfig()({ basePath: '/nested/base/dir' })
}
