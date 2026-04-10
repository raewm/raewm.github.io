import React from 'react';
import { useSurvey } from '../../store/SurveyContext';
import { INSTRUMENTS } from '../../constants/instruments';

const Step1_SiteSetup = () => {
  const { state, dispatch } = useSurvey();
  const { meta } = state;

  const handleChange = (e) => {
    const { name, value } = e.target;
    dispatch({
      type: 'SET_META',
      payload: { [name]: value }
    });
  };

  const selectedInstrument = INSTRUMENTS[meta.instrument];

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
      <section className="card">
        <h2 style={{ marginBottom: '24px' }}>Site Metadata</h2>
        
        <div className="input-group">
          <label className="label">Site Name</label>
          <input 
            type="text" 
            name="siteName" 
            value={meta.siteName} 
            onChange={handleChange} 
            placeholder="e.g. Chesapeake Bay Bridge"
          />
        </div>

        <div className="input-group">
          <label className="label">Deployment ID</label>
          <input 
            type="text" 
            name="deploymentId" 
            value={meta.deploymentId} 
            onChange={handleChange} 
            placeholder="e.g. CB-2024-001"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="input-group">
            <label className="label">Survey Date</label>
            <input 
              type="date" 
              name="date" 
              value={meta.date} 
              onChange={handleChange} 
            />
          </div>
          <div className="input-group">
            <label className="label">Operator</label>
            <input 
              type="text" 
              name="operator" 
              value={meta.operator} 
              onChange={handleChange} 
              placeholder="Your initials"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="input-group">
            <label className="label">Latitude (DD)</label>
            <input 
              type="number" 
              step="any" 
              name="lat" 
              value={meta.lat} 
              onChange={handleChange} 
              placeholder="38.983"
            />
          </div>
          <div className="input-group">
            <label className="label">Longitude (DD)</label>
            <input 
              type="number" 
              step="any" 
              name="lon" 
              value={meta.lon} 
              onChange={handleChange} 
              placeholder="-76.483"
            />
          </div>
        </div>
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <section className="card">
          <h2 style={{ marginBottom: '24px' }}>Instrumentation</h2>
          
          <div className="input-group">
            <label className="label">Hardware Model</label>
            <select name="instrument" value={meta.instrument} onChange={handleChange}>
              {Object.values(INSTRUMENTS).map(inst => (
                <option key={inst.id} value={inst.id}>{inst.label}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="label">Instrument Serial Number</label>
            <input 
              type="text" 
              name="instrumentId" 
              value={meta.instrumentId} 
              onChange={handleChange} 
              placeholder="SN #123456"
            />
          </div>

          {selectedInstrument && (
            <div style={{ 
              marginTop: '16px', 
              padding: '16px', 
              backgroundColor: 'rgba(59, 130, 246, 0.05)', 
              borderRadius: 'var(--radius)',
              borderLeft: '4px solid var(--color-accent)'
            }}>
              <h4 style={{ fontSize: '13px', color: 'var(--color-accent)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Field Tip: {selectedInstrument.label}
              </h4>
              <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
                {selectedInstrument.helpText}
              </p>
            </div>
          )}
        </section>

        <section className="card" style={{ flex: 1 }}>
          <h2 style={{ marginBottom: '12px' }}>General Notes</h2>
          <textarea 
            name="notes" 
            value={meta.notes} 
            onChange={handleChange} 
            placeholder="Field conditions, photos taken, benchmark condition..."
            style={{ height: 'calc(100% - 40px)', minHeight: '120px', resize: 'none' }}
          />
        </section>
      </div>
    </div>
  );
};

export default Step1_SiteSetup;
