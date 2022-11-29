import React from 'react'
import { NavLink } from 'react-router-dom'
import './Navbar.css'
import styles from './Navbar.module.css'

function getListItemClass ({ isActive }) {
  return (isActive ? `${styles.selected} ${styles.listItem}` : styles.listItem)
}
export default function Navbar () {
  return (
    <div className={styles.list}>
      <div>
        <NavLink className={getListItemClass} data-testid='dashboard-link' to='/dashboard'>Dashboard</NavLink>
      </div>
      <div>
        <NavLink className={getListItemClass} data-testid='graphiql-link' to='/dashboard/graphiql'>GraphiQL</NavLink>
      </div>
      <div>
        <NavLink className={getListItemClass} data-testid='config-view-link' to='/dashboard/config-view'>Configuration</NavLink>
      </div>
      <div>
        <NavLink className={getListItemClass} data-testid='swagger-view-link' to='/dashboard/openapi'>Entity API Docs</NavLink>
      </div>
      <div>
        <NavLink className={getListItemClass} data-testid='swagger-plt-db-view-link' to='/dashboard/openapi-admin'>Admin API Docs</NavLink>
      </div>
      <div>
        <NavLink className={getListItemClass} data-testid='react-admin-link' to='/dashboard/table-view'>Table View</NavLink>
      </div>
      <div>
        <NavLink className={getListItemClass} data-testid='data-admin-link' to='/dashboard/data-admin'>Data Admin</NavLink>
      </div>
    </div>
  )
}
