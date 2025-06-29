import { create } from '../../index.js'

const app = await create(process.argv.length > 2 ? process.argv.at(-1) : 'platformatic.service.json')
await app.start({ listen: true })
