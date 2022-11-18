import { Navigate, Routes, Route } from 'react-router-dom'
import React, { createContext, useState } from 'react'
import { Layout } from '@platformatic/ui-components'
import GraphiQLPage from './pages/GQL'
import ConfigViewer from './pages/ConfigViewer'
import SwaggerViewer from './pages/SwaggerViewer'
import ReactAdmin from './pages/ReactAdmin'
import Dashboard from './components/Dashboard'

import '@platformatic/ui-components/dist/main.css'
import Home from './pages/Home'

const AppContext = createContext({})
export { AppContext }

function getCurrentUrl () {
  return `${window.location.protocol}//${window.location.host}`
}

function App () {
  const [userName, setUsername] = useState('')
  const [logged, setLogged] = useState(false)
  const [adminSecret, setAdminSecret] = useState(null)
  const urlPrefix = import.meta.env.VITE_SERVER_URL || getCurrentUrl()

  return (
    <AppContext.Provider
      value={{
        userName,
        logged,
        setLogged,
        setUsername,
        adminSecret,
        setAdminSecret,
        urlPrefix
      }}
    >

      <Layout>
        <Dashboard>
          <Routes>
            <Route path='/' exact element={<Navigate to='/dashboard' />} />
            <Route path='/dashboard' element={<Home />} />
            <Route path='/dashboard/graphiql' element={<GraphiQLPage graphqlEndpoint={`${urlPrefix}/graphql`} />} />
            <Route path='/dashboard/config-view' element={<ConfigViewer />} />
            <Route path='/dashboard/openapi' element={<SwaggerViewer swaggerDocUrl={`${urlPrefix}/documentation/json`} />} />
            <Route path='/dashboard/openapi-admin' element={<SwaggerViewer swaggerDocUrl={`${urlPrefix}/_admin/documentation/json`} />} />
            <Route path='/dashboard/table-view/*' element={<ReactAdmin basename='/dashboard/table-view' apiUrl={`${urlPrefix}`} swaggerDocUrl={`${urlPrefix}/documentation/json`} />} />
          </Routes>

        </Dashboard>
      </Layout>
    </AppContext.Provider>
  )
}

export default App
