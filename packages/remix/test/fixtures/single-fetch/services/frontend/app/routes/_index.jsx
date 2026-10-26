import { Link, useLoaderData } from '@remix-run/react'

export function loader () {
  return {
    greeting: 'hello-from-loader',
    date: new Date(0),
    nested: { values: new Set([1, 2, 3]), map: new Map([['key', 'value']]) },
    slow: new Promise(resolve => setTimeout(() => resolve('deferred-value'), 50))
  }
}

export default function Index () {
  const data = useLoaderData()

  return (
    <div>
      <p>{data.greeting}</p>
      <Link to='/other'>Other</Link>
    </div>
  )
}
