import React from 'react'
import ReactDOM from 'react-dom/client'
import LabApp from './LabApp'
import './styles.css'
import './labyrinth.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LabApp />
  </React.StrictMode>,
)
