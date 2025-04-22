import { Links, Meta, Outlet, Scripts } from '@remix-run/react'

const version = 123
globalThis.platformatic.logger?.info('Log from remix App page')

export default function App () {
  return (
    <html>
      <head>
        <link rel='icon' href='data:image/x-icon;base64,AA' />
        <Meta />
        <Links />
      </head>
      <body>
        <div>Hello from v{version}</div>
        <Outlet />

        <Scripts />
      </body>
    </html>
  )
}
