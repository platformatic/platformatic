import Navbar from './Navbar'
import React, { Fragment, useContext, useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import styles from './Dashboard.module.css'
import { Toaster } from 'react-hot-toast'
import LoginBox from './LoginBox'
import { AppContext } from '../App'
export default function Dashboard (props) {
  const [loaded, setLoaded] = useState(false)
  const { logged, setLogged, urlPrefix } = useContext(AppContext)
  useEffect(() => {
    async function getConfig () {
      const apiUrl = `${urlPrefix}/_admin/config`
      const response = await fetch(apiUrl)
      if (response.status === 200) {
        const body = await response.json()
        if (body.loginRequired !== true) {
          setLogged(true)
        }
        setLoaded(true)
      }
    }
    getConfig()
  }, [])
  if (!loaded) {
    return <h1>Dashboard is Loading</h1>
  }
  if (logged) {
    return (
      <>
        <Navbar />
        <div className={styles.container}>
          <div className={styles.sidebar}>
            <Sidebar />
          </div>

          <div className={styles.main}>
            <main>
              <div className='notifications'>
                <Toaster />
              </div>
              <div>
                <div>{props.children}</div>
              </div>
            </main>
          </div>
        </div>
      </>
    )
  } else {
    return (
      <LoginBox />
    )
  }
}
