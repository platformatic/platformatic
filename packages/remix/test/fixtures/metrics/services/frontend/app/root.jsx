import { json } from '@remix-run/node'
import { Links, Meta, Outlet, Scripts, useLoaderData } from '@remix-run/react'

const version = 123

export async function loader () {
  const response = await fetch('http://backend.plt.local/time')
  const { time } = await response.json()

  return json({ time })
}

export default function App () {
  const { time } = useLoaderData()

  return (
    <html>
      <head>
        <link rel='icon' href='data:image/x-icon;base64,AA' />
        <Meta />
        <Links />
      </head>
      <body>
        <div>
          Hello from v{version} t{time}
        </div>
        <Outlet />

        <Scripts />
      </body>
    </html>
  )
}
