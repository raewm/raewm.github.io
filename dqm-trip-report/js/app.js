/**
 * app.js
 * Main Orchestration Layer for the DQM Trip Report Generator.
 * Coordinates between UI tabs, file loading, and state persistence.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Component Initialization
    // Each component attaches its own globally-scoped logic and listeners.
    if (typeof initTabs === 'function') initTabs();
    if (typeof initFileLoader === 'function') initFileLoader();
    if (typeof initMetaForm === 'function') initMetaForm();

    // 2. Global Tool-bar Event Listeners

    /**
     * Handle Manual Save to LocalStorage.
     * Provides user feedback via alert on success.
     */
    const saveBtn = document.getElementById('save-draft-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (typeof saveDraft === 'function') saveDraft();
            alert('Draft saved successfully to local storage.');
        });
    }

    /**
     * Handle Session Reset.
     * Clears LocalStorage and reloads the browser to return to zero-state.
     */
    const clearBtn = document.getElementById('clear-data-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all data and start over?')) {
                if (typeof clearState === 'function') clearState();
                location.reload();
            }
        });
    }

    /**
     * Handle Report Generation / Printing.
     * Triggers a final render pass before invoking the browser print dialog.
     */
    const printBtn = document.getElementById('print-btn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            // Ensure the report snapshot reflects current state modifications
            if (typeof renderReport === 'function') renderReport();
            window.print();
        });
    }

    // 3. Automated State Restoration
    /**
     * Attempts to resume previous session from LocalStorage.
     * If a source JSON is found, it automatically transitions the UI to the editor/summary view.
     */
    if (typeof loadDraft === 'function') {
        const restored = loadDraft();
        if (restored && window.appState.sourceJson) {
            console.log("Found existing draft, populating UI...");
            // Transitions the file upload tab to show metadata summary
            if (typeof updateLoadSummaryUI === 'function') updateLoadSummaryUI();
            // Re-initializes the global metadata form with saved values
            if (typeof initMetaForm === 'function') initMetaForm();
            // Rebuild data-check panels from restored state
            if (typeof renderDataCheck === 'function') renderDataCheck();
        }
    }
});
