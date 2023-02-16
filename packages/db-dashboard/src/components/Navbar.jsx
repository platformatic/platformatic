import React from 'react'
import { NavLink } from 'react-router-dom'
import './Navbar.css'
import styles from './Navbar.module.css'

function getListItemClass ({ isActive }) {
  return (isActive ? `${styles.selected} ${styles.listItem}` : styles.listItem)
}
const dashboardPath = import.meta.env.VITE_DASHBOARD_PATH || '/dashboard'
export default function Navbar () {
  return (
    <div className={styles.list}>
      <div>
        <NavLink className={getListItemClass} data-testid='dashboard-link' to={dashboardPath}>Dashboard</NavLink>
      </div>
      <div>
        <NavLink className={getListItemClass} data-testid='graphiql-link' to={dashboardPath + '/graphiql'}>GraphiQL</NavLink>
      </div>
      <div>
        <NavLink className={getListItemClass} data-testid='config-view-link' to={dashboardPath + '/config-view'}>Configuration</NavLink>
      </div>
      <div>
        <NavLink className={getListItemClass} data-testid='swagger-view-link' to={dashboardPath + '/openapi'}>Entity API Docs</NavLink>
      </div>
      <div>
        <NavLink className={getListItemClass} data-testid='swagger-plt-db-view-link' to={dashboardPath + '/openapi-admin'}>Admin API Docs</NavLink>
      </div>
      <div>
        <NavLink className={getListItemClass} data-testid='react-admin-link' to={dashboardPath + '/table-view'}>Table View</NavLink>
      </div>
    </div>
  )
}
