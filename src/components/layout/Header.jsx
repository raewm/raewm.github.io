import React from 'react';
import { useSurvey } from '../../store/SurveyContext';

const Header = () => {
  const { state, dispatch } = useSurvey();

  const handleReset = () => {
    if (window.confirm('Are you sure you want to clear all data and start over?')) {
      dispatch({ type: 'RESET' });
    }
  };

  const handleToggleUnits = () => {
    dispatch({
      type: 'SET_META',
      payload: { displayUnit: state.meta.displayUnit === 'm' ? 'ft' : 'm' }
    });
  };

  return (
    <header className="glass" style={{
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          backgroundColor: 'var(--color-accent)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '18px'
        }}>G</div>
        <div>
          <h1 style={{ fontSize: '18px', lineHeight: 1 }}>Tide Gauge Surveyor</h1>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            v1.0.0 &bull; {state.meta.siteName || 'New Survey'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button className="btn-outline" onClick={handleToggleUnits} style={{ minWidth: '80px' }}>
          Units: {state.meta.displayUnit.toUpperCase()}
        </button>
        <button className="btn-ghost" onClick={handleReset}>
          Reset
        </button>
      </div>
    </header>
  );
};

export default Header;
