import { MockAgent, setGlobalDispatcher } from 'undici'

const mockAgent = new MockAgent()
mockAgent.disableNetConnect()
setGlobalDispatcher(mockAgent)

// Node.js >= 26 uses a newer built-in Undici dispatcher than the installed package.
globalThis[Symbol.for('undici.globalDispatcher.2')] = mockAgent

const mockPool = mockAgent.get('https://registry.npmjs.org')

mockPool.intercept({ path: '@platformatic/runtime' }).reply(404, 'Not found.')
