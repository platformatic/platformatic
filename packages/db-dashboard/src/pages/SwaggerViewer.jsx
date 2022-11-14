'use strict'
import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'
import styles from './SwaggerViewer.module.css'
export default function SwaggerViewer (props) {
  const { swaggerDocUrl } = props
  return (
    <div className={styles.container}>
      <SwaggerUI url={swaggerDocUrl} />
    </div>
  )
}
