import { readFile } from 'node:fs/promises'
import { MockAgent, setGlobalDispatcher } from 'undici'

const mockAgent = new MockAgent()
mockAgent.disableNetConnect()
setGlobalDispatcher(mockAgent)

const mockPool = mockAgent.get('https://registry.npmjs.org')

mockPool
  .intercept({ path: '@platformatic/runtime' })
  .reply(200, await readFile(new URL('./runtime-info.json', import.meta.url)))
