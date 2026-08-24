import React from 'react'
import ReactDOM from 'react-dom/client'
import LabApp from './LabApp'
import UnitCircleGatewayPortal from './UnitCircleGatewayPortal'
import VectorAdditionPortal from './VectorAdditionPortal'
import { installMotionClock } from './motionClock'
import './styles.css'
import './labyrinth.css'
import './vector-addition.css'
import './unit-circle-gateway.css'

installMotionClock()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LabApp />
    <UnitCircleGatewayPortal />
    <VectorAdditionPortal />
  </React.StrictMode>,
)
