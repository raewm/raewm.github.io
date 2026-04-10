import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { surveyReducer, initialState } from './surveyReducer';

const SurveyContext = createContext();

export const SurveyProvider = ({ children }) => {
  const [state, dispatch] = useReducer(surveyReducer, initialState, (initial) => {
    const saved = localStorage.getItem('tide_gauge_survey_auto_save');
    return saved ? JSON.parse(saved) : initial;
  });

  // Auto-save to localStorage
  useEffect(() => {
    localStorage.setItem('tide_gauge_survey_auto_save', JSON.stringify(state));
  }, [state]);

  return (
    <SurveyContext.Provider value={{ state, dispatch }}>
      {children}
    </SurveyContext.Provider>
  );
};

export const useSurvey = () => {
  const context = useContext(SurveyContext);
  if (!context) {
    throw new Error('useSurvey must be used within a SurveyProvider');
  }
  return context;
};
