import React from 'react';
import { useSurvey } from '../../store/SurveyContext';

const steps = [
  { id: 1, label: 'Site Setup' },
  { id: 2, label: 'Datum Setup' },
  { id: 3, label: 'Measurements' },
  { id: 4, label: 'Report' },
];

const StepIndicator = () => {
  const { state, dispatch } = useSurvey();
  const currentStep = state.currentStep;

  const goToStep = (id) => {
    // Only allow jumping back, or jumping forward if the current step is "complete" 
    // (for MVP, we just allow any navigation for testing)
    dispatch({ type: 'SET_STEP', payload: id });
  };

  return (
    <nav style={{
      padding: '24px',
      display: 'flex',
      justifyContent: 'center',
      borderBottom: '1px solid var(--color-border)'
    }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', maxWidth: '800px', width: '100%' }}>
        {steps.map((step, idx) => {
          const isActive = step.id === currentStep;
          const isPast = step.id < currentStep;

          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => goToStep(step.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--color-accent)' : isPast ? 'var(--color-success)' : 'var(--color-border)',
                  color: isActive ? 'var(--color-accent)' : isPast ? 'var(--color-success)' : 'var(--color-text-muted)',
                  textAlign: 'left',
                }}
              >
                <span style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: isActive ? 'var(--color-accent)' : isPast ? 'var(--color-success)' : 'var(--color-surface-2)',
                  color: '#fff',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                }}>
                  {isPast ? '✓' : step.id}
                </span>
                <span style={{ fontSize: '14px', fontWeight: isActive ? '600' : '400' }}>
                  {step.label}
                </span>
              </button>
              {idx < steps.length - 1 && (
                <div style={{ width: '20px', height: '1px', backgroundColor: 'var(--color-border)' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};

export default StepIndicator;
