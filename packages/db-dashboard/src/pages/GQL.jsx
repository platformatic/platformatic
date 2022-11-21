import GraphiQL from 'graphiql'
import React, { useContext } from 'react'
import { createGraphiQLFetcher } from '@graphiql/toolkit'
import { AppContext } from '../App'
import 'graphiql/graphiql.css'
import styles from './GQL.module.css'

export default function GraphiQLPage (props) {
  const { adminSecret } = useContext(AppContext)
  const { graphqlEndpoint } = props
  const fetcher = getFetcher(graphqlEndpoint)
  return (
    <>
      <div className={`block ${styles.graphiql}`}>
        <GraphiQL
          headers={
            adminSecret
              ? `{ "X-PLATFORMATIC-ADMIN-SECRET": "${adminSecret}" }`
              : ''
          }
          fetcher={fetcher}
          headerEditorEnabled
          shouldPersistHeaders
        >
          <GraphiQL.Logo>
            <img className={styles['graphiql-plt-logo']} src='/images/logo-192x192.png' height={34} />
          </GraphiQL.Logo>
        </GraphiQL>
      </div>
    </>
  )
}

function getFetcher (endpoint) {
  const parsedUrl = new URL(endpoint)
  const host = parsedUrl.host

  const websocketProtocol = parsedUrl.protocol === 'https:' ? 'wss:' : 'ws:'

  const url = `${parsedUrl.protocol}//${host}${parsedUrl.pathname}`
  const subscriptionUrl = `${websocketProtocol}//${host}${parsedUrl.pathname}`

  const fetcher = createGraphiQLFetcher({
    url,
    subscriptionUrl
  })
  return fetcher
}
