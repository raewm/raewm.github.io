// state.js
// Manages the global state of the application and handles localStorage persistence

const defaultState = {
    // Loaded from JSON
    sourceJson: null,
    plants: [],
    qaChecks: {},
    timeline: [],
    originalGeneralComments: '',
    originalQaTeam: '',
    originalSystemProvider: '',
    originalCheckDate: '',

    // Meta Tab fields (User input)
    meta: {
        reportDate: new Date().toISOString().split('T')[0],
        preparedBy: '',
        district: '',
        operator: '',
        location: '',
        weather: '',
        discrepancies: '',
        methods: ''
    },

    // Any manual overrides made in the logic
    overrides: {}
};

window.appState = JSON.parse(JSON.stringify(defaultState));

// --- State Methods ---

function saveDraft() {
    try {
        localStorage.setItem('dqmTripReportDraft', JSON.stringify(window.appState));
        console.log("Draft saved to localStorage.");
    } catch (e) {
        console.warn("Could not save draft to localStorage (likely QuotaExceededError from large image payloads). Session state is maintained in RAM.", e);
    }
}

function loadDraft() {
    const saved = localStorage.getItem('dqmTripReportDraft');
    if (saved) {
        try {
            window.appState = JSON.parse(saved);
            console.log("Draft loaded from localStorage.");
            return true;
        } catch (e) {
            console.error("Failed to parse saved draft", e);
        }
    }
    return false;
}

function clearState() {
    window.appState = JSON.parse(JSON.stringify(defaultState));
    localStorage.removeItem('dqmTripReportDraft');
    console.log("State cleared.");
}

function setSourceData(jsonData) {
    window.appState.sourceJson = jsonData;

    // Support both the original dummy format and the true Export format
    const meta = jsonData.metadata || jsonData;

    window.appState.plants = meta.plants || [];
    window.appState.qaChecks = jsonData.checks || jsonData.qaChecks || {};
    window.appState.timeline = meta.timeline || [];
    window.appState.originalGeneralComments = meta.generalComments || '';

    // Handle qaTeam array vs string
    let team = meta.qaTeamMembers || meta.qaTeam || '';
    if (Array.isArray(team)) team = team.join(', ');
    window.appState.originalQaTeam = team;

    window.appState.originalSystemProvider = meta.systemProvider || '';
    window.appState.originalCheckDate = meta.checkDate || '';

    // Auto-populate some meta fields naturally
    if (!window.appState.meta.preparedBy && window.appState.originalQaTeam) {
        window.appState.meta.preparedBy = window.appState.originalQaTeam;
    }
    if (!window.appState.meta.reportDate && window.appState.originalCheckDate) {
        window.appState.meta.reportDate = window.appState.originalCheckDate;
    }

    saveDraft();
}
