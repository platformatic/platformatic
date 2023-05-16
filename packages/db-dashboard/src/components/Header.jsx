import styles from './Header.module.css'
import { AppContext } from '../App'
import React, { useContext } from 'react'
import { Button } from '@platformatic/ui-components'
import { WHITE, ERROR_RED, BOX_SHADOW } from '@platformatic/ui-components/src/components/constants'

export default function Header () {
  const { userName, setUsername, logged, setLogged, dashboardPath } = useContext(AppContext)
  function onLogoutButtonClicked (event) {
    event.preventDefault()
    setLogged(false)
    setUsername('')
  }
  return (
    <div className={styles.header}>
      <a href={dashboardPath} data-testid='header-home-link' className={styles.brand}>
        <img className={styles.logo} src='/images/00_Platformatic_Squared_Logo_Blue_Transparent_300dpi.png' />
      </a>
      {logged && userName && (
        <Button color={WHITE} backgroundColor={ERROR_RED} onClick={onLogoutButtonClicked} label={`Logout ${userName}`} bold bordered={false} hoverEffect={BOX_SHADOW} />
      )}
    </div>
  )
}
