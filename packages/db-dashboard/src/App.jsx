import { Navigate, Routes, Route } from 'react-router-dom'
import React, { createContext, useState } from 'react'
import Layout from './components/Layout'
import Home from './pages/Home'
import GraphiQLPage from './pages/GQL'
import ConfigViewer from './pages/ConfigViewer'
import SwaggerViewer from './pages/SwaggerViewer'
import ReactAdmin from './pages/ReactAdmin'

const AppContext = createContext({})
export { AppContext }
function getCurrentUrl () {
  return `${window.location.protocol}//${window.location.host}`
}
function App () {
  const [userName, setUsername] = useState(null)
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
        <Routes>
          <Route path='/' exact element={<Navigate to='/dashboard' />} />
          <Route path='/dashboard' element={<Home />} />
          <Route path='/giql' element={<GraphiQLPage graphqlEndpoint={`${urlPrefix}/graphql`} />} />
          <Route path='/config-view' element={<ConfigViewer />} />
          <Route path='/swagger-docs' element={<SwaggerViewer swaggerDocUrl={`${urlPrefix}/documentation/json`} />} />
          <Route path='/swagger-plt-db-docs' element={<SwaggerViewer swaggerDocUrl={`${urlPrefix}/_admin/documentation/json`} />} />
          <Route path='/react-admin/*' element={<ReactAdmin basename='/react-admin' apiUrl={`${urlPrefix}`} swaggerDocUrl={`${urlPrefix}/documentation/json`} />} />
        </Routes>
      </Layout>
    </AppContext.Provider>
  )
}

export default App
