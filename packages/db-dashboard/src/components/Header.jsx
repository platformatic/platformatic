import styles from './Header.module.css'
import { AppContext } from '../App'
import React, { useContext } from 'react'
import { Button } from '@platformatic/ui-components'
export default function Header () {
  const { userName, setUsername, logged, setLogged } = useContext(AppContext)
  function onLogoutButtonClicked (event) {
    event.preventDefault()
    setLogged(false)
    setUsername('')
  }
  return (
    <div className={styles.header}>
      <a href='/dashboard' data-testid='header-home-link' className={styles.brand}>
        <img className={styles.logo} src='/images/logo-192x192.png' />
      </a>
      {logged && userName && (
        <Button color='red' primary='false' onClick={onLogoutButtonClicked} label={`Logout ${userName}`} />
      )}
    </div>
  )
}
