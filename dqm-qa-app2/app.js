// ===== State Management =====
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

// ===== Constants & Profiles (Reused from dqm-qa-app) =====
const vesselProfiles = {
    'Scow': ['Monitoring', 'Ullage'],
    'Hopper Dredge': ['Standard'],
    'Pipeline Dredge': ['Standard', 'Small Business'],
    'Mechanical Dredge': ['Standard']
};

const requiredChecks = {
    'Scow-Monitoring': ['positionCheck', 'hullStatus', 'draftSensorLightFwd', 'draftSensorLightAft', 'draftSensorLoadedFwd', 'draftSensorLoadedAft'],
    'Scow-Ullage': ['positionCheck', 'hullStatus', 'draftSensorLightFwd', 'draftSensorLightAft', 'draftSensorLoadedFwd', 'draftSensorLoadedAft', 'ullageLightFwd', 'ullageLightAft', 'ullageLoadedFwd', 'ullageLoadedAft'],
    'Hopper Dredge-Standard': ['positionCheck', 'hullStatus', 'draftSensorLightFwd', 'draftSensorLightAft', 'draftSensorLoadedFwd', 'draftSensorLoadedAft', 'ullageLightFwd', 'ullageLightAft', 'ullageLoadedFwd', 'ullageLoadedAft', 'dragheadDepth'],
    'Pipeline Dredge-Standard': ['positionCheck', 'suctionMouthDepth', 'velocity'],
    'Pipeline Dredge-Small Business': ['positionCheck', 'suctionMouthDepth'],
    'Mechanical Dredge-Standard': ['positionCheck', 'bucketDepth', 'bucketPosition']
};

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
    initializeApp();
    loadDraft();
});

function initializeApp() {
    // Set default date
    document.getElementById('check-date').valueAsDate = new Date();

    // Event Listeners: Main Actions
    document.getElementById('add-plant-btn').addEventListener('click', addPlant);
    document.getElementById('save-draft-btn').addEventListener('click', saveDraft);
    document.getElementById('export-btn').addEventListener('click', exportJSON);
    document.getElementById('clear-btn').addEventListener('click', () => {
        if (confirm('Clear all data?')) {
            localStorage.removeItem('dqm-window-qa-draft');
            location.reload();
        }
    });

    // Event Listeners: Input Tracking
    ['check-date', 'weather-conditions', 'qa-team', 'system-provider', 'general-comments'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateAppState);
    });

    // Modal Events
    document.getElementById('add-qa-btn').addEventListener('click', openPicker);
    document.getElementById('add-comment-btn').addEventListener('click', addTimelineComment);
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('modal-log-btn').addEventListener('click', logActiveCheckToTimeline);

    // Close on overlay click
    document.getElementById('picker-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'picker-overlay') closePicker();
    });
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'modal-overlay') closeModal();
    });

    // Add initial plant
    if (appState.plants.length === 0) addPlant();

    renderTimeline();
}

function addTimelineComment() {
    const notes = prompt('Enter timeline comment:');
    if (notes && notes.trim()) {
        const entry = {
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            activity: 'Comment',
            notes: notes.trim(),
            timestamp: new Date().toISOString()
        };
        appState.timeline.push(entry);
        renderTimeline();
        saveDraft();
    }
}

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

function removePlant(btn) {
    btn.closest('.plant-entry').remove();
    updatePlants();
}

function updateProfileOptions(select) {
    const type = select.value;
    const profileSelect = select.closest('.plant-entry').querySelector('.vessel-profile');
    profileSelect.innerHTML = '<option value="">Profile...</option>';
    if (type && vesselProfiles[type]) {
        profileSelect.disabled = false;
        vesselProfiles[type].forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            profileSelect.appendChild(opt);
        });
    } else {
        profileSelect.disabled = true;
    }
    updatePlants();
}

function updatePlants() {
    const newPlants = [];
    document.querySelectorAll('.plant-entry').forEach((entry, idx) => {
        const name = entry.querySelector('.plant-name').value;
        const type = entry.querySelector('.vessel-type').value;
        const profile = entry.querySelector('.vessel-profile').value;

        // Preserve existing checks if this plant already existed in state
        let checks = {};
        if (appState.plants[idx]) {
            checks = appState.plants[idx].checks || {};
        }

        if (name || type || profile) {
            newPlants.push({ name, vesselType: type, profile, checks });
        }
    });
    appState.plants = newPlants;
    saveDraft();
}

// ===== Picker & Modal Logic =====
function openPicker() {
    const grid = document.getElementById('picker-grid');
    grid.innerHTML = '';

    if (appState.plants.length > 1) {
        // Step 1: Select Vessel
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
        // Only one plant, default to it
        appState.activePlantIndex = 0;
        renderCheckPickerForPlant(0);
    }

    document.getElementById('picker-overlay').classList.remove('hidden');
}

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

function closePicker() {
    document.getElementById('picker-overlay').classList.add('hidden');
}

function openModal(checkType) {
    appState.activeCheckType = checkType;
    const modal = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const content = document.getElementById('modal-content');

    const plant = appState.plants[appState.activePlantIndex];
    title.textContent = `${plant.name || `Plant #${appState.activePlantIndex + 1}`} - ${checkNames[checkType]}`;
    content.innerHTML = getCheckContent(checkType);

    // Restore data if exists for this specific plant
    const existingData = plant.checks[checkType];
    if (existingData) {
        setTimeout(() => restoreCheckData(checkType, existingData), 0);
    }

    // Attach local input listeners for auto-calc
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
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.body.style.overflow = 'auto';
    appState.activeCheckType = null;
}

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

function restoreCheckData(checkType, data) {
    Object.keys(data).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.type === 'checkbox') el.checked = data[id];
            else el.value = data[id];
        }
    });

    // Restore photo previews for hullStatus
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

    // Trigger toggles
    if (checkType === 'velocity') toggleVelocityMethod();
    if (checkType === 'dragheadDepth') toggleDragheadSections();
    if (checkType === 'draftSensorLight') toggleDraftLightMethod();
    if (checkType === 'draftSensorLoaded') toggleDraftLoadedMethod();
}

// ===== Timeline & Logging =====
function logActiveCheckToTimeline() {
    const type = appState.activeCheckType;
    if (!type) return;

    saveCheckData(type);

    const plant = appState.plants[appState.activePlantIndex];
    let activityText = `[${plant.name || `Plant #${appState.activePlantIndex + 1}`}] ${checkNames[type]} Completed`;

    // Dynamic naming for Draghead
    if (type === 'dragheadDepth') {
        const sides = [];
        const portChk = document.getElementById('dh-port-chk');
        const centerChk = document.getElementById('dh-center-chk');
        const stbdChk = document.getElementById('dh-stbd-chk');

        if (portChk && portChk.checked) sides.push('Port');
        if (centerChk && centerChk.checked) sides.push('Center');
        if (stbdChk && stbdChk.checked) sides.push('Stbd');

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
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        activity: activityText,
        notes: '',
        timestamp: new Date().toISOString(),
        plantIdx: appState.activePlantIndex,
        checkType: type
    };

    appState.timeline.push(entry);
    renderTimeline();
    saveDraft();
    closeModal();
}

// Helper to check if a specific check is logged in the timeline for a plant
function isCheckLogged(plantIdx, checkType) {
    return appState.timeline.some(entry => entry.plantIdx === plantIdx && entry.checkType === checkType);
}

// Helper to check if all required checks for a plant are logged
function isPlantComplete(plantIdx) {
    const p = appState.plants[plantIdx];
    if (!p) return false;
    const key = `${p.vesselType}-${p.profile}`;
    const required = requiredChecks[key] || [];
    if (required.length === 0) return false;
    return required.every(type => isCheckLogged(plantIdx, type));
}

function renderTimeline() {
    const tbody = document.getElementById('timeline-body');
    tbody.innerHTML = '';
    if (appState.timeline.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No timeline entries</td></tr>';
        return;
    }

    appState.timeline.forEach((item, idx) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="timeline-time">${item.time}</td>
            <td class="timeline-activity">${item.activity}</td>
            <td class="timeline-notes">${item.notes || ''}</td>
            <td class="col-action"><button class="timeline-delete-btn" onclick="deleteTimelineEntry(${idx})">✕</button></td>
        `;
        tbody.appendChild(row);
    });
}

window.deleteTimelineEntry = (idx) => {
    if (confirm('Delete entry?')) {
        appState.timeline.splice(idx, 1);
        renderTimeline();
        saveDraft();
    }
};

// ===== Data Persistence & Export =====
function saveDraft() {
    try {
        localStorage.setItem('dqm-window-qa-draft', JSON.stringify(appState));
    } catch (e) {
        console.warn('Failed to save draft to localStorage (possibly quota exceeded):', e);
    }
}

function loadDraft() {
    const draft = localStorage.getItem('dqm-window-qa-draft');
    if (!draft) return;
    const data = JSON.parse(draft);
    Object.assign(appState, data);

    // Restore UI
    document.getElementById('check-date').value = appState.checkDate || '';
    document.getElementById('weather-conditions').value = appState.weatherConditions || '';
    document.getElementById('qa-team').value = appState.qaTeam || '';
    document.getElementById('system-provider').value = appState.systemProvider || '';
    document.getElementById('general-comments').value = appState.generalComments || '';

    // Restore Plants
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
}

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
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DQM_QA_CHECK_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

// ===== Form Generators (Ported from dqm-qa-app) =====
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

function createPositionCheckForm() {
    return `
        <div class="form-group">
            <label>Handheld GPS Position</label>
            <button type="button" class="gps-button" onclick="captureGPS()">📡 Capture Device GPS</button>
            <div class="input-row mt-1">
                <input type="number" id="handheld-lat" step="0.000001" placeholder="Lat">
                <input type="number" id="handheld-lon" step="0.000001" placeholder="Lon">
            </div>
        </div>
        <div class="form-group">
            <label>DQM System Position</label>
            <div class="input-row">
                <input type="number" id="dqm-lat" step="0.000001" placeholder="Lat">
                <input type="number" id="dqm-lon" step="0.000001" placeholder="Lon">
            </div>
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
                <div class="form-group"><label>${SideProper} Port</label><input type="number" id="${cond}-${side}-port" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>${SideProper} Stbd</label><input type="number" id="${cond}-${side}-stbd" step="0.1" placeholder="0.0"></div>
            </div>
            <div class="input-row">
                <div class="form-group"><label>DQM ${SideProper}</label><input type="number" id="${cond}-dqm-${side}" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Diff</label><input type="number" id="${cond}-${side}-diff" readonly placeholder="Auto-calc"></div>
            </div>
        </div>

        <div id="simulated-${cond}-${side}-section" class="${cond === 'loaded' ? 'hidden' : ''}">
            <div class="form-group"><label>${SideProper} Offset (ft)</label><input type="number" id="sim-${cond}-${side}-offset" step="0.1" placeholder="e.g., 2.0"></div>
            ${[1, 2, 3].map(i => `
                <div class="input-row">
                    <div class="form-group"><label>Depth ${i}</label><input type="number" id="sim-${cond}-${side}-depth-${i}" step="0.1" placeholder="0.0"></div>
                    <div class="form-group"><label>Reading ${i}</label><input type="number" id="sim-${cond}-${side}-reading-${i}" step="0.1" placeholder="0.0"></div>
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

function createUllageForm(cond, side) {
    const SideProper = side === 'fwd' ? 'Forward' : 'Aft';
    const CondProper = cond === 'light' ? 'Light' : 'Loaded';

    return `
        <h2>Ullage Check — ${CondProper} (${SideProper})</h2>
        <div class="input-row">
            <div class="form-group"><label>${SideProper} Port Sounding</label><input type="number" id="ullage-${cond}-${side}-port" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>${SideProper} Stbd Sounding</label><input type="number" id="ullage-${cond}-${side}-stbd" step="0.1" placeholder="0.0"></div>
        </div>
        <div class="input-row">
            <div class="form-group"><label>DQM System ${SideProper}</label><input type="number" id="ullage-${cond}-dqm-${side}" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Diff</label><input type="number" id="ullage-${cond}-diff-${side}" readonly placeholder="Auto-calc"></div>
        </div>
        <div class="form-group">
            <label>Remarks</label>
            <textarea id="ullage-${cond}-${side}-remarks" rows="2" placeholder="Measurement notes..."></textarea>
        </div>
    `;
}

function createDragheadDepthForm() {
    return `
        <div class="form-group" style="display:flex; gap:10px;">
            <label><input type="checkbox" id="dh-port-chk" onchange="toggleDragheadSections()"> Port</label>
            <label><input type="checkbox" id="dh-center-chk" onchange="toggleDragheadSections()"> Center</label>
            <label><input type="checkbox" id="dh-stbd-chk" onchange="toggleDragheadSections()"> Stbd</label>
        </div>
        <div id="dh-port-sec" class="hidden">
            <h3>Port Draghead</h3>
            <div class="form-group"><label>Offset</label><input type="number" id="dh-port-offset" value="0" step="0.1"></div>
            ${[1, 2, 3].map(i => `
                <div class="input-row">
                    <div class="form-group"><label>Man ${i}</label><input type="number" id="dh-port-man-${i}" step="0.1" placeholder="0.0"></div>
                    <div class="form-group"><label>DQM ${i}</label><input type="number" id="dh-port-dqm-${i}" step="0.1" placeholder="0.0"></div>
                    <div class="form-group"><label>Diff</label><input type="number" id="dh-port-diff-${i}" readonly placeholder="Auto-calc"></div>
                </div>
            `).join('')}
        </div>
        <div id="dh-center-sec" class="hidden">
            <h3>Center Draghead</h3>
            <div class="form-group"><label>Offset</label><input type="number" id="dh-center-offset" value="0" step="0.1"></div>
            ${[1, 2, 3].map(i => `
                <div class="input-row">
                    <div class="form-group"><label>Man ${i}</label><input type="number" id="dh-center-man-${i}" step="0.1" placeholder="0.0"></div>
                    <div class="form-group"><label>DQM ${i}</label><input type="number" id="dh-center-dqm-${i}" step="0.1" placeholder="0.0"></div>
                    <div class="form-group"><label>Diff</label><input type="number" id="dh-center-diff-${i}" readonly placeholder="Auto-calc"></div>
                </div>
            `).join('')}
        </div>
        <div id="dh-stbd-sec" class="hidden">
            <h3>Starboard Draghead</h3>
            <div class="form-group"><label>Offset</label><input type="number" id="dh-stbd-offset" value="0" step="0.1"></div>
            ${[1, 2, 3].map(i => `
                <div class="input-row">
                    <div class="form-group"><label>Man ${i}</label><input type="number" id="dh-stbd-man-${i}" step="0.1" placeholder="0.0"></div>
                    <div class="form-group"><label>DQM ${i}</label><input type="number" id="dh-stbd-dqm-${i}" step="0.1" placeholder="0.0"></div>
                    <div class="form-group"><label>Diff</label><input type="number" id="dh-stbd-diff-${i}" readonly placeholder="Auto-calc"></div>
                </div>
            `).join('')}
        </div>
    `;
}

function createSuctionMouthDepthForm() {
    return `
        <div class="form-group">
            <label>Depth Offset (ft)</label>
            <input type="number" id="suction-offset" step="0.1" value="0">
        </div>
        ${[1, 2, 3].map(i => `
            <div class="input-row">
                <div class="form-group"><label>Manual ${i}</label><input type="number" id="suction-man-${i}" step="0.1"></div>
                <div class="form-group"><label>DQM ${i}</label><input type="number" id="suction-dqm-${i}" step="0.1"></div>
                <div class="form-group"><label>Diff</label><input type="number" id="suction-diff-${i}" readonly></div>
            </div>
        `).join('')}
    `;
}

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
window.toggleDraftLightMethod = () => {
    const val = document.getElementById('draft-light-method').value;
    document.getElementById('physical-draft-light-section').classList.toggle('hidden', val !== 'physical');
    document.getElementById('simulated-draft-light-section').classList.toggle('hidden', val !== 'simulated');
};
window.toggleDraftLoadedMethod = () => {
    const val = document.getElementById('draft-loaded-method').value;
    document.getElementById('physical-draft-loaded-section').classList.toggle('hidden', val !== 'physical');
    document.getElementById('simulated-draft-loaded-section').classList.toggle('hidden', val !== 'simulated');
};
window.toggleDragheadSections = () => {
    document.getElementById('dh-port-sec').classList.toggle('hidden', !document.getElementById('dh-port-chk').checked);
    document.getElementById('dh-center-sec').classList.toggle('hidden', !document.getElementById('dh-center-chk') || !document.getElementById('dh-center-chk').checked);
    document.getElementById('dh-stbd-sec').classList.toggle('hidden', !document.getElementById('dh-stbd-chk').checked);
};

window.handleHullPhoto = (input, previewId) => {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            const preview = document.getElementById(previewId);
            preview.src = dataUrl;
            preview.style.display = 'block';

            // Persist to state
            const plant = appState.plants[appState.activePlantIndex];
            if (!plant.checks.hullStatus) plant.checks.hullStatus = {};
            // Map preview ID to state key
            const stateKey = previewId === 'hull-open-preview' ? 'hull-open-photo' : 'hull-close-photo';
            plant.checks.hullStatus[stateKey] = dataUrl;

            saveDraft();
        };
        reader.readAsDataURL(file);
    }
};

window.toggleDraftMethod = (cond, side) => {
    const val = document.getElementById(`draft-${cond}-${side}-method`).value;
    document.getElementById(`physical-${cond}-${side}-section`).classList.toggle('hidden', val !== 'physical');
    document.getElementById(`simulated-${cond}-${side}-section`).classList.toggle('hidden', val !== 'simulated');
};
window.toggleVelocityMethod = () => {
    const val = document.getElementById('velocity-method').value;
    document.getElementById('velocity-dye-sec').classList.toggle('hidden', val !== 'dye');
    document.getElementById('velocity-meter-sec').classList.toggle('hidden', val !== 'meter');
};

// ===== Calculations =====
// ===== Calculations =====
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

function calcDraft(cond, side) {
    const methodEl = document.getElementById(`draft-${cond}-${side}-method`);
    if (!methodEl) return;

    if (methodEl.value === 'physical') {
        const p = parseFloat(document.getElementById(`${cond}-${side}-port`).value);
        const s = parseFloat(document.getElementById(`${cond}-${side}-stbd`).value);
        const dqm = parseFloat(document.getElementById(`${cond}-dqm-${side}`).value);
        const el = document.getElementById(`${cond}-${side}-diff`);
        if (!isNaN(p) && !isNaN(s) && !isNaN(dqm)) el.value = Math.abs(((p + s) / 2) - dqm).toFixed(2);
    } else {
        const off = parseFloat(document.getElementById(`sim-${cond}-${side}-offset`).value) || 0;
        for (let i = 1; i <= 3; i++) {
            const d = parseFloat(document.getElementById(`sim-${cond}-${side}-depth-${i}`).value);
            const r = parseFloat(document.getElementById(`sim-${cond}-${side}-reading-${i}`).value);
            const el = document.getElementById(`sim-${cond}-${side}-diff-${i}`);
            if (!isNaN(d) && !isNaN(r)) el.value = Math.abs((d + off) - r).toFixed(1);
        }
    }
}

function calcUllage(cond, side) {
    const p = parseFloat(document.getElementById(`ullage-${cond}-${side}-port`).value);
    const s = parseFloat(document.getElementById(`ullage-${cond}-${side}-stbd`).value);
    const dqm = parseFloat(document.getElementById(`ullage-${cond}-dqm-${side}`).value);
    const el = document.getElementById(`ullage-${cond}-diff-${side}`);
    if (!isNaN(p) && !isNaN(s) && !isNaN(dqm)) el.value = Math.abs(((p + s) / 2) - dqm).toFixed(2);
}

function calcDraghead() {
    ['port', 'center', 'stbd'].forEach(side => {
        const offsetEl = document.getElementById(`dh-${side}-offset`);
        if (!offsetEl) return;
        const off = parseFloat(offsetEl.value) || 0;
        for (let i = 1; i <= 3; i++) {
            const m = parseFloat(document.getElementById(`dh-${side}-man-${i}`).value);
            const d = parseFloat(document.getElementById(`dh-${side}-dqm-${i}`).value);
            const el = document.getElementById(`dh-${side}-diff-${i}`);
            if (!isNaN(m) && !isNaN(d)) el.value = Math.abs((m + off) - d).toFixed(1);
        }
    });
}

function calcSuction() {
    const off = parseFloat(document.getElementById('suction-offset').value) || 0;
    for (let i = 1; i <= 3; i++) {
        const m = parseFloat(document.getElementById(`suction-man-${i}`).value);
        const d = parseFloat(document.getElementById(`suction-dqm-${i}`).value);
        const el = document.getElementById(`suction-diff-${i}`);
        if (!isNaN(m) && !isNaN(d)) el.value = Math.abs((m + off) - d).toFixed(1);
    }
}

function calcVelocity() {
    const methodEl = document.getElementById('velocity-method');
    if (!methodEl) return;

    if (methodEl.value === 'dye') {
        const L = parseFloat(document.getElementById('vel-pipe-length').value);
        for (let i = 1; i <= 2; i++) {
            const t = parseFloat(document.getElementById(`vel-dye-time-${i}`).value);
            const d = parseFloat(document.getElementById(`vel-dye-dqm-${i}`).value);
            const el = document.getElementById(`vel-dye-diff-${i}`);
            if (!isNaN(L) && !isNaN(t) && !isNaN(d) && t > 0) el.value = Math.abs((L / t) - d).toFixed(2);
        }
    } else {
        for (let i = 1; i <= 2; i++) {
            const m = parseFloat(document.getElementById(`vel-meter-man-${i}`).value);
            const d = parseFloat(document.getElementById(`vel-meter-dqm-${i}`).value);
            const el = document.getElementById(`vel-meter-diff-${i}`);
            if (!isNaN(m) && !isNaN(d)) el.value = Math.abs(m - d).toFixed(2);
        }
    }
}

function calcBucketDepth() {
    const off = parseFloat(document.getElementById('bucket-offset').value) || 0;
    for (let i = 1; i <= 3; i++) {
        const m = parseFloat(document.getElementById(`bucket-man-${i}`).value);
        const d = parseFloat(document.getElementById(`bucket-dqm-${i}`).value);
        const el = document.getElementById(`bucket-diff-${i}`);
        if (!isNaN(m) && !isNaN(d)) el.value = Math.abs((m + off) - d).toFixed(1);
    }
}

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

function calculatePositionDifference() {
    const lat1 = parseFloat(document.getElementById('handheld-lat').value);
    const lon1 = parseFloat(document.getElementById('handheld-lon').value);
    const lat2 = parseFloat(document.getElementById('dqm-lat').value);
    const lon2 = parseFloat(document.getElementById('dqm-lon').value);

    if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return;

    const R = 20925525; // Earth radius in feet
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;

    const el = document.getElementById('position-diff');
    if (el) el.value = dist.toFixed(1);
}

function captureGPS() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(pos => {
            const latEl = document.getElementById('handheld-lat');
            const lonEl = document.getElementById('handheld-lon');
            if (latEl && lonEl) {
                latEl.value = pos.coords.latitude.toFixed(6);
                lonEl.value = pos.coords.longitude.toFixed(6);
                calculatePositionDifference();
                saveCheckData('positionCheck');
            }
        });
    } else {
        alert("Geolocation not supported");
    }
}
