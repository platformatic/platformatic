import styles from './Navbar.module.css'
import { AppContext } from '../App'
import React, { useContext } from 'react'
export default function Navbar () {
  const { userName, setUsername, logged, setLogged } = useContext(AppContext)
  function onLogoutButtonClicked (event) {
    event.preventDefault()
    setLogged(false)
    setUsername(null)
  }
  return (
    <div className={styles.navbar}>
      <a href='/dashboard' data-testid='navbar-home-link' className={styles.brand}>
        <img className={styles.logo} src='/images/logo-192x192.png' />
      </a>
      {logged && (
        <button className='button is-danger is-small' onClick={onLogoutButtonClicked}>Logout {userName}</button>
      )}
    </div>
  )
}
