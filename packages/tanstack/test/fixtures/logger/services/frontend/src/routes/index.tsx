import { getLogger } from '@platformatic/globals'
import { createFileRoute } from '@tanstack/react-router'

const logger = getLogger()
logger.info('Log from TanStack App page')
const version = 123

function Home () {
  return <div>Hello from v{version}</div>
}

export const Route = createFileRoute('/')({
  component: Home
})
