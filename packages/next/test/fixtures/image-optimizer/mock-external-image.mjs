import { readFile } from 'node:fs/promises'
import { MockAgent } from 'undici'

export default async function createMockInterceptor () {
  const mockAgent = new MockAgent()
  mockAgent.disableNetConnect()

  const mockPool = mockAgent.get('https://example.com')

  mockPool
    .intercept({ path: '/image.png', method: 'GET' })
    .reply(200, await readFile(new URL('./services/fallback/public/platformatic.png', import.meta.url)), {
      headers: { 'content-type': 'image/png' }
    })

  return function (dispatch) {
    return async function mockDispatch (opts, handler) {
      const domain = new URL(opts.origin).hostname.toLowerCase()

      if (domain === 'example.com') {
        return mockAgent.dispatch(opts, handler)
      } else {
        return dispatch(opts, handler)
      }
    }
  }
}
