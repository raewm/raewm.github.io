/**
 * state.js
 * Centralized State Management for the Trip Report application.
 * Handles normalization of imported JSON data, localStorage persistence, 
 * and user-input metadata.
 */

/**
 * Default structure for a fresh application session.
 */
const defaultState = {
    // Audit data loaded from external JSON
    sourceJson: null,
    plants: [], // Array of plant objects, each containing its own 'checks' map
    qaChecks: {}, // Kept for legacy compatibility (single-vessel audits)
    timeline: [],

    // Read-only snapshots from the source JSON (to prevent data loss if user edits meta)
    originalGeneralComments: '',
    originalQaTeam: '',
    originalSystemProvider: '',
    originalCheckDate: '',

    // User-editable Metadata fields (The "Report Info" tab)
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

    // Catch-all for logic overrides or temporary UI states
    overrides: {}
};

/**
 * The Global Application State object.
 * Accessible across all modules in the Trip Report app.
 */
window.appState = JSON.parse(JSON.stringify(defaultState));

// --- Persistence Methods ---

/**
 * Persists appState to LocalStorage.
 * Note: Large image payloads (Hull Status) might hit the 5MB browser quota.
 */
function saveDraft() {
    try {
        localStorage.setItem('dqmTripReportDraft', JSON.stringify(window.appState));
        console.log("Draft saved to localStorage.");
    } catch (e) {
        console.warn("Could not save draft to localStorage (likely QuotaExceededError). Session state is maintained in RAM.", e);
    }
}

/**
 * Attempts to rehydrate state from LocalStorage.
 * Includes migration logic for legacy drafts.
 * @returns {boolean} True if a draft was found and loaded.
 */
function loadDraft() {
    const saved = localStorage.getItem('dqmTripReportDraft');
    if (saved) {
        try {
            window.appState = JSON.parse(saved);

            // Migration: Older drafts didn't separate report-specific QA team from audit-source QA team.
            if (window.appState.meta && window.appState.meta.qaTeam === undefined) {
                window.appState.meta.qaTeam = window.appState.originalQaTeam || '';

                // Reset preparedBy if it was previously auto-filled by the audit team string
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

/**
 * Resets the application to default state and wipes LocalStorage.
 */
function clearState() {
    window.appState = JSON.parse(JSON.stringify(defaultState));
    localStorage.removeItem('dqmTripReportDraft');
    console.log("State cleared.");
}

/**
 * Normalizes and imports raw JSON data exported from the QA App.
 * Handles both Single-Plant (Legacy) and Multi-Plant (New) schemas.
 * @param {Object} jsonData - The raw export from dqm-qa-app.
 */
function setSourceData(jsonData) {
    window.appState.sourceJson = jsonData;

    // Handle potential nesting of metadata (some exports wrap items under 'metadata')
    const meta = jsonData.metadata || jsonData;

    window.appState.plants = meta.plants || [];

    // Legacy Support Logic:
    // If the file is from an older single-plant app, checks are top-level.
    const legacyChecks = jsonData.checks || jsonData.qaChecks || {};

    if (window.appState.plants.length > 0) {
        window.appState.plants.forEach(plant => {
            if (!plant.checks) {
                // For legacy files with exactly one plant detected, map the root checks to it.
                if (window.appState.plants.length === 1) {
                    plant.checks = legacyChecks;
                } else {
                    plant.checks = {};
                }
            }
        });
    }

    // Capture legacy checks as backup reference
    window.appState.qaChecks = legacyChecks;

    // Map audit timeline and read-only metadata
    window.appState.timeline = meta.timeline || [];
    window.appState.originalGeneralComments = meta.generalComments || '';

    // Normalize QA Team (can be array or string in different versions)
    let team = meta.qaTeamMembers || meta.qaTeam || '';
    if (Array.isArray(team)) team = team.join(', ');
    window.appState.originalQaTeam = team;

    window.appState.originalSystemProvider = meta.systemProvider || '';
    window.appState.originalCheckDate = meta.checkDate || '';

    // Smart-defaults for user metadata based on audit source
    if (window.appState.originalQaTeam) {
        window.appState.meta.qaTeam = window.appState.originalQaTeam;
    }
    if (!window.appState.meta.reportDate && window.appState.originalCheckDate) {
        window.appState.meta.reportDate = window.appState.originalCheckDate;
    }

    saveDraft();
}
