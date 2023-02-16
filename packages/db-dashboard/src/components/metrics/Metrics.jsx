import React, { useEffect, useState } from 'react'
import TotalMetric from './TotalMetric'

function getCurrentUrl () {
  return `${window.location.protocol}//${window.location.host}`
}
const urlPrefix = import.meta.env.VITE_SERVER_URL || getCurrentUrl()
const dashboardPath = import.meta.env.VITE_DASHBOARD_PATH || '/dashboard'
export default function Metrics () {
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    async function getMetrics () {
      const res = await fetch(`${urlPrefix}${dashboardPath}/metrics`, { method: 'GET' })
      if (res.status === 200) {
        const data = await res.json()
        setMetrics(data)
      }
    }
    getMetrics()
    const intervalId = setInterval(getMetrics, 5000)
    return () => {
      clearInterval(intervalId)
    }
  }, [])

  if (!metrics || metrics.error) return
  return <TotalMetric metrics={metrics} />
}
