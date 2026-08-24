import React from 'react'
import ReactDOM from 'react-dom/client'
import LabApp from './LabApp'
import VectorAdditionPortal from './VectorAdditionPortal'
import './styles.css'
import './labyrinth.css'
import './vector-addition.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LabApp />
    <VectorAdditionPortal />
  </React.StrictMode>,
)
