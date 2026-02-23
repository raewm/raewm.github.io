const appState = {
    plants: [],
    checkDate: '',
    weatherConditions: '',
    qaTeam: '',
    systemProvider: '',
    timeline: [],
    generalComments: '',
    qaChecks: {}
};

// ===== Vessel Profiles Configuration =====
const vesselProfiles = {
    'Scow': ['Monitoring', 'Ullage'],
    'Hopper Dredge': ['Standard'],
    'Pipeline Dredge': ['Standard', 'Small Business'],
    'Mechanical Dredge': ['Standard']
};

// ===== Required Checks by Profile =====
const requiredChecks = {
    'Scow-Monitoring': ['positionCheck', 'hullStatus', 'draftSensorLight', 'draftSensorLoaded'],
    'Scow-Ullage': ['positionCheck', 'hullStatus', 'draftSensorLight', 'draftSensorLoaded', 'ullageLight', 'ullageLoaded'],
    'Hopper Dredge-Standard': ['positionCheck', 'hullStatus', 'draftSensorLight', 'draftSensorLoaded', 'ullageLight', 'ullageLoaded', 'dragheadDepth'],
    'Pipeline Dredge-Standard': ['positionCheck', 'suctionMouthDepth', 'velocity'],
    'Pipeline Dredge-Small Business': ['positionCheck', 'suctionMouthDepth'],
    'Mechanical Dredge-Standard': ['positionCheck', 'bucketDepth', 'bucketPosition']
};

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    loadDraft();
});

function initializeApp() {
    // Set default date to today
    document.getElementById('check-date').valueAsDate = new Date();

    // Add first plant entry
    addPlant();

    // Event listeners
    document.getElementById('add-plant-btn').addEventListener('click', addPlant);
    document.getElementById('save-draft-btn').addEventListener('click', saveDraft);
    document.getElementById('export-btn').addEventListener('click', exportJSON);
    document.getElementById('clear-btn').addEventListener('click', clearAll);
    document.getElementById('check-date').addEventListener('change', updateAppState);
    document.getElementById('qa-team').addEventListener('input', updateAppState);
    document.getElementById('system-provider').addEventListener('input', updateAppState);
    document.getElementById('general-comments').addEventListener('input', updateAppState);
    document.getElementById('add-timeline-comment-btn').addEventListener('click', addTimelineComment);

    // Render timeline table
    renderTimeline();
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
        <div class="plant-grid">
            <div class="form-group">
                <label>Plant/Vessel Name</label>
                <input type="text" class="plant-name" placeholder="Enter plant name" required>
            </div>
            <div class="form-group">
                <label>Vessel Type</label>
                <select class="vessel-type" onchange="updateProfileOptions(this)">
                    <option value="">Select...</option>
                    <option value="Scow">Scow</option>
                    <option value="Hopper Dredge">Hopper Dredge</option>
                    <option value="Pipeline Dredge">Pipeline Dredge</option>
                    <option value="Mechanical Dredge">Mechanical Dredge</option>
                </select>
            </div>
            <div class="form-group">
                <label>Profile</label>
                <select class="vessel-profile" disabled>
                    <option value="">Select type first</option>
                </select>
            </div>
        </div>
    `;

    container.appendChild(plantEntry);

    // Add event listeners
    plantEntry.querySelector('.plant-name').addEventListener('input', updatePlants);
    plantEntry.querySelector('.vessel-type').addEventListener('change', updatePlants);
    plantEntry.querySelector('.vessel-profile').addEventListener('change', updatePlants);

    updatePlants();
}

function removePlant(btn) {
    if (confirm('Remove this plant entry?')) {
        btn.closest('.plant-entry').remove();
        renumberPlants();
        updatePlants();
    }
}

function renumberPlants() {
    const plants = document.querySelectorAll('.plant-entry');
    plants.forEach((plant, index) => {
        plant.querySelector('.plant-number').textContent = `Plant #${index + 1}`;
    });
}

function updateProfileOptions(selectElement) {
    const vesselType = selectElement.value;
    const plantEntry = selectElement.closest('.plant-entry');
    const profileSelect = plantEntry.querySelector('.vessel-profile');

    profileSelect.innerHTML = '<option value="">Select...</option>';

    if (vesselType && vesselProfiles[vesselType]) {
        profileSelect.disabled = false;
        vesselProfiles[vesselType].forEach(profile => {
            const option = document.createElement('option');
            option.value = profile;
            option.textContent = profile;
            profileSelect.appendChild(option);
        });
    } else {
        profileSelect.disabled = true;
    }

    updatePlants();
}

function updatePlants() {
    const plantEntries = document.querySelectorAll('.plant-entry');
    appState.plants = [];

    plantEntries.forEach(entry => {
        const name = entry.querySelector('.plant-name').value;
        const vesselType = entry.querySelector('.vessel-type').value;
        const profile = entry.querySelector('.vessel-profile').value;

        if (name && vesselType && profile) {
            appState.plants.push({ name, vesselType, profile });
        }
    });

    updateQAChecks();
    saveDraft();
}

// ===== QA Checks Management =====
function updateQAChecks() {
    const checksNeeded = new Set();

    appState.plants.forEach(plant => {
        const key = `${plant.vesselType}-${plant.profile}`;
        const checks = requiredChecks[key] || [];
        checks.forEach(check => checksNeeded.add(check));
    });

    renderQAChecks(Array.from(checksNeeded));
}

function renderQAChecks(checks) {
    const container = document.getElementById('qa-checks-container');
    container.innerHTML = '';

    checks.forEach(checkType => {
        const checkCard = createCheckCard(checkType);
        container.appendChild(checkCard);
    });
}

function createCheckCard(checkType) {
    const card = document.createElement('section');
    card.className = 'card';
    card.id = `${checkType}-card`;
    card.dataset.checkType = checkType;

    const content = getCheckContent(checkType);
    card.innerHTML = content;

    // Add event listeners to all inputs
    setTimeout(() => {
        card.querySelectorAll('input, textarea, select').forEach(input => {
            input.addEventListener('input', () => {
                saveCheckData(checkType);
                calculateDifferences(checkType);
            });
            input.addEventListener('change', () => {
                saveCheckData(checkType);
                calculateDifferences(checkType);
            });
        });

        // Add log to timeline button handler
        const logBtn = card.querySelector('.log-timeline-btn');
        if (logBtn) {
            logBtn.addEventListener('click', () => logCheckToTimeline(checkType));
        }
    }, 0);

    return card;
}

// ===== Check Content Generators =====
function getCheckContent(checkType) {
    switch (checkType) {
        case 'positionCheck':
            return createPositionCheckForm();
        case 'hullStatus':
            return createHullStatusForm();
        case 'draftSensorLight':
            return createDraftSensorLightForm();
        case 'draftSensorLoaded':
            return createDraftSensorLoadedForm();
        case 'ullageLight':
            return createUllageLightForm();
        case 'ullageLoaded':
            return createUllageLoadedForm();
        case 'dragheadDepth':
            return createDragheadDepthForm();
        case 'suctionMouthDepth':
            return createSuctionMouthDepthForm();
        case 'velocity':
            return createVelocityForm();
        case 'bucketDepth':
            return createBucketDepthForm();
        case 'bucketPosition':
            return createBucketPositionForm();
        default:
            return '<p>Unknown check type</p>';
    }
}

function createPositionCheckForm() {
    const isScow = appState.plants.some(p => p.vesselType === 'Scow');

    return `
        <h2>Position Check</h2>
        
        <h3>Static Position Check</h3>
        <div class="form-group">
            <label>Handheld GPS Position</label>
            <button type="button" class="gps-button" onclick="captureGPS('handheld')">
                📡 Capture Device GPS
            </button>
            <div class="input-row mt-1">
                <input type="number" id="handheld-lat" step="0.000001" placeholder="Latitude">
                <input type="number" id="handheld-lon" step="0.000001" placeholder="Longitude">
            </div>
        </div>
        
        <div class="form-group">
            <label>DQM System Position</label>
            <div class="input-row">
                <input type="number" id="dqm-lat" step="0.000001" placeholder="Latitude">
                <input type="number" id="dqm-lon" step="0.000001" placeholder="Longitude">
            </div>
        </div>
        
        <div class="input-row">
            <div class="form-group">
                <label>Number of Satellites</label>
                <input type="number" id="satellites" placeholder="Satellite count">
            </div>
            <div class="form-group">
                <label>Position Difference (ft)</label>
                <input type="number" id="position-diff" step="0.1" placeholder="Auto-calculated or manual">
            </div>
        </div>
        
        <div class="form-group">
            <label>Remarks</label>
            <textarea id="position-remarks" rows="2" placeholder="GPS accuracy, conditions, etc."></textarea>
        </div>
        
        ${isScow ? `
        <h3>Dynamic Position Check (Scow)</h3>
        <div class="form-group">
            <label>Dynamic Check Performed</label>
            <select id="dynamic-performed">
                <option value="">Select...</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
            </select>
        </div>
        <div class="form-group">
            <label>Dynamic Check Notes</label>
            <textarea id="dynamic-notes" rows="3" placeholder="Track comparison notes, disposal area data interval changes, etc."></textarea>
        </div>
        ` : ''}
        
        <button type="button" class="log-timeline-btn">📋 Log to Timeline</button>
    `;
}

function createHullStatusForm() {
    return `
        <h2>Hull Status Check</h2>

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
            <input type="file" id="hull-open-photo" accept="image/*" onchange="previewHullPhoto(this, 'hull-open-photo-preview')">
            <img id="hull-open-photo-preview" style="display:none; max-width:100%; max-height:200px; margin-top:8px; border-radius:6px; border:1px solid #444;" alt="Closed to Open photo">
        </div>

        <div class="form-group">
            <label>Photo Reference (Open to Closed)</label>
            <input type="file" id="hull-close-photo" accept="image/*" onchange="previewHullPhoto(this, 'hull-close-photo-preview')">
            <img id="hull-close-photo-preview" style="display:none; max-width:100%; max-height:200px; margin-top:8px; border-radius:6px; border:1px solid #444;" alt="Open to Closed photo">
        </div>

        <div class="form-group">
            <label>Remarks</label>
            <textarea id="hull-remarks" rows="2" placeholder="Additional observations"></textarea>
        </div>

        <button type="button" class="log-timeline-btn">📋 Log to Timeline</button>
    `;
}

function createDraftSensorLightForm() {
    return `
        <h2>Draft Sensor Check — Light Condition</h2>
        <p class="text-muted">Perform this check when the vessel is light (empty hopper/scow). Record physical draft marks and compare to DQM system readings.</p>

        <div class="form-group">
            <label>Check Method</label>
            <select id="draft-light-check-method" onchange="toggleDraftLightMethod()">
                <option value="physical">Physical Draft Check</option>
                <option value="simulated">Simulated Draft Check (Test Pipe Method)</option>
            </select>
        </div>

        <div id="physical-draft-light-section">
            <h3 style="margin-top: 15px; margin-bottom: 10px;">Forward Sensors</h3>
            <div class="input-row">
                <div class="form-group">
                    <label>Forward Port (ft)</label>
                    <input type="number" id="light-fwd-port" step="0.1" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>Forward Starboard (ft)</label>
                    <input type="number" id="light-fwd-stbd" step="0.1" placeholder="0.0">
                </div>
            </div>
            <div class="input-row-3">
                <div class="form-group">
                    <label>Fwd Avg (ft)</label>
                    <input type="number" id="light-fwd-avg" step="0.01" readonly placeholder="Auto-calc">
                </div>
                <div class="form-group">
                    <label>DQM System Fwd (ft)</label>
                    <input type="number" id="light-dqm-fwd" step="0.1" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>Fwd Diff (ft)</label>
                    <input type="number" id="light-fwd-diff" step="0.01" readonly placeholder="Auto-calc">
                </div>
            </div>
            <div style="margin-top: 10px; margin-bottom: 20px;">
                <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Light Physical Draft Check (Forward) Completed', this)">📋 Log Physical Fwd</button>
            </div>

            <hr style="margin: 20px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.1);">

            <h3 style="margin-top: 15px; margin-bottom: 10px;">Aft Sensors</h3>
            <div class="input-row">
                <div class="form-group">
                    <label>Aft Port (ft)</label>
                    <input type="number" id="light-aft-port" step="0.1" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>Aft Starboard (ft)</label>
                    <input type="number" id="light-aft-stbd" step="0.1" placeholder="0.0">
                </div>
            </div>
            <div class="input-row-3">
                <div class="form-group">
                    <label>Aft Avg (ft)</label>
                    <input type="number" id="light-aft-avg" step="0.01" readonly placeholder="Auto-calc">
                </div>
                <div class="form-group">
                    <label>DQM System Aft (ft)</label>
                    <input type="number" id="light-dqm-aft" step="0.1" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>Aft Diff (ft)</label>
                    <input type="number" id="light-aft-diff" step="0.01" readonly placeholder="Auto-calc">
                </div>
            </div>
            <div style="margin-top: 10px; margin-bottom: 20px;">
                <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Light Physical Draft Check (Aft) Completed', this)">📋 Log Physical Aft</button>
            </div>
        </div>

        <div id="simulated-draft-light-section" class="hidden">
            <h3>Simulated Draft Check — Forward Sensor (Light)</h3>
            <p class="text-muted">Test pipe method: Measure sensor response at known water depths</p>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 1 (ft)</label><input type="number" id="sim-light-fwd-depth-1" step="0.1" placeholder="e.g., 5.0"></div>
                <div class="form-group"><label>DQM Reading 1 (ft)</label><input type="number" id="sim-light-fwd-reading-1" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-light-fwd-diff-1" step="0.1" readonly placeholder="Auto-calc"></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 2 (ft)</label><input type="number" id="sim-light-fwd-depth-2" step="0.1" placeholder="e.g., 10.0"></div>
                <div class="form-group"><label>DQM Reading 2 (ft)</label><input type="number" id="sim-light-fwd-reading-2" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-light-fwd-diff-2" step="0.1" readonly placeholder="Auto-calc"></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 3 (ft)</label><input type="number" id="sim-light-fwd-depth-3" step="0.1" placeholder="e.g., 15.0"></div>
                <div class="form-group"><label>DQM Reading 3 (ft)</label><input type="number" id="sim-light-fwd-reading-3" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-light-fwd-diff-3" step="0.1" readonly placeholder="Auto-calc"></div>
            </div>
            <div style="margin-top: 10px; margin-bottom: 20px;">
                <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Light Simulated Draft Check (Forward) Completed', this)">📋 Log Simulated Fwd</button>
            </div>

            <hr style="margin: 20px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.1);">

            <h3>Simulated Draft Check — Aft Sensor (Light)</h3>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 1 (ft)</label><input type="number" id="sim-light-aft-depth-1" step="0.1" placeholder="e.g., 5.0"></div>
                <div class="form-group"><label>DQM Reading 1 (ft)</label><input type="number" id="sim-light-aft-reading-1" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-light-aft-diff-1" step="0.1" readonly placeholder="Auto-calc"></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 2 (ft)</label><input type="number" id="sim-light-aft-depth-2" step="0.1" placeholder="e.g., 10.0"></div>
                <div class="form-group"><label>DQM Reading 2 (ft)</label><input type="number" id="sim-light-aft-reading-2" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-light-aft-diff-2" step="0.1" readonly placeholder="Auto-calc"></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 3 (ft)</label><input type="number" id="sim-light-aft-depth-3" step="0.1" placeholder="e.g., 15.0"></div>
                <div class="form-group"><label>DQM Reading 3 (ft)</label><input type="number" id="sim-light-aft-reading-3" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-light-aft-diff-3" step="0.1" readonly placeholder="Auto-calc"></div>
            </div>
            <div style="margin-top: 10px; margin-bottom: 20px;">
                <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Light Simulated Draft Check (Aft) Completed', this)">📋 Log Simulated Aft</button>
            </div>

            <div class="form-group">
                <label>Test Pipe Details</label>
                <textarea id="sim-light-pipe-details" rows="2" placeholder="Pipe length, fill method, calibration notes, etc."></textarea>
            </div>
        </div>

        <div class="form-group">
            <label>Remarks</label>
            <textarea id="draft-light-remarks" rows="2" placeholder="Observations, calibration status, etc."></textarea>
        </div>
    `;
}

function createDraftSensorLoadedForm() {
    return `
        <h2>Draft Sensor Check — Loaded Condition</h2>
        <p class="text-muted">Perform this check when the vessel is loaded (full hopper/scow). Record physical draft marks and compare to DQM system readings.</p>

        <div class="form-group">
            <label>Check Method</label>
            <select id="draft-loaded-check-method" onchange="toggleDraftLoadedMethod()">
                <option value="physical">Physical Draft Check</option>
                <option value="simulated">Simulated Draft Check (Test Pipe Method)</option>
            </select>
        </div>

        <div id="physical-draft-loaded-section">
            <h3 style="margin-top: 15px; margin-bottom: 10px;">Forward Sensors</h3>
            <div class="input-row">
                <div class="form-group">
                    <label>Forward Port (ft)</label>
                    <input type="number" id="loaded-fwd-port" step="0.1" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>Forward Starboard (ft)</label>
                    <input type="number" id="loaded-fwd-stbd" step="0.1" placeholder="0.0">
                </div>
            </div>
            <div class="input-row-3">
                <div class="form-group">
                    <label>Fwd Avg (ft)</label>
                    <input type="number" id="loaded-fwd-avg" step="0.01" readonly placeholder="Auto-calc">
                </div>
                <div class="form-group">
                    <label>DQM System Fwd (ft)</label>
                    <input type="number" id="loaded-dqm-fwd" step="0.1" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>Fwd Diff (ft)</label>
                    <input type="number" id="loaded-fwd-diff" step="0.01" readonly placeholder="Auto-calc">
                </div>
            </div>
            <div style="margin-top: 10px; margin-bottom: 20px;">
                <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Loaded Physical Draft Check (Forward) Completed', this)">📋 Log Physical Fwd</button>
            </div>

            <hr style="margin: 20px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.1);">

            <h3 style="margin-top: 15px; margin-bottom: 10px;">Aft Sensors</h3>
            <div class="input-row">
                <div class="form-group">
                    <label>Aft Port (ft)</label>
                    <input type="number" id="loaded-aft-port" step="0.1" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>Aft Starboard (ft)</label>
                    <input type="number" id="loaded-aft-stbd" step="0.1" placeholder="0.0">
                </div>
            </div>
            <div class="input-row-3">
                <div class="form-group">
                    <label>Aft Avg (ft)</label>
                    <input type="number" id="loaded-aft-avg" step="0.01" readonly placeholder="Auto-calc">
                </div>
                <div class="form-group">
                    <label>DQM System Aft (ft)</label>
                    <input type="number" id="loaded-dqm-aft" step="0.1" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>Aft Diff (ft)</label>
                    <input type="number" id="loaded-aft-diff" step="0.01" readonly placeholder="Auto-calc">
                </div>
            </div>
            <div style="margin-top: 10px; margin-bottom: 20px;">
                <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Loaded Physical Draft Check (Aft) Completed', this)">📋 Log Physical Aft</button>
            </div>
        </div>

        <div id="simulated-draft-loaded-section" class="hidden">
            <h3>Simulated Draft Check — Forward Sensor (Loaded)</h3>
            <p class="text-muted">Test pipe method: Measure sensor response at known water depths</p>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 1 (ft)</label><input type="number" id="sim-loaded-fwd-depth-1" step="0.1" placeholder="e.g., 5.0"></div>
                <div class="form-group"><label>DQM Reading 1 (ft)</label><input type="number" id="sim-loaded-fwd-reading-1" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-loaded-fwd-diff-1" step="0.1" readonly placeholder="Auto-calc"></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 2 (ft)</label><input type="number" id="sim-loaded-fwd-depth-2" step="0.1" placeholder="e.g., 10.0"></div>
                <div class="form-group"><label>DQM Reading 2 (ft)</label><input type="number" id="sim-loaded-fwd-reading-2" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-loaded-fwd-diff-2" step="0.1" readonly placeholder="Auto-calc"></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 3 (ft)</label><input type="number" id="sim-loaded-fwd-depth-3" step="0.1" placeholder="e.g., 15.0"></div>
                <div class="form-group"><label>DQM Reading 3 (ft)</label><input type="number" id="sim-loaded-fwd-reading-3" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-loaded-fwd-diff-3" step="0.1" readonly placeholder="Auto-calc"></div>
            </div>
            <div style="margin-top: 10px; margin-bottom: 20px;">
                <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Loaded Simulated Draft Check (Forward) Completed', this)">📋 Log Simulated Fwd</button>
            </div>

            <hr style="margin: 20px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.1);">

            <h3>Simulated Draft Check — Aft Sensor (Loaded)</h3>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 1 (ft)</label><input type="number" id="sim-loaded-aft-depth-1" step="0.1" placeholder="e.g., 5.0"></div>
                <div class="form-group"><label>DQM Reading 1 (ft)</label><input type="number" id="sim-loaded-aft-reading-1" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-loaded-aft-diff-1" step="0.1" readonly placeholder="Auto-calc"></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 2 (ft)</label><input type="number" id="sim-loaded-aft-depth-2" step="0.1" placeholder="e.g., 10.0"></div>
                <div class="form-group"><label>DQM Reading 2 (ft)</label><input type="number" id="sim-loaded-aft-reading-2" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-loaded-aft-diff-2" step="0.1" readonly placeholder="Auto-calc"></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 3 (ft)</label><input type="number" id="sim-loaded-aft-depth-3" step="0.1" placeholder="e.g., 15.0"></div>
                <div class="form-group"><label>DQM Reading 3 (ft)</label><input type="number" id="sim-loaded-aft-reading-3" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-loaded-aft-diff-3" step="0.1" readonly placeholder="Auto-calc"></div>
            </div>
            <div style="margin-top: 10px; margin-bottom: 20px;">
                <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Loaded Simulated Draft Check (Aft) Completed', this)">📋 Log Simulated Aft</button>
            </div>

            <div class="form-group">
                <label>Test Pipe Details</label>
                <textarea id="sim-loaded-pipe-details" rows="2" placeholder="Pipe length, fill method, calibration notes, etc."></textarea>
            </div>
        </div>

        <div class="form-group">
            <label>Remarks</label>
            <textarea id="draft-loaded-remarks" rows="2" placeholder="Observations, calibration status, etc."></textarea>
        </div>
    `;
}

// Toggle functions for split draft check methods
function toggleDraftLightMethod() {
    const method = document.getElementById('draft-light-check-method')?.value;
    document.getElementById('physical-draft-light-section')?.classList.toggle('hidden', method === 'simulated');
    document.getElementById('simulated-draft-light-section')?.classList.toggle('hidden', method !== 'simulated');
}

function toggleDraftLoadedMethod() {
    const method = document.getElementById('draft-loaded-check-method')?.value;
    document.getElementById('physical-draft-loaded-section')?.classList.toggle('hidden', method === 'simulated');
    document.getElementById('simulated-draft-loaded-section')?.classList.toggle('hidden', method !== 'simulated');
}

function createDraftSensorSimulatedForm() {
    return `
        <h2>Draft Sensor Check — Simulated (Test Pipe Method)</h2>
        <p class="text-muted">Use the test pipe method to simulate known water depths at the sensor. Record at least 3 measurements for each sensor location.</p>

        <h3>Forward Sensor</h3>
        <div class="input-row-3">
            <div class="form-group"><label>Test Depth 1 (ft)</label><input type="number" id="sim-fwd-depth-1" step="0.1" placeholder="e.g., 5.0"></div>
            <div class="form-group"><label>DQM Reading 1 (ft)</label><input type="number" id="sim-fwd-reading-1" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-fwd-diff-1" step="0.1" readonly placeholder="Auto-calc"></div>
        </div>
        <div class="input-row-3">
            <div class="form-group"><label>Test Depth 2 (ft)</label><input type="number" id="sim-fwd-depth-2" step="0.1" placeholder="e.g., 10.0"></div>
            <div class="form-group"><label>DQM Reading 2 (ft)</label><input type="number" id="sim-fwd-reading-2" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-fwd-diff-2" step="0.1" readonly placeholder="Auto-calc"></div>
        </div>
        <div class="input-row-3">
            <div class="form-group"><label>Test Depth 3 (ft)</label><input type="number" id="sim-fwd-depth-3" step="0.1" placeholder="e.g., 15.0"></div>
            <div class="form-group"><label>DQM Reading 3 (ft)</label><input type="number" id="sim-fwd-reading-3" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-fwd-diff-3" step="0.1" readonly placeholder="Auto-calc"></div>
        </div>

        <h3>Aft Sensor</h3>
        <div class="input-row-3">
            <div class="form-group"><label>Test Depth 1 (ft)</label><input type="number" id="sim-aft-depth-1" step="0.1" placeholder="e.g., 5.0"></div>
            <div class="form-group"><label>DQM Reading 1 (ft)</label><input type="number" id="sim-aft-reading-1" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-aft-diff-1" step="0.1" readonly placeholder="Auto-calc"></div>
        </div>
        <div class="input-row-3">
            <div class="form-group"><label>Test Depth 2 (ft)</label><input type="number" id="sim-aft-depth-2" step="0.1" placeholder="e.g., 10.0"></div>
            <div class="form-group"><label>DQM Reading 2 (ft)</label><input type="number" id="sim-aft-reading-2" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-aft-diff-2" step="0.1" readonly placeholder="Auto-calc"></div>
        </div>
        <div class="input-row-3">
            <div class="form-group"><label>Test Depth 3 (ft)</label><input type="number" id="sim-aft-depth-3" step="0.1" placeholder="e.g., 15.0"></div>
            <div class="form-group"><label>DQM Reading 3 (ft)</label><input type="number" id="sim-aft-reading-3" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-aft-diff-3" step="0.1" readonly placeholder="Auto-calc"></div>
        </div>

        <div class="form-group">
            <label>Test Pipe Details</label>
            <textarea id="sim-pipe-details" rows="2" placeholder="Pipe length, fill method, calibration notes, etc."></textarea>
        </div>
        <div class="form-group">
            <label>Remarks</label>
            <textarea id="sim-draft-remarks" rows="2" placeholder="Observations, calibration status, etc."></textarea>
        </div>

        <div class="form-group" style="display: flex; gap: 10px; margin-top: 15px;">
            <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Simulated Draft Check (Forward) Completed', this)">📋 Log Fwd to Timeline</button>
            <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Simulated Draft Check (Aft) Completed', this)">📋 Log Aft to Timeline</button>
        </div>
    `;
}

function createUllageLightForm() {
    return `
        <h2>Ullage Check — Light Condition</h2>
        <p class="text-muted">Perform this check when the hopper/bin is empty. Record manual weighted tape soundings and compare to DQM system readings. Acceptable difference: ±0.1 ft.</p>

        <h3 style="margin-top: 15px; margin-bottom: 10px;">Forward Sensors</h3>
        <div class="input-row">
            <div class="form-group">
                <label>Forward Port Sounding (ft)</label>
                <input type="number" id="ullage-light-fwd-port" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Forward Starboard Sounding (ft)</label>
                <input type="number" id="ullage-light-fwd-stbd" step="0.1" placeholder="0.0">
            </div>
        </div>
        <div class="input-row">
            <div class="form-group">
                <label>DQM System Forward (ft)</label>
                <input type="number" id="ullage-light-dqm-fwd" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Fwd Diff (ft)</label>
                <input type="number" id="ullage-light-diff-fwd" step="0.01" placeholder="Auto-calc" readonly>
            </div>
        </div>
        <div style="margin-top: 10px; margin-bottom: 20px;">
            <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Light Ullage Check (Forward) Completed', this)">📋 Log Fwd to Timeline</button>
        </div>

        <hr style="margin: 20px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.1);">

        <h3 style="margin-top: 15px; margin-bottom: 10px;">Aft Sensors</h3>
        <div class="input-row">
            <div class="form-group">
                <label>Aft Port Sounding (ft)</label>
                <input type="number" id="ullage-light-aft-port" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Aft Starboard Sounding (ft)</label>
                <input type="number" id="ullage-light-aft-stbd" step="0.1" placeholder="0.0">
            </div>
        </div>
        <div class="input-row">
            <div class="form-group">
                <label>DQM System Aft (ft)</label>
                <input type="number" id="ullage-light-dqm-aft" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Aft Diff (ft)</label>
                <input type="number" id="ullage-light-diff-aft" step="0.01" placeholder="Auto-calc" readonly>
            </div>
        </div>
        <div style="margin-top: 10px; margin-bottom: 20px;">
            <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Light Ullage Check (Aft) Completed', this)">📋 Log Aft to Timeline</button>
        </div>

        <div class="form-group">
            <label>Remarks</label>
            <textarea id="ullage-light-remarks" rows="2" placeholder="Measurement notes, etc."></textarea>
        </div>
    `;
}

function createUllageLoadedForm() {
    return `
        <h2>Ullage Check — Loaded Condition</h2>
        <p class="text-muted">Perform this check after the bin/hopper is loaded. Ensure a uniform material surface before taking soundings. Acceptable difference: ±0.1 ft.</p>

        <h3 style="margin-top: 15px; margin-bottom: 10px;">Forward Sensors</h3>
        <div class="input-row">
            <div class="form-group">
                <label>Forward Port Sounding (ft)</label>
                <input type="number" id="ullage-loaded-fwd-port" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Forward Starboard Sounding (ft)</label>
                <input type="number" id="ullage-loaded-fwd-stbd" step="0.1" placeholder="0.0">
            </div>
        </div>
        <div class="input-row">
            <div class="form-group">
                <label>DQM System Forward (ft)</label>
                <input type="number" id="ullage-loaded-dqm-fwd" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Fwd Diff (ft)</label>
                <input type="number" id="ullage-loaded-diff-fwd" step="0.01" placeholder="Auto-calc" readonly>
            </div>
        </div>
        <div style="margin-top: 10px; margin-bottom: 20px;">
            <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Loaded Ullage Check (Forward) Completed', this)">📋 Log Fwd to Timeline</button>
        </div>

        <hr style="margin: 20px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.1);">

        <h3 style="margin-top: 15px; margin-bottom: 10px;">Aft Sensors</h3>
        <div class="input-row">
            <div class="form-group">
                <label>Aft Port Sounding (ft)</label>
                <input type="number" id="ullage-loaded-aft-port" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Aft Starboard Sounding (ft)</label>
                <input type="number" id="ullage-loaded-aft-stbd" step="0.1" placeholder="0.0">
            </div>
        </div>
        <div class="input-row">
            <div class="form-group">
                <label>DQM System Aft (ft)</label>
                <input type="number" id="ullage-loaded-dqm-aft" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Aft Diff (ft)</label>
                <input type="number" id="ullage-loaded-diff-aft" step="0.01" placeholder="Auto-calc" readonly>
            </div>
        </div>
        <div style="margin-top: 10px; margin-bottom: 20px;">
            <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Loaded Ullage Check (Aft) Completed', this)">📋 Log Aft to Timeline</button>
        </div>

        <div class="form-group">
            <label>Remarks</label>
            <textarea id="ullage-loaded-remarks" rows="2" placeholder="Material type, measurement notes, etc."></textarea>
        </div>
    `;
}

function createDragheadDepthForm() {
    return `
        <h2>Draghead Depth Check</h2>
        
        <p class="text-muted">Select which dragheads to record measurements for:</p>
        <div class="form-group" style="display: flex; gap: 15px; margin-bottom: 20px;">
            <label style="display: flex; align-items: center; gap: 5px; font-weight: normal; cursor: pointer;">
                <input type="checkbox" id="draghead-check-port" onchange="toggleDragheadSections()"> Port
            </label>
            <label style="display: flex; align-items: center; gap: 5px; font-weight: normal; cursor: pointer;">
                <input type="checkbox" id="draghead-check-center" onchange="toggleDragheadSections()"> Center
            </label>
            <label style="display: flex; align-items: center; gap: 5px; font-weight: normal; cursor: pointer;">
                <input type="checkbox" id="draghead-check-stbd" onchange="toggleDragheadSections()"> Starboard
            </label>
        </div>

        <div id="draghead-port-section" class="hidden">
            <h3>Port Draghead</h3>
            <div class="form-group" style="margin-bottom: 20px;">
                <label>Depth Offset (ft)</label>
                <input type="number" id="draghead-port-offset" step="0.1" placeholder="e.g., 2.0">
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Measurement 1 - Manual (ft)</label><input type="number" id="draghead-port-manual-1" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Measurement 1 - DQM (ft)</label><input type="number" id="draghead-port-dqm-1" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="draghead-port-diff-1" step="0.1" placeholder="Auto-calc" readonly></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Measurement 2 - Manual (ft)</label><input type="number" id="draghead-port-manual-2" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Measurement 2 - DQM (ft)</label><input type="number" id="draghead-port-dqm-2" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="draghead-port-diff-2" step="0.1" placeholder="Auto-calc" readonly></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Measurement 3 - Manual (ft)</label><input type="number" id="draghead-port-manual-3" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Measurement 3 - DQM (ft)</label><input type="number" id="draghead-port-dqm-3" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="draghead-port-diff-3" step="0.1" placeholder="Auto-calc" readonly></div>
            </div>
            <div style="margin-top: 10px; margin-bottom: 20px;">
                <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Draghead Depth Check (Port) Completed', this)">📋 Log Port to Timeline</button>
            </div>
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.1);">
        </div>

        <div id="draghead-center-section" class="hidden">
            <h3>Center Draghead</h3>
            <div class="form-group" style="margin-bottom: 20px;">
                <label>Depth Offset (ft)</label>
                <input type="number" id="draghead-center-offset" step="0.1" placeholder="e.g., 2.0">
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Measurement 1 - Manual (ft)</label><input type="number" id="draghead-center-manual-1" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Measurement 1 - DQM (ft)</label><input type="number" id="draghead-center-dqm-1" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="draghead-center-diff-1" step="0.1" placeholder="Auto-calc" readonly></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Measurement 2 - Manual (ft)</label><input type="number" id="draghead-center-manual-2" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Measurement 2 - DQM (ft)</label><input type="number" id="draghead-center-dqm-2" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="draghead-center-diff-2" step="0.1" placeholder="Auto-calc" readonly></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Measurement 3 - Manual (ft)</label><input type="number" id="draghead-center-manual-3" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Measurement 3 - DQM (ft)</label><input type="number" id="draghead-center-dqm-3" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="draghead-center-diff-3" step="0.1" placeholder="Auto-calc" readonly></div>
            </div>
            <div style="margin-top: 10px; margin-bottom: 20px;">
                <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Draghead Depth Check (Center) Completed', this)">📋 Log Center to Timeline</button>
            </div>
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.1);">
        </div>
        
        <div id="draghead-stbd-section" class="hidden">
            <h3>Starboard Draghead</h3>
            <div class="form-group" style="margin-bottom: 20px;">
                <label>Depth Offset (ft)</label>
                <input type="number" id="draghead-stbd-offset" step="0.1" placeholder="e.g., 2.0">
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Measurement 1 - Manual (ft)</label><input type="number" id="draghead-stbd-manual-1" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Measurement 1 - DQM (ft)</label><input type="number" id="draghead-stbd-dqm-1" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="draghead-stbd-diff-1" step="0.1" placeholder="Auto-calc" readonly></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Measurement 2 - Manual (ft)</label><input type="number" id="draghead-stbd-manual-2" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Measurement 2 - DQM (ft)</label><input type="number" id="draghead-stbd-dqm-2" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="draghead-stbd-diff-2" step="0.1" placeholder="Auto-calc" readonly></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Measurement 3 - Manual (ft)</label><input type="number" id="draghead-stbd-manual-3" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Measurement 3 - DQM (ft)</label><input type="number" id="draghead-stbd-dqm-3" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="draghead-stbd-diff-3" step="0.1" placeholder="Auto-calc" readonly></div>
            </div>
            <div style="margin-top: 10px; margin-bottom: 20px;">
                <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Draghead Depth Check (Starboard) Completed', this)">📋 Log Stbd to Timeline</button>
            </div>
        </div>
        
        <div class="form-group">
            <label>Remarks</label>
            <textarea id="draghead-remarks" rows="2"></textarea>
        </div>
    `;
}

function toggleDragheadSections() {
    const port = document.getElementById('draghead-check-port')?.checked;
    const center = document.getElementById('draghead-check-center')?.checked;
    const stbd = document.getElementById('draghead-check-stbd')?.checked;

    document.getElementById('draghead-port-section')?.classList.toggle('hidden', !port);
    document.getElementById('draghead-center-section')?.classList.toggle('hidden', !center);
    document.getElementById('draghead-stbd-section')?.classList.toggle('hidden', !stbd);
}

function createSuctionMouthDepthForm() {
    return `
        <h2>Suction Mouth Depth Check</h2>

        <div class="form-group">
            <label>Depth Offset (ft)</label>
            <input type="number" id="suction-offset" step="0.1" placeholder="e.g., 2.0">
        </div>
        
        <p class="text-muted">Record at least 3 measurements within the operating range</p>
        
        <div class="input-row-3">
            <div class="form-group">
                <label>Measurement 1 - Manual (ft)</label>
                <input type="number" id="suction-manual-1" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Measurement 1 - DQM System (ft)</label>
                <input type="number" id="suction-dqm-1" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Difference (ft)</label>
                <input type="number" id="suction-diff-1" step="0.1" placeholder="Auto-calc" readonly>
            </div>
        </div>
        
        <div class="input-row-3">
            <div class="form-group">
                <label>Measurement 2 - Manual (ft)</label>
                <input type="number" id="suction-manual-2" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Measurement 2 - DQM System (ft)</label>
                <input type="number" id="suction-dqm-2" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Difference (ft)</label>
                <input type="number" id="suction-diff-2" step="0.1" placeholder="Auto-calc" readonly>
            </div>
        </div>
        
        <div class="input-row-3">
            <div class="form-group">
                <label>Measurement 3 - Manual (ft)</label>
                <input type="number" id="suction-manual-3" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Measurement 3 - DQM System (ft)</label>
                <input type="number" id="suction-dqm-3" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Difference (ft)</label>
                <input type="number" id="suction-diff-3" step="0.1" placeholder="Auto-calc" readonly>
            </div>
        </div>
        
        <div class="form-group">
            <label>Remarks</label>
            <textarea id="suction-remarks" rows="2"></textarea>
        </div>
        
        <button type="button" class="log-timeline-btn">📋 Log to Timeline</button>
    `;
}

function createVelocityForm() {
    return `
        <h2>Velocity Check</h2>
        
        <div class="form-group">
            <label>Test Method</label>
            <select id="velocity-method" onchange="toggleVelocityMethod()">
                <option value="">Select...</option>
                <option value="dye">Dye Test</option>
                <option value="meter">External Meter</option>
            </select>
        </div>
        
        <div id="velocity-dye-section" class="hidden">
            <div class="form-group">
                <label>Pipeline Length (ft)</label>
                <input type="number" id="velocity-pipe-length" step="0.1" placeholder="Distance from dye injection to outfall">
            </div>
            
            <p class="text-muted">Record up to 3 dye tests</p>
            
            ${[1, 2, 3].map(i => `
                <div class="form-group"><label style="color:#666; font-size:0.9em; text-transform:uppercase;">Test ${i}</label></div>
                <div class="input-row">
                    <div class="form-group">
                        <label>Travel Time (sec)</label>
                        <input type="number" id="velocity-dye-time-${i}" step="0.1" placeholder="Time">
                    </div>
                    <div class="form-group">
                        <label>Calc Velocity (ft/s)</label>
                        <input type="number" id="velocity-dye-calc-${i}" step="0.01" readonly placeholder="Auto-calc">
                    </div>
                </div>
                <div class="input-row" style="margin-bottom: 12px;">
                    <div class="form-group">
                        <label>DQM Velocity (ft/s)</label>
                        <input type="number" id="velocity-dye-dqm-${i}" step="0.01" placeholder="System">
                    </div>
                    <div class="form-group">
                        <label>Difference (ft/s)</label>
                        <input type="number" id="velocity-dye-diff-${i}" step="0.01" readonly placeholder="Auto-calc">
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div id="velocity-meter-section" class="hidden">
            <div class="form-group">
                <label>External Meter Calibration Date</label>
                <input type="date" id="velocity-cal-date">
            </div>
            
            <p class="text-muted">Record up to 3 external meter tests</p>
            
            ${[1, 2, 3].map(i => `
                <div class="input-row-3">
                    <div class="form-group"><label>Meter Velocity (ft/s)</label><input type="number" id="velocity-meter-manual-${i}" step="0.01" placeholder="0.00"></div>
                    <div class="form-group"><label>DQM Velocity (ft/s)</label><input type="number" id="velocity-meter-dqm-${i}" step="0.01" placeholder="0.00"></div>
                    <div class="form-group"><label>Difference (ft/s)</label><input type="number" id="velocity-meter-diff-${i}" step="0.01" readonly placeholder="Auto-calc"></div>
                </div>
            `).join('')}
        </div>
        
        <div class="form-group">
            <label>Remarks</label>
            <textarea id="velocity-remarks" rows="2" placeholder="Test observations, etc."></textarea>
        </div>
        
        <button type="button" class="log-timeline-btn">📋 Log to Timeline</button>
    `;
}

function toggleVelocityMethod() {
    const method = document.getElementById('velocity-method')?.value;
    document.getElementById('velocity-dye-section')?.classList.toggle('hidden', method !== 'dye');
    document.getElementById('velocity-meter-section')?.classList.toggle('hidden', method !== 'meter');
}

function createBucketDepthForm() {
    return `
        <h2>Bucket/Grab Depth Check</h2>
        <p class="text-muted">Lower bucket to known depth and verify DQM sensor accuracy. Record at least 3 measurements. Acceptable difference: ≤0.5 ft.</p>

        <div class="form-group">
            <label>Depth Offset — Attachment Point to Bucket Heel (ft)</label>
            <input type="number" id="bucket-offset" step="0.1" placeholder="e.g., 2.0">
        </div>

        <div class="input-row-3">
            <div class="form-group"><label>Measurement 1 — Manual (ft)</label><input type="number" id="bucket-manual-1" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Measurement 1 — DQM System (ft)</label><input type="number" id="bucket-dqm-1" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Difference (ft)</label><input type="number" id="bucket-diff-1" step="0.1" placeholder="Auto-calc" readonly></div>
        </div>
        <div class="input-row-3">
            <div class="form-group"><label>Measurement 2 — Manual (ft)</label><input type="number" id="bucket-manual-2" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Measurement 2 — DQM System (ft)</label><input type="number" id="bucket-dqm-2" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Difference (ft)</label><input type="number" id="bucket-diff-2" step="0.1" placeholder="Auto-calc" readonly></div>
        </div>
        <div class="input-row-3">
            <div class="form-group"><label>Measurement 3 — Manual (ft)</label><input type="number" id="bucket-manual-3" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Measurement 3 — DQM System (ft)</label><input type="number" id="bucket-dqm-3" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Difference (ft)</label><input type="number" id="bucket-diff-3" step="0.1" placeholder="Auto-calc" readonly></div>
        </div>

        <div class="form-group">
            <label>Remarks</label>
            <textarea id="bucket-depth-remarks" rows="2" placeholder="Sensor type, calibration notes, etc."></textarea>
        </div>

        <button type="button" class="log-timeline-btn">📋 Log to Timeline</button>
    `;
}

function createBucketPositionForm() {
    return `
        <h2>Bucket Position Check</h2>
        <p class="text-muted">Position boom at known angles and verify bucket positioning sensors/offsets against physical measurements. Acceptable difference: ≤10 ft (3 m).</p>

        <div class="form-group">
            <label>Reference Drawings Available</label>
            <select id="bucket-pos-drawings">
                <option value="">Select...</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
            </select>
        </div>

        <div class="form-group">
            <label>Measurement Tool Used</label>
            <select id="bucket-pos-tool">
                <option value="">Select...</option>
                <option value="tape">Measuring Tape</option>
                <option value="laser">Laser Rangefinder</option>
                <option value="other">Other</option>
            </select>
        </div>

        <div class="input-row-3">
            <div class="form-group"><label>Position 1 — Manual (ft)</label><input type="number" id="bucket-pos-manual-1" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Position 1 — DQM System (ft)</label><input type="number" id="bucket-pos-dqm-1" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Difference (ft)</label><input type="number" id="bucket-pos-diff-1" step="0.1" placeholder="Auto-calc" readonly></div>
        </div>
        <div class="input-row-3">
            <div class="form-group"><label>Position 2 — Manual (ft)</label><input type="number" id="bucket-pos-manual-2" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Position 2 — DQM System (ft)</label><input type="number" id="bucket-pos-dqm-2" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Difference (ft)</label><input type="number" id="bucket-pos-diff-2" step="0.1" placeholder="Auto-calc" readonly></div>
        </div>
        <div class="input-row-3">
            <div class="form-group"><label>Position 3 — Manual (ft)</label><input type="number" id="bucket-pos-manual-3" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Position 3 — DQM System (ft)</label><input type="number" id="bucket-pos-dqm-3" step="0.1" placeholder="0.0"></div>
            <div class="form-group"><label>Difference (ft)</label><input type="number" id="bucket-pos-diff-3" step="0.1" placeholder="Auto-calc" readonly></div>
        </div>

        <div class="form-group">
            <label>Boom Angles Tested</label>
            <input type="text" id="bucket-pos-angles" placeholder="e.g., 30°, 60°, 90° from centerline">
        </div>

        <div class="form-group">
            <label>Remarks</label>
            <textarea id="bucket-pos-remarks" rows="2" placeholder="Observations, offset corrections applied, etc."></textarea>
        </div>

        <button type="button" class="log-timeline-btn">📋 Log to Timeline</button>
    `;
}
function captureGPS(type) {
    const button = event.target;

    if (!navigator.geolocation) {
        alert('GPS not available on this device');
        return;
    }

    button.disabled = true;
    button.textContent = '⏳ Getting GPS...';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            document.getElementById('handheld-lat').value = lat.toFixed(6);
            document.getElementById('handheld-lon').value = lon.toFixed(6);

            button.disabled = false;
            button.textContent = '✅ GPS Captured';

            setTimeout(() => {
                button.textContent = '📡 Capture Device GPS';
            }, 2000);

            saveCheckData('positionCheck');
        },
        (error) => {
            alert(`GPS Error: ${error.message}`);
            button.disabled = false;
            button.textContent = '❌ GPS Failed';

            setTimeout(() => {
                button.textContent = '📡 Capture Device GPS';
            }, 2000);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Shows a photo preview for hull status file inputs and persists the data URL to state
function previewHullPhoto(inputEl, previewId) {
    const preview = document.getElementById(previewId);
    const file = inputEl.files && inputEl.files[0];
    if (!file || !preview) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        preview.src = dataUrl;
        preview.style.display = 'block';
        // Persist photo data directly since file inputs don't serialize via .value
        if (!appState.qaChecks.hullStatus) appState.qaChecks.hullStatus = {};
        appState.qaChecks.hullStatus[inputEl.id] = dataUrl;
        saveDraft();
    };
    reader.readAsDataURL(file);
}

// ===== Data Management =====
function updateAppState() {
    appState.checkDate = document.getElementById('check-date').value;
    appState.weatherConditions = document.getElementById('weather-conditions').value;
    appState.qaTeam = document.getElementById('qa-team').value;
    appState.systemProvider = document.getElementById('system-provider').value;
    appState.generalComments = document.getElementById('general-comments').value;
    saveDraft();
}

function saveCheckData(checkType) {
    const card = document.getElementById(`${checkType}-card`);
    if (!card) return;

    // Initialize with existing data to preserve asynchronously loaded Base64 URLs (e.g., from Hull Status photos)
    const data = { ...(appState.qaChecks[checkType] || {}) };

    card.querySelectorAll('input, textarea, select').forEach(input => {
        if (input.id) {
            // Never serialize fake file paths into the JSON object
            if (input.type === 'file') return;

            if (input.type === 'checkbox') {
                data[input.id] = input.checked;
            } else {
                data[input.id] = input.value;
            }
        }
    });

    appState.qaChecks[checkType] = data;
    saveDraft();
}

function saveDraft() {
    try {
        localStorage.setItem('dqm-qa-draft', JSON.stringify(appState));
    } catch (e) {
        console.error('Failed to save draft:', e);
    }
}

function loadDraft() {
    try {
        const draft = localStorage.getItem('dqm-qa-draft');
        if (draft) {
            const data = JSON.parse(draft);

            // Restore metadata
            if (data.checkDate) document.getElementById('check-date').value = data.checkDate;
            if (data.qaTeam) document.getElementById('qa-team').value = data.qaTeam;
            if (data.systemProvider) document.getElementById('system-provider').value = data.systemProvider;
            if (data.generalComments) document.getElementById('general-comments').value = data.generalComments;

            // Restore plants
            if (data.plants && data.plants.length > 0) {
                // Remove default plant
                document.getElementById('plants-container').innerHTML = '';
                plantCounter = 0;

                data.plants.forEach(plant => {
                    addPlant();
                    const entries = document.querySelectorAll('.plant-entry');
                    const entry = entries[entries.length - 1];

                    entry.querySelector('.plant-name').value = plant.name;
                    entry.querySelector('.vessel-type').value = plant.vesselType;
                    updateProfileOptions(entry.querySelector('.vessel-type'));
                    entry.querySelector('.vessel-profile').value = plant.profile;
                });

                updatePlants();
            }

            // Restore timeline
            if (data.timeline && Array.isArray(data.timeline)) {
                appState.timeline = data.timeline;
                renderTimeline();
            }

            // Restore QA check data
            Object.assign(appState, data);

            setTimeout(() => {
                Object.keys(data.qaChecks || {}).forEach(checkType => {
                    const checkData = data.qaChecks[checkType];
                    Object.keys(checkData).forEach(inputId => {
                        const input = document.getElementById(inputId);
                        if (input) {
                            if (input.type === 'checkbox') {
                                input.checked = checkData[inputId] === true || checkData[inputId] === 'true';
                            } else {
                                input.value = checkData[inputId];
                            }
                        }
                    });
                });
                if (typeof toggleVelocityMethod === 'function') toggleVelocityMethod();
                if (typeof toggleDragheadSections === 'function') toggleDragheadSections();
            }, 500);
        }
    } catch (e) {
        console.error('Failed to load draft:', e);
    }
}

function clearAll() {
    if (confirm('Clear all data? This cannot be undone.')) {
        localStorage.removeItem('dqm-qa-draft');
        location.reload();
    }
}

// ===== Export Functions =====
function exportJSON() {
    updateAppState();

    // Validate we have at least one plant
    if (appState.plants.length === 0) {
        alert('Please add at least one plant before exporting.');
        return;
    }

    // Strip check entries where every value is empty/undefined
    // so the trip-report only sees checks that were actually performed
    function hasAnyValue(obj) {
        if (!obj) return false;
        return Object.values(obj).some(v => v !== '' && v !== null && v !== undefined);
    }
    const filteredChecks = {};
    Object.entries(appState.qaChecks).forEach(([type, data]) => {
        if (hasAnyValue(data)) {
            filteredChecks[type] = data;
        }
    });

    // Build export object
    const exportData = {
        metadata: {
            plants: appState.plants,
            checkDate: appState.checkDate,
            weather: appState.weatherConditions,
            qaTeamMembers: appState.qaTeam.split(',').map(s => s.trim()).filter(s => s),
            systemProvider: appState.systemProvider,
            draftCombo: appState.draftCombo,
            timeline: appState.timeline,
            generalComments: appState.generalComments,
            exportedAt: new Date().toISOString()
        },
        checks: filteredChecks
    };

    // Generate filename
    const plantNames = appState.plants.map(p => p.name.replace(/[^a-zA-Z0-9]/g, '')).join('_');
    const dateStr = appState.checkDate.replace(/-/g, '-');
    const filename = `DQM_QA_${plantNames}_${dateStr}.json`;

    // Download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`✅ Exported: ${filename}`);
}

// ===== Timeline Functions =====
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

function logCheckToTimeline(checkType) {
    const checkNames = {
        'positionCheck': 'Position Check',
        'hullStatus': 'Hull Status Check',
        'draftSensorLight': 'Draft Sensor Check (Light)',
        'draftSensorLoaded': 'Draft Sensor Check (Loaded)',
        'draftSensorSimulated': 'Draft Sensor Check (Simulated)',
        'ullageLight': 'Ullage Check (Light)',
        'ullageLoaded': 'Ullage Check (Loaded)',
        'dragheadDepth': 'Draghead Depth Check',
        'suctionMouthDepth': 'Suction Mouth Depth Check',
        'velocity': 'Velocity Check',
        'bucketDepth': 'Bucket/Grab Depth Check',
        'bucketPosition': 'Bucket Position Check'
    };

    const card = document.getElementById(`${checkType}-card`);
    if (card) {
        card.classList.add('check-logged');
    }

    const entry = {
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        activity: `${checkNames[checkType]} Completed`,
        notes: '',
        timestamp: new Date().toISOString()
    };

    appState.timeline.push(entry);
    renderTimeline();
    saveDraft();

    // Show confirmation
    const logBtn = card.querySelector('.log-timeline-btn');
    if (logBtn) {
        const originalText = logBtn.textContent;
        logBtn.textContent = '✓ Logged to Timeline';
        logBtn.disabled = true;
        setTimeout(() => {
            logBtn.textContent = originalText;
            logBtn.disabled = false;
        }, 2000);
    }
}

function logCustomToTimeline(activityText, button) {
    const entry = {
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        activity: activityText,
        notes: '',
        timestamp: new Date().toISOString()
    };

    appState.timeline.push(entry);
    renderTimeline();
    saveDraft();

    if (button) {
        button.classList.add('check-logged');
        const originalText = button.textContent;
        button.textContent = '✓ Logged';
        button.disabled = true;
        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
        }, 2000);
    }
}

function renderTimeline() {
    const tbody = document.getElementById('timeline-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (appState.timeline.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">No timeline entries yet</td></tr>';
        return;
    }

    appState.timeline.forEach((entry, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="timeline-time">${entry.time}</td>
            <td class="timeline-activity">${entry.activity}</td>
            <td class="timeline-notes">${entry.notes}</td>
            <td><button type="button" class="timeline-delete-btn" onclick="deleteTimelineEntry(${index})">✕</button></td>
        `;
        tbody.appendChild(row);
    });
}

function deleteTimelineEntry(index) {
    if (confirm('Delete this timeline entry?')) {
        appState.timeline.splice(index, 1);
        renderTimeline();
        saveDraft();
    }
}

// ===== Auto-Calculation Functions =====
function calculateDifferences(checkType) {
    switch (checkType) {
        case 'positionCheck':
            calculatePositionDifference();
            break;
        case 'draftSensorLight':
            calculatePhysicalDraftDifferences('light');
            calculateSimulatedDraftDifferences('light');
            break;
        case 'draftSensorLoaded':
            calculatePhysicalDraftDifferences('loaded');
            calculateSimulatedDraftDifferences('loaded');
            break;
        case 'dragheadDepth':
            calculateDragheadDifferences();
            break;
        case 'suctionMouthDepth':
            calculateSuctionDifferences();
            break;
        case 'velocity':
            calculateVelocity();
            break;
        case 'ullageLight':
            calculateUllageDifferences('light');
            break;
        case 'ullageLoaded':
            calculateUllageDifferences('loaded');
            break;
        case 'bucketDepth':
            calculateBucketDepthDifferences();
            break;
        case 'bucketPosition':
            calculateBucketPositionDifferences();
            break;
    }
}

function calculatePositionDifference() {
    const lat1 = parseFloat(document.getElementById('handheld-lat')?.value);
    const lon1 = parseFloat(document.getElementById('handheld-lon')?.value);
    const lat2 = parseFloat(document.getElementById('dqm-lat')?.value);
    const lon2 = parseFloat(document.getElementById('dqm-lon')?.value);

    if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return;

    // Haversine formula to calculate distance in feet
    const R = 20902231; // Earth radius in feet
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    const diffInput = document.getElementById('position-diff');
    if (diffInput) {
        diffInput.value = distance.toFixed(1);
    }
}

function calculatePhysicalDraftDifferences(condition) {
    ['fwd', 'aft'].forEach(pos => {
        const port = parseFloat(document.getElementById(`${condition}-${pos}-port`)?.value);
        const stbd = parseFloat(document.getElementById(`${condition}-${pos}-stbd`)?.value);
        const dqm = parseFloat(document.getElementById(`${condition}-dqm-${pos}`)?.value);

        const avgInput = document.getElementById(`${condition}-${pos}-avg`);
        const diffInput = document.getElementById(`${condition}-${pos}-diff`);

        if (!isNaN(port) && !isNaN(stbd) && avgInput) {
            const avg = (port + stbd) / 2;
            avgInput.value = avg.toFixed(2);

            if (!isNaN(dqm) && diffInput) {
                diffInput.value = Math.abs(avg - dqm).toFixed(2);
            } else if (diffInput) {
                diffInput.value = '';
            }
        } else {
            if (avgInput) avgInput.value = '';
            if (diffInput) diffInput.value = '';
        }
    });
}

function calculateSimulatedDraftDifferences(condition) {
    // condition is 'light' or 'loaded'
    for (let i = 1; i <= 3; i++) {
        const depth = parseFloat(document.getElementById(`sim-${condition}-fwd-depth-${i}`)?.value);
        const reading = parseFloat(document.getElementById(`sim-${condition}-fwd-reading-${i}`)?.value);
        const diffInput = document.getElementById(`sim-${condition}-fwd-diff-${i}`);
        if (!isNaN(depth) && !isNaN(reading) && diffInput) {
            diffInput.value = Math.abs(depth - reading).toFixed(1);
        }
    }
    for (let i = 1; i <= 3; i++) {
        const depth = parseFloat(document.getElementById(`sim-${condition}-aft-depth-${i}`)?.value);
        const reading = parseFloat(document.getElementById(`sim-${condition}-aft-reading-${i}`)?.value);
        const diffInput = document.getElementById(`sim-${condition}-aft-diff-${i}`);
        if (!isNaN(depth) && !isNaN(reading) && diffInput) {
            diffInput.value = Math.abs(depth - reading).toFixed(1);
        }
    }
}

// Auto-calculations for the standalone Simulated Draft card
function calculateStandaloneSimulatedDraftDifferences() {
    ['fwd', 'aft'].forEach(pos => {
        for (let i = 1; i <= 3; i++) {
            const depth = parseFloat(document.getElementById(`sim-${pos}-depth-${i}`)?.value);
            const reading = parseFloat(document.getElementById(`sim-${pos}-reading-${i}`)?.value);
            const diffInput = document.getElementById(`sim-${pos}-diff-${i}`);
            if (!isNaN(depth) && !isNaN(reading) && diffInput) {
                diffInput.value = Math.abs(depth - reading).toFixed(1);
            }
        }
    });
}

function calculateDragheadDifferences() {
    ['port', 'center', 'stbd'].forEach(side => {
        const offset = parseFloat(document.getElementById(`draghead-${side}-offset`)?.value) || 0;
        for (let i = 1; i <= 3; i++) {
            const manual = parseFloat(document.getElementById(`draghead-${side}-manual-${i}`)?.value);
            const dqm = parseFloat(document.getElementById(`draghead-${side}-dqm-${i}`)?.value);
            const diffInput = document.getElementById(`draghead-${side}-diff-${i}`);

            if (!isNaN(manual) && !isNaN(dqm) && diffInput) {
                diffInput.value = Math.abs((manual + offset) - dqm).toFixed(1);
            }
        }
    });
}

function calculateSuctionDifferences() {
    const offset = parseFloat(document.getElementById('suction-offset')?.value) || 0;

    for (let i = 1; i <= 3; i++) {
        const manual = parseFloat(document.getElementById(`suction-manual-${i}`)?.value);
        const dqm = parseFloat(document.getElementById(`suction-dqm-${i}`)?.value);
        const diffInput = document.getElementById(`suction-diff-${i}`);

        if (!isNaN(manual) && !isNaN(dqm) && diffInput) {
            diffInput.value = Math.abs((manual + offset) - dqm).toFixed(1);
        }
    }
}

function calculateVelocity() {
    const method = document.getElementById('velocity-method')?.value;

    if (method === 'dye') {
        const pipeLength = parseFloat(document.getElementById('velocity-pipe-length')?.value);
        if (!isNaN(pipeLength) && pipeLength > 0) {
            [1, 2, 3].forEach(i => {
                const time = parseFloat(document.getElementById(`velocity-dye-time-${i}`)?.value);
                const calcInput = document.getElementById(`velocity-dye-calc-${i}`);
                if (!isNaN(time) && time > 0 && calcInput) {
                    const calculated = pipeLength / time;
                    calcInput.value = calculated.toFixed(2);

                    const dqm = parseFloat(document.getElementById(`velocity-dye-dqm-${i}`)?.value);
                    const diffInput = document.getElementById(`velocity-dye-diff-${i}`);
                    if (!isNaN(dqm) && diffInput) {
                        diffInput.value = Math.abs(calculated - dqm).toFixed(2);
                    }
                }
            });
        }
    } else if (method === 'meter') {
        [1, 2, 3].forEach(i => {
            const manual = parseFloat(document.getElementById(`velocity-meter-manual-${i}`)?.value);
            const dqm = parseFloat(document.getElementById(`velocity-meter-dqm-${i}`)?.value);
            const diffInput = document.getElementById(`velocity-meter-diff-${i}`);

            if (!isNaN(manual) && !isNaN(dqm) && diffInput) {
                diffInput.value = Math.abs(manual - dqm).toFixed(2);
            }
        });
    }
}

function calculateUllageDifferences(condition) {
    // Forward: average port+stbd manual soundings vs DQM forward reading
    const fwdPort = parseFloat(document.getElementById(`ullage-${condition}-fwd-port`)?.value);
    const fwdStbd = parseFloat(document.getElementById(`ullage-${condition}-fwd-stbd`)?.value);
    const dqmFwd = parseFloat(document.getElementById(`ullage-${condition}-dqm-fwd`)?.value);
    const fwdDiff = document.getElementById(`ullage-${condition}-diff-fwd`);

    if (fwdDiff) {
        let manualFwd;
        if (!isNaN(fwdPort) && !isNaN(fwdStbd)) {
            manualFwd = (fwdPort + fwdStbd) / 2;
        } else if (!isNaN(fwdPort)) {
            manualFwd = fwdPort;
        } else if (!isNaN(fwdStbd)) {
            manualFwd = fwdStbd;
        }
        if (manualFwd !== undefined && !isNaN(dqmFwd)) {
            fwdDiff.value = Math.abs(manualFwd - dqmFwd).toFixed(2);
        }
    }

    // Aft: average port+stbd manual soundings vs DQM aft reading
    const aftPort = parseFloat(document.getElementById(`ullage-${condition}-aft-port`)?.value);
    const aftStbd = parseFloat(document.getElementById(`ullage-${condition}-aft-stbd`)?.value);
    const dqmAft = parseFloat(document.getElementById(`ullage-${condition}-dqm-aft`)?.value);
    const aftDiff = document.getElementById(`ullage-${condition}-diff-aft`);

    if (aftDiff) {
        let manualAft;
        if (!isNaN(aftPort) && !isNaN(aftStbd)) {
            manualAft = (aftPort + aftStbd) / 2;
        } else if (!isNaN(aftPort)) {
            manualAft = aftPort;
        } else if (!isNaN(aftStbd)) {
            manualAft = aftStbd;
        }
        if (manualAft !== undefined && !isNaN(dqmAft)) {
            aftDiff.value = Math.abs(manualAft - dqmAft).toFixed(2);
        }
    }
}

function calculateBucketDepthDifferences() {
    const offset = parseFloat(document.getElementById('bucket-offset')?.value) || 0;

    for (let i = 1; i <= 3; i++) {
        const manual = parseFloat(document.getElementById(`bucket-manual-${i}`)?.value);
        const dqm = parseFloat(document.getElementById(`bucket-dqm-${i}`)?.value);
        const diffInput = document.getElementById(`bucket-diff-${i}`);
        if (!isNaN(manual) && !isNaN(dqm) && diffInput) {
            diffInput.value = Math.abs((manual + offset) - dqm).toFixed(1);
        }
    }
}

function calculateBucketPositionDifferences() {
    for (let i = 1; i <= 3; i++) {
        const manual = parseFloat(document.getElementById(`bucket-pos-manual-${i}`)?.value);
        const dqm = parseFloat(document.getElementById(`bucket-pos-dqm-${i}`)?.value);
        const diffInput = document.getElementById(`bucket-pos-diff-${i}`);
        if (!isNaN(manual) && !isNaN(dqm) && diffInput) {
            diffInput.value = Math.abs(manual - dqm).toFixed(1);
        }
    }
}
