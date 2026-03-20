// Main Application Logic for DPIP Review
const AppState = {
    metadata: {
        reviewerName: '',
        reviewDate: '',
        plantName: '',
        plantType: '',
        generalComments: ''
    },
    checklist: {},
    dataCheck: {
        isUllageProfile: false,
        displacement: {
            reportedDraft: '',
            reportedDisplacement: '',
            method: 'table',
            tableParams: { x1: '', y1: '', x2: '', y2: '' },
            equationParams: { coefA: '', coefB: '', coefC: '' }
        },
        volume: {
            reportedUllage: '',
            reportedVolume: '',
            method: 'table',
            tableParams: { x1: '', y1: '', x2: '', y2: '' },
            equationParams: { coefA: '', coefB: '', coefC: '' }
        }
    }
};

const DQM_DPIP_STORAGE_KEY = 'dqm_dpip_draft';

// DOM Elements
const elements = {
    reviewerName: document.getElementById('reviewer-name'),
    reviewDate: document.getElementById('review-date'),
    plantName: document.getElementById('plant-name'),
    plantType: document.getElementById('plant-type'),
    generalComments: document.getElementById('general-comments'),
    
    themeToggle: document.getElementById('theme-toggle'),
    exportPdfBtn: document.getElementById('export-pdf-btn'),
    exportJsonBtn: document.getElementById('export-json-btn'),
    importJsonBtn: document.getElementById('import-json-btn'),
    importFile: document.getElementById('import-file'),
    clearBtn: document.getElementById('clear-btn'),
    
    checklistSubtitle: document.getElementById('checklist-subtitle'),
    checklistContainer: document.getElementById('checklist-container'),
    dataCheckSection: document.getElementById('data-check-section'),
    dataCheckContainer: document.getElementById('data-check-container')
};

function init() {
    if (!elements.reviewDate.value) {
        elements.reviewDate.valueAsDate = new Date();
    }
    loadDraft();
    setupEventListeners();
    renderChecklist();
    renderDataCheck();
}

function setupEventListeners() {
    elements.reviewerName.addEventListener('input', (e) => { AppState.metadata.reviewerName = e.target.value; saveDraft(); });
    elements.reviewDate.addEventListener('change', (e) => { AppState.metadata.reviewDate = e.target.value; saveDraft(); });
    elements.plantName.addEventListener('input', (e) => { AppState.metadata.plantName = e.target.value; saveDraft(); });
    elements.plantType.addEventListener('change', (e) => { 
        AppState.metadata.plantType = e.target.value; 
        AppState.checklist = {}; 
        saveDraft(); 
        renderChecklist();
        renderDataCheck();
    });
    elements.generalComments.addEventListener('input', (e) => { AppState.metadata.generalComments = e.target.value; saveDraft(); });

    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.clearBtn.addEventListener('click', clearAll);
    elements.exportJsonBtn.addEventListener('click', exportJson);
    elements.importJsonBtn.addEventListener('click', () => elements.importFile.click());
    elements.importFile.addEventListener('change', importJson);
    elements.exportPdfBtn.addEventListener('click', generatePdf);

    // Setup Tab Listeners
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(targetId).classList.add('active');
            
            if (targetId === 'tab-report-preview') {
                updateReportPreview();
            }
        });
    });
}

const CHECKLISTS = {
    hopper: [
        { id: 'h1', text: 'Cover Page: Dredge Name, Date, Photo of Plant' },
        { id: 'h2', text: 'Table of Contents' },
        { id: 'h3', text: 'Dredge Contacts: Dredging Company & System Provider (POC, Phone, Email)' },
        { id: 'h4', text: 'Dredge Characteristics: Dimensions, Method, Capacity, Digging Depths, Drafts, RPM/Velocity, Pipe IDs' },
        { id: 'h5', text: 'Sensor Data Collection Method: Averaging, Routing, Internet Connection' },
        { id: 'h6', text: 'Sensors Descriptions/Calibrations: Positioning System & Heading' },
        { id: 'h7', text: 'Sensors Descriptions/Calibrations: Hull Status, Draft, and Dragarm Depths' },
        { id: 'h8', text: 'Sensors Descriptions/Calibrations: Density, Velocity, Pump RPM, Pumpout' },
        { id: 'h9', text: 'Calculated Parameters: Displacement (Method & Tables)' },
        { id: 'h10', text: 'Calculated Parameters: Hopper Volume (Method, Tables, Datum)' },
        { id: 'h11', text: 'Calculated Parameters: Drag Head Position & Load Number Increment' },
        { id: 'h12', text: 'Quality Control: QC Process and Calibration Log' },
        { id: 'h13', text: 'Appendices: Hydrostatic Curves, Certified Tables, Dimensioned Drawings' },
        { id: 'h14', text: 'Appendices: Sensor Manuals and Certificates of Calibration' }
    ],
    pipeline: [
        { id: 'p1', text: 'Cover Page: Dredge Name, Date, Photo of Plant' },
        { id: 'p2', text: 'Table of Contents & Contact Information' },
        { id: 'p3', text: 'Dredge Characteristics: Dimensions, Digging Depths, Ladder Length, Pumps, Pipe IDs, Advance Method' },
        { id: 'p4', text: 'Sensor Data Collection: Transmission, Internet, Time Stamp, Repair Methods' },
        { id: 'p5', text: 'Sensors: Cutter/Suction Head Positioning & Depth' },
        { id: 'p6', text: 'Sensors: Dredge Heading, Slurry Velocity & Density' },
        { id: 'p7', text: 'Sensors: Pump RPM, Vacuum, and Outlet Pressure' },
        { id: 'p8', text: 'Manual/Calculated Parameters: Vertical Correction (Tidal/River)' },
        { id: 'p9', text: 'Manual/Calculated Parameters: Pipeline Lengths, Booster Pumps, Dredge Advance' },
        { id: 'p10', text: 'Manual/Calculated Parameters: Outfall Info & Positioning, Non-Effective Events' },
        { id: 'p11', text: 'Quality Control Information: QC Manager, Process, Logs' },
        { id: 'p12', text: 'Appendices: Typical Plan & Profile View Drawings (including Idler Barge if applicable)' },
        { id: 'p13', text: 'Appendices: Sensor Manuals and Certificates of Calibration' }
    ],
    mechanical: [
        { id: 'm1', text: 'Cover Page: Dredge Name, Date, Photo of Plant' },
        { id: 'm2', text: 'Table of Contents' },
        { id: 'm3', text: 'Dredge Contacts: Dredging Company & System Provider' },
        { id: 'm4', text: 'Dredge Characteristics: Lifting Capacity, Boom Length, Bucket Capacity, Digging Depths, Swing Radius' },
        { id: 'm5', text: 'Sensor Data Collection Method' },
        { id: 'm6', text: 'Sensors: Positioning System & Dredge Heading' },
        { id: 'm7', text: 'Sensors: Boom Angle, Bucket Position, Heading, & Depth' },
        { id: 'm8', text: 'Sensors: Vertical Correction (Tide)' },
        { id: 'm9', text: 'Quality Control: Process & Calibration Logs' },
        { id: 'm10', text: 'Appendices: Dimensioned Drawings of Dredge (Overall & Boom Dimensions)' },
        { id: 'm11', text: 'Appendices: Sensor Manuals and Certificates of Calibration' }
    ],
    scow: [
        { id: 's1', text: 'Contacts: Dredging Company & Scow Monitoring System Provider' },
        { id: 's2', text: 'Scow Characteristics: Dimensions, Capacity, Min/Max Draft, Displacement, Ullage, Volume' },
        { id: 's3', text: 'Sensor Repair/Installation Methods & Data-Reporting Equipment' },
        { id: 's4', text: 'Procedure for Providing Data via Email' },
        { id: 's5', text: 'System Power Supply, Battery Charge Method, & Telemetry' },
        { id: 's6', text: 'Dimensioned Drawings (Plan/Profile, Bin cross sections, reference markers)' },
        { id: 's7', text: 'Criteria to Increment Trip Number & UTC Time Stamp' },
        { id: 's8', text: 'Sensors: Positioning System & Hull Status' },
        { id: 's9', text: 'Sensors: Drafts & Bin Ullage' },
        { id: 's10', text: 'Displacement (Method & Tables from marine surveyor)' },
        { id: 's11', text: 'Volume (Method & Table from surveyor)' },
        { id: 's12', text: 'Contractor Data (Backup Frequency/Method), Archive Capability' },
        { id: 's13', text: 'Logs: Sensor Performance, Data Backup, QC Plan & Procedures' }
    ]
};

function renderChecklist() {
    const type = AppState.metadata.plantType;
    elements.checklistContainer.innerHTML = '';
    
    if (!type) {
        elements.checklistSubtitle.textContent = 'Select a Plant Type to view required checklist items.';
        return;
    }

    elements.checklistSubtitle.textContent = `Required items for ${type.charAt(0).toUpperCase() + type.slice(1)} DPIP.`;
    const items = CHECKLISTS[type] || [];
    
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'checklist-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `check-${item.id}`;
        checkbox.checked = !!AppState.checklist[item.id];
        
        checkbox.addEventListener('change', (e) => {
            AppState.checklist[item.id] = e.target.checked;
            saveDraft();
        });
        
        const label = document.createElement('label');
        label.htmlFor = `check-${item.id}`;
        label.className = 'checklist-text';
        label.textContent = item.text;
        
        div.appendChild(checkbox);
        div.appendChild(label);
        elements.checklistContainer.appendChild(div);
    });
}

function renderDataCheck() {
    const type = AppState.metadata.plantType;
    const navBtn = document.getElementById('nav-data-check');
    if (type === 'hopper' || type === 'scow') {
        if (navBtn) navBtn.style.display = 'block';
        elements.dataCheckSection.style.display = 'block';
        
        let html = '';
        if (type === 'scow') {
            html += `
                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.9rem;">
                        <input type="checkbox" id="is-ullage-profile" ${AppState.dataCheck.isUllageProfile ? 'checked' : ''} style="width:1.2rem; height:1.2rem;">
                        Is this an Ullage Profile Scow? (Requires Volume Check)
                    </label>
                </div>
            `;
        }

        html += buildCalculatorSection('displacement', 'Displacement Check', 'Draft', 'Displacement');
        
        if (type === 'hopper' || (type === 'scow' && AppState.dataCheck.isUllageProfile)) {
            html += buildCalculatorSection('volume', 'Volume Check', 'Ullage', 'Volume');
        }

        elements.dataCheckContainer.innerHTML = html;
        attachCalculatorListeners('displacement', 'Draft', 'Displacement');
        
        if (type === 'hopper' || (type === 'scow' && AppState.dataCheck.isUllageProfile)) {
            attachCalculatorListeners('volume', 'Ullage', 'Volume');
        }

        if (type === 'scow') {
            document.getElementById('is-ullage-profile').addEventListener('change', (e) => {
                AppState.dataCheck.isUllageProfile = e.target.checked;
                saveDraft();
                renderDataCheck();
            });
        }
    } else {
        elements.dataCheckSection.style.display = 'none';
        const navBtn = document.getElementById('nav-data-check');
        if (navBtn) {
            navBtn.style.display = 'none';
            if (navBtn.classList.contains('active')) {
                document.querySelector('.tab-btn[data-tab="tab-review-info"]').click();
            }
        }
    }
}

window.setCheckMethod = function(section, method) {
    AppState.dataCheck[section].method = method;
    saveDraft();
    renderDataCheck();
}

function buildCalculatorSection(sectionKey, title, inputLabel, outputLabel) {
    const data = AppState.dataCheck[sectionKey];
    const reportedInput = sectionKey === 'displacement' ? data.reportedDraft : data.reportedUllage;
    const reportedOutput = sectionKey === 'displacement' ? data.reportedDisplacement : data.reportedVolume;
    const inputKey = sectionKey === 'displacement' ? 'reportedDraft' : 'reportedUllage';
    const outputKey = sectionKey === 'displacement' ? 'reportedDisplacement' : 'reportedVolume';

    let html = `
    <div class="data-check-panel">
        <h3 style="border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;">${title}</h3>
        <div class="input-row" style="margin-top: 1rem;">
            <div class="form-group">
                <label>Reported ${inputLabel}</label>
                <input type="number" step="any" id="${sectionKey}-input" value="${reportedInput}">
            </div>
            <div class="form-group">
                <label>Reported ${outputLabel}</label>
                <input type="number" step="any" id="${sectionKey}-output" value="${reportedOutput}">
            </div>
        </div>
        <h4 style="margin: 1rem 0 0.5rem 0; font-size: 0.9rem;">DPIP Verification Method</h4>
        <div class="tab-group">
            <button class="tab-btn ${data.method === 'table' ? 'active' : ''}" onclick="setCheckMethod('${sectionKey}', 'table')">Table Interpolation</button>
            <button class="tab-btn ${data.method === 'equation' ? 'active' : ''}" onclick="setCheckMethod('${sectionKey}', 'equation')">Equation Solver</button>
        </div>
    `;

    if (data.method === 'table') {
        html += `
            <div class="input-row-3">
                <div class="form-group">
                    <label>x1 (Smaller ${inputLabel})</label>
                    <input type="number" step="any" id="${sectionKey}-x1" value="${data.tableParams.x1}">
                </div>
                <div class="form-group">
                    <label>y1 (Smaller ${outputLabel})</label>
                    <input type="number" step="any" id="${sectionKey}-y1" value="${data.tableParams.y1}">
                </div>
            </div>
            <div class="input-row-3">
                <div class="form-group">
                    <label>x2 (Larger ${inputLabel})</label>
                    <input type="number" step="any" id="${sectionKey}-x2" value="${data.tableParams.x2}">
                </div>
                <div class="form-group">
                    <label>y2 (Larger ${outputLabel})</label>
                    <input type="number" step="any" id="${sectionKey}-y2" value="${data.tableParams.y2}">
                </div>
            </div>
        `;
    } else {
        html += `
            <p class="text-muted">Equation: y = Ax² + Bx + C (where x = Reported ${inputLabel})</p>
            <div class="input-row-3">
                <div class="form-group">
                    <label>Coefficient A</label>
                    <input type="number" step="any" id="${sectionKey}-a" value="${data.equationParams.coefA}">
                </div>
                <div class="form-group">
                    <label>Coefficient B</label>
                    <input type="number" step="any" id="${sectionKey}-b" value="${data.equationParams.coefB}">
                </div>
                <div class="form-group">
                    <label>Coefficient C</label>
                    <input type="number" step="any" id="${sectionKey}-c" value="${data.equationParams.coefC}">
                </div>
            </div>
        `;
    }

    html += `
        <div class="input-row mt-1" style="background: var(--bg-primary); padding: 1rem; border-radius: var(--radius-md); align-items: center;">
            <div class="form-group" style="margin: 0; flex: 2;">
                <label>Calculated Verification ${outputLabel}</label>
                <input type="text" readonly id="${sectionKey}-result" style="font-size: 1.1rem; font-weight: bold; background: transparent; border: none; padding: 0;">
            </div>
            <div id="${sectionKey}-match" style="flex: 1; text-align: right; font-weight: bold; font-size: 1.1rem;"></div>
        </div>
    </div>`;
    
    return html;
}

function attachCalculatorListeners(sectionKey, inputLabel, outputLabel) {
    const data = AppState.dataCheck[sectionKey];
    const inputKey = sectionKey === 'displacement' ? 'reportedDraft' : 'reportedUllage';
    const outputKey = sectionKey === 'displacement' ? 'reportedDisplacement' : 'reportedVolume';

    const calcResult = () => {
        const x = parseFloat(data[inputKey]);
        let calculated = null;
        if (!isNaN(x)) {
            if (data.method === 'table') {
                const x1 = parseFloat(data.tableParams.x1);
                const y1 = parseFloat(data.tableParams.y1);
                const x2 = parseFloat(data.tableParams.x2);
                const y2 = parseFloat(data.tableParams.y2);
                if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2) && x1 !== x2) {
                    calculated = y1 + (x - x1) * ((y2 - y1) / (x2 - x1));
                }
            } else {
                const a = parseFloat(data.equationParams.coefA) || 0;
                const b = parseFloat(data.equationParams.coefB) || 0;
                const c = parseFloat(data.equationParams.coefC) || 0;
                calculated = (a * x * x) + (b * x) + c;
            }
        }
        
        const resultEl = document.getElementById(`${sectionKey}-result`);
        const matchEl = document.getElementById(`${sectionKey}-match`);
        
        if (calculated !== null) {
            resultEl.value = calculated.toFixed(2);
            const reported = parseFloat(data[outputKey]);
            if (!isNaN(reported)) {
                // allow a small tolerance differences like 0.05
                const diff = Math.abs(calculated - reported);
                if (diff < 0.1) {
                    matchEl.textContent = '✅ Matches';
                    matchEl.style.color = 'var(--success)';
                } else {
                    matchEl.textContent = '❌ Mismatch';
                    matchEl.style.color = 'var(--danger)';
                }
            } else {
                matchEl.textContent = '';
            }
        } else {
            resultEl.value = 'Incomplete parameters';
            matchEl.textContent = '';
        }
    };

    const bindInput = (id, obj, key) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                obj[key] = e.target.value;
                calcResult();
                saveDraft();
            });
        }
    };

    bindInput(`${sectionKey}-input`, data, inputKey);
    bindInput(`${sectionKey}-output`, data, outputKey);

    if (data.method === 'table') {
        bindInput(`${sectionKey}-x1`, data.tableParams, 'x1');
        bindInput(`${sectionKey}-y1`, data.tableParams, 'y1');
        bindInput(`${sectionKey}-x2`, data.tableParams, 'x2');
        bindInput(`${sectionKey}-y2`, data.tableParams, 'y2');
    } else {
        bindInput(`${sectionKey}-a`, data.equationParams, 'coefA');
        bindInput(`${sectionKey}-b`, data.equationParams, 'coefB');
        bindInput(`${sectionKey}-c`, data.equationParams, 'coefC');
    }

    calcResult();
}

function saveDraft() {
    localStorage.setItem(DQM_DPIP_STORAGE_KEY, JSON.stringify(AppState));
}

function loadDraft() {
    const saved = localStorage.getItem(DQM_DPIP_STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            
            // Deep merge safety to not overwrite new nested props with old undefined ones if state shape changes
            if (parsed.dataCheck && parsed.dataCheck.displacement) {
                AppState.dataCheck.displacement = { ...AppState.dataCheck.displacement, ...parsed.dataCheck.displacement };
                AppState.dataCheck.volume = { ...AppState.dataCheck.volume, ...parsed.dataCheck.volume };
                AppState.dataCheck.isUllageProfile = parsed.dataCheck.isUllageProfile;
                AppState.dataCheck.type = undefined; // cleanup old prop
            }
            
            Object.assign(AppState.metadata, parsed.metadata);
            Object.assign(AppState.checklist, parsed.checklist);
            
            elements.reviewerName.value = AppState.metadata.reviewerName;
            elements.reviewDate.value = AppState.metadata.reviewDate;
            elements.plantName.value = AppState.metadata.plantName;
            elements.plantType.value = AppState.metadata.plantType;
            elements.generalComments.value = AppState.metadata.generalComments;
            
            if (localStorage.getItem('theme') === 'light') {
                document.body.classList.add('light-mode');
                elements.themeToggle.querySelector('span').textContent = '☀️';
            }
        } catch (e) {
            console.error('Error loading draft', e);
        }
    }
}

function clearAll() {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
        localStorage.removeItem(DQM_DPIP_STORAGE_KEY);
        location.reload();
    }
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    elements.themeToggle.querySelector('span').textContent = isLight ? '☀️' : '🌙';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

function exportJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(AppState, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `dpip_review_${AppState.metadata.plantName || 'draft'}.json`);
    dlAnchorElem.click();
}

function importJson(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const parsed = JSON.parse(evt.target.result);
                // Simple wipe and load
                localStorage.setItem(DQM_DPIP_STORAGE_KEY, JSON.stringify(parsed));
                location.reload();
            } catch (err) {
                alert('Invalid JSON file');
            }
        };
        reader.readAsText(file);
    }
}

function generatePdf() {
    const pContainer = document.getElementById('print-container');
    pContainer.innerHTML = buildReportHtml();
    window.print();
    setTimeout(() => { pContainer.innerHTML = ''; }, 1000);
}

function updateReportPreview() {
    const previewContainer = document.getElementById('report-preview-container');
    if (previewContainer) {
        previewContainer.innerHTML = buildReportHtml();
    }
}

function buildReportHtml() {
    const md = AppState.metadata;
    const items = CHECKLISTS[md.plantType] || [];
    
    let checklistHtml = items.map(item => {
        const isChecked = !!AppState.checklist[item.id];
        return `<tr>
            <td style="width:5%; text-align:center; font-size:16px;">${isChecked ? '☑' : '☐'}</td>
            <td>${item.text}</td>
        </tr>`;
    }).join('');

    let dataCheckHtml = '';
    if (md.plantType === 'hopper' || md.plantType === 'scow') {
        const dc = AppState.dataCheck;
        const addSection = (title, data, inLabel, outLabel) => {
            const inVal = document.getElementById(data===dc.displacement ? 'displacement-input' : 'volume-input')?.value || '-';
            const outVal = document.getElementById(data===dc.displacement ? 'displacement-output' : 'volume-output')?.value || '-';
            const calcVal = document.getElementById(data===dc.displacement ? 'displacement-result' : 'volume-result')?.value || '-';
            const matchVal = document.getElementById(data===dc.displacement ? 'displacement-match' : 'volume-match')?.textContent || '';
            const matchColor = matchVal.includes('✅') ? 'green' : 'red';
            
            return `
            <h4>${title}</h4>
            <table class="report-table">
                <tr><th>Reported ${inLabel}</th><th>Reported ${outLabel}</th><th>Calculated Verification ${outLabel}</th><th>Status</th></tr>
                <tr>
                    <td>${inVal}</td>
                    <td>${outVal}</td>
                    <td>${calcVal}</td>
                    <td style="color:${matchColor}; font-weight:bold;">${matchVal}</td>
                </tr>
            </table>`;
        };
        
        dataCheckHtml += addSection('Displacement Integration Check', dc.displacement, 'Draft', 'Displacement');
        if (md.plantType === 'hopper' || (md.plantType === 'scow' && dc.isUllageProfile)) {
            dataCheckHtml += addSection('Volume Integration Check', dc.volume, 'Ullage', 'Volume');
        }
    }

    return `
    <style>
        .report-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; color: black; }
        .report-table th, .report-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .report-table th { background-color: #f2f2f2; font-weight: bold; }
        .preview-wrapper { color: black; font-family: sans-serif; background: white; padding: 20px; border-radius: 8px; }
        .preview-wrapper h2, .preview-wrapper h3, .preview-wrapper h4 { color: black; }
        .preview-wrapper h2 { border-bottom: 2px solid black; padding-bottom: 5px; margin-top: 0; }
        .preview-wrapper h3 { border-bottom: 2px solid black; padding-bottom: 5px; margin-top: 20px; }
        @media print {
            body * { visibility: hidden; }
            .container { display: none !important; }
            #print-container, #print-container * { visibility: visible; }
            #print-container { position: absolute; left: 0; top: 0; width: 100%; display: block !important; padding: 20px; font-family: sans-serif; color: black; background: white; }
        }
    </style>
    <div class="preview-wrapper">
        <div style="text-align:center; margin-bottom:20px;">
            <h2 style="border:none;">DQM DPIP Review Report</h2>
        </div>
        
        <h3>Review Information</h3>
        <table class="report-table">
            <tr><th>Plant Name</th><td>${md.plantName || 'N/A'}</td><th>Plant Type</th><td><span style="text-transform: capitalize;">${md.plantType || 'N/A'}</span></td></tr>
            <tr><th>Review Date</th><td>${md.reviewDate || 'N/A'}</td><th>Reviewer</th><td>${md.reviewerName || 'N/A'}</td></tr>
            <tr><th>General Comments</th><td colspan="3">${md.generalComments || 'None'}</td></tr>
        </table>

        <h3>Document Checklist</h3>
        <table class="report-table">
            ${checklistHtml || '<tr><td>No checklist items available.</td></tr>'}
        </table>

        ${dataCheckHtml ? `<h3>Integration Verification Data Check</h3>${dataCheckHtml}` : ''}
    </div>
    `;
}

document.addEventListener('DOMContentLoaded', init);
