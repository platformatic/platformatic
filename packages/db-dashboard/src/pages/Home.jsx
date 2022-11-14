import { BorderedBox, Button } from '@platformatic/ui-components'
import React from 'react'
import { notify } from '../utils'
import styles from './Home.module.css'
import Metrics from '../components/metrics/Metrics'
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
      <BorderedBox>
        <div className={styles.actionsContainer}>
          <div className={styles.title}>
            <h1>Welcome to Platformatic DB!</h1>
          </div>
          <div className={styles.actions}>
            <Button onClick={onRestartClicked} primary='true' label='Restart Server' />
          </div>
        </div>
      </BorderedBox>
      <Metrics />
    </>
  )
}
