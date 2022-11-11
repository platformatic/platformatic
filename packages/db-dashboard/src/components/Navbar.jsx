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
    <nav className='navbar is-white'>
      <div className='container is-flex is-align-items-center is-justify-content-space-between'>
        <div className='navbar-brand'>
          <a className='navbar-item brand-text' href='/dashboard' data-testid='navbar-home-link'>
            <img className={styles.logo} src='/images/logo-192x192.png' /> Platformatic DB
          </a>
        </div>
        {logged && (
          <button className='button is-danger is-small' onClick={onLogoutButtonClicked}>Logout {userName}</button>
        )}
      </div>
    </nav>
  )
}
