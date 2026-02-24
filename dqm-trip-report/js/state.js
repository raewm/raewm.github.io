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
        qaTeam: '',
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

            // Migration for older drafts that didn't have meta.qaTeam separated
            if (window.appState.meta && window.appState.meta.qaTeam === undefined) {
                window.appState.meta.qaTeam = window.appState.originalQaTeam || '';

                // If preparedBy was auto-filled with originalQaTeam in the old version, clear it so the true author can type their name
                if (window.appState.meta.preparedBy === window.appState.originalQaTeam) {
                    window.appState.meta.preparedBy = '';
                }
            }

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

    // Multi-Vessel Schema: Checks are now inside each plant
    // Legacy Schema: Checks are top-level or in 'qaChecks'
    const legacyChecks = jsonData.checks || jsonData.qaChecks || {};

    if (window.appState.plants.length > 0) {
        window.appState.plants.forEach(plant => {
            if (!plant.checks) {
                // If it's a legacy file with only one plant, we can map the top-level checks here
                // Otherwise, it remains as is
                if (window.appState.plants.length === 1) {
                    plant.checks = legacyChecks;
                } else {
                    plant.checks = {};
                }
            }
        });
    }

    // Still keep a reference at top level if needed, but primary source is now plants
    window.appState.qaChecks = legacyChecks;

    window.appState.timeline = meta.timeline || [];
    window.appState.originalGeneralComments = meta.generalComments || '';

    // Handle qaTeam array vs string
    let team = meta.qaTeamMembers || meta.qaTeam || '';
    if (Array.isArray(team)) team = team.join(', ');
    window.appState.originalQaTeam = team;

    window.appState.originalSystemProvider = meta.systemProvider || '';
    window.appState.originalCheckDate = meta.checkDate || '';

    // Auto-populate some meta fields naturally
    if (window.appState.originalQaTeam) {
        window.appState.meta.qaTeam = window.appState.originalQaTeam;
    }
    if (!window.appState.meta.reportDate && window.appState.originalCheckDate) {
        window.appState.meta.reportDate = window.appState.originalCheckDate;
    }

    saveDraft();
}
