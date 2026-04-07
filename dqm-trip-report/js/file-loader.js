/**
 * file-loader.js
 * Ingestion module for the Trip Report application.
 * Handles drag-and-drop or file-picker selection of .json audit exports.
 */

function initFileLoader() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const loadStatus = document.getElementById('load-status');
    const summaryCard = document.getElementById('loaded-summary');
    const summaryContent = document.getElementById('summary-content');

    // 1. Interaction Setup
    dropZone.addEventListener('click', () => fileInput.click());

    // Drag and drop event orchestration
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Visual feedback for drag states
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', handleFileSelect, false);

    // 2. Data Ingestion Handlers

    /**
     * Entry point for dropped files.
     */
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        if (file) processFile(file);
    }

    /**
     * Entry point for standard file input selection.
     */
    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) processFile(file);
    }

    /**
     * Validates and reads the JSON file contents.
     * Accepts two file types — dispatched by the 'action' field:
     *   'dqmTripReportDraft' → portable draft saved via downloadDraft()
     *   anything else        → QA App export (existing path via setSourceData)
     * @param {File} file - The raw browser File object.
     */
    function processFile(file) {
        if (!file.name.endsWith('.json')) {
            showStatus('Error: Please upload a valid .json file.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                // --- Branch: portable Trip Report draft ---
                if (data.action === 'dqmTripReportDraft') {
                    const ok = (typeof loadDraftFile === 'function') && loadDraftFile(data);
                    if (!ok) {
                        showStatus('Error: Could not restore draft. File may be corrupted.', 'error');
                        return;
                    }

                    // Refresh all UI components from the restored state
                    if (typeof updateLoadSummaryUI === 'function') updateLoadSummaryUI();
                    if (typeof initMetaForm      === 'function') initMetaForm();
                    if (typeof renderDataCheck   === 'function') renderDataCheck();

                    showStatus('Draft restored successfully!', 'success');

                    // Re-display summary using the embedded sourceJson
                    if (window.appState.sourceJson) displaySummary(window.appState.sourceJson);
                    return;
                }

                // --- Branch: QA App export (original path) ---
                if (data.action !== 'dqmQaLogExport') {
                    showStatus('Warning: This file might not be a valid DQM QA App export.', 'warning');
                }

                if (typeof setSourceData === 'function') setSourceData(data);
                if (typeof initMetaForm  === 'function') initMetaForm();
                if (typeof renderDataCheck === 'function') renderDataCheck();

                showStatus('File loaded successfully!', 'success');
                displaySummary(data);

            } catch (err) {
                showStatus('Error reading JSON file. Invalid format.', 'error');
                console.error(err);
            }
        };
        reader.readAsText(file);
    }

    /**
     * Displays transient status messages to the user.
     * @param {string} msg - The text to display.
     * @param {string} type - 'success', 'warning', or 'error' (affects CSS class).
     */
    function showStatus(msg, type) {
        loadStatus.textContent = msg;
        loadStatus.className = `status-message ${type}`;
        loadStatus.classList.remove('hidden');
        setTimeout(() => loadStatus.classList.add('hidden'), 5000);
    }

    /**
     * Renders a brief summary of the loaded audit file to the Load Tab.
     * Useful for verifying the correct file was selected before generating the report.
     * @param {Object} data - The parsed audit JSON.
     */
    function displaySummary(data) {
        const meta = data.metadata || data;
        const plants = meta.plants || [];
        const date = meta.checkDate || 'Unknown';

        let qaTeam = meta.qaTeamMembers || meta.qaTeam || 'Unknown';
        if (Array.isArray(qaTeam)) qaTeam = qaTeam.join(', ');

        let html = `
            <div><strong>Original Date:</strong> ${date}</div>
            <div><strong>QA Team:</strong> ${qaTeam}</div>
            <div><strong>Plants Included:</strong> ${plants.length}</div>
        `;

        if (plants.length > 0) {
            html += `<div style="grid-column: 1 / -1; margin-top: 10px;"><ul>`;
            plants.forEach(p => {
                html += `<li>${p.name} - ${p.vesselType} (${p.profile})</li>`;
            });
            html += `</ul></div>`;
        }

        summaryContent.innerHTML = html;
        summaryCard.classList.remove('hidden');
    }
}

/**
 * Global helper to refresh the summary UI without re-loading the whole file.
 * Used during state restoration (loadDraft).
 */
window.updateLoadSummaryUI = function () {
    if (window.appState && window.appState.sourceJson) {
        const summaryCard = document.getElementById('loaded-summary');
        const summaryContent = document.getElementById('summary-content');

        let data = window.appState.sourceJson;
        const meta = data.metadata || data;

        let qaTeam = meta.qaTeamMembers || meta.qaTeam || '';
        if (Array.isArray(qaTeam)) qaTeam = qaTeam.join(', ');

        let html = `
            <div><strong>Original Date:</strong> ${meta.checkDate || ''}</div>
            <div><strong>QA Team:</strong> ${qaTeam}</div>
            <div><strong>Plants Included:</strong> ${(meta.plants || []).length}</div>
        `;
        summaryContent.innerHTML = html;
        summaryCard.classList.remove('hidden');
    }
};
