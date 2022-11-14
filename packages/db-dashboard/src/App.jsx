import { Navigate, Routes, Route } from 'react-router-dom'
import { createContext, useState } from 'react'
import {Button, Layout, TabbedWindow} from '@platformatic/ui-components'
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
function App (props) {
  const [userName, setUsername] = useState(null)
  const [logged, setLogged] = useState(false)
  const [adminSecret, setAdminSecret] = useState(null)
  const urlPrefix = import.meta.env.VITE_SERVER_URL || getCurrentUrl()

  const tabs = [
    {
      label: 'Main',
      component: () => <Button onClick={onRestartClicked} primary="true" label="Restart Server"/>
    },
    {
      label: 'Configuration',
      component: () => <ConfigViewer />
    },
    { 
      label: 'GraphiQL',
      component: () => <GraphiQLPage graphqlEndpoint={`${urlPrefix}/graphql`} />
    },
    { 
      label: 'Swagger Docs',
      component: () => <SwaggerViewer swaggerDocUrl={`${urlPrefix}/documentation/json`} />
    },
    { 
      label: 'React Admin',
      component: () => <ReactAdmin basename='/react-admin' apiUrl={`${urlPrefix}`} swaggerDocUrl={`${urlPrefix}/documentation/json`} />
    },
    {
      label: 'Admin API Docs',
      component: () => <SwaggerViewer swaggerDocUrl={`${urlPrefix}/_admin/documentation/json`} />
    }
  ]

  async function onRestartClicked () {
    const res = await fetch('/_admin/restart', {
      method: 'POST'
    })
    if (res.status === 200) {
      notify({
        message: 'Server restarted',
        type: 'success'
      })
    } else {
      notify({
        message: 'There was an error...',
        type: 'error'
      })
    }
  }
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
            <Route path='/giql' element={<GraphiQLPage graphqlEndpoint={`${urlPrefix}/graphql`} />} />
            <Route path='/config-view' element={<ConfigViewer />} />
            <Route path='/swagger-docs' element={<SwaggerViewer swaggerDocUrl={`${urlPrefix}/documentation/json`} />} />
            <Route path='/swagger-plt-db-docs' element={<SwaggerViewer swaggerDocUrl={`${urlPrefix}/_admin/documentation/json`} />} />
            <Route path='/react-admin/*' element={<ReactAdmin basename='/react-admin' apiUrl={`${urlPrefix}`} swaggerDocUrl={`${urlPrefix}/documentation/json`} />} />
          </Routes>

          {/* <TabbedWindow tabs={tabs}/> */}
        </Dashboard>
      </Layout>
    </AppContext.Provider>
  )
}

export default App
