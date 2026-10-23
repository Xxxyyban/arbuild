import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Scene3D from '../Three/Scene3D';      // Match your actual folder case ('three' vs 'Three')
import CameraView from '../Three/CameraView';
import CaseModel from '../Three/CaseModel';
import MotherboardModel from '../Three/MotherboardModel';
import Icon from '../components/Icon';
import '../styles/Assemble.css';

export default function ThreeCameraView() {
  const [showCamera, setShowCamera] = useState(false);

  return (
    <div className="assemble" style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* Top Bar with Camera Toggle Button */}
      <header className="assemble__bar" style={{ position: 'relative', zIndex: 10 }}>
        <Link to="/lab" className="assemble__back">
          ← Back to the Build Lab
        </Link>
        
        <div className="assemble__title-group">
          <p className="eyebrow">AR Mode</p>
          <h1>PC Assembly Workspace</h1>
        </div>

        <div className="assemble__actions">
          <button 
            className="assemble__rotate-btn focus-ring"
            onClick={() => setShowCamera(prev => !prev)}
            style={{
              background: showCamera ? '#059669' : 'var(--bg-panel, #1e293b)',
              borderColor: showCamera ? '#34d399' : 'var(--line-trace, rgba(255, 255, 255, 0.1))',
              color: showCamera ? '#ffffff' : 'var(--text-primary, #e2e8f0)'
            }}
          >
            <Icon name="camera" size={16} /> {showCamera ? 'Camera on' : 'Camera off'}
          </button>
        </div>
      </header>

      {/* Viewport Layer with dynamic AR modifier class */}
      <div 
        className={`assemble__viewport ${showCamera ? 'assemble__viewport--ar' : ''}`} 
        style={{ position: 'relative', flex: 1, width: '100%' }}
      >
        
        {/* Conditional Live Camera Feed Background */}
        {showCamera && <CameraView />}

        {/* 3D Canvas Layer - Pass isCameraOn down to Scene3D so desk and grid hide */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
          <Scene3D isCameraOn={showCamera}>
            <CaseModel />
            <group position={[-0.05, 0.25, -0.15]}>
              <MotherboardModel />
            </group>
          </Scene3D>
        </div>
      </div>
    </div>
  );
}