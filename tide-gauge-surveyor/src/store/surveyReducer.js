export const initialState = {
  // Step 1 — Site metadata
  meta: {
    siteName: '',
    deploymentId: '',
    date: new Date().toISOString().split('T')[0],
    lat: '',
    lon: '',
    operator: '',
    notes: '',
    instrument: 'HOBO',
    instrumentId: '',
    displayUnit: 'm', // 'm' | 'ft'
  },

  // Step 2 — Datum parameters
  datumParams: {
    targetDatum: 'MLLW',
    geoidModel: '18',
    geoidN: null,
    geoidSource: 'manual',
    vdatumOffset: null,
    vdatumSource: 'manual',
    closureTolerance: 0.020,
  },

  // Step 3 — List of measurement legs
  legs: [],
  
  // App state
  currentStep: 1,
};

export function surveyReducer(state, action) {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
      
    case 'SET_META':
      return { 
        ...state, 
        meta: { ...state.meta, ...action.payload } 
      };
      
    case 'SET_DATUM_PARAMS':
      return { 
        ...state, 
        datumParams: { ...state.datumParams, ...action.payload } 
      };
      
    case 'ADD_LEG':
      return { 
        ...state, 
        legs: [...state.legs, { ...action.payload, id: `leg-${Date.now()}` }] 
      };
      
    case 'UPDATE_LEG':
      return {
        ...state,
        legs: state.legs.map(leg => 
          leg.id === action.payload.id ? { ...leg, ...action.payload.updates } : leg
        ),
      };
      
    case 'REMOVE_LEG':
      return {
        ...state,
        legs: state.legs.filter(leg => leg.id !== action.payload),
      };
      
    case 'RESET':
      return initialState;
      
    case 'LOAD_SESSION':
      return action.payload;
      
    default:
      return state;
  }
}
