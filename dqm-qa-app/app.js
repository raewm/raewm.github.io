// ===== Application State =====
const appState = {
    plants: [],
    checkDate: '',
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
    'Pipeline Dredge': ['Standard', 'Small Business']
};

// ===== Required Checks by Profile =====
const requiredChecks = {
    'Scow-Monitoring': ['positionCheck', 'hullStatus', 'draftSensor'],
    'Scow-Ullage': ['positionCheck', 'hullStatus', 'draftSensor', 'ullage'],
    'Hopper Dredge-Standard': ['positionCheck', 'hullStatus', 'draftSensor', 'ullage', 'dragheadDepth'],
    'Pipeline Dredge-Standard': ['positionCheck', 'suctionMouthDepth', 'velocity'],
    'Pipeline Dredge-Small Business': ['positionCheck', 'suctionMouthDepth']
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
    // Determine which checks are needed based on all plants
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
        case 'draftSensor':
            return createDraftSensorForm();
        case 'ullage':
            return createUllageForm();
        case 'dragheadDepth':
            return createDragheadDepthForm();
        case 'suctionMouthDepth':
            return createSuctionMouthDepthForm();
        case 'velocity':
            return createVelocityForm();
        default:
            return '<p>Unknown check type</p>';
    }
}

function createPositionCheckForm() {
    const isScow = appState.plants.some(p => p.vesselType === 'Scow');

    return `
        <h2>📍 Position Check</h2>
        
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
        <h2>⚓ Hull Status Check</h2>
        
        <div class="form-group">
            <label>Hull Opened</label>
            <select id="hull-opened">
                <option value="">Select...</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
            </select>
        </div>
        
        <div class="form-group">
            <label>Closed to Open Trigger Condition</label>
            <textarea id="hull-open-trigger" rows="2" placeholder="Describe bin/door position when sensor changed from closed to open"></textarea>
        </div>
        
        <div class="form-group">
            <label>Photo Reference (Closed to Open)</label>
            <input type="text" id="hull-open-photo" placeholder="Photo filename or reference">
        </div>
        
        <div class="form-group">
            <label>Open to Closed Trigger Condition</label>
            <textarea id="hull-close-trigger" rows="2" placeholder="Describe bin/door position when sensor changed from open to closed"></textarea>
        </div>
        
        <div class="form-group">
            <label>Photo Reference (Open to Closed)</label>
            <input type="text" id="hull-close-photo" placeholder="Photo filename or reference">
        </div>
        
        <div class="form-group">
            <label>Remarks</label>
            <textarea id="hull-remarks" rows="2" placeholder="Additional observations"></textarea>
        </div>
        
        <button type="button" class="log-timeline-btn">📋 Log to Timeline</button>
    `;
}

function createDraftSensorForm() {
    return `
        <h2>📏 Draft Sensor Check</h2>
        
        <div class="form-group">
            <label>Check Method</label>
            <select id="draft-check-method" onchange="toggleDraftCheckMethod()">
                <option value="physical">Physical Draft Check (Light & Loaded)</option>
                <option value="simulated">Simulated Draft Check (Test Pipe Method)</option>
            </select>
        </div>
        
        <div id="physical-draft-section">
            <h3>Physical Draft Check - Light Condition</h3>
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
            <div class="input-row">
                <div class="form-group">
                    <label>DQM System Forward (ft)</label>
                    <input type="number" id="light-dqm-fwd" step="0.1" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>DQM System Aft (ft)</label>
                    <input type="number" id="light-dqm-aft" step="0.1" placeholder="0.0">
                </div>
            </div>
            
            <h3>Physical Draft Check - Loaded Condition</h3>
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
            <div class="input-row">
                <div class="form-group">
                    <label>DQM System Forward (ft)</label>
                    <input type="number" id="loaded-dqm-fwd" step="0.1" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>DQM System Aft (ft)</label>
                    <input type="number" id="loaded-dqm-aft" step="0.1" placeholder="0.0">
                </div>
            </div>
            
            <div class="form-group">
                <label>Sea Conditions</label>
                <textarea id="draft-sea-conditions" rows="2" placeholder="Wave height, weather conditions, etc."></textarea>
            </div>
        </div>
        
        <div id="simulated-draft-section" class="hidden">
            <h3>Simulated Draft Check - Forward Sensor</h3>
            <p class="text-muted">Test pipe method: Measure sensor response at known water depths</p>
            
            <div class="input-row-3">
                <div class="form-group">
                    <label>Test Depth 1 (ft)</label>
                    <input type="number" id="sim-fwd-depth-1" step="0.1" placeholder="e.g., 5.0">
                </div>
                <div class="form-group">
                    <label>DQM Reading 1 (ft)</label>
                    <input type="number" id="sim-fwd-reading-1" step="0.1" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>Difference (ft)</label>
                    <input type="number" id="sim-fwd-diff-1" step="0.1" readonly placeholder="Auto-calc">
                </div>
            </div>
            <div class="input-row-3">
                <div class="form-group">
                    <label>Test Depth 2 (ft)</label>
                    <input type="number" id="sim-fwd-depth-2" step="0.1" placeholder="e.g., 10.0">
                </div>
                <div class="form-group">
                    <label>DQM Reading 2 (ft)</label>
                    <input type="number" id="sim-fwd-reading-2" step="0.1" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>Difference (ft)</label>
                    <input type="number" id="sim-fwd-diff-2" step="0.1" readonly placeholder="Auto-calc">
                </div>
            </div>
            <div class="input-row-3">
                <div class="form-group">
                    <label>Test Depth 3 (ft)</label>
                    <input type="number" id="sim-fwd-depth-3" step="0.1" placeholder="e.g., 15.0">
                </div>
                <div class="form-group">
                    <label>DQM Reading 3 (ft)</label>
                    <input type="number" id="sim-fwd-reading-3" step="0.1" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>Difference (ft)</label>
                    <input type="number" id="sim-fwd-diff-3" step="0.1" readonly placeholder="Auto-calc">
                </div>
            </div>
            
            <h3>Simulated Draft Check - Aft Sensor</h3>
            <div class="input-row-3">
                <div class="form-group">
                    <label>Test Depth 1 (ft)</label>
                    <input type="number" id="sim-aft-depth-1" step="0.1" placeholder="e.g., 5.0">
                </div>
                <div class="form-group">
                    <label>DQM Reading 1 (ft)</label>
                    <input type="number" id="sim-aft-reading-1" step="0.1" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>Difference (ft)</label>
                    <input type="number" id="sim-aft-diff-1" step="0.1" readonly placeholder="Auto-calc">
                </div>
            </div>
            <div class="input-row-3">
                <div class="form-group">
                    <label>Test Depth 2 (ft)</label>
                    <input type="number" id="sim-aft-depth-2" step="0.1" placeholder="e.g., 10.0">
                </div>
                <div class="form-group">
                    <label>DQM Reading 2 (ft)</label>
                    <input type="number" id="sim-aft-reading-2" step="0.1" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>Difference (ft)</label>
                    <input type="number" id="sim-aft-diff-2" step="0.1" readonly placeholder="Auto-calc">
                </div>
            </div>
            <div class="input-row-3">
                <div class="form-group">
                    <label>Test Depth 3 (ft)</label>
                    <input type="number" id="sim-aft-depth-3" step="0.1" placeholder="e.g., 15.0">
                </div>
                <div class="form-group">
                    <label>DQM Reading 3 (ft)</label>
                    <input type="number" id="sim-aft-reading-3" step="0.1" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>Difference (ft)</label>
                    <input type="number" id="sim-aft-diff-3" step="0.1" readonly placeholder="Auto-calc">
                </div>
            </div>
            
            <div class="form-group">
                <label>Test Pipe Details</label>
                <textarea id="sim-pipe-details" rows="2" placeholder="Pipe length, fill method, calibration notes, etc."></textarea>
            </div>
        </div>
        
        <div class="form-group">
            <label>Remarks</label>
            <textarea id="draft-remarks" rows="2"></textarea>
        </div>
        
        <button type="button" class="log-timeline-btn">📋 Log to Timeline</button>
    `;
}

// Toggle function for draft check method
function toggleDraftCheckMethod() {
    const method = document.getElementById('draft-check-method')?.value;
    const physicalSection = document.getElementById('physical-draft-section');
    const simulatedSection = document.getElementById('simulated-draft-section');

    if (method === 'simulated') {
        physicalSection?.classList.add('hidden');
        simulatedSection?.classList.remove('hidden');
    } else {
        physicalSection?.classList.remove('hidden');
        simulatedSection?.classList.add('hidden');
    }
}

function createUllageForm() {
    return `
        <h2>📐 Ullage Check</h2>
        
        <h3>Light Condition</h3>
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
                <label>DQM System Forward (ft)</label>
                <input type="number" id="ullage-light-dqm-fwd" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>DQM System Aft (ft)</label>
                <input type="number" id="ullage-light-dqm-aft" step="0.1" placeholder="0.0">
            </div>
        </div>
        
        <h3>Loaded Condition</h3>
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
                <label>DQM System Forward (ft)</label>
                <input type="number" id="ullage-loaded-dqm-fwd" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>DQM System Aft (ft)</label>
                <input type="number" id="ullage-loaded-dqm-aft" step="0.1" placeholder="0.0">
            </div>
        </div>
        
        <div class="form-group">
            <label>Remarks</label>
            <textarea id="ullage-remarks" rows="2" placeholder="Conditions, measurement method, etc."></textarea>
        </div>
        
        <button type="button" class="log-timeline-btn">📋 Log to Timeline</button>
    `;
}

function createDragheadDepthForm() {
    return `
        <h2>🔧 Draghead Depth Check</h2>
        
        <p class="text-muted">Record at least 3 measurements within the operating range</p>
        
        <div class="input-row-3">
            <div class="form-group">
                <label>Measurement 1 - Manual (ft)</label>
                <input type="number" id="draghead-manual-1" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Measurement 1 - DQM System (ft)</label>
                <input type="number" id="draghead-dqm-1" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Difference (ft)</label>
                <input type="number" id="draghead-diff-1" step="0.1" placeholder="Auto-calc" readonly>
            </div>
        </div>
        
        <div class="input-row-3">
            <div class="form-group">
                <label>Measurement 2 - Manual (ft)</label>
                <input type="number" id="draghead-manual-2" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Measurement 2 - DQM System (ft)</label>
                <input type="number" id="draghead-dqm-2" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Difference (ft)</label>
                <input type="number" id="draghead-diff-2" step="0.1" placeholder="Auto-calc" readonly>
            </div>
        </div>
        
        <div class="input-row-3">
            <div class="form-group">
                <label>Measurement 3 - Manual (ft)</label>
                <input type="number" id="draghead-manual-3" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Measurement 3 - DQM System (ft)</label>
                <input type="number" id="draghead-dqm-3" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Difference (ft)</label>
                <input type="number" id="draghead-diff-3" step="0.1" placeholder="Auto-calc" readonly>
            </div>
        </div>
        
        <div class="form-group">
            <label>Sea/Wave Conditions</label>
            <textarea id="draghead-conditions" rows="2" placeholder="Wave height and conditions during measurements"></textarea>
        </div>
        
        <div class="form-group">
            <label>Remarks</label>
            <textarea id="draghead-remarks" rows="2"></textarea>
        </div>
        
        <button type="button" class="log-timeline-btn">📋 Log to Timeline</button>
    `;
}

function createSuctionMouthDepthForm() {
    return `
        <h2>🔧 Suction Mouth Depth Check</h2>
        
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
                <input type="number" id="suction-dqm-3" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Measurement 3 - DQM System (ft)</label>
                <input type="number" id="suction-manual-3" step="0.1" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Difference (ft)</label>
                <input type="number" id="suction-diff-3" step="0.1" placeholder="Auto-calc" readonly>
            </div>
        </div>
        
        <div class="form-group">
            <label>Sea/Wave Conditions</label>
            <textarea id="suction-conditions" rows="2" placeholder="Wave height and conditions during measurements"></textarea>
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
        <h2>💨 Velocity Check</h2>
        
        <div class="form-group">
            <label>Pipeline Length (ft)</label>
            <input type="number" id="velocity-pipe-length" step="0.1" placeholder="Distance from dye injection to outfall">
        </div>
        
        <div class="form-group">
            <label>Test Method</label>
            <select id="velocity-method">
                <option value="">Select...</option>
                <option value="dye">Dye Test</option>
                <option value="meter">External Meter</option>
            </select>
        </div>
        
        <div class="input-row">
            <div class="form-group">
                <label>Travel Time (seconds)</label>
                <input type="number" id="velocity-time" step="0.1" placeholder="Time for dye to travel">
            </div>
            <div class="form-group">
                <label>Calculated Velocity (ft/s)</label>
                <input type="number" id="velocity-calculated" step="0.01" placeholder="Auto-calculated">
            </div>
        </div>
        
        <div class="input-row">
            <div class="form-group">
                <label>DQM System Velocity (ft/s)</label>
                <input type="number" id="velocity-dqm" step="0.01" placeholder="System reading">
            </div>
            <div class="form-group">
                <label>Difference (ft/s)</label>
                <input type="number" id="velocity-diff" step="0.01" placeholder="Auto-calc" readonly>
            </div>
        </div>
        
        <div class="form-group">
            <label>Pump RPM</label>
            <input type="number" id="velocity-rpm" placeholder="RPM during test">
        </div>
        
        <div class="form-group">
            <label>External Meter Calibration Date</label>
            <input type="date" id="velocity-cal-date">
        </div>
        
        <div class="form-group">
            <label>Remarks</label>
            <textarea id="velocity-remarks" rows="2" placeholder="Test conditions, observations"></textarea>
        </div>
        
        <button type="button" class="log-timeline-btn">📋 Log to Timeline</button>
    `;
}

// ===== GPS Functions =====
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

// ===== Data Management =====
function updateAppState() {
    appState.checkDate = document.getElementById('check-date').value;
    appState.qaTeam = document.getElementById('qa-team').value;
    appState.systemProvider = document.getElementById('system-provider').value;
    appState.generalComments = document.getElementById('general-comments').value;
    saveDraft();
}

function saveCheckData(checkType) {
    const card = document.getElementById(`${checkType}-card`);
    if (!card) return;

    const data = {};
    card.querySelectorAll('input, textarea, select').forEach(input => {
        if (input.id) {
            data[input.id] = input.value;
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
                            input.value = checkData[inputId];
                        }
                    });
                });
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

    // Build export object
    const exportData = {
        metadata: {
            plants: appState.plants,
            checkDate: appState.checkDate,
            qaTeamMembers: appState.qaTeam.split(',').map(s => s.trim()).filter(s => s),
            systemProvider: appState.systemProvider,
            timeline: appState.timeline,
            generalComments: appState.generalComments,
            exportedAt: new Date().toISOString()
        },
        checks: appState.qaChecks
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
        'draftSensor': 'Draft Sensor Check',
        'ullage': 'Ullage Check',
        'dragheadDepth': 'Draghead Depth Check',
        'suctionMouthDepth': 'Suction Mouth Depth Check',
        'velocity': 'Velocity Check'
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
        case 'draftSensor':
            calculateSimulatedDraftDifferences();
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

function calculateSimulatedDraftDifferences() {
    // Calculate differences for forward sensor
    for (let i = 1; i <= 3; i++) {
        const depth = parseFloat(document.getElementById(`sim-fwd-depth-${i}`)?.value);
        const reading = parseFloat(document.getElementById(`sim-fwd-reading-${i}`)?.value);
        const diffInput = document.getElementById(`sim-fwd-diff-${i}`);

        if (!isNaN(depth) && !isNaN(reading) && diffInput) {
            diffInput.value = Math.abs(depth - reading).toFixed(1);
        }
    }

    // Calculate differences for aft sensor
    for (let i = 1; i <= 3; i++) {
        const depth = parseFloat(document.getElementById(`sim-aft-depth-${i}`)?.value);
        const reading = parseFloat(document.getElementById(`sim-aft-reading-${i}`)?.value);
        const diffInput = document.getElementById(`sim-aft-diff-${i}`);

        if (!isNaN(depth) && !isNaN(reading) && diffInput) {
            diffInput.value = Math.abs(depth - reading).toFixed(1);
        }
    }
}

function calculateDragheadDifferences() {
    for (let i = 1; i <= 3; i++) {
        const manual = parseFloat(document.getElementById(`draghead-manual-${i}`)?.value);
        const dqm = parseFloat(document.getElementById(`draghead-dqm-${i}`)?.value);
        const diffInput = document.getElementById(`draghead-diff-${i}`);

        if (!isNaN(manual) && !isNaN(dqm) && diffInput) {
            diffInput.value = Math.abs(manual - dqm).toFixed(1);
        }
    }
}

function calculateSuctionDifferences() {
    for (let i = 1; i <= 3; i++) {
        const manual = parseFloat(document.getElementById(`suction-manual-${i}`)?.value);
        const dqm = parseFloat(document.getElementById(`suction-dqm-${i}`)?.value);
        const diffInput = document.getElementById(`suction-diff-${i}`);

        if (!isNaN(manual) && !isNaN(dqm) && diffInput) {
            diffInput.value = Math.abs(manual - dqm).toFixed(1);
        }
    }
}

function calculateVelocity() {
    const pipeLength = parseFloat(document.getElementById('velocity-pipe-length')?.value);
    const time = parseFloat(document.getElementById('velocity-time')?.value);
    const dqmVelocity = parseFloat(document.getElementById('velocity-dqm')?.value);

    // Calculate velocity from pipe length and time
    if (!isNaN(pipeLength) && !isNaN(time) && time > 0) {
        const calculated = pipeLength / time;
        const calcInput = document.getElementById('velocity-calculated');
        if (calcInput) {
            calcInput.value = calculated.toFixed(2);
        }

        // Calculate difference
        if (!isNaN(dqmVelocity)) {
            const diffInput = document.getElementById('velocity-diff');
            if (diffInput) {
                diffInput.value = Math.abs(calculated - dqmVelocity).toFixed(2);
            }
        }
    }

    // Just calculate difference if calculated velocity already exists
    const calculatedVelocity = parseFloat(document.getElementById('velocity-calculated')?.value);
    if (!isNaN(calculatedVelocity) && !isNaN(dqmVelocity)) {
        const diffInput = document.getElementById('velocity-diff');
        if (diffInput) {
            diffInput.value = Math.abs(calculatedVelocity - dqmVelocity).toFixed(2);
        }
    }
}
