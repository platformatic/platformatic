import { readFile } from 'node:fs/promises'
import { MockAgent, setGlobalDispatcher } from 'undici'

const mockAgent = new MockAgent()
mockAgent.disableNetConnect()
setGlobalDispatcher(mockAgent)

// Node.js >= 26 bundles undici >= 8, whose built-in fetch() reads the global
// dispatcher from Symbol.for('undici.globalDispatcher.2'), while undici 7's
// setGlobalDispatcher() only writes Symbol.for('undici.globalDispatcher.1').
// Mirror the mock onto the symbol fetch() reads so it observes the mock too.
globalThis[Symbol.for('undici.globalDispatcher.2')] = mockAgent

const mockPool = mockAgent.get('https://registry.npmjs.org')

mockPool
  .intercept({ path: '@platformatic/runtime' })
  .reply(200, await readFile(new URL('./runtime-info.json', import.meta.url)))
