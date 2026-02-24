// ===== State Management =====
const appState = {
    plants: [],
    checkDate: '',
    weatherConditions: '',
    qaTeam: '',
    systemProvider: '',
    timeline: [],
    generalComments: '',
    qaChecks: {},
    activeCheckType: null // Tracks which check is currently open in the modal
};

// ===== Constants & Profiles (Reused from dqm-qa-app) =====
const vesselProfiles = {
    'Scow': ['Monitoring', 'Ullage'],
    'Hopper Dredge': ['Standard'],
    'Pipeline Dredge': ['Standard', 'Small Business'],
    'Mechanical Dredge': ['Standard']
};

const requiredChecks = {
    'Scow-Monitoring': ['positionCheck', 'hullStatus', 'draftSensorLight', 'draftSensorLoaded'],
    'Scow-Ullage': ['positionCheck', 'hullStatus', 'draftSensorLight', 'draftSensorLoaded', 'ullageLight', 'ullageLoaded'],
    'Hopper Dredge-Standard': ['positionCheck', 'hullStatus', 'draftSensorLight', 'draftSensorLoaded', 'ullageLight', 'ullageLoaded', 'dragheadDepth'],
    'Pipeline Dredge-Standard': ['positionCheck', 'suctionMouthDepth', 'velocity'],
    'Pipeline Dredge-Small Business': ['positionCheck', 'suctionMouthDepth'],
    'Mechanical Dredge-Standard': ['positionCheck', 'bucketDepth', 'bucketPosition']
};

const checkNames = {
    'positionCheck': 'Position Check',
    'hullStatus': 'Hull Status Check',
    'draftSensorLight': 'Draft Sensor Check (Light)',
    'draftSensorLoaded': 'Draft Sensor Check (Loaded)',
    'ullageLight': 'Ullage Check (Light)',
    'ullageLoaded': 'Ullage Check (Loaded)',
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
    appState.plants = [];
    document.querySelectorAll('.plant-entry').forEach(entry => {
        const name = entry.querySelector('.plant-name').value;
        const type = entry.querySelector('.vessel-type').value;
        const profile = entry.querySelector('.vessel-profile').value;
        if (name || type || profile) appState.plants.push({ name, vesselType: type, profile });
    });
    saveDraft();
}

// ===== Picker & Modal Logic =====
function openPicker() {
    const grid = document.getElementById('picker-grid');
    grid.innerHTML = '';

    // Determine which checks are relevant based on plants
    const relevantChecks = new Set();
    appState.plants.forEach(p => {
        const key = `${p.vesselType}-${p.profile}`;
        (requiredChecks[key] || []).forEach(c => relevantChecks.add(c));
    });

    // If no plants or patterns found, show all
    const checksToShow = relevantChecks.size > 0 ? Array.from(relevantChecks) : Object.keys(checkNames);

    checksToShow.forEach(type => {
        const btn = document.createElement('button');
        btn.className = 'picker-btn';
        btn.textContent = checkNames[type];
        btn.onclick = () => {
            closePicker();
            openModal(type);
        };
        grid.appendChild(btn);
    });

    document.getElementById('picker-overlay').classList.remove('hidden');
}

function closePicker() {
    document.getElementById('picker-overlay').classList.add('hidden');
}

function openModal(checkType) {
    appState.activeCheckType = checkType;
    const modal = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const content = document.getElementById('modal-content');

    title.textContent = checkNames[checkType];
    content.innerHTML = getCheckContent(checkType);

    // Restore data if exists
    const existingData = appState.qaChecks[checkType];
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
    const data = { ...(appState.qaChecks[checkType] || {}) };
    content.querySelectorAll('input, select, textarea').forEach(input => {
        if (input.id) {
            if (input.type === 'file') return;
            data[input.id] = input.type === 'checkbox' ? input.checked : input.value;
        }
    });
    appState.qaChecks[checkType] = data;
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

    const entry = {
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        activity: `${checkNames[type]} Completed`,
        notes: '',
        timestamp: new Date().toISOString()
    };

    appState.timeline.push(entry);
    renderTimeline();
    saveDraft();
    closeModal();
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
    localStorage.setItem('dqm-window-qa-draft', JSON.stringify(appState));
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
        },
        checks: appState.qaChecks
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DQM_QA_WINDOW_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

// ===== Form Generators (Ported from dqm-qa-app) =====
function getCheckContent(type) {
    switch (type) {
        case 'positionCheck': return createPositionCheckForm();
        case 'hullStatus': return createHullStatusForm();
        case 'draftSensorLight': return createDraftSensorLightForm();
        case 'draftSensorLoaded': return createDraftSensorLoadedForm();
        case 'ullageLight': return createUllageLightForm();
        case 'ullageLoaded': return createUllageLoadedForm();
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
            <label>Status Photo</label>
            <input type="file" id="hull-photo-input" accept="image/*" capture="environment" onchange="handleHullPhoto(this)">
            <img id="hull-photo-preview" style="display:none; width:100%; margin-top:10px; border-radius:8px;">
        </div>
        <div class="form-group">
            <label>Remarks</label>
            <textarea id="hull-remarks" rows="2"></textarea>
        </div>
    `;
}

function createDraftSensorLightForm() {
    return `
        <div class="form-group">
            <label>Check Method</label>
            <select id="draft-light-method" onchange="toggleDraftLightMethod()">
                <option value="physical">Physical Draft Check</option>
                <option value="simulated">Simulated Draft Check</option>
            </select>
        </div>
        <div id="physical-draft-light-section">
            <div class="input-row">
                <div class="form-group"><label>Fwd Port</label><input type="number" id="light-fwd-port" step="0.1"></div>
                <div class="form-group"><label>Fwd Stbd</label><input type="number" id="light-fwd-stbd" step="0.1"></div>
            </div>
            <div class="input-row">
                <div class="form-group"><label>DQM Fwd</label><input type="number" id="light-dqm-fwd" step="0.1"></div>
                <div class="form-group"><label>Diff</label><input type="number" id="light-fwd-diff" readonly></div>
            </div>
            <hr>
            <div class="input-row">
                <div class="form-group"><label>Aft Port</label><input type="number" id="light-aft-port" step="0.1"></div>
                <div class="form-group"><label>Aft Stbd</label><input type="number" id="light-aft-stbd" step="0.1"></div>
            </div>
            <div class="input-row">
                <div class="form-group"><label>DQM Aft</label><input type="number" id="light-dqm-aft" step="0.1"></div>
                <div class="form-group"><label>Diff</label><input type="number" id="light-aft-diff" readonly></div>
            </div>
        </div>
        <div id="simulated-draft-light-section" class="hidden">
            <div class="form-group"><label>Fwd Offset</label><input type="number" id="sim-light-fwd-offset" value="0"></div>
            ${[1, 2, 3].map(i => `
                <div class="input-row">
                    <input type="number" id="sim-light-fwd-depth-${i}" placeholder="Depth ${i}">
                    <input type="number" id="sim-light-fwd-reading-${i}" placeholder="DQM ${i}">
                    <input type="number" id="sim-light-fwd-diff-${i}" readonly placeholder="Diff">
                </div>
            `).join('')}
        </div>
    `;
}

function createDraftSensorLoadedForm() {
    return `
        <div class="form-group">
            <label>Check Method</label>
            <select id="draft-loaded-method" onchange="toggleDraftLoadedMethod()">
                <option value="physical">Physical Draft Check</option>
                <option value="simulated">Simulated Draft Check</option>
            </select>
        </div>
        <div id="physical-draft-loaded-section">
            <div class="input-row">
                <div class="form-group"><label>Fwd Port</label><input type="number" id="loaded-fwd-port" step="0.1"></div>
                <div class="form-group"><label>Fwd Stbd</label><input type="number" id="loaded-fwd-stbd" step="0.1"></div>
            </div>
            <div class="input-row">
                <div class="form-group"><label>DQM Fwd</label><input type="number" id="loaded-dqm-fwd" step="0.1"></div>
                <div class="form-group"><label>Diff</label><input type="number" id="loaded-fwd-diff" readonly></div>
            </div>
            <hr>
            <div class="input-row">
                <div class="form-group"><label>Aft Port</label><input type="number" id="loaded-aft-port" step="0.1"></div>
                <div class="form-group"><label>Aft Stbd</label><input type="number" id="loaded-aft-stbd" step="0.1"></div>
            </div>
            <div class="input-row">
                <div class="form-group"><label>DQM Aft</label><input type="number" id="loaded-dqm-aft" step="0.1"></div>
                <div class="form-group"><label>Diff</label><input type="number" id="loaded-aft-diff" readonly></div>
            </div>
        </div>
        <div id="simulated-draft-loaded-section" class="hidden">
            <div class="form-group"><label>Fwd Offset</label><input type="number" id="sim-loaded-fwd-offset" value="0"></div>
            ${[1, 2, 3].map(i => `
                <div class="input-row">
                    <input type="number" id="sim-loaded-fwd-depth-${i}" placeholder="Depth ${i}">
                    <input type="number" id="sim-loaded-fwd-reading-${i}" placeholder="DQM ${i}">
                    <input type="number" id="sim-loaded-fwd-diff-${i}" readonly placeholder="Diff">
                </div>
            `).join('')}
        </div>
    `;
}

function createUllageLightForm() {
    return `
        <h3 style="margin-top:0">Forward Sensors</h3>
        <div class="input-row">
            <div class="form-group"><label>Port</label><input type="number" id="ullage-light-fwd-port" step="0.1"></div>
            <div class="form-group"><label>Stbd</label><input type="number" id="ullage-light-fwd-stbd" step="0.1"></div>
        </div>
        <div class="input-row">
            <div class="form-group"><label>DQM Fwd</label><input type="number" id="ullage-light-dqm-fwd" step="0.1"></div>
            <div class="form-group"><label>Diff</label><input type="number" id="ullage-light-diff-fwd" readonly></div>
        </div>
        <hr>
        <h3>Aft Sensors</h3>
        <div class="input-row">
            <div class="form-group"><label>Port</label><input type="number" id="ullage-light-aft-port" step="0.1"></div>
            <div class="form-group"><label>Stbd</label><input type="number" id="ullage-light-aft-stbd" step="0.1"></div>
        </div>
        <div class="input-row">
            <div class="form-group"><label>DQM Aft</label><input type="number" id="ullage-light-dqm-aft" step="0.1"></div>
            <div class="form-group"><label>Diff</label><input type="number" id="ullage-light-diff-aft" readonly></div>
        </div>
    `;
}

function createUllageLoadedForm() {
    return `
        <h3 style="margin-top:0">Forward Sensors</h3>
        <div class="input-row">
            <div class="form-group"><label>Port</label><input type="number" id="ullage-loaded-fwd-port" step="0.1"></div>
            <div class="form-group"><label>Stbd</label><input type="number" id="ullage-loaded-fwd-stbd" step="0.1"></div>
        </div>
        <div class="input-row">
            <div class="form-group"><label>DQM Fwd</label><input type="number" id="ullage-loaded-dqm-fwd" step="0.1"></div>
            <div class="form-group"><label>Diff</label><input type="number" id="ullage-loaded-diff-fwd" readonly></div>
        </div>
        <hr>
        <h3>Aft Sensors</h3>
        <div class="input-row">
            <div class="form-group"><label>Port</label><input type="number" id="ullage-loaded-aft-port" step="0.1"></div>
            <div class="form-group"><label>Stbd</label><input type="number" id="ullage-loaded-aft-stbd" step="0.1"></div>
        </div>
        <div class="input-row">
            <div class="form-group"><label>DQM Aft</label><input type="number" id="ullage-loaded-dqm-aft" step="0.1"></div>
            <div class="form-group"><label>Diff</label><input type="number" id="ullage-loaded-diff-aft" readonly></div>
        </div>
    `;
}

function createDragheadDepthForm() {
    return `
        <div class="form-group" style="display:flex; gap:10px;">
            <label><input type="checkbox" id="dh-port-chk" onchange="toggleDragheadSections()"> Port</label>
            <label><input type="checkbox" id="dh-stbd-chk" onchange="toggleDragheadSections()"> Stbd</label>
        </div>
        <div id="dh-port-sec" class="hidden">
            <h3>Port Draghead</h3>
            <div class="form-group"><label>Offset</label><input type="number" id="dh-port-offset" value="0"></div>
            ${[1, 2, 3].map(i => `
                <div class="input-row">
                    <input type="number" id="dh-port-man-${i}" placeholder="Man ${i}">
                    <input type="number" id="dh-port-dqm-${i}" placeholder="DQM ${i}">
                    <input type="number" id="dh-port-diff-${i}" readonly placeholder="Diff">
                </div>
            `).join('')}
        </div>
        <div id="dh-stbd-sec" class="hidden">
            <h3>Starboard Draghead</h3>
            <div class="form-group"><label>Offset</label><input type="number" id="dh-stbd-offset" value="0"></div>
            ${[1, 2, 3].map(i => `
                <div class="input-row">
                    <input type="number" id="dh-stbd-man-${i}" placeholder="Man ${i}">
                    <input type="number" id="dh-stbd-dqm-${i}" placeholder="DQM ${i}">
                    <input type="number" id="dh-stbd-diff-${i}" readonly placeholder="Diff">
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
    document.getElementById('dh-stbd-sec').classList.toggle('hidden', !document.getElementById('dh-stbd-chk').checked);
};
window.toggleVelocityMethod = () => {
    const val = document.getElementById('velocity-method').value;
    document.getElementById('velocity-dye-sec').classList.toggle('hidden', val !== 'dye');
    document.getElementById('velocity-meter-sec').classList.toggle('hidden', val !== 'meter');
};

// ===== Calculations =====
function calculateDifferences(type) {
    switch (type) {
        case 'positionCheck': calculatePositionDifference(); break;
        case 'draftSensorLight': calcDraft('light'); break;
        case 'draftSensorLoaded': calcDraft('loaded'); break;
        case 'ullageLight': calcUllage('light'); break;
        case 'ullageLoaded': calcUllage('loaded'); break;
        case 'dragheadDepth': calcDraghead(); break;
        case 'suctionMouthDepth': calcSuction(); break;
        case 'velocity': calcVelocity(); break;
        case 'bucketDepth': calcBucketDepth(); break;
        case 'bucketPosition': calcBucketPos(); break;
    }
}

function calcDraft(cond) {
    if (document.getElementById(`draft-${cond}-method`).value === 'physical') {
        ['fwd', 'aft'].forEach(pos => {
            const p = parseFloat(document.getElementById(`${cond}-${pos}-port`).value);
            const s = parseFloat(document.getElementById(`${cond}-${pos}-stbd`).value);
            const dqm = parseFloat(document.getElementById(`${cond}-dqm-${pos}`).value);
            const el = document.getElementById(`${cond}-${pos}-diff`);
            if (!isNaN(p) && !isNaN(s) && !isNaN(dqm)) el.value = Math.abs(((p + s) / 2) - dqm).toFixed(2);
        });
    } else {
        const off = parseFloat(document.getElementById(`sim-${cond}-fwd-offset`).value) || 0;
        for (let i = 1; i <= 3; i++) {
            const d = parseFloat(document.getElementById(`sim-${cond}-fwd-depth-${i}`).value);
            const r = parseFloat(document.getElementById(`sim-${cond}-fwd-reading-${i}`).value);
            const el = document.getElementById(`sim-${cond}-fwd-diff-${i}`);
            if (!isNaN(d) && !isNaN(r)) el.value = Math.abs((d + off) - r).toFixed(1);
        }
    }
}

function calcUllage(cond) {
    ['fwd', 'aft'].forEach(pos => {
        const p = parseFloat(document.getElementById(`ullage-${cond}-${pos}-port`).value);
        const s = parseFloat(document.getElementById(`ullage-${cond}-${pos}-stbd`).value);
        const dqm = parseFloat(document.getElementById(`ullage-${cond}-dqm-${pos}`).value);
        const el = document.getElementById(`ullage-${cond}-diff-${pos}`);
        if (!isNaN(p) && !isNaN(s) && !isNaN(dqm)) el.value = Math.abs(((p + s) / 2) - dqm).toFixed(2);
    });
}

function calcDraghead() {
    ['port', 'stbd'].forEach(side => {
        const off = parseFloat(document.getElementById(`dh-${side}-offset`).value) || 0;
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
    if (document.getElementById('velocity-method').value === 'dye') {
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
        const m = parseFloat(document.getElementById(`bpos-man-${i}`).value);
        const d = parseFloat(document.getElementById(`bpos-dqm-${i}`).value);
        const el = document.getElementById(`bpos-diff-${i}`);
        if (!isNaN(m) && !isNaN(d)) el.value = Math.abs(m - d).toFixed(1);
    }
}

window.handleHullPhoto = (input) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById('hull-photo-preview');
        img.src = e.target.result;
        img.style.display = 'block';
        if (!appState.qaChecks.hullStatus) appState.qaChecks.hullStatus = {};
        appState.qaChecks.hullStatus.photoData = e.target.result;
    };
    if (input.files[0]) reader.readAsDataURL(input.files[0]);
};
