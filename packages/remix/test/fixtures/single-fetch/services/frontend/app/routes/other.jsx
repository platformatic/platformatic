import { useLoaderData } from '@remix-run/react'

export function loader () {
  return { message: 'hello-from-other' }
}

export default function Other () {
  return <p>{useLoaderData().message}</p>
}
