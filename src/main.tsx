import React from 'react'
import ReactDOM from 'react-dom/client'
import ComponentLabelsPortal from './ComponentLabelsPortal'
import ComponentPuzzlePortal from './ComponentPuzzlePortal'
import FocusSafeFramePortal from './FocusSafeFramePortal'
import LabApp from './LabApp'
import ThetaLabelPortal from './ThetaLabelPortal'
import UnitCircleGatewayPortal from './UnitCircleGatewayPortal'
import VectorAdditionPortal from './VectorAdditionPortal'
import { installMotionClock } from './motionClock'
import './styles.css'
import './labyrinth.css'
import './vector-addition.css'
import './unit-circle-gateway.css'
import './component-puzzle.css'
import './viewport.css'
import './semantic-fit.css'
import './focus-ui.css'

installMotionClock()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LabApp />
    <UnitCircleGatewayPortal />
    <ThetaLabelPortal />
    <FocusSafeFramePortal />
    <ComponentPuzzlePortal />
    <ComponentLabelsPortal />
    <VectorAdditionPortal />
  </React.StrictMode>,
)
