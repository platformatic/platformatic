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
  const dashboardPath = import.meta.env.VITE_DASHBOARD_PATH || '/dashboard'

  return (
    <AppContext.Provider
      value={{
        userName,
        logged,
        setLogged,
        setUsername,
        adminSecret,
        setAdminSecret,
        urlPrefix,
        dashboardPath
      }}
    >

      <Layout>
        <Dashboard>
          <Routes>
            <Route path='/' exact element={<Navigate to={dashboardPath} />} />
            <Route path={dashboardPath} element={<Home />} />
            <Route path={dashboardPath + '/graphiql'} element={<GraphiQLPage graphqlEndpoint={`${urlPrefix}/graphql`} />} />
            <Route path={dashboardPath + '/config-view'} element={<ConfigViewer />} />
            <Route path={dashboardPath + '/openapi'} element={<SwaggerViewer swaggerDocUrl={`${urlPrefix}/documentation/json`} />} />
            <Route path={dashboardPath + '/openapi-admin'} element={<SwaggerViewer swaggerDocUrl={`${urlPrefix}/_admin/documentation/json`} />} />
            <Route path={dashboardPath + '/table-view/*'} element={<ReactAdmin basename={dashboardPath + '/table-view'} apiUrl={`${urlPrefix}`} swaggerDocUrl={`${urlPrefix}/documentation/json`} />} />
          </Routes>

        </Dashboard>
      </Layout>
    </AppContext.Provider>
  )
}

export default App
