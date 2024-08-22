import { version } from '../../../../../tmp/version.js'

export default async function Home () {
  const response = await fetch('http://service.plt.local/time')
  const { time } = await response.json()

  return (
    <div>
      Hello from v{version} t{time}
    </div>
  )
}
