/**
 * @file app.js (Original DQM QA App)
 * @description Core logic for the original USACE DQM QA Check application.
 * Supports multi-vessel tracking, automated calculations, photo capture, and timeline logging.
 */

/**
 * Global application state.
 * @type {Object}
 * @property {Array} plants - Array of plant objects, each containing checks.
 * @property {string} checkDate - The current inspection date.
 * @property {string} weatherConditions - Current weather/sea metadata.
 * @property {string} qaTeam - String listing QA team members.
 * @property {string} systemProvider - String listing system provider reps.
 * @property {Array} timeline - Chronological log of events and checks.
 * @property {string} generalComments - Overall inspection observations.
 * @property {number|null} activePlantIndex - Tracks which plant is currently being edited.
 */
const appState = {
    plants: [],
    checkDate: '',
    weatherConditions: '',
    qaTeam: '',
    systemProvider: '',
    timeline: [],
    generalComments: '',
    activePlantIndex: null // New: tracks which plant is being checked
};

// ===== Vessel Profiles Configuration =====
// Defines available profiles for each vessel type.
const vesselProfiles = {
    'Scow': ['Monitoring', 'Ullage'],
    'Hopper Dredge': ['Standard'],
    'Pipeline Dredge': ['Standard', 'Small Business'],
    'Mechanical Dredge': ['Standard']
};

// ===== Required Checks by Profile =====
// Maps VesselType-Profile combinations to specific QA check IDs.
const requiredChecks = {
    'Scow-Monitoring': ['positionCheck', 'hullStatus', 'draftSensorLight', 'draftSensorLoaded'],
    'Scow-Ullage': ['positionCheck', 'hullStatus', 'draftSensorLight', 'draftSensorLoaded', 'ullageLight', 'ullageLoaded'],
    'Hopper Dredge-Standard': ['positionCheck', 'hullStatus', 'draftSensorLight', 'draftSensorLoaded', 'ullageLight', 'ullageLoaded', 'dragheadDepth'],
    'Pipeline Dredge-Standard': ['positionCheck', 'suctionMouthDepth', 'velocity'],
    'Pipeline Dredge-Small Business': ['positionCheck', 'suctionMouthDepth'],
    'Mechanical Dredge-Standard': ['positionCheck', 'bucketDepth', 'bucketPosition']
};

/**
 * Initialization on DOM Load.
 * Sets up default values, adds initial plant, and attaches global listeners.
 */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    // 1. Load data FIRST before doing ANY initialization that might trigger a save
    loadDraft();

    // 2. Perform UI setup and add default plant ONLY if nothing was loaded
    initializeApp();

    // 3. Prevent data loss on accidental navigation
    window.addEventListener('beforeunload', (e) => {
        saveDraft(); // Final sync
    });
});

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
 * Performs core app initialization.
 */
function initializeApp() {
    // Set default date to today for convenience if not already set by loadDraft
    if (!document.getElementById('check-date').value) {
        document.getElementById('check-date').valueAsDate = new Date();
    }

    // Start with one plant entry by default ONLY if loadDraft didn't find any
    if (appState.plants.length === 0) {
        addPlant();
    }

    // Global Action Button Listeners
    document.getElementById('add-plant-btn').addEventListener('click', addPlant);
    document.getElementById('save-draft-btn').addEventListener('click', () => {
        saveDraft();
        showToast('Draft Saved');
    });
    document.getElementById('export-btn').addEventListener('click', exportJSON);
    document.getElementById('clear-btn').addEventListener('click', clearAll);
    // Metadata Input Syncing
    document.getElementById('check-date').addEventListener('change', updateAppState);
    document.getElementById('qa-team').addEventListener('input', updateAppState);
    document.getElementById('system-provider').addEventListener('input', updateAppState);
    document.getElementById('general-comments').addEventListener('input', updateAppState);
    // Timeline Action
    document.getElementById('add-timeline-comment-btn').addEventListener('click', addTimelineComment);

    // Initial timeline render
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

// ===== Plant Management =====
// Logic for adding, removing, and renumbering plants/vessels.

let plantCounter = 0;

/**
 * Adds a new Plant UI entry and updates the internal state.
 * Dynamically creates the form block for Vessel Name, Type, and Profile.
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

    // Attach local input/change listeners to track state modifications
    plantEntry.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', updatePlants);
        el.addEventListener('change', updatePlants);
    });

    updatePlants(); // Sync state immediately
}

/**
 * Removes a plant entry after user confirmation.
 * @param {HTMLElement} btn - The remove button element.
 */
function removePlant(btn) {
    if (confirm('Remove this plant entry?')) {
        btn.closest('.plant-entry').remove();
        renumberPlants(); // Keep the numbers (Plant #1, #2...) sequential
        updatePlants();   // Sync state
    }
}

/**
 * Renumbers plant headers to maintain sequential order after deletions.
 */
function renumberPlants() {
    const plants = document.querySelectorAll('.plant-entry');
    plants.forEach((plant, index) => {
        plant.querySelector('.plant-number').textContent = `Plant #${index + 1}`;
    });
}

/**
 * Updates the Profile dropdown based on the selected Vessel Type.
 * @param {HTMLSelectElement} selectElement - The Vessel Type select element.
 */
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

        // Restore last selected profile for this vessel type if available
        const plantData = appState.plants[plantEntry.id.split('-').pop()];
        if (plantData && plantData.lastProfiles && plantData.lastProfiles[vesselType]) {
            profileSelect.value = plantData.lastProfiles[vesselType];
        }
    } else {
        profileSelect.disabled = true;
    }

    updatePlants();
}

/**
 * Syncs the DOM plant entries to the global `appState.plants` object.
 * Preserves existing check data during the sync.
 */
function updatePlants() {
    const plantEntries = document.querySelectorAll('.plant-entry');
    const newPlants = [];

    plantEntries.forEach((entry, idx) => {
        const name = entry.querySelector('.plant-name').value;
        const vesselType = entry.querySelector('.vessel-type').value;
        const profile = entry.querySelector('.vessel-profile').value;

        // Carry over existing check data if the index matches
        let checks = {};
        if (appState.plants[idx]) {
            checks = appState.plants[idx].checks || {};
        }

        // Always push to appState so the index exists, but use placeholders if empty
        newPlants.push({
            name: name || `Plant #${idx + 1}`,
            vesselType: vesselType || 'Unknown',
            profile: profile || 'None',
            checks
        });
    });

    appState.plants = newPlants;
    updateQAChecks(); // Re-render the QA Check forms based on profile selections
    saveDraft();
}

// ===== QA Checks Management =====
// Logic for rendering and coordinating the individual QA check cards.

/**
 * Renders the QA Check section by iterating through all defined plants.
 * Creates headers and calls createCheckCard for each required check.
 */
function updateQAChecks() {
    const container = document.getElementById('qa-checks-container');
    container.innerHTML = '';

    console.log(`Updating QA Checks for ${appState.plants.length} plants`);

    appState.plants.forEach((plant, pIdx) => {
        const key = `${plant.vesselType}-${plant.profile}`;
        const checks = requiredChecks[key] || [];

        console.log(`Processing plant ${pIdx}: ${plant.name}, Key: ${key}, Checks found: ${checks.length}`);

        // Create Vessel Section Header
        const vesselHeader = document.createElement('h2');
        vesselHeader.style.margin = '40px 0 20px 0';
        vesselHeader.style.padding = '12px 20px';
        vesselHeader.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
        vesselHeader.style.color = '#ffffff';
        vesselHeader.style.borderRadius = '8px';
        vesselHeader.style.borderLeft = '4px solid #4a90e2';
        vesselHeader.textContent = `QA Checks: ${plant.name} (${plant.vesselType})`;
        container.appendChild(vesselHeader);

        if (checks.length > 0) {
            checks.forEach(checkType => {
                try {
                    const checkCard = createCheckCard(checkType, pIdx, plant.name);
                    container.appendChild(checkCard);
                } catch (err) {
                    console.error(`Error creating card for ${checkType} (Plant ${pIdx}):`, err);
                }
            });
        } else {
            // Friendly fallback if no profile is selected
            const placeholder = document.createElement('p');
            placeholder.style.padding = '20px';
            placeholder.style.color = '#666';
            placeholder.style.fontStyle = 'italic';
            placeholder.textContent = 'Please select a valid Vessel Type and Profile to see required QA checks.';
            container.appendChild(placeholder);
        }
    });
}

/**
 * Creates an individual QA Check card element.
 * Handles ID suffixing, event delegation, and data restoration.
 * @param {string} checkType - The ID of the check (e.g., 'hullStatus').
 * @param {number} plantIdx - The index of the plant in appState.
 * @param {string} plantName - The name of the vessel for labelling.
 * @returns {HTMLElement} The populated card element.
 */
function createCheckCard(checkType, plantIdx, plantName) {
    const card = document.createElement('section');
    card.className = 'card';
    card.id = `${checkType}-card-${plantIdx}`;
    card.dataset.checkType = checkType;
    card.dataset.plantIndex = plantIdx;

    // Generate HTML content based on check type
    const content = getCheckContent(checkType, plantIdx);
    card.innerHTML = content;

    // Label the card with the specific vessel name
    const h2 = card.querySelector('h2');
    if (h2) h2.textContent = `${plantName} - ${h2.textContent}`;

    // Suffix all element IDs with the plant index to ensure DOM uniqueness
    card.querySelectorAll('[id], [name]').forEach(el => {
        if (el.id) el.id = `${el.id}-${plantIdx}`;
        if (el.name) el.name = `${el.name}-${plantIdx}`;
    });

    /**
     * Update onchange/onclick handlers.
     * Injects the plantIdx into function calls (e.g., calculate() -> calculate(0)).
     */
    const validFunctions = ['calculate', 'preview', 'toggle', 'log', 'captureGPS'];
    card.querySelectorAll('[onchange], [onclick]').forEach(el => {
        ['onchange', 'onclick'].forEach(attr => {
            const val = el.getAttribute(attr);
            if (val && validFunctions.some(f => val.includes(f)) && val.includes('(')) {
                // Only inject pIdx if it's one of our known functions and doesn't already have it
                const newVal = val.replace(/\(([^)]*)\)/, `($1${val.match(/\(\s*\)/) ? '' : ', '}${plantIdx})`);
                el.setAttribute(attr, newVal);
            }
        });
    });

    // Attach data-sync listeners with a slight delay to ensure DOM is ready
    setTimeout(() => {
        card.querySelectorAll('input, textarea, select').forEach(input => {
            input.addEventListener('input', () => {
                saveCheckData(checkType, plantIdx);
                calculateDifferences(checkType, plantIdx);
            });
            input.addEventListener('change', () => {
                saveCheckData(checkType, plantIdx);
                calculateDifferences(checkType, plantIdx);
            });
        });

        // Restore check-specific data from state
        const existingData = appState.plants[plantIdx].checks[checkType];
        if (existingData) {
            restoreCheckData(checkType, plantIdx, existingData);
        }

        // Attach the "Log to Timeline" button logic
        const logBtn = card.querySelector('.log-timeline-btn');
        if (logBtn) {
            logBtn.addEventListener('click', () => logCheckToTimeline(checkType, plantIdx));
        }
    }, 0);

    return card;
}

// ===== Check Content Generators =====
// Returns the HTML templates for various QA check forms.

/**
 * Router function for check form generation.
 * @param {string} checkType - Key for the check type.
 * @param {number} plantIdx - Index for ID suffixing.
 * @returns {string} HTML string.
 */
function getCheckContent(checkType, plantIdx) {
    switch (checkType) {
        case 'positionCheck':
            return createPositionCheckForm(plantIdx);
        case 'hullStatus':
            return createHullStatusForm(plantIdx);
        case 'draftSensorLight':
            return createDraftSensorLightForm(plantIdx);
        case 'draftSensorLoaded':
            return createDraftSensorLoadedForm(plantIdx);
        case 'ullageLight':
            return createUllageLightForm(plantIdx);
        case 'ullageLoaded':
            return createUllageLoadedForm(plantIdx);
        case 'dragheadDepth':
            return createDragheadDepthForm(plantIdx);
        case 'suctionMouthDepth':
            return createSuctionMouthDepthForm(plantIdx);
        case 'velocity':
            return createVelocityForm(plantIdx);
        case 'bucketDepth':
            return createBucketDepthForm(plantIdx);
        case 'bucketPosition':
            return createBucketPositionForm(plantIdx);
        default:
            return `<p>No template for ${checkType}</p>`;
    }
}

/**
 * Position Check Form Template.
 * Includes Static GPS check and Dynamic comparison for Scows.
 * @returns {string} HTML Template.
 */
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
                <input type="number" id="position-diff" step="0.01" placeholder="Auto-calculated or manual">
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

/**
 * Hull Status Form Template.
 * Includes Photo capture/upload for both "Closed to Open" and "Open to Closed" transitions.
 * @param {number} plantIdx - Index for persisting/restoring data.
 * @returns {string} HTML Template.
 */
function createHullStatusForm(plantIdx) {
    const data = appState.plants[plantIdx]?.checks.hullStatus || {};
    const openPhoto = data['hull-open-photo'] || '';
    const closePhoto = data['hull-close-photo'] || '';

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
            <div class="photo-actions">
                <button type="button" class="btn-secondary" onclick="this.closest('.form-group').querySelectorAll('input')[0].click()">📷 Take Photo</button>
                <button type="button" class="btn-secondary" onclick="this.closest('.form-group').querySelectorAll('input')[1].click()">📁 Upload Image</button>
            </div>
            <!-- Standard camera capture -->
            <input type="file" id="hull-open-capture" accept="image/*" capture="environment" class="visually-hidden" onchange="previewHullPhoto(this, 'hull-open-photo-preview', 'hull-open-photo')">
            <!-- Local file upload -->
            <input type="file" id="hull-open-upload" accept="image/*" class="visually-hidden" onchange="previewHullPhoto(this, 'hull-open-photo-preview', 'hull-open-photo')">
            <img id="hull-open-photo-preview" src="${openPhoto}" style="${openPhoto ? 'display:block;' : 'display:none;'} max-width:100%; max-height:200px; margin-top:8px; border-radius:6px; border:1px solid #444;" alt="Closed to Open photo">
        </div>

        <div class="form-group">
            <label>Photo Reference (Open to Closed)</label>
            <div class="photo-actions">
                <button type="button" class="btn-secondary" onclick="this.closest('.form-group').querySelectorAll('input')[0].click()">📷 Take Photo</button>
                <button type="button" class="btn-secondary" onclick="this.closest('.form-group').querySelectorAll('input')[1].click()">📁 Upload Image</button>
            </div>
            <input type="file" id="hull-close-capture" accept="image/*" capture="environment" class="visually-hidden" onchange="previewHullPhoto(this, 'hull-close-photo-preview', 'hull-close-photo')">
            <input type="file" id="hull-close-upload" accept="image/*" class="visually-hidden" onchange="previewHullPhoto(this, 'hull-close-photo-preview', 'hull-close-photo')">
            <img id="hull-close-photo-preview" src="${closePhoto}" style="${closePhoto ? 'display:block;' : 'display:none;'} max-width:100%; max-height:200px; margin-top:8px; border-radius:6px; border:1px solid #444;" alt="Open to Closed photo">
        </div>

        <div class="form-group">
            <label>Remarks</label>
            <textarea id="hull-remarks" rows="2" placeholder="Additional observations"></textarea>
        </div>

        <button type="button" class="log-timeline-btn">📋 Log to Timeline</button>
    `;
}

/**
 * Draft Sensor (Light Condition) Form Template.
 * Supports toggle between Physical and Simulated (Test Pipe) methods.
 * @returns {string} HTML Template.
 */
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

        <!-- Physical Marks Section -->
        <div id="physical-draft-light-section">
            <h3 style="margin-top: 15px; margin-bottom: 10px;">Forward Sensors</h3>
            <div class="input-row">
                <div class="form-group">
                    <label>Forward Port (ft)</label>
                    <input type="number" id="light-fwd-port" step="0.01" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>Forward Starboard (ft)</label>
                    <input type="number" id="light-fwd-stbd" step="0.01" placeholder="0.0">
                </div>
            </div>
            <div class="input-row-3">
                <div class="form-group">
                    <label>Fwd Avg (ft)</label>
                    <input type="number" id="light-fwd-avg" step="0.01" readonly placeholder="Auto-calc">
                </div>
                <div class="form-group">
                    <label>DQM System Fwd (ft)</label>
                    <input type="number" id="light-dqm-fwd" step="0.01" placeholder="0.0">
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
                    <input type="number" id="light-aft-port" step="0.01" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>Aft Starboard (ft)</label>
                    <input type="number" id="light-aft-stbd" step="0.01" placeholder="0.0">
                </div>
            </div>
            <div class="input-row-3">
                <div class="form-group">
                    <label>Aft Avg (ft)</label>
                    <input type="number" id="light-aft-avg" step="0.01" readonly placeholder="Auto-calc">
                </div>
                <div class="form-group">
                    <label>DQM System Aft (ft)</label>
                    <input type="number" id="light-dqm-aft" step="0.01" placeholder="0.0">
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

        <!-- Simulated Pipe Section -->
        <div id="simulated-draft-light-section" class="hidden">
            <h3>Simulated Draft Check — Forward Sensor (Light)</h3>
            <p class="text-muted">Test pipe method: Measure sensor response at known water depths</p>
            <div class="input-row-3">
                <div class="form-group"><label>Fwd Offset (ft)</label><input type="number" id="sim-light-fwd-offset" step="0.01" placeholder="e.g., 2.0"></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 1 (ft)</label><input type="number" id="sim-light-fwd-depth-1" step="0.01" placeholder="e.g., 5.0"></div>
                <div class="form-group"><label>DQM Reading 1 (ft)</label><input type="number" id="sim-light-fwd-reading-1" step="0.01" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-light-fwd-diff-1" step="0.01" readonly placeholder="Auto-calc"></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 2 (ft)</label><input type="number" id="sim-light-fwd-depth-2" step="0.01" placeholder="e.g., 10.0"></div>
                <div class="form-group"><label>DQM Reading 2 (ft)</label><input type="number" id="sim-light-fwd-reading-2" step="0.01" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-light-fwd-diff-2" step="0.01" readonly placeholder="Auto-calc"></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 3 (ft)</label><input type="number" id="sim-light-fwd-depth-3" step="0.01" placeholder="e.g., 15.0"></div>
                <div class="form-group"><label>DQM Reading 3 (ft)</label><input type="number" id="sim-light-fwd-reading-3" step="0.01" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-light-fwd-diff-3" step="0.01" readonly placeholder="Auto-calc"></div>
            </div>
            <div style="margin-top: 10px; margin-bottom: 20px;">
                <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Light Simulated Draft Check (Forward) Completed', this)">📋 Log Simulated Fwd</button>
            </div>

            <hr style="margin: 20px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.1);">

            <h3>Simulated Draft Check — Aft Sensor (Light)</h3>
            <div class="input-row-3">
                <div class="form-group"><label>Aft Offset (ft)</label><input type="number" id="sim-light-aft-offset" step="0.01" placeholder="e.g., 2.0"></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 1 (ft)</label><input type="number" id="sim-light-aft-depth-1" step="0.01" placeholder="e.g., 5.0"></div>
                <div class="form-group"><label>DQM Reading 1 (ft)</label><input type="number" id="sim-light-aft-reading-1" step="0.01" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-light-aft-diff-1" step="0.01" readonly placeholder="Auto-calc"></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 2 (ft)</label><input type="number" id="sim-light-aft-depth-2" step="0.01" placeholder="e.g., 10.0"></div>
                <div class="form-group"><label>DQM Reading 2 (ft)</label><input type="number" id="sim-light-aft-reading-2" step="0.01" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-light-aft-diff-2" step="0.01" readonly placeholder="Auto-calc"></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 3 (ft)</label><input type="number" id="sim-light-aft-depth-3" step="0.01" placeholder="e.g., 15.0"></div>
                <div class="form-group"><label>DQM Reading 3 (ft)</label><input type="number" id="sim-light-aft-reading-3" step="0.01" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-light-aft-diff-3" step="0.01" readonly placeholder="Auto-calc"></div>
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

/**
 * Draft Sensor (Loaded Condition) Form Template.
 * Used for full hopper/scow inspections.
 * @returns {string} HTML Template.
 */
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

        <!-- Physical Marks Section -->
        <div id="physical-draft-loaded-section">
            <h3 style="margin-top: 15px; margin-bottom: 10px;">Forward Sensors</h3>
            <div class="input-row">
                <div class="form-group">
                    <label>Forward Port (ft)</label>
                    <input type="number" id="loaded-fwd-port" step="0.01" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>Forward Starboard (ft)</label>
                    <input type="number" id="loaded-fwd-stbd" step="0.01" placeholder="0.0">
                </div>
            </div>
            <div class="input-row-3">
                <div class="form-group">
                    <label>Fwd Avg (ft)</label>
                    <input type="number" id="loaded-fwd-avg" step="0.01" readonly placeholder="Auto-calc">
                </div>
                <div class="form-group">
                    <label>DQM System Fwd (ft)</label>
                    <input type="number" id="loaded-dqm-fwd" step="0.01" placeholder="0.0">
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
                    <input type="number" id="loaded-aft-port" step="0.01" placeholder="0.0">
                </div>
                <div class="form-group">
                    <label>Aft Starboard (ft)</label>
                    <input type="number" id="loaded-aft-stbd" step="0.01" placeholder="0.0">
                </div>
            </div>
            <div class="input-row-3">
                <div class="form-group">
                    <label>Aft Avg (ft)</label>
                    <input type="number" id="loaded-aft-avg" step="0.01" readonly placeholder="Auto-calc">
                </div>
                <div class="form-group">
                    <label>DQM System Aft (ft)</label>
                    <input type="number" id="loaded-dqm-aft" step="0.01" placeholder="0.0">
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

        <!-- Simulated Pipe Section -->
        <div id="simulated-draft-loaded-section" class="hidden">
            <h3>Simulated Draft Check — Forward Sensor (Loaded)</h3>
            <p class="text-muted">Test pipe method: Measure sensor response at known water depths</p>
            <div class="input-row-3">
                <div class="form-group"><label>Fwd Offset (ft)</label><input type="number" id="sim-loaded-fwd-offset" step="0.1" placeholder="e.g., 2.0"></div>
            </div>
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
                <div class="form-group"><label>Aft Offset (ft)</label><input type="number" id="sim-loaded-aft-offset" step="0.1" placeholder="e.g., 2.0"></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 1 (ft)</label><input type="number" id="sim-loaded-aft-depth-1" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>DQM Reading 1 (ft)</label><input type="number" id="sim-loaded-aft-reading-1" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-loaded-aft-diff-1" step="0.1" readonly placeholder="Auto-calc"></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 2 (ft)</label><input type="number" id="sim-loaded-aft-depth-2" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>DQM Reading 2 (ft)</label><input type="number" id="sim-loaded-aft-reading-2" step="0.1" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="sim-loaded-aft-diff-2" step="0.1" readonly placeholder="Auto-calc"></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Test Depth 3 (ft)</label><input type="number" id="sim-loaded-aft-depth-3" step="0.1" placeholder="0.0"></div>
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

/**
 * Toggles visibility of Light Draft check sections based on method selection.
 * @param {number} plantIdx - Index suffix.
 */
function toggleDraftLightMethod(plantIdx) {
    const method = document.getElementById(`draft-light-check-method-${plantIdx}`)?.value;
    document.getElementById(`physical-draft-light-section-${plantIdx}`)?.classList.toggle('hidden', method === 'simulated');
    document.getElementById(`simulated-draft-light-section-${plantIdx}`)?.classList.toggle('hidden', method !== 'simulated');
}

/**
 * Toggles visibility of Loaded Draft check sections based on method selection.
 * @param {number} plantIdx - Index suffix.
 */
function toggleDraftLoadedMethod(plantIdx) {
    const method = document.getElementById(`draft-loaded-check-method-${plantIdx}`)?.value;
    document.getElementById(`physical-draft-loaded-section-${plantIdx}`)?.classList.toggle('hidden', method === 'simulated');
    document.getElementById(`simulated-draft-loaded-section-${plantIdx}`)?.classList.toggle('hidden', method !== 'simulated');
}

/**
 * Simulated Draft (General) Form Template.
 * Legacy template for integrated checks.
 * @returns {string} HTML Template.
 */
function createDraftSensorSimulatedForm() {
    return `
        <h2>Draft Sensor Check — Simulated (Test Pipe Method)</h2>
        <p class="text-muted">Use the test pipe method to simulate known water depths at the sensor. Record at least 3 measurements for each sensor location.</p>

        <h3>Forward Sensor</h3>
        <div class="input-row-3">
            <div class="form-group"><label>Fwd Offset (ft)</label><input type="number" id="sim-fwd-offset" step="0.1" placeholder="e.g., 2.0"></div>
        </div>
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
            <div class="form-group"><label>Aft Offset (ft)</label><input type="number" id="sim-aft-offset" step="0.1" placeholder="e.g., 2.0"></div>
        </div>
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

/**
 * Ullage (Light Condition) Form Template.
 * Measurement of bin/hopper depth using weighted tape soundings.
 * @returns {string} HTML Template.
 */
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
        <div class="input-row-3">
            <div class="form-group">
                <label>Avg Sounding (ft)</label>
                <input type="number" id="ullage-light-fwd-avg" step="0.01" placeholder="Auto-calc" readonly>
            </div>
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
        <div class="input-row-3">
            <div class="form-group">
                <label>Avg Sounding (ft)</label>
                <input type="number" id="ullage-light-aft-avg" step="0.01" placeholder="Auto-calc" readonly>
            </div>
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

/**
 * Ullage (Loaded Condition) Form Template.
 * Used for full hopper/bin inspections.
 * @returns {string} HTML Template.
 */
function createUllageLoadedForm() {
    return `
        <h2>Ullage Check — Loaded Condition</h2>
        <p class="text-muted">Perform this check after the bin/hopper is loaded. Ensure a uniform material surface before taking soundings. Acceptable difference: ±0.1 ft.</p>

        <h3 style="margin-top: 15px; margin-bottom: 10px;">Forward Sensors</h3>
        <div class="input-row">
            <div class="form-group">
                <label>Forward Port Sounding (ft)</label>
                <input type="number" id="ullage-loaded-fwd-port" step="0.01" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Forward Starboard Sounding (ft)</label>
                <input type="number" id="ullage-loaded-fwd-stbd" step="0.01" placeholder="0.0">
            </div>
        </div>
        <div class="input-row-3">
            <div class="form-group">
                <label>Avg Sounding (ft)</label>
                <input type="number" id="ullage-loaded-fwd-avg" step="0.01" placeholder="Auto-calc" readonly>
            </div>
            <div class="form-group">
                <label>DQM System Forward (ft)</label>
                <input type="number" id="ullage-loaded-dqm-fwd" step="0.01" placeholder="0.0">
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
                <input type="number" id="ullage-loaded-aft-port" step="0.01" placeholder="0.0">
            </div>
            <div class="form-group">
                <label>Aft Starboard Sounding (ft)</label>
                <input type="number" id="ullage-loaded-aft-stbd" step="0.01" placeholder="0.0">
            </div>
        </div>
        <div class="input-row-3">
            <div class="form-group">
                <label>Avg Sounding (ft)</label>
                <input type="number" id="ullage-loaded-aft-avg" step="0.01" placeholder="Auto-calc" readonly>
            </div>
            <div class="form-group">
                <label>DQM System Aft (ft)</label>
                <input type="number" id="ullage-loaded-dqm-aft" step="0.01" placeholder="0.0">
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

/**
 * Draghead Depth Check Form Template.
 * Dynamically toggles sections for Port, Center, and Starboard dragheads.
 * @returns {string} HTML Template.
 */
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

        <!-- Port Section -->
        <div id="draghead-port-section" class="hidden">
            <h3>Port Draghead</h3>
            <div class="form-group" style="margin-bottom: 20px;">
                <label>Depth Offset (ft)</label>
                <input type="number" id="draghead-port-offset" step="0.01" placeholder="e.g., 2.0">
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Measurement 1 - Manual (ft)</label><input type="number" id="draghead-port-manual-1" step="0.01" placeholder="0.0"></div>
                <div class="form-group"><label>Measurement 1 - DQM (ft)</label><input type="number" id="draghead-port-dqm-1" step="0.01" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="draghead-port-diff-1" step="0.01" placeholder="Auto-calc" readonly></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Measurement 2 - Manual (ft)</label><input type="number" id="draghead-port-manual-2" step="0.01" placeholder="0.0"></div>
                <div class="form-group"><label>Measurement 2 - DQM (ft)</label><input type="number" id="draghead-port-dqm-2" step="0.01" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="draghead-port-diff-2" step="0.01" placeholder="Auto-calc" readonly></div>
            </div>
            <div class="input-row-3">
                <div class="form-group"><label>Measurement 3 - Manual (ft)</label><input type="number" id="draghead-port-manual-3" step="0.01" placeholder="0.0"></div>
                <div class="form-group"><label>Measurement 3 - DQM (ft)</label><input type="number" id="draghead-port-dqm-3" step="0.01" placeholder="0.0"></div>
                <div class="form-group"><label>Difference (ft)</label><input type="number" id="draghead-port-diff-3" step="0.01" placeholder="Auto-calc" readonly></div>
            </div>
            <div class="status-buttons" style="margin-top: 10px; margin-bottom: 20px;">
                <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Draghead Depth Check (Port) Completed', this)">📋 Log Port to Timeline</button>
            </div>
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.1);">
        </div>

        <!-- Center Section -->
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
            <div class="status-buttons" style="margin-top: 10px; margin-bottom: 20px;">
                <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Draghead Depth Check (Center) Completed', this)">📋 Log Center to Timeline</button>
            </div>
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.1);">
        </div>
        
        <!-- Starboard Section -->
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
            <div class="status-buttons" style="margin-top: 10px; margin-bottom: 20px;">
                <button type="button" class="btn-secondary log-custom-btn" onclick="logCustomToTimeline('Draghead Depth Check (Starboard) Completed', this)">📋 Log Stbd to Timeline</button>
            </div>
        </div>
        
        <div class="form-group">
            <label>Remarks</label>
            <textarea id="draghead-remarks" rows="2"></textarea>
        </div>
    `;
}

/**
 * Toggles visibility of Draghead sections based on checkbox selection.
 * @param {number} plantIdx - Index suffix.
 */
function toggleDragheadSections(plantIdx) {
    const port = document.getElementById(`draghead-check-port-${plantIdx}`)?.checked;
    const center = document.getElementById(`draghead-check-center-${plantIdx}`)?.checked;
    const stbd = document.getElementById(`draghead-check-stbd-${plantIdx}`)?.checked;

    document.getElementById(`draghead-port-section-${plantIdx}`)?.classList.toggle('hidden', !port);
    document.getElementById(`draghead-center-section-${plantIdx}`)?.classList.toggle('hidden', !center);
    document.getElementById(`draghead-stbd-section-${plantIdx}`)?.classList.toggle('hidden', !stbd);
}

/**
 * Suction Mouth Depth Check Form Template.
 * @returns {string} HTML Template.
 */
function createSuctionMouthDepthForm() {
    return `
        <h2>Suction Mouth Depth Check</h2>

        <div class="form-group">
            <label>Depth Offset (ft)</label>
            <input type="number" id="suction-offset" step="0.1" placeholder="e.g., 2.0">
        </div>
        
        <p class="text-muted">Record measurements within the operating range</p>
        
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

function toggleVelocityMethod(plantIdx) {
    const method = document.getElementById(`velocity-method-${plantIdx}`)?.value;
    document.getElementById(`velocity-dye-section-${plantIdx}`)?.classList.toggle('hidden', method !== 'dye');
    document.getElementById(`velocity-meter-section-${plantIdx}`)?.classList.toggle('hidden', method !== 'meter');
}

/**
 * Bucket/Grab Depth Check Form Template.
 * Used for mechanical dredges.
 * @returns {string} HTML Template.
 */
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

/**
 * Bucket Position Check Form Template.
 * Verifies horizontal/swing accuracy for mechanical dredges.
 * @returns {string} HTML Template.
 */
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

/**
 * Captures the current device coordinates for position checks.
 * @param {string} type - 'handheld' or 'dqm' (typically handheld).
 * @param {number} plantIdx - Index for identifying target inputs.
 */
function captureGPS(type, plantIdx) {
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

            const latEl = document.getElementById(`handheld-lat-${plantIdx}`);
            const lonEl = document.getElementById(`handheld-lon-${plantIdx}`);
            if (latEl) latEl.value = lat.toFixed(6);
            if (lonEl) lonEl.value = lon.toFixed(6);

            button.disabled = false;
            button.textContent = '✅ GPS Captured';

            setTimeout(() => {
                button.textContent = '📡 Capture Device GPS';
            }, 2000);

            saveCheckData('positionCheck', plantIdx);
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

/**
 * Shows a photo preview for hull status file inputs and persists the data URL to state.
 * @param {HTMLInputElement} inputEl - File input element.
 * @param {string} previewId - ID of target <img>.
 * @param {string} stateKey - Key for storing in appState.checks.hullStatus.
 * @param {number} plantIdx - Parent plant index.
 */
function previewHullPhoto(inputEl, previewId, stateKey, plantIdx) {
    // Try to find the preview image via DOM traversal first, fallback to ID
    const preview = inputEl.closest('.form-group')?.querySelector('img') || document.getElementById(`${previewId}-${plantIdx}`) || document.getElementById(previewId);
    const file = inputEl.files && inputEl.files[0];
    if (!file || !preview) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        preview.src = dataUrl;
        preview.style.display = 'block';

        // Persist photo data directly
        const plant = appState.plants[plantIdx];
        if (plant) {
            if (!plant.checks.hullStatus) plant.checks.hullStatus = {};
            // If stateKey is not provided, derive from ID but strip the plant index
            const key = stateKey || inputEl.id.replace(new RegExp(`-${plantIdx}$`), '');
            plant.checks.hullStatus[key] = dataUrl;
            saveDraft();
        }
    };
    reader.readAsDataURL(file);
}

// ===== Data Management =====

/**
 * Updates application-level metadata from global form inputs.
 */
function updateAppState() {
    appState.checkDate = document.getElementById('check-date').value;
    appState.weatherConditions = document.getElementById('weather-conditions').value;
    appState.qaTeam = document.getElementById('qa-team').value;
    appState.systemProvider = document.getElementById('system-provider').value;
    appState.generalComments = document.getElementById('general-comments').value;
    saveDraft();
}

/**
 * Saves all input values from a check card into the application state.
 * @param {string} checkType - The key for the check (e.g., 'hullStatus').
 * @param {number} plantIdx - The index of the plant.
 */
function saveCheckData(checkType, plantIdx) {
    const card = document.getElementById(`${checkType}-card-${plantIdx}`);
    if (!card) return;

    const plant = appState.plants[plantIdx];
    if (!plant.checks[checkType]) plant.checks[checkType] = {};

    // Initialize with existing data to preserve asynchronously loaded Base64 URLs (e.g., from Hull Status photos)
    const data = plant.checks[checkType];

    card.querySelectorAll('input, textarea, select').forEach(input => {
        if (input.id) {
            // Never serialize fake file paths into the JSON object
            if (input.type === 'file') return;

            // Fix for "doubling suffix" bug: 
            // Ensure we strip the -${plantIdx} suffix from the ID before saving to state
            let key = input.id;
            if (key.endsWith(`-${plantIdx}`)) {
                key = key.substring(0, key.lastIndexOf(`-${plantIdx}`));
            }

            if (input.type === 'checkbox') {
                data[key] = input.checked;
            } else {
                data[key] = input.value;
            }
        }
    });

    saveDraft();
}

/**
 * Serializes the current appState to LocalStorage.
 */
function saveDraft() {
    try {
        localStorage.setItem('dqm-qa-draft', JSON.stringify(appState));
    } catch (e) {
        console.error('Failed to save draft:', e);
    }
}

/**
 * Loads the application state from LocalStorage and reconstructs the UI.
 */
function loadDraft() {
    try {
        const draft = localStorage.getItem('dqm-qa-draft');
        if (draft) {
            const data = JSON.parse(draft);

            // Restore metadata (Global form fields)
            if (data.checkDate) document.getElementById('check-date').value = data.checkDate;
            if (data.qaTeam) document.getElementById('qa-team').value = data.qaTeam;
            if (data.systemProvider) document.getElementById('system-provider').value = data.systemProvider;
            if (data.generalComments) document.getElementById('general-comments').value = data.generalComments;

            // Restore plants - This involves recreating the plant DOM entries
            if (data.plants && data.plants.length > 0) {
                // Clear the default initial plant
                document.getElementById('plants-container').innerHTML = '';
                plantCounter = 0;

                data.plants.forEach(plant => {
                    addPlant();
                    const entries = document.querySelectorAll('.plant-entry');
                    const entry = entries[entries.length - 1];

                    // Map state back to DOM
                    entry.querySelector('.plant-name').value = plant.name;
                    entry.querySelector('.vessel-type').value = plant.vesselType;
                    updateProfileOptions(entry.querySelector('.vessel-type'));
                    entry.querySelector('.vessel-profile').value = plant.profile;
                });

                updatePlants();
            }

            // Restore timeline history
            if (data.timeline && Array.isArray(data.timeline)) {
                appState.timeline = data.timeline;
                renderTimeline();
            }

            // Merge full data back into active appState
            Object.assign(appState, data);

            // Re-render the QA check cards based on the restored vessel profiles
            updateQAChecks();

            // Run conditional UI toggles (e.g., Simulated vs Physical Sections)
            // Delay ensures the DOM generated by updateQAChecks is fully ready
            setTimeout(() => {
                appState.plants.forEach((plant, pIdx) => {
                    const key = `${plant.vesselType}-${plant.profile}`;
                    const checks = requiredChecks[key] || [];

                    if (checks.includes('velocity')) {
                        if (typeof toggleVelocityMethod === 'function') toggleVelocityMethod(pIdx);
                    }
                    if (checks.includes('dragheadDepth')) {
                        if (typeof toggleDragheadSections === 'function') toggleDragheadSections(pIdx);
                    }
                    if (checks.includes('draftSensorLight')) {
                        if (typeof toggleDraftLightMethod === 'function') toggleDraftLightMethod(pIdx);
                    }
                    if (checks.includes('draftSensorLoaded')) {
                        if (typeof toggleDraftLoadedMethod === 'function') toggleDraftLoadedMethod(pIdx);
                    }
                });
            }, 500);
        }
    } catch (e) {
        console.error('Failed to load draft:', e);
    }
}

/**
 * Resets the application state and clears LocalStorage.
 */
function clearAll() {
    if (confirm('Clear all data? This cannot be undone.')) {
        localStorage.removeItem('dqm-qa-draft');
        location.reload();
    }
}

// ===== Export Functions =====

/**
 * Validates state, filters empty data, and triggers a JSON file download.
 */
function exportJSON() {
    updateAppState();

    // Validate we have at least one plant
    if (appState.plants.length === 0) {
        alert('Please add at least one plant before exporting.');
        return;
    }

    // Helper to check if a check object has any actual data (avoids exporting empty containers)
    function hasAnyValue(obj) {
        if (!obj) return false;
        return Object.values(obj).some(v => v !== '' && v !== null && v !== undefined);
    }

    // Filter checks for each plant to keep the JSON file clean
    appState.plants.forEach(plant => {
        const filtered = {};
        if (plant.checks) {
            Object.entries(plant.checks).forEach(([type, data]) => {
                if (hasAnyValue(data)) {
                    filtered[type] = data;
                }
            });
        }
        plant.checks = filtered;
    });

    // Build the final export structure
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

    // Construct filename from plant names and date
    const plantNames = appState.plants.map(p => p.name.trim()).filter(n => n).join(' ');
    const displayPlantNames = plantNames || 'Unnamed Plants';
    const dateStr = appState.checkDate || new Date().toISOString().split('T')[0];
    const filename = `DQM QA ${displayPlantNames} ${dateStr}.json`;

    // Download via data URL
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

/**
 * Adds a manual comment entry to the activity timeline.
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
 * Logs a completed QA check to the timeline and updates visual status.
 * @param {string} checkType - The check key.
 * @param {number} plantIdx - The plant index.
 */
function logCheckToTimeline(checkType, plantIdx) {
    saveCheckData(checkType, plantIdx);

    const plant = appState.plants[plantIdx];
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

    const card = document.getElementById(`${checkType}-card-${plantIdx}`);
    if (card) {
        card.classList.add('check-logged');
    }

    const entry = {
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        activity: `[${plant.name}] ${checkNames[checkType]} Completed`,
        notes: '',
        timestamp: new Date().toISOString()
    };

    appState.timeline.push(entry);
    renderTimeline();
    saveDraft();

    // Show temporary confirmation state on the button
    if (card) {
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
}

/**
 * Logs a custom event (e.g., partial draft check) to the timeline.
 * @param {string} activityText - Context string for the event.
 * @param {HTMLElement} button - The button that triggered the log.
 */
function logCustomToTimeline(activityText, button) {
    const entry = {
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
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

/**
 * Re-renders the timeline table from appState.
 */
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

/**
 * Deletes a specific entry from the activity timeline.
 * @param {number} index - Index of the entry to remove.
 */
function deleteTimelineEntry(index) {
    if (confirm('Delete this timeline entry?')) {
        appState.timeline.splice(index, 1);
        renderTimeline();
        saveDraft();
    }
}

/**
 * Populates form inputs with data from the application state for a specific plant.
 * @param {string} checkType - The key for the check (e.g., 'positionCheck').
 * @param {number} plantIdx - The plant index.
 * @param {Object} data - The state data object for this check.
 */
function restoreCheckData(checkType, plantIdx, data) {
    const card = document.getElementById(`${checkType}-card-${plantIdx}`);
    if (!card) return;

    for (const [key, value] of Object.entries(data)) {
        // Find inputs by ID or name (supporting both template formats)
        const input = card.querySelector(`[id="${key}-${plantIdx}"], [name="${key}-${plantIdx}"]`);
        if (input) {
            if (input.type === 'checkbox') {
                input.checked = value;
            } else {
                input.value = value;
            }
        }
    }

    // Special restoration for photo previews (converting state data URLs back to <img> src)
    if (checkType === 'hullStatus') {
        const openPreview = document.getElementById(`hull-open-photo-preview-${plantIdx}`);
        const closePreview = document.getElementById(`hull-close-photo-preview-${plantIdx}`);

        if (openPreview && data['hull-open-photo']) {
            openPreview.src = data['hull-open-photo'];
            openPreview.style.display = 'block';
        }
        if (closePreview && data['hull-close-photo']) {
            closePreview.src = data['hull-close-photo'];
            closePreview.style.display = 'block';
        }
    }
}

// ===== Auto-Calculation Functions =====

/**
 * Dispatcher for triggering calculations based on check type.
 * @param {string} checkType - The check key.
 * @param {number} plantIdx - The plant index.
 */
function calculateDifferences(checkType, plantIdx) {
    switch (checkType) {
        case 'positionCheck':
            calculatePositionDifference(plantIdx);
            break;
        case 'draftSensorLight':
            calculatePhysicalDraftDifferences('light', plantIdx);
            calculateSimulatedDraftDifferences('light', plantIdx);
            break;
        case 'draftSensorLoaded':
            calculatePhysicalDraftDifferences('loaded', plantIdx);
            calculateSimulatedDraftDifferences('loaded', plantIdx);
            break;
        case 'dragheadDepth':
            calculateDragheadDifferences(plantIdx);
            break;
        case 'suctionMouthDepth':
            calculateSuctionDifferences(plantIdx);
            break;
        case 'velocity':
            calculateVelocity(plantIdx);
            break;
        case 'ullageLight':
            calculateUllageDifferences('light', plantIdx);
            break;
        case 'ullageLoaded':
            calculateUllageDifferences('loaded', plantIdx);
            break;
        case 'bucketDepth':
            calculateBucketDepthDifferences(plantIdx);
            break;
        case 'bucketPosition':
            calculateBucketPositionDifferences(plantIdx);
            break;
    }
}

/**
 * Calculates straight-line distance (feet) between handheld GPS and DQM GPS coordinates.
 * @param {number} plantIdx - Plant index.
 */
function calculatePositionDifference(plantIdx) {
    const lat1 = parseFloat(document.getElementById(`handheld-lat-${plantIdx}`)?.value);
    const lon1 = parseFloat(document.getElementById(`handheld-lon-${plantIdx}`)?.value);
    const lat2 = parseFloat(document.getElementById(`dqm-lat-${plantIdx}`)?.value);
    const lon2 = parseFloat(document.getElementById(`dqm-lon-${plantIdx}`)?.value);

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

    const diffInput = document.getElementById(`position-diff-${plantIdx}`);
    if (diffInput) {
        diffInput.value = distance.toFixed(2);
    }
}

/**
 * Calculates differences for physical (draft-tube) measurements.
 * @param {string} condition - 'light' or 'loaded'.
 * @param {number} plantIdx - Plant index.
 */
function calculatePhysicalDraftDifferences(condition, plantIdx) {
    ['fwd', 'aft'].forEach(pos => {
        const port = parseFloat(document.getElementById(`${condition}-${pos}-port-${plantIdx}`)?.value);
        const stbd = parseFloat(document.getElementById(`${condition}-${pos}-stbd-${plantIdx}`)?.value);
        const dqm = parseFloat(document.getElementById(`${condition}-dqm-${pos}-${plantIdx}`)?.value);

        const avgInput = document.getElementById(`${condition}-${pos}-avg-${plantIdx}`);
        const diffInput = document.getElementById(`${condition}-${pos}-diff-${plantIdx}`);

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

/**
 * Calculates differences for simulated draft checks using defined offsets.
 * @param {string} condition - 'light' or 'loaded'.
 * @param {number} plantIdx - Plant index.
 */
function calculateSimulatedDraftDifferences(condition, plantIdx) {
    // condition is 'light' or 'loaded'
    ['fwd', 'aft'].forEach(pos => {
        const offset = parseFloat(document.getElementById(`sim-${condition}-${pos}-offset-${plantIdx}`)?.value) || 0;
        for (let i = 1; i <= 3; i++) {
            const depth = parseFloat(document.getElementById(`sim-${condition}-${pos}-depth-${i}-${plantIdx}`)?.value);
            const reading = parseFloat(document.getElementById(`sim-${condition}-${pos}-reading-${i}-${plantIdx}`)?.value);
            const diffInput = document.getElementById(`sim-${condition}-${pos}-diff-${i}-${plantIdx}`);
            if (!isNaN(depth) && !isNaN(reading) && diffInput) {
                diffInput.value = Math.abs((depth + offset) - reading).toFixed(2);
            }
        }
    });
}

/**
 * Standalone simulated draft calculation logic (for non-integrated tabs).
 * @param {number} plantIdx - Plant index.
 */
function calculateStandaloneSimulatedDraftDifferences(plantIdx) {
    ['fwd', 'aft'].forEach(pos => {
        const offset = parseFloat(document.getElementById(`sim-${pos}-offset-${plantIdx}`)?.value) || 0;
        for (let i = 1; i <= 3; i++) {
            const depth = parseFloat(document.getElementById(`sim-${pos}-depth-${i}-${plantIdx}`)?.value);
            const reading = parseFloat(document.getElementById(`sim-${pos}-reading-${i}-${plantIdx}`)?.value);
            const diffInput = document.getElementById(`sim-${pos}-diff-${i}-${plantIdx}`);
            if (!isNaN(depth) && !isNaN(reading) && diffInput) {
                diffInput.value = Math.abs((depth + offset) - reading).toFixed(2);
            }
        }
    });
}

/**
 * Calculates differences for Draghead Depth checks including vertical offsets.
 * @param {number} plantIdx - Plant index.
 */
function calculateDragheadDifferences(plantIdx) {
    ['port', 'center', 'stbd'].forEach(side => {
        const offset = parseFloat(document.getElementById(`draghead-${side}-offset-${plantIdx}`)?.value) || 0;
        for (let i = 1; i <= 3; i++) {
            const manual = parseFloat(document.getElementById(`draghead-${side}-manual-${i}-${plantIdx}`)?.value);
            const dqm = parseFloat(document.getElementById(`draghead-${side}-dqm-${i}-${plantIdx}`)?.value);
            const diffInput = document.getElementById(`draghead-${side}-diff-${i}-${plantIdx}`);

            if (!isNaN(manual) && !isNaN(dqm) && diffInput) {
                diffInput.value = Math.abs((manual + offset) - dqm).toFixed(2);
            }
        }
    });
}

/**
 * Calculates differences for Suction Mouth Depth checks.
 * @param {number} plantIdx - Plant index.
 */
function calculateSuctionDifferences(plantIdx) {
    const offset = parseFloat(document.getElementById(`suction-offset-${plantIdx}`)?.value) || 0;

    for (let i = 1; i <= 3; i++) {
        const manual = parseFloat(document.getElementById(`suction-manual-${i}-${plantIdx}`)?.value);
        const dqm = parseFloat(document.getElementById(`suction-dqm-${i}-${plantIdx}`)?.value);
        const diffInput = document.getElementById(`suction-diff-${i}-${plantIdx}`);

        if (!isNaN(manual) && !isNaN(dqm) && diffInput) {
            diffInput.value = Math.abs((manual + offset) - dqm).toFixed(2);
        }
    }
}

/**
 * Calculates Velocity based on either Dye Test (length/time) or Meter Comparison.
 * @param {number} plantIdx - Plant index.
 */
function calculateVelocity(plantIdx) {
    const method = document.getElementById(`velocity-method-${plantIdx}`)?.value;

    if (method === 'dye') {
        const pipeLength = parseFloat(document.getElementById(`velocity-pipe-length-${plantIdx}`)?.value);
        if (!isNaN(pipeLength) && pipeLength > 0) {
            [1, 2, 3].forEach(i => {
                const time = parseFloat(document.getElementById(`velocity-dye-time-${i}-${plantIdx}`)?.value);
                const calcInput = document.getElementById(`velocity-dye-calc-${i}-${plantIdx}`);
                if (!isNaN(time) && time > 0 && calcInput) {
                    const calculated = pipeLength / time;
                    calcInput.value = calculated.toFixed(2);

                    const dqm = parseFloat(document.getElementById(`velocity-dye-dqm-${i}-${plantIdx}`)?.value);
                    const diffInput = document.getElementById(`velocity-dye-diff-${i}-${plantIdx}`);
                    if (!isNaN(dqm) && diffInput) {
                        diffInput.value = Math.abs(calculated - dqm).toFixed(2);
                    }
                }
            });
        }
    } else if (method === 'meter') {
        [1, 2, 3].forEach(i => {
            const manual = parseFloat(document.getElementById(`velocity-meter-manual-${i}-${plantIdx}`)?.value);
            const dqm = parseFloat(document.getElementById(`velocity-meter-dqm-${i}-${plantIdx}`)?.value);
            const diffInput = document.getElementById(`velocity-meter-diff-${i}-${plantIdx}`);

            if (!isNaN(manual) && !isNaN(dqm) && diffInput) {
                diffInput.value = Math.abs(manual - dqm).toFixed(2);
            }
        });
    }
}

/**
 * Calculates Ullage differences by averaging manual port/starboard soundings.
 * @param {string} condition - 'light' or 'loaded'.
 * @param {number} plantIdx - Plant index.
 */
function calculateUllageDifferences(condition, plantIdx) {
    // Forward: average port+stbd manual soundings vs DQM forward reading
    const fwdPort = parseFloat(document.getElementById(`ullage-${condition}-fwd-port-${plantIdx}`)?.value);
    const fwdStbd = parseFloat(document.getElementById(`ullage-${condition}-fwd-stbd-${plantIdx}`)?.value);
    const dqmFwd = parseFloat(document.getElementById(`ullage-${condition}-dqm-fwd-${plantIdx}`)?.value);
    const fwdAvg = document.getElementById(`ullage-${condition}-fwd-avg-${plantIdx}`);
    const fwdDiff = document.getElementById(`ullage-${condition}-diff-fwd-${plantIdx}`);

    if (fwdAvg) {
        let manualFwd;
        if (!isNaN(fwdPort) && !isNaN(fwdStbd)) {
            manualFwd = (fwdPort + fwdStbd) / 2;
        } else if (!isNaN(fwdPort)) {
            manualFwd = fwdPort;
        } else if (!isNaN(fwdStbd)) {
            manualFwd = fwdStbd;
        }

        if (manualFwd !== undefined) {
            fwdAvg.value = manualFwd.toFixed(2);
            if (!isNaN(dqmFwd) && fwdDiff) {
                fwdDiff.value = Math.abs(manualFwd - dqmFwd).toFixed(2);
            }
        } else {
            fwdAvg.value = '';
            if (fwdDiff) fwdDiff.value = '';
        }
    }

    // Aft: average port+stbd manual soundings vs DQM aft reading
    const aftPort = parseFloat(document.getElementById(`ullage-${condition}-aft-port-${plantIdx}`)?.value);
    const aftStbd = parseFloat(document.getElementById(`ullage-${condition}-aft-stbd-${plantIdx}`)?.value);
    const dqmAft = parseFloat(document.getElementById(`ullage-${condition}-dqm-aft-${plantIdx}`)?.value);
    const aftAvg = document.getElementById(`ullage-${condition}-aft-avg-${plantIdx}`);
    const aftDiff = document.getElementById(`ullage-${condition}-diff-aft-${plantIdx}`);

    if (aftAvg) {
        let manualAft;
        if (!isNaN(aftPort) && !isNaN(aftStbd)) {
            manualAft = (aftPort + aftStbd) / 2;
        } else if (!isNaN(aftPort)) {
            manualAft = aftPort;
        } else if (!isNaN(aftStbd)) {
            manualAft = aftStbd;
        }

        if (manualAft !== undefined) {
            aftAvg.value = manualAft.toFixed(2);
            if (!isNaN(dqmAft) && aftDiff) {
                aftDiff.value = Math.abs(manualAft - dqmAft).toFixed(2);
            }
        } else {
            aftAvg.value = '';
            if (aftDiff) aftDiff.value = '';
        }
    }
}

/**
 * Calculates bucket depth differences including vertical heel offsets.
 * @param {number} plantIdx - Plant index.
 */
function calculateBucketDepthDifferences(plantIdx) {
    const offset = parseFloat(document.getElementById(`bucket-offset-${plantIdx}`)?.value) || 0;

    for (let i = 1; i <= 3; i++) {
        const manual = parseFloat(document.getElementById(`bucket-manual-${i}-${plantIdx}`)?.value);
        const dqm = parseFloat(document.getElementById(`bucket-dqm-${i}-${plantIdx}`)?.value);
        const diffInput = document.getElementById(`bucket-diff-${i}-${plantIdx}`);
        if (!isNaN(manual) && !isNaN(dqm) && diffInput) {
            diffInput.value = Math.abs((manual + offset) - dqm).toFixed(2);
        }
    }
}

/**
 * Calculates bucket position (horizontal/radial) differences.
 * @param {number} plantIdx - Plant index.
 */
function calculateBucketPositionDifferences(plantIdx) {
    for (let i = 1; i <= 3; i++) {
        const manual = parseFloat(document.getElementById(`bucket-pos-manual-${i}-${plantIdx}`)?.value);
        const dqm = parseFloat(document.getElementById(`bucket-pos-dqm-${i}-${plantIdx}`)?.value);
        const diffInput = document.getElementById(`bucket-pos-diff-${i}-${plantIdx}`);
        if (!isNaN(manual) && !isNaN(dqm) && diffInput) {
            diffInput.value = Math.abs(manual - dqm).toFixed(2);
        }
    }
}
