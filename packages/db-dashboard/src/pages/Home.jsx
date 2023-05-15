import React from 'react'
import { MAIN_GREEN, MAIN_DARK_BLUE, BOX_SHADOW } from '@platformatic/ui-components/src/components/constants'
import { BorderedBox, Button } from '@platformatic/ui-components'
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
            <Button onClick={onRestartClicked} color={MAIN_DARK_BLUE} backgroundColor={MAIN_GREEN} bordered={false} bold label='Restart Server' hoverEffect={BOX_SHADOW} />
          </div>
        </div>
      </BorderedBox>
      <Metrics />
    </>
  )
}
