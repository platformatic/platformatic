import { defineEventHandler, setResponseHeader } from 'nitro/h3'

export default defineEventHandler(event => {
  setResponseHeader(event, 'content-type', 'text/html')
  return '<html><body>Hello from Nitro 3</body></html>'
})
