import { readFile } from 'node:fs/promises'

export default async function (app) {
  app.get('/', async () => {
    return readFile(process.env.PLT_TESTS_TEMPLATE_FILE, 'utf8')
  })

  return app
}
