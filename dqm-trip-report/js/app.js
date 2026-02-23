// app.js
// Main entry point for the DQM Trip Report app

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize logic
    if (typeof initTabs === 'function') initTabs();
    if (typeof initFileLoader === 'function') initFileLoader();
    if (typeof initMetaForm === 'function') initMetaForm();

    // 2. Global buttons
    const saveBtn = document.getElementById('save-draft-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (typeof saveDraft === 'function') saveDraft();
            alert('Draft saved successfully to local storage.');
        });
    }

    const clearBtn = document.getElementById('clear-data-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all data and start over?')) {
                if (typeof clearState === 'function') clearState();
                location.reload();
            }
        });
    }

    const printBtn = document.getElementById('print-btn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            // Ensure render is up to date before printing
            if (typeof renderReport === 'function') renderReport();
            window.print();
        });
    }

    // 3. Try to restore draft on load
    if (typeof loadDraft === 'function') {
        const restored = loadDraft();
        if (restored && window.appState.sourceJson) {
            console.log("Found existing draft, populating UI...");
            // Jump to load summary
            if (typeof updateLoadSummaryUI === 'function') updateLoadSummaryUI();
            if (typeof initMetaForm === 'function') initMetaForm();
        }
    }
});
