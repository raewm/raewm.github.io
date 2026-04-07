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
    overrides: {},

    // Per-plant Integration Verification Data Check state.
    // Keyed by plant array index (0, 1, 2…) matching appState.plants.
    // Each value is an object returned by getDefaultDataCheckState() in data-check.js.
    dataCheck: {}
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

            // Migration: Ensure dataCheck map exists (absent in older drafts).
            if (!window.appState.dataCheck) {
                window.appState.dataCheck = {};
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
 * Downloads the current appState as a portable draft .json file.
 * The file can be re-uploaded on any machine to resume work.
 */
function downloadDraft() {
    const envelope = {
        action:  'dqmTripReportDraft',
        version: 1,
        savedAt: new Date().toISOString(),
        state:   window.appState
    };

    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);

    // Derive a meaningful filename from report date or fall back to today
    const dateStr = (window.appState.meta && window.appState.meta.reportDate)
        ? window.appState.meta.reportDate
        : new Date().toISOString().split('T')[0];
    const filename = `dqm-draft-${dateStr}.json`;

    const a = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`Draft downloaded as ${filename}.`);
}

/**
 * Rehydrates appState from a portable draft envelope object.
 * Called by file-loader.js when it detects action === 'dqmTripReportDraft'.
 * @param {Object} envelope - The parsed draft JSON (must include .state).
 * @returns {boolean} True if successfully loaded.
 */
function loadDraftFile(envelope) {
    if (!envelope || !envelope.state) {
        console.error('loadDraftFile: invalid envelope — missing .state');
        return false;
    }

    try {
        window.appState = envelope.state;

        // --- Migration guards (same as loadDraft) ---
        if (window.appState.meta && window.appState.meta.qaTeam === undefined) {
            window.appState.meta.qaTeam = window.appState.originalQaTeam || '';
            if (window.appState.meta.preparedBy === window.appState.originalQaTeam) {
                window.appState.meta.preparedBy = '';
            }
        }
        if (!window.appState.dataCheck) {
            window.appState.dataCheck = {};
        }

        // Also persist to localStorage so the session survives a refresh
        saveDraft();

        console.log(`Draft file loaded (saved at ${envelope.savedAt || 'unknown'}).`);
        return true;
    } catch (e) {
        console.error('loadDraftFile: failed to rehydrate state', e);
        return false;
    }
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
