import React from 'react'
import ReactDOM from 'react-dom/client'
import ComponentLabelsPortal from './ComponentLabelsPortal'
import ComponentPuzzlePortal from './ComponentPuzzlePortal'
import DiagonalizationStoryPortal from './DiagonalizationStoryPortal'
import DiscoveryMapPortal from './DiscoveryMapPortal'
import FocusSafeFramePortal from './FocusSafeFramePortal'
import LabApp from './LabApp'
import MatrixDeterminantPortal from './MatrixDeterminantPortal'
import MobileRoomBackPortal from './MobileRoomBackPortal'
import ThetaLabelPortal from './ThetaLabelPortal'
import UnitCircleGatewayPortal from './UnitCircleGatewayPortal'
import VectorAdditionPortal from './VectorAdditionPortal'
import WaveTangentPortal from './WaveTangentPortal'
import { installMobileViewport } from './mobileViewport'
import { installMotionClock } from './motionClock'
import './styles.css'
import './labyrinth.css'
import './vector-addition.css'
import './dot-product.css'
import './matrix-determinant.css'
import './unit-circle-gateway.css'
import './component-puzzle.css'
import './vector-mobile-cleanup.css'
import './semantic-fit.css'
import './focus-ui.css'
import './viewport.css'
import './mobile-polish.css'
import './discovery-map.css'
import './discovery-map-v2.css'
import './wave-tangent.css'
import './diagonalization-story.css'

installMotionClock()
installMobileViewport()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LabApp />
    <UnitCircleGatewayPortal />
    <ThetaLabelPortal />
    <FocusSafeFramePortal />
    <ComponentPuzzlePortal />
    <ComponentLabelsPortal />
    <VectorAdditionPortal />
    <MatrixDeterminantPortal />
    <DiagonalizationStoryPortal />
    <MobileRoomBackPortal />
    <WaveTangentPortal />
    <DiscoveryMapPortal />
  </React.StrictMode>,
)
