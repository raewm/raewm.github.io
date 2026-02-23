// file-loader.js
// Handles drag-and-drop and file selection for the JSON report

function initFileLoader() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const loadStatus = document.getElementById('load-status');
    const summaryCard = document.getElementById('loaded-summary');
    const summaryContent = document.getElementById('summary-content');

    // Click to upload
    dropZone.addEventListener('click', () => fileInput.click());

    // Drag and drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', handleFileSelect, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        if (file) processFile(file);
    }

    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) processFile(file);
    }

    function processFile(file) {
        if (!file.name.endsWith('.json')) {
            showStatus('Error: Please upload a valid .json file from the DQM QA App.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.action !== 'dqmQaLogExport') {
                    showStatus('Warning: This file might not be a valid DQM QA App export.', 'warning');
                }

                // Update state
                if (typeof setSourceData === 'function') {
                    setSourceData(data);
                }

                // Also update the form immediately since we might have pulled meta out of JSON
                if (typeof initMetaForm === 'function') {
                    initMetaForm();
                }

                showStatus('File loaded successfully!', 'success');
                displaySummary(data);

            } catch (err) {
                showStatus('Error reading JSON file. Invalid format.', 'error');
                console.error(err);
            }
        };
        reader.readAsText(file);
    }

    function showStatus(msg, type) {
        loadStatus.textContent = msg;
        loadStatus.className = `status-message ${type}`;
        loadStatus.classList.remove('hidden');
        setTimeout(() => loadStatus.classList.add('hidden'), 5000);
    }

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

// Global exposure
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
