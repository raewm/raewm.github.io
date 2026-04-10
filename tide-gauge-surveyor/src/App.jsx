import React from 'react';
import Header from './components/layout/Header';
import StepIndicator from './components/layout/StepIndicator';
import { useSurvey } from './store/SurveyContext';

// Step components
import Step1_SiteSetup from './components/steps/Step1_SiteSetup';

const Step2 = () => <div className="animate-fade-in"><div className="card"><h2>Datum Setup</h2><p className="label" style={{marginTop:'20px'}}>Coming soon in Phase 2</p></div></div>;
const Step3 = () => <div className="animate-fade-in"><div className="card"><h2>Measurements</h2><p className="label" style={{marginTop:'20px'}}>Coming soon in Phase 2</p></div></div>;
const Step4 = () => <div className="animate-fade-in"><div className="card"><h2>Report</h2><p className="label" style={{marginTop:'20px'}}>Coming soon in Phase 2</p></div></div>;

function App() {
  const { state, dispatch } = useSurvey();
  const { currentStep } = state;

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <Step1_SiteSetup />;
      case 2: return <Step2 />;
      case 3: return <Step3 />;
      case 4: return <Step4 />;
      default: return <Step1_SiteSetup />;
    }
  };

  const goToNext = () => dispatch({ type: 'SET_STEP', payload: currentStep + 1 });
  const goToPrev = () => dispatch({ type: 'SET_STEP', payload: currentStep - 1 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <StepIndicator />
      
      <main className="container" style={{ flex: 1, padding: '40px 24px' }}>
        {renderStep()}

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '40px',
          paddingTop: '20px',
          borderTop: '1px solid var(--color-border)'
        }}>
          <button 
            className="btn-outline" 
            onClick={goToPrev} 
            disabled={currentStep === 1}
          >
            Previous
          </button>
          <button 
            className="btn-primary" 
            onClick={goToNext} 
            disabled={currentStep === 4}
          >
            Next
          </button>
        </div>
      </main>

      <footer style={{ padding: '24px', textAlign: 'center', borderTop: '1px solid var(--color-border)' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
          &copy; {new Date().getFullYear()} Tide Gauge Surveyor &bull; Senior Principal Engineer Edition
        </p>
      </footer>
    </div>
  );
}

export default App;
