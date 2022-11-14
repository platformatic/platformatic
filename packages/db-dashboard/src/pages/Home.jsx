import { Button } from '@platformatic/ui-components'
import React from 'react'
import { notify } from '../utils'
import styles from './Home.module.css'
export default function Home () {
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
    <>
      <h1 className={styles.title}>Welcome to Platformatic DB!</h1>
      <Button onClick={onRestartClicked} primary="true" label="Restart Server"/>
    </>
  )
}
