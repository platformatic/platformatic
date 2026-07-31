import { onEntrypointRequest } from '@platformatic/basic'

await new Promise(resolve => setTimeout(resolve, 500))

export default function setup () {
  onEntrypointRequest(({ addResponseHeader }) => {
    addResponseHeader('x-slow-extension', 'loaded')
  })
}
