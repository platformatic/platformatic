import { getLogger } from '@platformatic/globals'

const logger = getLogger()

export default function Home() {
  logger.debug('Home page called')

  return (
    <main>
      <div>Hello World!</div>
    </main>
  )
}
