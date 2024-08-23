import { Links, Meta, Outlet, Scripts } from '@remix-run/react'

export default function App() {
  return (
    <html>
      <head>
        <link rel="icon" href="data:image/x-icon;base64,AA" />
        <Meta />
        <Links />
      </head>
      <body>
        <div>Hello from {Date.now()}</div>
        <Outlet />

        <Scripts />
      </body>
    </html>
  )
}
