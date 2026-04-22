/**
 * Application State for DQM QA App 2.
 * Focuses on a single-modal, multi-plant workflow.
 */
const appState = {
    plants: [],
    checkDate: '',
    weatherConditions: '',
    qaTeam: '',
    systemProvider: '',
    timeline: [],
    generalComments: '',
    activeCheckType: null, // Tracks which check is currently open in the modal
    activePlantIndex: null // Tracks which plant the active check belongs to
};

let isRestoring = false; // Flag to prevent "empty scraping" during initial DOM reconstruction

/**
 * Vessel Configuration & Profile Mappings.
 * Defines which QA checks are required for each vessel type/profile combination.
 */
const vesselProfiles = {
    'Scow': ['Monitoring', 'Ullage'],
    'Hopper Dredge': ['Standard'],
    'Pipeline Dredge': ['Standard', 'Small Business'],
    'Mechanical Dredge': ['Standard']
};

/**
 * Mapping of Profile combinations to specific Check IDs.
 */
const requiredChecks = {
    'Scow-Monitoring': ['positionCheck', 'hullStatus', 'draftSensorLightFwd', 'draftSensorLightAft', 'draftSensorLoadedFwd', 'draftSensorLoadedAft'],
    'Scow-Ullage': ['positionCheck', 'hullStatus', 'draftSensorLightFwd', 'draftSensorLightAft', 'draftSensorLoadedFwd', 'draftSensorLoadedAft', 'ullageLightFwd', 'ullageLightAft', 'ullageLoadedFwd', 'ullageLoadedAft'],
    'Hopper Dredge-Standard': ['positionCheck', 'hullStatus', 'draftSensorLightFwd', 'draftSensorLightAft', 'draftSensorLoadedFwd', 'draftSensorLoadedAft', 'ullageLightFwd', 'ullageLightAft', 'ullageLoadedFwd', 'ullageLoadedAft', 'dragheadDepth'],
    'Pipeline Dredge-Standard': ['positionCheck', 'suctionMouthDepth', 'velocity'],
    'Pipeline Dredge-Small Business': ['positionCheck', 'suctionMouthDepth'],
    'Mechanical Dredge-Standard': ['positionCheck', 'bucketDepth', 'bucketPosition']
};

/**
 * Human-readable display names for QA checks.
 */
const checkNames = {
    'positionCheck': 'Position Check',
    'hullStatus': 'Hull Status Check',
    'draftSensorLightFwd': 'Draft Sensor Check (Light - Forward)',
    'draftSensorLightAft': 'Draft Sensor Check (Light - Aft)',
    'draftSensorLoadedFwd': 'Draft Sensor Check (Loaded - Forward)',
    'draftSensorLoadedAft': 'Draft Sensor Check (Loaded - Aft)',
    'ullageLightFwd': 'Ullage Check (Light - Forward)',
    'ullageLightAft': 'Ullage Check (Light - Aft)',
    'ullageLoadedFwd': 'Ullage Check (Loaded - Forward)',
    'ullageLoadedAft': 'Ullage Check (Loaded - Aft)',
    'dragheadDepth': 'Draghead Depth Check',
    'suctionMouthDepth': 'Suction Mouth Depth Check',
    'velocity': 'Velocity Check',
    'bucketDepth': 'Bucket/Grab Depth Check',
    'bucketPosition': 'Bucket Position Check'
};

// ===== Initialization =====

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    
    // Inject version
    const versionEl = document.getElementById('app-version');
    if (versionEl && typeof APP_VERSION !== 'undefined') versionEl.textContent = `v${APP_VERSION}`;

    // 1. Load data FIRST before doing ANY initialization that might trigger a save
    loadDraft();

    // 2. Perform UI setup and add default plant ONLY if nothing was loaded
    initializeApp();

    // 3. Prevent data loss on accidental navigation
    window.addEventListener('beforeunload', handleBeforeUnload);
});

/**
 * Global listener to ensure state is persisted before the window closes.
 */
function handleBeforeUnload() {
    saveDraft();
}

/**
 * Initializes the theme from localStorage.
 */
function initTheme() {
    const theme = localStorage.getItem('dqm-theme') || 'dark';
    if (theme === 'light') {
        document.body.classList.add('light-mode');
        const icon = document.getElementById('theme-toggle-icon');
        if (icon) icon.textContent = '☀️';
    }

    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleTheme);
    }
}

/**
 * Toggles between light and dark mode.
 */
function toggleTheme() {
    const body = document.body;
    const icon = document.getElementById('theme-toggle-icon');

    body.classList.toggle('light-mode');

    const isLight = body.classList.contains('light-mode');
    localStorage.setItem('dqm-theme', isLight ? 'light' : 'dark');

    if (icon) {
        icon.textContent = isLight ? '☀️' : '🌙';
    }
}

/**
 * Sets up global event listeners and initializes default state.
 */
function initializeApp() {
    // Set default date to today if not already set by loadDraft
    if (!document.getElementById('check-date').value) {
        document.getElementById('check-date').valueAsDate = new Date();
    }

    // Event Listeners: Main Global Actions
    document.getElementById('add-plant-btn').addEventListener('click', addPlant);
    document.getElementById('save-draft-btn').addEventListener('click', () => {
        saveDraft();
        showToast('Draft Saved');
    });
    document.getElementById('export-btn').addEventListener('click', exportJSON);
    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-file-input').value = ''; // Reset so same file can be re-selected
        document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', importJSON);
    document.getElementById('clear-btn').addEventListener('click', () => {
        if (confirm('Clear all data?')) {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            localStorage.removeItem('dqm-window-qa-draft');
            location.reload();
        }
    });

    // Event Listeners: State Syncing (Global Header Fields)
    ['check-date', 'weather-conditions', 'qa-team', 'system-provider', 'general-comments'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateAppState);
    });

    // Modal & Overlay Interaction Events
    document.getElementById('add-qa-btn').addEventListener('click', openPicker);
    document.getElementById('add-comment-btn').addEventListener('click', addTimelineComment);
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('modal-log-btn').addEventListener('click', logActiveCheckToTimeline);

    // Overlay click-to-close logic
    document.getElementById('picker-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'picker-overlay') closePicker();
    });
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'modal-overlay') closeModal();
    });

    // Start with at least one plant if none loaded from draft
    if (appState.plants.length === 0) addPlant();

    renderTimeline();
}

/**
 * Shows a brief visual notification to the user.
 * @param {string} message - Text to display.
 */
function showToast(message) {
    let toast = document.getElementById('save-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'save-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: #28a745;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            transition: opacity 0.3s, transform 0.3s;
            pointer-events: none;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    clearTimeout(toast.hideTimeout);
    toast.hideTimeout = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
    }, 2000);
}

/**
 * Appends a comment entry to the timeline from a prompt.
 */
function addTimelineComment() {
    const notes = prompt('Enter timeline comment:');
    if (notes && notes.trim()) {
        const entry = {
            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
            activity: 'Comment',
            notes: notes.trim(),
            timestamp: new Date().toISOString()
        };
        appState.timeline.push(entry);
        renderTimeline();
        saveDraft();
    }
}

/**
 * Syncs global application metadata from the header inputs to appState.
 */
function updateAppState() {
    appState.checkDate = document.getElementById('check-date').value;
    appState.weatherConditions = document.getElementById('weather-conditions').value;
    appState.qaTeam = document.getElementById('qa-team').value;
    appState.systemProvider = document.getElementById('system-provider').value;
    appState.generalComments = document.getElementById('general-comments').value;
    saveDraft();
}

// ===== Plant Management =====

let plantCounter = 0;

/**
 * Dynamically adds a new plant entry row to the UI.
 */
function addPlant() {
    plantCounter++;
    const container = document.getElementById('plants-container');
    const plantEntry = document.createElement('div');
    plantEntry.className = 'plant-entry';
    plantEntry.dataset.plantId = plantCounter;

    plantEntry.innerHTML = `
        <div class="plant-header">
            <span class="plant-number">Plant #${plantCounter}</span>
            ${plantCounter > 1 ? '<button type="button" class="remove-plant-btn" onclick="removePlant(this)">✕ Remove</button>' : ''}
        </div>
        <div class="form-group">
            <input type="text" class="plant-name" placeholder="Vessel Name" required>
        </div>
        <div class="input-row">
            <select class="vessel-type" onchange="updateProfileOptions(this)">
                <option value="">Type...</option>
                <option value="Scow">Scow</option>
                <option value="Hopper Dredge">Hopper</option>
                <option value="Pipeline Dredge">Pipeline</option>
                <option value="Mechanical Dredge">Mechanical</option>
            </select>
            <select class="vessel-profile" disabled>
                <option value="">Profile...</option>
            </select>
        </div>
    `;

    container.appendChild(plantEntry);
    plantEntry.querySelectorAll('input, select').forEach(el => el.addEventListener('change', updatePlants));
    updatePlants();
}

/**
 * Removes a plant entry row and refreshes the state.
 */
function removePlant(btn) {
    btn.closest('.plant-entry').remove();
    updatePlants();
}

/**
 * Refreshes profile dropdown based on selected vessel type.
 */
function updateProfileOptions(select) {
    const type = select.value;
    const plantEntry = select.closest('.plant-entry');
    const profileSelect = plantEntry.querySelector('.vessel-profile');
    profileSelect.innerHTML = '<option value="">Profile...</option>';
    if (type && vesselProfiles[type]) {
        profileSelect.disabled = false;
        vesselProfiles[type].forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            profileSelect.appendChild(opt);
        });

        // Restore last selected profile for this vessel type if available
        const plantIdx = Array.from(document.querySelectorAll('.plant-entry')).indexOf(plantEntry);
        const plantData = appState.plants[plantIdx];
        if (plantData && plantData.lastProfiles && plantData.lastProfiles[type]) {
            profileSelect.value = plantData.lastProfiles[type];
        }
    } else {
        profileSelect.disabled = true;
    }
    updatePlants();
}

/**
 * SCRAPES the plant entry rows from the DOM and syncs them to appState.
 */
function updatePlants() {
    if (isRestoring) return; // Don't scrape while the UI is being reconstructed from state
    const newPlants = [];
    document.querySelectorAll('.plant-entry').forEach((entry, idx) => {
        const name = entry.querySelector('.plant-name').value;
        const type = entry.querySelector('.vessel-type').value;
        const profile = entry.querySelector('.vessel-profile').value;

        // Preserve existing checks and profile history
        let checks = {};
        let lastProfiles = {};
        if (appState.plants[idx]) {
            checks = appState.plants[idx].checks || {};
            lastProfiles = appState.plants[idx].lastProfiles || {};
        }

        // Update profile memory if selected
        if (type && profile) {
            lastProfiles[type] = profile;
        }

        if (name || type || profile) {
            newPlants.push({ name, vesselType: type, profile, checks, lastProfiles });
        }
    });
    appState.plants = newPlants;
    saveDraft();
}

// ===== Picker & Modal Logic =====

/**
 * Opens the initial picker to choose either a Vessel (if multi-plant) or a QA Check.
 */
function openPicker() {
    const grid = document.getElementById('picker-grid');
    grid.innerHTML = '';

    if (appState.plants.length > 1) {
        // Step 1: Vessel Selection (for multi-plant projects)
        const title = document.querySelector('#picker-overlay h3');
        const originalTitle = title.textContent;
        title.textContent = 'Select Vessel';

        appState.plants.forEach((p, idx) => {
            const btn = document.createElement('button');
            const isComplete = isPlantComplete(idx);
            btn.className = `picker-btn vessel-select-btn ${isComplete ? 'check-logged' : ''}`;
            btn.innerHTML = `<strong>${p.name || `Plant #${idx + 1}`}</strong><br><small>${p.vesselType}${isComplete ? ' (Complete)' : ''}</small>`;
            btn.onclick = () => {
                appState.activePlantIndex = idx;
                title.textContent = originalTitle;
                renderCheckPickerForPlant(idx);
            };
            grid.appendChild(btn);
        });
    } else {
        // Only one plant, skip vessel selection and show checks immediately
        appState.activePlantIndex = 0;
        renderCheckPickerForPlant(0);
    }

    document.getElementById('picker-overlay').classList.remove('hidden');
}

/**
 * Renders the available QA Checks for a specific plant in the picker grid.
 * @param {number} plantIdx - The index of the selected plant.
 */
function renderCheckPickerForPlant(plantIdx) {
    const grid = document.getElementById('picker-grid');
    grid.innerHTML = '';
    const p = appState.plants[plantIdx];
    const key = `${p.vesselType}-${p.profile}`;
    const checksToShow = requiredChecks[key] || Object.keys(checkNames);

    checksToShow.forEach(type => {
        const btn = document.createElement('button');
        const isLogged = isCheckLogged(plantIdx, type);
        btn.className = `picker-btn ${isLogged ? 'check-logged' : ''}`;
        btn.textContent = checkNames[type];
        btn.onclick = () => {
            closePicker();
            openModal(type);
        };
        grid.appendChild(btn);
    });
}

/**
 * Closes the picker overlay.
 */
function closePicker() {
    document.getElementById('picker-overlay').classList.add('hidden');
}

/**
 * Opens the main modal for a specific QA check and loads its content.
 * @param {string} checkType - The key identifying the check.
 * @param {Object} snapshotData - Optional: Prioritize this data over the current state (for timeline review).
 */
function openModal(checkType, snapshotData = null) {
    appState.activeCheckType = checkType;
    const modal = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const content = document.getElementById('modal-content');

    // Populate data from state if it exists for this plant's check
    const plant = appState.plants[appState.activePlantIndex];
    title.textContent = `${plant.name || `Plant #${appState.activePlantIndex + 1}`} - ${checkNames[checkType]}`;
    content.innerHTML = getCheckContent(checkType);

    const dataToRestore = snapshotData || plant.checks[checkType];

    if (dataToRestore) {
        setTimeout(() => restoreCheckData(checkType, dataToRestore), 0);
    }

    // Attach listeners for auto-calc and real-time state syncing
    setTimeout(() => {
        content.querySelectorAll('input, select, textarea').forEach(el => {
            el.addEventListener('input', () => {
                saveCheckData(checkType);
                calculateDifferences(checkType);
            });
        });
        calculateDifferences(checkType);
    }, 0);

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

/**
 * Closes the main modal.
 */
function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.body.style.overflow = 'auto';
    appState.activeCheckType = null;
}

/**
 * Persists the values from the modal's internal form to the application state.
 * @param {string} checkType - The check key.
 */
function saveCheckData(checkType) {
    const content = document.getElementById('modal-content');
    const plant = appState.plants[appState.activePlantIndex];
    if (!plant.checks[checkType]) plant.checks[checkType] = {};

    const data = plant.checks[checkType];
    content.querySelectorAll('input, select, textarea').forEach(input => {
        if (input.id) {
            if (input.type === 'file') return;
            data[input.id] = input.type === 'checkbox' ? input.checked : input.value;
        }
    });
    saveDraft();
}

/**
 * Restores data to the modal's DOM elements from the application state.
 * @param {string} checkType - The check key.
 * @param {Object} data - The saved state data for this check.
 */
function restoreCheckData(checkType, data) {
    Object.keys(data).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.type === 'checkbox') el.checked = data[id];
            else el.value = data[id];
        }
    });

    // Special restoration for photo previews in Hull Status
    if (checkType === 'hullStatus') {
        const openPhoto = data['hull-open-photo'];
        const closePhoto = data['hull-close-photo'];
        if (openPhoto) {
            const preview = document.getElementById('hull-open-preview');
            if (preview) {
                preview.src = openPhoto;
                preview.style.display = 'block';
            }
        }
        if (closePhoto) {
            const preview = document.getElementById('hull-close-preview');
            if (preview) {
                preview.src = closePhoto;
                preview.style.display = 'block';
            }
        }
    }

    // Trigger UI toggles based on the restored values (e.g. simulated vs physical sections)
    if (checkType === 'velocity') toggleVelocityMethod();
    if (checkType === 'dragheadDepth') toggleDragheadSections();
    if (checkType === 'draftSensorLight') toggleDraftLightMethod();
    if (checkType === 'draftSensorLoaded') toggleDraftLoadedMethod();
    if (checkType === 'positionCheck') togglePosFormat();
}

// ===== Timeline & Logging =====

/**
 * Logs the current check in the modal to the activity timeline.
 */
function logActiveCheckToTimeline() {
    const type = appState.activeCheckType;
    if (!type) return;

    // Ensure all current values are saved before logging
    saveCheckData(type);

    const plant = appState.plants[appState.activePlantIndex];
    let activityText = `[${plant.name || `Plant #${appState.activePlantIndex + 1}`}] ${checkNames[type]} Completed`;

    // Dynamic naming enhancement for Draghead Depth (listing which sides were checked)
    if (type === 'dragheadDepth') {
        const sides = [];
        const portChk = document.getElementById('dh-port-chk');
        const centerChk = document.getElementById('dh-center-chk');
        const stbdChk = document.getElementById('dh-stbd-chk');

        if (portChk && portChk.checked) sides.push('Port');
        if (centerChk && centerChk.checked) sides.push('Center');
        if (stbdChk && stbdChk.checked) sides.push('Stbd');

        // Fallback for case where checkboxes aren't in current DOM view (just in case)
        if (sides.length === 0 && plant.checks[type]) {
            const data = plant.checks[type];
            if (data['dh-port-chk']) sides.push('Port');
            if (data['dh-center-chk']) sides.push('Center');
            if (data['dh-stbd-chk']) sides.push('Stbd');
        }

        if (sides.length > 0) {
            activityText = `[${plant.name || `Plant #${appState.activePlantIndex + 1}`}] Draghead Depth Check (${sides.join(', ')}) Completed`;
        }
    }

    const entry = {
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        activity: activityText,
        notes: '',
        timestamp: new Date().toISOString(),
        plantIdx: appState.activePlantIndex,
        checkType: type,
        data: JSON.parse(JSON.stringify(plant.checks[type])) // Capture a snapshot of the data
    };

    appState.timeline.push(entry);
    renderTimeline();
    saveDraft();
    closeModal();
}

/**
 * Reopens a QA check modal from a timeline entry.
 * @param {number} plantIdx - Index of the plant.
 * @param {string} checkType - Type of the check.
 * @param {number} entryIdx - Index of the timeline entry (to pull snapshot data).
 */
function openTimelineEntry(plantIdx, checkType, entryIdx) {
    if (plantIdx === undefined || !checkType) return;
    appState.activePlantIndex = plantIdx;

    // Pass the historical snapshot data to the modal
    const snapshot = appState.timeline[entryIdx]?.data;
    openModal(checkType, snapshot);
}

/**
 * Checks if a specific check is already logged in the timeline for a plant.
 */
function isCheckLogged(plantIdx, checkType) {
    return appState.timeline.some(entry => entry.plantIdx === plantIdx && entry.checkType === checkType);
}

/**
 * Checks if all required QA elements for a plant are in the timeline.
 */
function isPlantComplete(plantIdx) {
    const p = appState.plants[plantIdx];
    if (!p) return false;
    const key = `${p.vesselType}-${p.profile}`;
    const required = requiredChecks[key] || [];
    if (required.length === 0) return false;
    return required.every(type => isCheckLogged(plantIdx, type));
}

/**
 * Re-renders the timeline table.
 */
function renderTimeline() {
    const tbody = document.getElementById('timeline-body');
    tbody.innerHTML = '';
    if (appState.timeline.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No timeline entries</td></tr>';
        return;
    }

    appState.timeline.forEach((item, idx) => {
        const isClickable = item.plantIdx !== undefined && item.checkType;
        const row = document.createElement('tr');
        if (isClickable) {
            row.className = 'clickable-row';
            row.title = 'Click to reopen this QA check';
            row.onclick = () => openTimelineEntry(item.plantIdx, item.checkType, idx);
        }

        row.innerHTML = `
            <td class="timeline-time">${item.time}</td>
            <td class="timeline-activity">${item.activity}</td>
            <td class="timeline-notes">${item.notes || ''}</td>
            <td class="col-action"><button class="timeline-delete-btn" onclick="event.stopPropagation(); deleteTimelineEntry(${idx})">✕</button></td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * Deletes a specific timeline entry.
 */
window.deleteTimelineEntry = (idx) => {
    if (confirm('Delete entry?')) {
        appState.timeline.splice(idx, 1);
        renderTimeline();
        saveDraft();
    }
};

// ===== Data Persistence & Export =====

/**
 * Saves the entire appState to LocalStorage.
 */
function saveDraft() {
    try {
        localStorage.setItem('dqm-window-qa-draft', JSON.stringify(appState));
    } catch (e) {
        console.warn('Failed to save draft to localStorage (possibly quota exceeded):', e);
    }
}

/**
 * Loads application state from LocalStorage and reconstructs the UI.
 */
function loadDraft() {
    const draft = localStorage.getItem('dqm-window-qa-draft');
    if (!draft) return;

    isRestoring = true; // Block scraping
    try {
        const data = JSON.parse(draft);
        Object.assign(appState, data);

        // Restore Global Header UI
        document.getElementById('check-date').value = appState.checkDate || '';
        document.getElementById('weather-conditions').value = appState.weatherConditions || '';
        document.getElementById('qa-team').value = appState.qaTeam || '';
        document.getElementById('system-provider').value = appState.systemProvider || '';
        document.getElementById('general-comments').value = appState.generalComments || '';

        // Reconstruct Plant Rows
        if (appState.plants.length > 0) {
            document.getElementById('plants-container').innerHTML = '';
            plantCounter = 0;
            appState.plants.forEach(p => {
                addPlant();
                const last = document.querySelector('.plant-entry:last-child');
                last.querySelector('.plant-name').value = p.name;
                last.querySelector('.vessel-type').value = p.vesselType;
                updateProfileOptions(last.querySelector('.vessel-type'));
                last.querySelector('.vessel-profile').value = p.profile;
            });
        }
        renderTimeline();
    } finally {
        isRestoring = false; // Re-enable scraping
    }
}

/**
 * Triggers a JSON file download for the current audit data.
 */
function exportJSON() {
    updateAppState();
    const exportData = {
        metadata: {
            plants: appState.plants,
            checkDate: appState.checkDate,
            weather: appState.weatherConditions,
            qaTeamMembers: appState.qaTeam.split(',').map(s => s.trim()).filter(s => s),
            systemProvider: appState.systemProvider,
            timeline: appState.timeline,
            generalComments: appState.generalComments,
            exportedAt: new Date().toISOString()
        }
    };
    // Construct filename: app name + plant names + live timestamp (HH-MM, colon-safe for Windows/iOS)
    const plantNames = appState.plants.map(p => p.name.trim()).filter(n => n).join('_');
    const displayPlantNames = (plantNames || 'Unnamed-Plants').replace(/\s+/g, '_');
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `DQM-QA_${displayPlantNames}_${ts}.json`;

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
}

/**
 * Handles importing a previously exported JSON file back into the app.
 * Supports both the export format ({ metadata: {...} }) and raw appState format.
 * @param {Event} event - The file input change event.
 */
function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const parsed = JSON.parse(e.target.result);

            // Normalize: handle both export format and raw appState format
            let importedState;
            if (parsed.metadata) {
                // Export format: { metadata: { plants, checkDate, weather, qaTeamMembers, systemProvider, timeline, generalComments } }
                const m = parsed.metadata;
                importedState = {
                    plants: m.plants || [],
                    checkDate: m.checkDate || '',
                    weatherConditions: m.weather || '',
                    // qaTeamMembers is an array in export; join it back to a string for the form
                    qaTeam: Array.isArray(m.qaTeamMembers) ? m.qaTeamMembers.join(', ') : (m.qaTeam || ''),
                    systemProvider: m.systemProvider || '',
                    timeline: m.timeline || [],
                    generalComments: m.generalComments || ''
                };
            } else if (Array.isArray(parsed.plants) || parsed.checkDate !== undefined) {
                // Raw appState format (e.g., from a manual draft backup)
                importedState = parsed;
            } else {
                throw new Error('Unrecognized JSON format.');
            }

            // Confirm before overwriting current session
            if (!confirm('Import this file? This will replace your current session data.')) return;

            // Apply to appState
            isRestoring = true;
            try {
                Object.assign(appState, {
                    plants: [],
                    checkDate: '',
                    weatherConditions: '',
                    qaTeam: '',
                    systemProvider: '',
                    timeline: [],
                    generalComments: '',
                    activeCheckType: null,
                    activePlantIndex: null
                }, importedState);

                // Restore Global Header UI
                document.getElementById('check-date').value = appState.checkDate || '';
                document.getElementById('weather-conditions').value = appState.weatherConditions || '';
                document.getElementById('qa-team').value = appState.qaTeam || '';
                document.getElementById('system-provider').value = appState.systemProvider || '';
                document.getElementById('general-comments').value = appState.generalComments || '';

                // Reconstruct Plant Rows
                document.getElementById('plants-container').innerHTML = '';
                plantCounter = 0;
                if (appState.plants.length > 0) {
                    appState.plants.forEach(p => {
                        addPlant();
                        const last = document.querySelector('.plant-entry:last-child');
                        last.querySelector('.plant-name').value = p.name || '';
                        last.querySelector('.vessel-type').value = p.vesselType || '';
                        updateProfileOptions(last.querySelector('.vessel-type'));
                        last.querySelector('.vessel-profile').value = p.profile || '';
                    });
                } else {
                    addPlant(); // Always have at least one plant row
                }

                renderTimeline();
            } finally {
                isRestoring = false;
            }

            // Persist the imported state to localStorage
            saveDraft();
            showToast('✅ Import Successful');

        } catch (err) {
            console.error('Import failed:', err);
            showToast('❌ Import Failed – Invalid JSON');
        }
    };
    reader.onerror = function () {
        showToast('❌ Failed to read file');
    };
    reader.readAsText(file);
}

// ===== Form Generators (Ported from dqm-qa-app) =====

/**
 * Factory for retrieving HTML template for a specific check.
 */
function getCheckContent(type) {
    switch (type) {
        case 'positionCheck': return createPositionCheckForm();
        case 'hullStatus': return createHullStatusForm();
        case 'draftSensorLightFwd': return createDraftSensorForm('light', 'fwd');
        case 'draftSensorLightAft': return createDraftSensorForm('light', 'aft');
        case 'draftSensorLoadedFwd': return createDraftSensorForm('loaded', 'fwd');
        case 'draftSensorLoadedAft': return createDraftSensorForm('loaded', 'aft');
        case 'ullageLightFwd': return createUllageForm('light', 'fwd');
        case 'ullageLightAft': return createUllageForm('light', 'aft');
        case 'ullageLoadedFwd': return createUllageForm('loaded', 'fwd');
        case 'ullageLoadedAft': return createUllageForm('loaded', 'aft');
        case 'dragheadDepth': return createDragheadDepthForm();
        case 'suctionMouthDepth': return createSuctionMouthDepthForm();
        case 'velocity': return createVelocityForm();
        case 'bucketDepth': return createBucketDepthForm();
        case 'bucketPosition': return createBucketPositionForm();
        default: return '<p>Unknown form.</p>';
    }
}

/**
 * Generates the coordinate sub-inputs (used for both Handheld and DQM rows).
 * Uses CSS grid for DMS/DDM so each field fills its column naturally.
 * @param {string} prefix - e.g. 'handheld' or 'dqm'
 */
function coordInputsHTML(prefix) {
    return `
        <div class="coord-set" id="${prefix}-dd" style="display:flex; gap:6px;">
            <input type="number" id="${prefix}-dd-lat" step="0.000001" placeholder="Lat (DD)" style="flex:1">
            <input type="number" id="${prefix}-dd-lon" step="0.000001" placeholder="Lon (DD)" style="flex:1">
        </div>

        <div class="coord-set hidden" id="${prefix}-dms">
            <!-- Column headers -->
            <div style="display:grid; grid-template-columns:3fr 3fr 4fr 2fr; gap:6px; margin-bottom:3px;">
                <small style="color:var(--text-muted); padding-left:2px;">Deg (°)</small>
                <small style="color:var(--text-muted); padding-left:2px;">Min (')</small>
                <small style="color:var(--text-muted); padding-left:2px;">Sec (")</small>
                <small style="color:var(--text-muted); padding-left:2px;">Hem</small>
            </div>
            <!-- Lat row -->
            <div style="display:grid; grid-template-columns:3fr 3fr 4fr 2fr; gap:6px; align-items:center;">
                <input type="number" id="${prefix}-dms-lat-d" placeholder="0" min="0" max="90" style="width:100%">
                <input type="number" id="${prefix}-dms-lat-m" placeholder="0" min="0" max="59" style="width:100%">
                <input type="number" id="${prefix}-dms-lat-s" placeholder="0.000" step="0.001" min="0" max="60" style="width:100%">
                <select id="${prefix}-dms-lat-hem" style="width:100%"><option value="N">N</option><option value="S">S</option></select>
            </div>
            <!-- Lon row -->
            <div style="display:grid; grid-template-columns:3fr 3fr 4fr 2fr; gap:6px; align-items:center; margin-top:6px;">
                <input type="number" id="${prefix}-dms-lon-d" placeholder="0" min="0" max="180" style="width:100%">
                <input type="number" id="${prefix}-dms-lon-m" placeholder="0" min="0" max="59" style="width:100%">
                <input type="number" id="${prefix}-dms-lon-s" placeholder="0.000" step="0.001" min="0" max="60" style="width:100%">
                <select id="${prefix}-dms-lon-hem" style="width:100%"><option value="W">W</option><option value="E">E</option></select>
            </div>
            <div style="display:grid; grid-template-columns:3fr 3fr 4fr 2fr; gap:6px; margin-top:2px;">
                <small style="color:var(--text-muted); padding-left:2px;">Lat</small>
                <small></small><small></small><small></small>
            </div>
            <div style="display:grid; grid-template-columns:3fr 3fr 4fr 2fr; gap:6px;">
                <small style="color:var(--text-muted); padding-left:2px;">Lon</small>
            </div>
        </div>

        <div class="coord-set hidden" id="${prefix}-ddm">
            <!-- Column headers -->
            <div style="display:grid; grid-template-columns:3fr 5fr 2fr; gap:6px; margin-bottom:3px;">
                <small style="color:var(--text-muted); padding-left:2px;">Deg (°)</small>
                <small style="color:var(--text-muted); padding-left:2px;">Dec. Min (')</small>
                <small style="color:var(--text-muted); padding-left:2px;">Hem</small>
            </div>
            <!-- Lat row -->
            <div style="display:grid; grid-template-columns:3fr 5fr 2fr; gap:6px; align-items:center;">
                <input type="number" id="${prefix}-ddm-lat-d" placeholder="0" min="0" max="90" style="width:100%">
                <input type="number" id="${prefix}-ddm-lat-dm" placeholder="0.00000" step="0.00001" min="0" max="60" style="width:100%">
                <select id="${prefix}-ddm-lat-hem" style="width:100%"><option value="N">N</option><option value="S">S</option></select>
            </div>
            <!-- Lon row -->
            <div style="display:grid; grid-template-columns:3fr 5fr 2fr; gap:6px; align-items:center; margin-top:6px;">
                <input type="number" id="${prefix}-ddm-lon-d" placeholder="0" min="0" max="180" style="width:100%">
                <input type="number" id="${prefix}-ddm-lon-dm" placeholder="0.00000" step="0.00001" min="0" max="60" style="width:100%">
                <select id="${prefix}-ddm-lon-hem" style="width:100%"><option value="W">W</option><option value="E">E</option></select>
            </div>
            <div style="display:grid; grid-template-columns:3fr 5fr 2fr; gap:6px; margin-top:2px;">
                <small style="color:var(--text-muted); padding-left:2px;">Lat</small>
            </div>
            <div style="display:grid; grid-template-columns:3fr 5fr 2fr; gap:6px;">
                <small style="color:var(--text-muted); padding-left:2px;">Lon</small>
            </div>
        </div>
    `;
}

/**
 * Generates HTML for GPS Position Check.
 * Each source (Handheld, DQM) has its own independent format selector.
 */
function createPositionCheckForm() {
    return `
        <div class="form-group">
            <label>Handheld GPS Position</label>
            <button type="button" class="gps-button" onclick="captureGPS()" style="width:100%; margin-bottom:8px;">📡 Capture Device GPS</button>
            <div style="margin-bottom:6px;">
                <select id="handheld-format" style="width:100%;" onchange="togglePosFormat()">
                    <option value="dd">Decimal Degrees (DD)</option>
                    <option value="dms">Degrees Minutes Seconds (DMS)</option>
                    <option value="ddm">Degrees Decimal Minutes (DDM)</option>
                </select>
            </div>
            <div class="mt-1">
                ${coordInputsHTML('handheld')}
            </div>
        </div>
        <div class="form-group">
            <label>DQM System Position</label>
            <div style="margin-bottom:6px;">
                <select id="dqm-format" style="width:100%;" onchange="togglePosFormat()">
                    <option value="dd">Decimal Degrees (DD)</option>
                    <option value="dms">Degrees Minutes Seconds (DMS)</option>
                    <option value="ddm">Degrees Decimal Minutes (DDM)</option>
                </select>
            </div>
            ${coordInputsHTML('dqm')}
        </div>
        <div class="input-row">
            <div class="form-group">
                <label>Distance Diff (ft)</label>
                <input type="number" id="position-diff" readonly>
            </div>
        </div>
        <div class="form-group">
            <label>Remarks</label>
            <textarea id="position-remarks" rows="2"></textarea>
        </div>
    `;
}

/**
 * Shows/hides the correct coordinate sub-inputs based on each source's own format selector.
 * Handheld and DQM are controlled independently.
 */
window.togglePosFormat = () => {
    ['handheld', 'dqm'].forEach(prefix => {
        const fmt = document.getElementById(`${prefix}-format`)?.value || 'dd';
        document.getElementById(`${prefix}-dd`).classList.toggle('hidden', fmt !== 'dd');
        document.getElementById(`${prefix}-dms`).classList.toggle('hidden', fmt !== 'dms');
        document.getElementById(`${prefix}-ddm`).classList.toggle('hidden', fmt !== 'ddm');
    });
    calculatePositionDifference();
};

/**
 * Parses a coordinate pair from the form for a given prefix and format.
 * Returns { lat, lon } in decimal degrees, or null if any field is empty/invalid.
 * @param {string} prefix - 'handheld' or 'dqm'
 * @param {string} fmt    - 'dd', 'dms', or 'ddm'
 */
function parsePosCoords(prefix, fmt) {
    const g = id => document.getElementById(id);
    const pf = v => parseFloat(v);

    if (fmt === 'dd') {
        const lat = pf(g(`${prefix}-dd-lat`)?.value);
        const lon = pf(g(`${prefix}-dd-lon`)?.value);
        if (isNaN(lat) || isNaN(lon)) return null;
        return { lat, lon };
    }

    if (fmt === 'dms') {
        const latD = pf(g(`${prefix}-dms-lat-d`)?.value);
        const latM = pf(g(`${prefix}-dms-lat-m`)?.value);
        const latS = pf(g(`${prefix}-dms-lat-s`)?.value);
        const latH = g(`${prefix}-dms-lat-hem`)?.value || 'N';
        const lonD = pf(g(`${prefix}-dms-lon-d`)?.value);
        const lonM = pf(g(`${prefix}-dms-lon-m`)?.value);
        const lonS = pf(g(`${prefix}-dms-lon-s`)?.value);
        const lonH = g(`${prefix}-dms-lon-hem`)?.value || 'W';
        if ([latD, latM, latS, lonD, lonM, lonS].some(isNaN)) return null;
        const lat = (latD + latM / 60 + latS / 3600) * (latH === 'S' ? -1 : 1);
        const lon = (lonD + lonM / 60 + lonS / 3600) * (lonH === 'W' ? -1 : 1);
        return { lat, lon };
    }

    if (fmt === 'ddm') {
        const latD  = pf(g(`${prefix}-ddm-lat-d`)?.value);
        const latDm = pf(g(`${prefix}-ddm-lat-dm`)?.value);
        const latH  = g(`${prefix}-ddm-lat-hem`)?.value || 'N';
        const lonD  = pf(g(`${prefix}-ddm-lon-d`)?.value);
        const lonDm = pf(g(`${prefix}-ddm-lon-dm`)?.value);
        const lonH  = g(`${prefix}-ddm-lon-hem`)?.value || 'W';
        if ([latD, latDm, lonD, lonDm].some(isNaN)) return null;
        const lat = (latD + latDm / 60) * (latH === 'S' ? -1 : 1);
        const lon = (lonD + lonDm / 60) * (lonH === 'W' ? -1 : 1);
        return { lat, lon };
    }

    return null;
}

/**
 * Generates HTML for Hull Status (photo upload) Form.
 */
function createHullStatusForm() {
    return `
        <div class="form-group">
            <label>Hull Opened</label>
            <select id="hull-opened">
                <option value="">Select...</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
            </select>
        </div>
        <div class="form-group">
            <label>Photo Reference (Closed to Open)</label>
            <div class="photo-actions" style="display:flex; gap:10px; margin-bottom:10px;">
                <button type="button" class="btn-secondary" onclick="document.getElementById('hull-open-photo-input').click()">📷 Take Photo / Upload</button>
            </div>
            <input type="file" id="hull-open-photo-input" accept="image/*" capture="environment" class="hidden" onchange="handleHullPhoto(this, 'hull-open-preview')">
            <img id="hull-open-preview" style="display:none; width:100%; border-radius:8px;">
        </div>
        <div class="form-group">
            <label>Photo Reference (Open to Closed)</label>
            <div class="photo-actions" style="display:flex; gap:10px; margin-bottom:10px;">
                <button type="button" class="btn-secondary" onclick="document.getElementById('hull-close-photo-input').click()">📷 Take Photo / Upload</button>
            </div>
            <input type="file" id="hull-close-photo-input" accept="image/*" capture="environment" class="hidden" onchange="handleHullPhoto(this, 'hull-close-preview')">
            <img id="hull-close-preview" style="display:none; width:100%; border-radius:8px;">
        </div>
        <div class="form-group">
            <label>Remarks</label>
            <textarea id="hull-remarks" rows="2" placeholder="Additional observations"></textarea>
        </div>
    `;
}

/**
 * Generates HTML for Draft Sensor (integrated physical/simulated) Form.
 */
function createDraftSensorForm(cond, side) {
    const SideProper = side === 'fwd' ? 'Forward' : 'Aft';
    const CondProper = cond === 'light' ? 'Light' : 'Loaded';

    return `
        <h2>Draft Sensor Check — ${CondProper} (${SideProper})</h2>
        <div class="form-group">
            <label>Check Method</label>
            <select id="draft-${cond}-${side}-method" onchange="toggleDraftMethod('${cond}', '${side}')">
                <option value="physical">Physical Draft Check</option>
                <option value="simulated" ${cond === 'light' ? 'selected' : ''}>Simulated Draft Check</option>
            </select>
        </div>
        
        <div id="physical-${cond}-${side}-section" class="${cond === 'light' ? 'hidden' : ''}">
            <div class="input-row">
                <div class="form-group"><label>${SideProper} Port</label><input type="number" id="${cond}-${side}-port" step="0.01" placeholder="0.0"></div>
                <div class="form-group"><label>${SideProper} Stbd</label><input type="number" id="${cond}-${side}-stbd" step="0.01" placeholder="0.0"></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Avg</label><input type="number" id="${cond}-${side}-avg" readonly placeholder="Avg"></div>
                <div class="form-group"><label>DQM ${SideProper}</label><input type="number" id="${cond}-dqm-${side}" step="0.01" placeholder="0.0"></div>
                <div class="form-group"><label>Diff</label><input type="number" id="${cond}-${side}-diff" readonly placeholder="Auto-calc"></div>
            </div>
        </div>

        <div id="simulated-${cond}-${side}-section" class="${cond === 'loaded' ? 'hidden' : ''}">
            <div class="form-group"><label>${SideProper} Offset (ft)</label><input type="number" id="sim-${cond}-${side}-offset" step="0.01" placeholder="e.g., 2.0"></div>
            ${[1, 2, 3].map(i => `
                <div class="input-row">
                    <div class="form-group"><label>Depth ${i}</label><input type="number" id="sim-${cond}-${side}-depth-${i}" step="0.01" placeholder="0.0"></div>
                    <div class="form-group"><label>Reading ${i}</label><input type="number" id="sim-${cond}-${side}-reading-${i}" step="0.01" placeholder="0.0"></div>
                    <div class="form-group"><label>Diff</label><input type="number" id="sim-${cond}-${side}-diff-${i}" readonly placeholder="Auto-calc"></div>
                </div>
            `).join('')}
            <div class="form-group">
                <label>Test Pipe Details</label>
                <textarea id="sim-${cond}-${side}-pipe-details" rows="2" placeholder="Pipe length, etc."></textarea>
            </div>
        </div>

        <div class="form-group">
            <label>Remarks</label>
            <textarea id="${cond}-${side}-remarks" rows="2" placeholder="Observations..."></textarea>
        </div>
    `;
}

/**
 * Generates HTML for Ullage Sounding Comparison Form.
 */
function createUllageForm(cond, side) {
    const SideProper = side === 'fwd' ? 'Forward' : 'Aft';
    const CondProper = cond === 'light' ? 'Light' : 'Loaded';

    return `
        <h2>Ullage Check — ${CondProper} (${SideProper})</h2>
        <div class="input-row">
            <div class="form-group"><label>${SideProper} Port Sounding</label><input type="number" id="ullage-${cond}-${side}-port" step="0.01" placeholder="0.0"></div>
            <div class="form-group"><label>${SideProper} Stbd Sounding</label><input type="number" id="ullage-${cond}-${side}-stbd" step="0.01" placeholder="0.0"></div>
        </div>
        <div class="input-row-3">
            <div class="form-group"><label>Average</label><input type="number" id="ullage-${cond}-${side}-avg" readonly placeholder="Avg"></div>
            <div class="form-group"><label>DQM System ${SideProper}</label><input type="number" id="ullage-${cond}-dqm-${side}" step="0.01" placeholder="0.0"></div>
            <div class="form-group"><label>Diff</label><input type="number" id="ullage-${cond}-diff-${side}" readonly placeholder="Auto-calc"></div>
        </div>
        <div class="form-group">
            <label>Remarks</label>
            <textarea id="ullage-${cond}-${side}-remarks" rows="2" placeholder="Measurement notes..."></textarea>
        </div>
    `;
}

/**
 * Generates HTML for Draghead Depth Check Form with Port/Center/Stbd toggles.
 */
function createDragheadDepthForm() {
    return `
        <div class="form-group" style="display:flex; gap:10px;">
            <label><input type="checkbox" id="dh-port-chk" onchange="toggleDragheadSections()"> Port</label>
            <label><input type="checkbox" id="dh-center-chk" onchange="toggleDragheadSections()"> Center</label>
            <label><input type="checkbox" id="dh-stbd-chk" onchange="toggleDragheadSections()"> Stbd</label>
        </div>
        <div id="dh-port-sec" class="hidden">
            <h3>Port Draghead</h3>
            <div class="form-group"><label>Offset</label><input type="number" id="dh-port-offset" value="0" step="0.01"></div>
            ${[1, 2, 3].map(i => `
                <div class="input-row">
                    <div class="form-group"><label>Man ${i}</label><input type="number" id="dh-port-man-${i}" step="0.01" placeholder="0.0"></div>
                    <div class="form-group"><label>DQM ${i}</label><input type="number" id="dh-port-dqm-${i}" step="0.01" placeholder="0.0"></div>
                    <div class="form-group"><label>Diff</label><input type="number" id="dh-port-diff-${i}" readonly placeholder="Auto-calc"></div>
                </div>
            `).join('')}
        </div>
        <div id="dh-center-sec" class="hidden">
            <h3>Center Draghead</h3>
            <div class="form-group"><label>Offset</label><input type="number" id="dh-center-offset" value="0" step="0.01"></div>
            ${[1, 2, 3].map(i => `
                <div class="input-row">
                    <div class="form-group"><label>Man ${i}</label><input type="number" id="dh-center-man-${i}" step="0.01" placeholder="0.0"></div>
                    <div class="form-group"><label>DQM ${i}</label><input type="number" id="dh-center-dqm-${i}" step="0.01" placeholder="0.0"></div>
                    <div class="form-group"><label>Diff</label><input type="number" id="dh-center-diff-${i}" readonly placeholder="Auto-calc"></div>
                </div>
            `).join('')}
        </div>
        <div id="dh-stbd-sec" class="hidden">
            <h3>Starboard Draghead</h3>
            <div class="form-group"><label>Offset</label><input type="number" id="dh-stbd-offset" value="0" step="0.01"></div>
            ${[1, 2, 3].map(i => `
                <div class="input-row">
                    <div class="form-group"><label>Man ${i}</label><input type="number" id="dh-stbd-man-${i}" step="0.01" placeholder="0.0"></div>
                    <div class="form-group"><label>DQM ${i}</label><input type="number" id="dh-stbd-dqm-${i}" step="0.01" placeholder="0.0"></div>
                    <div class="form-group"><label>Diff</label><input type="number" id="dh-stbd-diff-${i}" readonly placeholder="Auto-calc"></div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Generates HTML for Suction Mouth Depth (Cutterhead) Form.
 */
function createSuctionMouthDepthForm() {
    return `
        <div class="form-group">
            <label>Depth Offset (ft)</label>
            <input type="number" id="suction-offset" step="0.01" value="0">
        </div>
        ${[1, 2, 3].map(i => `
            <div class="input-row">
                <div class="form-group"><label>Manual ${i}</label><input type="number" id="suction-man-${i}" step="0.01"></div>
                <div class="form-group"><label>DQM ${i}</label><input type="number" id="suction-dqm-${i}" step="0.01"></div>
                <div class="form-group"><label>Diff</label><input type="number" id="suction-diff-${i}" readonly></div>
            </div>
        `).join('')}
    `;
}

/**
 * Generates HTML for Discharge Velocity (Dye/Meter) Form.
 */
function createVelocityForm() {
    return `
        <div class="form-group">
            <label>Test Method</label>
            <select id="velocity-method" onchange="toggleVelocityMethod()">
                <option value="dye">Dye Test</option>
                <option value="meter">External Meter</option>
            </select>
        </div>
        <div id="velocity-dye-sec">
            <div class="form-group"><label>Pipe Length (ft)</label><input type="number" id="vel-pipe-length"></div>
            ${[1, 2].map(i => `
                <div class="input-row">
                    <input type="number" id="vel-dye-time-${i}" placeholder="Time ${i}">
                    <input type="number" id="vel-dye-dqm-${i}" placeholder="DQM ${i}">
                    <input type="number" id="vel-dye-diff-${i}" readonly placeholder="Diff">
                </div>
            `).join('')}
        </div>
        <div id="velocity-meter-sec" class="hidden">
            ${[1, 2].map(i => `
                <div class="input-row">
                    <input type="number" id="vel-meter-man-${i}" placeholder="Meter ${i}">
                    <input type="number" id="vel-meter-dqm-${i}" placeholder="DQM ${i}">
                    <input type="number" id="vel-meter-diff-${i}" readonly placeholder="Diff">
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Generates HTML for Bucket/Grab Depth Form.
 */
function createBucketDepthForm() {
    return `
        <div class="form-group">
            <label>Heel Offset (ft)</label>
            <input type="number" id="bucket-offset" value="0">
        </div>
        ${[1, 2, 3].map(i => `
            <div class="input-row">
                <input type="number" id="bucket-man-${i}" placeholder="Manual ${i}">
                <input type="number" id="bucket-dqm-${i}" placeholder="DQM ${i}">
                <input type="number" id="bucket-diff-${i}" readonly placeholder="Diff">
            </div>
        `).join('')}
    `;
}

/**
 * Generates HTML for Bucket Position (Spatial) Form.
 */
function createBucketPositionForm() {
    return `
        <p class="text-muted">Verify bucket X/Y against physical boom angle/drawings.</p>
        ${[1, 2].map(i => `
            <div class="input-row">
                <input type="number" id="bpos-man-${i}" placeholder="Phys ${i}">
                <input type="number" id="bpos-dqm-${i}" placeholder="DQM ${i}">
                <input type="number" id="bpos-diff-${i}" readonly placeholder="Diff">
            </div>
        `).join('')}
    `;
}

// ===== Toggle Helpers =====

/**
 * Toggles visibility between physical and simulated draft sections in the modal.
 * @param {string} cond - The condition ('light' or 'loaded').
 * @param {string} side - The side ('fwd' or 'aft').
 */
window.toggleDraftMethod = (cond, side) => {
    const val = document.getElementById(`draft-${cond}-${side}-method`).value;
    document.getElementById(`physical-${cond}-${side}-section`).classList.toggle('hidden', val !== 'physical');
    document.getElementById(`simulated-${cond}-${side}-section`).classList.toggle('hidden', val !== 'simulated');
};

/**
 * Toggles visibility of Draghead sections based on checkboxes.
 */
window.toggleDragheadSections = () => {
    document.getElementById('dh-port-sec').classList.toggle('hidden', !document.getElementById('dh-port-chk').checked);
    const centerChk = document.getElementById('dh-center-chk');
    if (centerChk) { // Check if center checkbox exists (it might not for some vessel types)
        document.getElementById('dh-center-sec').classList.toggle('hidden', !centerChk.checked);
    }
    document.getElementById('dh-stbd-sec').classList.toggle('hidden', !document.getElementById('dh-stbd-chk').checked);
};

/**
 * Toggles visibility between Dye Test and External Meter velocity sections.
 */
window.toggleVelocityMethod = () => {
    const method = document.getElementById('velocity-method').value;
    document.getElementById('velocity-dye-sec').classList.toggle('hidden', method !== 'dye');
    document.getElementById('velocity-meter-sec').classList.toggle('hidden', method !== 'meter');
};

/**
 * Converts a browser File to a DataURL and updates the preview <img>.
 * Persists the DataURL to the application state.
 * @param {HTMLInputElement} input - The file input element.
 * @param {string} previewId - The ID of the image element to display the preview.
 */
window.handleHullPhoto = (input, previewId) => {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            const preview = document.getElementById(previewId);
            preview.src = dataUrl;
            preview.style.display = 'block';

            // Persist the binary data to the application state
            const plant = appState.plants[appState.activePlantIndex];
            if (!plant.checks.hullStatus) plant.checks.hullStatus = {};
            const stateKey = previewId === 'hull-open-preview' ? 'hull-open-photo' : 'hull-close-photo';
            plant.checks.hullStatus[stateKey] = dataUrl;

            saveDraft();
        };
        reader.readAsDataURL(file);
    }
};

// ===== Calculations & GPS =====

/**
 * Triggers re-calculation of field differences within the active modal.
 * Uses IDs relative to the open modal DOM.
 * @param {string} type - The check type key.
 */
function calculateDifferences(type) {
    if (type.startsWith('draftSensor')) {
        const parts = type.split(/(?=[A-Z])/);
        const cond = parts[2].toLowerCase();
        const side = parts[3].toLowerCase();
        calcDraft(cond, side);
    } else if (type.startsWith('ullage')) {
        const parts = type.split(/(?=[A-Z])/);
        const cond = parts[1].toLowerCase();
        const side = parts[2].toLowerCase();
        calcUllage(cond, side);
    } else {
        switch (type) {
            case 'positionCheck': calculatePositionDifference(); break;
            case 'dragheadDepth': calcDraghead(); break;
            case 'suctionMouthDepth': calcSuction(); break;
            case 'velocity': calcVelocity(); break;
            case 'bucketDepth': calcBucketDepth(); break;
            case 'bucketPosition': calcBucketPos(); break;
        }
    }
}

/**
 * Draft calculation logic for integrated forms.
 * @param {string} cond - 'light' or 'loaded'
 * @param {string} side - 'fwd' or 'aft'
 */
function calcDraft(cond, side) {
    const methodEl = document.getElementById(`draft-${cond}-${side}-method`);
    if (!methodEl) return;

    if (methodEl.value === 'physical') {
        const p = parseFloat(document.getElementById(`${cond}-${side}-port`)?.value);
        const s = parseFloat(document.getElementById(`${cond}-${side}-stbd`)?.value);
        const dqm = parseFloat(document.getElementById(`${cond}-dqm-${side}`)?.value);
        const avgEl = document.getElementById(`${cond}-${side}-avg`);
        const el = document.getElementById(`${cond}-${side}-diff`);
        if (!isNaN(p) && !isNaN(s) && avgEl) {
            const average = (p + s) / 2;
            avgEl.value = average.toFixed(2);
            if (!isNaN(dqm) && el) {
                el.value = Math.abs(average - dqm).toFixed(2);
            }
        }
    } else {
        const off = parseFloat(document.getElementById(`sim-${cond}-${side}-offset`)?.value) || 0;
        for (let i = 1; i <= 3; i++) {
            const d = parseFloat(document.getElementById(`sim-${cond}-${side}-depth-${i}`)?.value);
            const r = parseFloat(document.getElementById(`sim-${cond}-${side}-reading-${i}`)?.value);
            const el = document.getElementById(`sim-${cond}-${side}-diff-${i}`);
            if (!isNaN(d) && !isNaN(r) && el) {
                el.value = Math.abs((d + off) - r).toFixed(2);
            }
        }
    }
}

/**
 * Ullage calculation logic.
 * @param {string} cond - 'light' or 'loaded'
 * @param {string} side - 'fwd' or 'aft'
 */
function calcUllage(cond, side) {
    const p = parseFloat(document.getElementById(`ullage-${cond}-${side}-port`)?.value);
    const s = parseFloat(document.getElementById(`ullage-${cond}-${side}-stbd`)?.value);
    const dqm = parseFloat(document.getElementById(`ullage-${cond}-dqm-${side}`)?.value);
    const avgEl = document.getElementById(`ullage-${cond}-${side}-avg`);
    const el = document.getElementById(`ullage-${cond}-diff-${side}`);
    if (!isNaN(p) && !isNaN(s) && avgEl) {
        const average = (p + s) / 2;
        avgEl.value = average.toFixed(2);
        if (!isNaN(dqm) && el) {
            el.value = Math.abs(average - dqm).toFixed(2);
        }
    }
}

/**
 * Draghead depth calculation logic.
 */
function calcDraghead() {
    ['port', 'center', 'stbd'].forEach(side => {
        const offsetEl = document.getElementById(`dh-${side}-offset`);
        if (!offsetEl) return;
        const off = parseFloat(offsetEl.value) || 0;
        for (let i = 1; i <= 3; i++) {
            const m = parseFloat(document.getElementById(`dh-${side}-man-${i}`)?.value);
            const d = parseFloat(document.getElementById(`dh-${side}-dqm-${i}`)?.value);
            const el = document.getElementById(`dh-${side}-diff-${i}`);
            if (!isNaN(m) && !isNaN(d) && el) {
                el.value = Math.abs((m + off) - d).toFixed(2);
            }
        }
    });
}

/**
 * Suction mouth depth calculation logic.
 */
function calcSuction() {
    const off = parseFloat(document.getElementById('suction-offset')?.value) || 0;
    for (let i = 1; i <= 3; i++) {
        const m = parseFloat(document.getElementById(`suction-man-${i}`)?.value);
        const d = parseFloat(document.getElementById(`suction-dqm-${i}`)?.value);
        const el = document.getElementById(`suction-diff-${i}`);
        if (!isNaN(m) && !isNaN(d) && el) {
            el.value = Math.abs((m + off) - d).toFixed(2);
        }
    }
}

/**
 * Velocity calculation logic.
 */
function calcVelocity() {
    const methodEl = document.getElementById('velocity-method');
    if (!methodEl) return;

    if (methodEl.value === 'dye') {
        const L = parseFloat(document.getElementById('vel-pipe-length')?.value);
        for (let i = 1; i <= 2; i++) {
            const t = parseFloat(document.getElementById(`vel-dye-time-${i}`)?.value);
            const d = parseFloat(document.getElementById(`vel-dye-dqm-${i}`)?.value);
            const el = document.getElementById(`vel-dye-diff-${i}`);
            if (!isNaN(L) && !isNaN(t) && !isNaN(d) && t > 0 && el) {
                el.value = Math.abs((L / t) - d).toFixed(2);
            }
        }
    } else {
        for (let i = 1; i <= 2; i++) {
            const m = parseFloat(document.getElementById(`vel-meter-man-${i}`)?.value);
            const d = parseFloat(document.getElementById(`vel-meter-dqm-${i}`)?.value);
            const el = document.getElementById(`vel-meter-diff-${i}`);
            if (!isNaN(m) && !isNaN(d) && el) {
                el.value = Math.abs(m - d).toFixed(2);
            }
        }
    }
}

/**
 * Bucket depth calculation logic.
 */
function calcBucketDepth() {
    const off = parseFloat(document.getElementById('bucket-offset')?.value) || 0;
    for (let i = 1; i <= 3; i++) {
        const m = parseFloat(document.getElementById(`bucket-man-${i}`)?.value);
        const d = parseFloat(document.getElementById(`bucket-dqm-${i}`)?.value);
        const el = document.getElementById(`bucket-diff-${i}`);
        if (!isNaN(m) && !isNaN(d) && el) {
            el.value = Math.abs((m + off) - d).toFixed(2);
        }
    }
}

/**
 * Bucket position calculation logic.
 */
function calcBucketPos() {
    for (let i = 1; i <= 2; i++) {
        const mEl = document.getElementById(`bpos-man-${i}`);
        const dEl = document.getElementById(`bpos-dqm-${i}`);
        const el = document.getElementById(`bpos-diff-${i}`);
        if (mEl && dEl && el) {
            const m = parseFloat(mEl.value);
            const d = parseFloat(dEl.value);
            if (!isNaN(m) && !isNaN(d)) el.value = Math.abs(m - d).toFixed(1);
        }
    }
}

/**
 * Position check (GPS) difference calculation.
 * Reads each source's own format selector independently and converts both to DD for haversine.
 */
function calculatePositionDifference() {
    const hhFmt  = document.getElementById('handheld-format')?.value || 'dd';
    const dqmFmt = document.getElementById('dqm-format')?.value || 'dd';
    const hh  = parsePosCoords('handheld', hhFmt);
    const dqm = parsePosCoords('dqm', dqmFmt);
    if (!hh || !dqm) return;

    const R = 20902231; // Earth radius in feet
    const dLat = (dqm.lat - hh.lat) * Math.PI / 180;
    const dLon = (dqm.lon - hh.lon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(hh.lat * Math.PI / 180) * Math.cos(dqm.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;

    const el = document.getElementById('position-diff');
    if (el) el.value = dist.toFixed(2);
}

/**
 * Uses browser GeoLocation API to capture current Lat/Lon.
 * Fills handheld fields in whichever format the handheld selector is set to.
 */
function captureGPS() {
    if (!("geolocation" in navigator)) {
        alert("Geolocation not supported");
        return;
    }
    navigator.geolocation.getCurrentPosition(pos => {
        const fmt = document.getElementById('handheld-format')?.value || 'dd';
        const rawLat = pos.coords.latitude;
        const rawLon = pos.coords.longitude;
        const g = id => document.getElementById(id);

        if (fmt === 'dd') {
            if (g('handheld-dd-lat')) g('handheld-dd-lat').value = rawLat.toFixed(6);
            if (g('handheld-dd-lon')) g('handheld-dd-lon').value = rawLon.toFixed(6);

        } else if (fmt === 'dms') {
            const toDMS = (val) => {
                const abs = Math.abs(val);
                const d = Math.floor(abs);
                const mFull = (abs - d) * 60;
                const m = Math.floor(mFull);
                const s = ((mFull - m) * 60);
                return { d, m, s };
            };
            const latDMS = toDMS(rawLat);
            const lonDMS = toDMS(rawLon);
            if (g('handheld-dms-lat-d')) g('handheld-dms-lat-d').value = latDMS.d;
            if (g('handheld-dms-lat-m')) g('handheld-dms-lat-m').value = latDMS.m;
            if (g('handheld-dms-lat-s')) g('handheld-dms-lat-s').value = latDMS.s.toFixed(3);
            if (g('handheld-dms-lat-hem')) g('handheld-dms-lat-hem').value = rawLat >= 0 ? 'N' : 'S';
            if (g('handheld-dms-lon-d')) g('handheld-dms-lon-d').value = lonDMS.d;
            if (g('handheld-dms-lon-m')) g('handheld-dms-lon-m').value = lonDMS.m;
            if (g('handheld-dms-lon-s')) g('handheld-dms-lon-s').value = lonDMS.s.toFixed(3);
            if (g('handheld-dms-lon-hem')) g('handheld-dms-lon-hem').value = rawLon >= 0 ? 'E' : 'W';

        } else if (fmt === 'ddm') {
            const toDDM = (val) => {
                const abs = Math.abs(val);
                const d = Math.floor(abs);
                const dm = (abs - d) * 60;
                return { d, dm };
            };
            const latDDM = toDDM(rawLat);
            const lonDDM = toDDM(rawLon);
            if (g('handheld-ddm-lat-d'))  g('handheld-ddm-lat-d').value  = latDDM.d;
            if (g('handheld-ddm-lat-dm')) g('handheld-ddm-lat-dm').value = latDDM.dm.toFixed(5);
            if (g('handheld-ddm-lat-hem')) g('handheld-ddm-lat-hem').value = rawLat >= 0 ? 'N' : 'S';
            if (g('handheld-ddm-lon-d'))  g('handheld-ddm-lon-d').value  = lonDDM.d;
            if (g('handheld-ddm-lon-dm')) g('handheld-ddm-lon-dm').value = lonDDM.dm.toFixed(5);
            if (g('handheld-ddm-lon-hem')) g('handheld-ddm-lon-hem').value = rawLon >= 0 ? 'E' : 'W';
        }

        calculatePositionDifference();
        saveCheckData('positionCheck');
    }, () => {
        alert('Could not get GPS position. Check browser permissions.');
    });
}
