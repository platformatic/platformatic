import { MockAgent, setGlobalDispatcher } from 'undici'

const mockAgent = new MockAgent()
mockAgent.disableNetConnect()
setGlobalDispatcher(mockAgent)

const mockPool = mockAgent.get('https://registry.npmjs.org')

mockPool.intercept({ path: '@platformatic/runtime' }).reply(404, 'Not found.')
