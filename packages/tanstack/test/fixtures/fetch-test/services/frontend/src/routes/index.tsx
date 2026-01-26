import { createFileRoute } from '@tanstack/react-router'

const version = 123

// Loader function to test fetch - runs on the server
export async function loader () {
  const results: Record<string, unknown> = {}

  // Test 1: fetch with string URL
  try {
    const stringUrlResponse = await fetch('http://backend.plt.local/example')
    const stringUrlData = await stringUrlResponse.json()
    results.stringUrl = { ok: stringUrlResponse.ok, data: stringUrlData }
  } catch (err) {
    results.stringUrl = { ok: false, error: String(err) }
  }

  // Test 2: fetch with Request object (tests srvx/undici compatibility)
  try {
    const req = new Request('http://backend.plt.local/example')
    const requestObjectResponse = await fetch(req)
    const requestObjectData = await requestObjectResponse.json()
    results.requestObject = { ok: requestObjectResponse.ok, data: requestObjectData }
  } catch (err) {
    results.requestObject = { ok: false, error: String(err) }
  }

  return results
}

function Home () {
  const data = Route.useLoaderData()

  return (
    <div>
      Hello from v{version}
      <pre id="fetch-results">{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: Home,
  loader
})
