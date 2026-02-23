// report-renderer.js
// Generates the printable HTML report from application state

function renderReport() {
    const target = document.getElementById('report-render-target');
    const state = window.appState;
    const meta = state.meta;

    if (!state.sourceJson) {
        target.innerHTML = '<div class="text-center text-muted p-4" style="margin-top: 100px;">Please load a JSON file to see the preview.</div>';
        return;
    }

    const reportHtml = `
        <div class="report-header-grid" style="border-bottom: 2px solid black; padding-bottom: 20px; align-items: end;">
            <div>
                <h1 style="border: none; margin: 0; padding: 0; text-align: left; font-size: 16pt;">National Dredging Quality Management (DQM) Program</h1>
                <h2 style="border: none; margin: 0; padding: 0; font-size: 14pt; font-weight: normal;">Quality Assurance Check Report</h2>
            </div>
            <div style="text-align: right; font-size: 10pt; line-height: 1.6;">
                <strong>For Official Use Only</strong><br>
                <strong>Date:</strong> ${formatDate(meta.reportDate)}<br>
                <strong>US Army Corps of Engineers:</strong> ${escapeHtml(meta.district)}<br>
                <strong>Prepared by:</strong> ${escapeHtml(meta.preparedBy)}
            </div>
        </div>

        <h3>Project Information</h3>
        <table class="report-table">
            <tr>
                <th width="20%">Operator</th>
                <td width="30%">${escapeHtml(meta.operator)}</td>
                <th width="20%">Location</th>
                <td width="30%">${escapeHtml(meta.location)}</td>
            </tr>
            <tr>
                <th>Weather / Sea State</th>
                <td>${escapeHtml(meta.weather)}</td>
                <th>Original Check Date</th>
                <td>${escapeHtml(state.originalCheckDate)}</td>
            </tr>
            <tr>
                <th>System Provider</th>
                <td>${escapeHtml(state.originalSystemProvider)}</td>
                <th>Vessels Checked</th>
                <td>${renderVesselList(state.plants)}</td>
            </tr>
        </table>

        <h3>Discrepancies</h3>
        <p style="margin-bottom: 20px; font-size: 10pt;">${escapeHtml(meta.discrepancies) || 'None noted.'}</p>

        <h3>General Comments</h3>
        <p style="margin-bottom: 20px; font-size: 10pt;">${escapeHtml(state.originalGeneralComments) || 'None'}</p>

        <h3>Methods</h3>
        <p style="text-align: justify; margin-bottom: 30px; font-size: 10pt; line-height: 1.5;">${escapeHtml(meta.methods).replace(/\\n/g, '<br>')}</p>

        ${renderTimeline(state.timeline)}

        <div class="page-break"></div>

        <h2 style="text-align: center; font-size: 16pt; font-weight: bold; margin-bottom: 20px; border-bottom: none;">QA CHECK DATA OBSERVATION SHEETS</h2>

        ${renderChecks(state)}
    `;

    target.innerHTML = reportHtml;

    // Also copy to the actual hidden print container so window.print() works correctly
    document.getElementById('print-container').innerHTML = reportHtml;
}

function renderVesselList(plants) {
    if (!plants || plants.length === 0) return 'None';
    return plants.map(p => `${escapeHtml(p.name)} (${escapeHtml(p.vesselType)})`).join(', ');
}

function renderChecks(state) {
    let html = '';
    const checks = state.qaChecks || {};
    const overrides = state.overrides || {};

    const order = [
        'positionCheck',
        'draftSensor',
        'ullage',
        'hullStatus',
        'dragheadDepth',
        'suctionMouthDepth',
        'velocity',
        'bucketDepth',
        'bucketPosition'
    ];

    const labels = {
        'positionCheck': 'GPS Position Check',
        'draftSensor': 'Draft Sensor Check',
        'ullage': 'Ullage Check',
        'hullStatus': 'Hull Status Check',
        'dragheadDepth': 'Draghead Depth Check',
        'suctionMouthDepth': 'Suction Mouth Depth Check',
        'velocity': 'Velocity Check',
        'bucketDepth': 'Bucket Depth Check',
        'bucketPosition': 'Bucket Position Check'
    };

    order.forEach(type => {
        if (checks[type] && Object.keys(checks[type]).length > 0) {
            html += `<h3>${labels[type]}</h3>`;

            const data = checks[type];
            const override = overrides[type] || {};

            if (type === 'draftSensor' || type === 'ullage') {
                html += renderShipData(data, override, type);
            } else if (type === 'dragheadDepth') {
                html += renderDragheadTable(data, override);
            } else {
                html += renderGenericTable(data, override);
            }
        }
    });

    return html;
}

// Renders the complex 1-line tables for Draft and Ullage Light/Loaded
function renderShipData(data, override, typeName) {
    let html = '';
    ['light', 'loaded'].forEach(condition => {
        // Find if we have properties for this condition
        const conditionKeys = Object.keys(data).filter(k => k.toLowerCase().includes(condition));
        if (conditionKeys.length === 0) return;

        html += `<h4 style="margin: 15px 0 5px;">${condition.charAt(0).toUpperCase() + condition.slice(1)} ${typeName === 'ullage' ? 'Ullage' : 'Draft'}</h4>`;

        let fwdPort = getVal(data, override, `${condition}-fwd-port`) || getVal(data, override, `${condition}FwdPort`) || getVal(data, override, `${condition}-ullage-fwd-port`) || getVal(data, override, `ullage-${condition}-fwd-port`);
        let fwdStbd = getVal(data, override, `${condition}-fwd-stbd`) || getVal(data, override, `${condition}FwdStbd`) || getVal(data, override, `${condition}-ullage-fwd-stbd`) || getVal(data, override, `ullage-${condition}-fwd-stbd`);
        let aftPort = getVal(data, override, `${condition}-aft-port`) || getVal(data, override, `${condition}AftPort`) || getVal(data, override, `${condition}-ullage-aft-port`) || getVal(data, override, `ullage-${condition}-aft-port`);
        let aftStbd = getVal(data, override, `${condition}-aft-stbd`) || getVal(data, override, `${condition}AftStbd`) || getVal(data, override, `${condition}-ullage-aft-stbd`) || getVal(data, override, `ullage-${condition}-aft-stbd`);

        let dqmFwd = getVal(data, override, `${condition}-dqm-fwd`) || getVal(data, override, `${condition}DqmFwd`) || getVal(data, override, `${condition}-ullage-dqm-fwd`) || getVal(data, override, `ullage-${condition}-dqm-fwd`);
        let dqmAft = getVal(data, override, `${condition}-dqm-aft`) || getVal(data, override, `${condition}DqmAft`) || getVal(data, override, `${condition}-ullage-dqm-aft`) || getVal(data, override, `ullage-${condition}-dqm-aft`);

        // Compute averages natively if possible
        let fwdAvg = avg(fwdPort, fwdStbd);
        let aftAvg = avg(aftPort, aftStbd);

        let fwdDiff = diff(fwdAvg, dqmFwd);
        let aftDiff = diff(aftAvg, dqmAft);

        html += `
            <table class="report-table">
            <tr>
                <th>Location</th>
                <th class="text-center">Port</th>
                <th class="text-center">Starboard</th>
                <th class="text-center">Average</th>
                <th class="text-center">DQM System</th>
                <th class="text-center">Difference</th>
            </tr>
            <tr>
                <td><strong>Forward</strong></td>
                <td class="text-center">${formatNum(fwdPort)}</td>
                <td class="text-center">${formatNum(fwdStbd)}</td>
                <td class="text-center">${formatNum(fwdAvg)}</td>
                <td class="text-center">${formatNum(dqmFwd)}</td>
                <td class="text-center">${formatNum(fwdDiff)}</td>
            </tr>
            <tr>
                <td><strong>Aft</strong></td>
                <td class="text-center">${formatNum(aftPort)}</td>
                <td class="text-center">${formatNum(aftStbd)}</td>
                <td class="text-center">${formatNum(aftAvg)}</td>
                <td class="text-center">${formatNum(dqmAft)}</td>
                <td class="text-center">${formatNum(aftDiff)}</td>
            </tr>
        </table>`;
    });

    // Append any remarks found specifically for this block
    let remarks = getVal(data, override, `${typeName === 'ullage' ? 'ullage' : 'draft'}-remarks`);
    if (remarks) {
        html += `<p style="font-size: 10pt; font-style: italic;">Remarks: ${escapeHtml(remarks.toString())}</p>`;
    }

    return html;
}

// Special Draghead rendering
function renderDragheadTable(data, override) {
    let rows = '';
    [1, 2, 3].forEach(num => {
        let manual = getVal(data, override, `draghead-manual-${num}`);
        let dqm = getVal(data, override, `draghead-dqm-${num}`);
        let diff = getVal(data, override, `draghead-diff-${num}`);

        if (manual !== undefined || dqm !== undefined) {
            rows += `
            <tr>
                <td class="text-center">Depth Measurement ${num}</td>
                <td class="text-center">${formatNum(manual)}</td>
                <td class="text-center">${formatNum(dqm)}</td>
                <td class="text-center">${formatNum(diff)}</td>
            </tr>`;
        }
    });

    let html = `
    <table class="report-table">
        <tr>
            <th width="40%">Measurement</th>
            <th width="20%" class="text-center">Manual QA (ft)</th>
            <th width="20%" class="text-center">DQM System (ft)</th>
            <th width="20%" class="text-center">Difference</th>
        </tr>
        ${rows}
    </table>`;

    let remarks = getVal(data, override, 'draghead-remarks');
    if (remarks) html += `<p style="font-size: 10pt; font-style: italic;">Remarks: ${escapeHtml(remarks.toString())}</p>`;

    return html;
}


function renderGenericTable(originalData, overrideData) {
    let rows = '';
    function recurse(obj, overrideObj, prefix = '') {
        for (const [key, val] of Object.entries(obj)) {
            const currentOverride = overrideObj ? overrideObj[key] : undefined;
            const finalVal = currentOverride !== undefined ? currentOverride : val;

            if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                recurse(val, overrideObj ? overrideObj[key] : {}, prefix + formatLabel(key) + ' - ');
            } else {
                let displayStr = finalVal;
                if (finalVal === null || finalVal === undefined || finalVal === '') {
                    displayStr = 'N/A';
                }
                rows += `
                <tr>
                    <td width="40%" style="font-weight: 500;">${prefix}${formatLabel(key)}</td>
                    <td width="60%">${escapeHtml(String(displayStr))}</td>
                </tr>`;
            }
        }
    }

    recurse(originalData, overrideData);

    return `
    <table class="report-table" style="margin-bottom: 30px;">
        ${rows}
    </table>
    `;
}

function renderTimeline(timelineArray) {
    if (!timelineArray || timelineArray.length === 0) return '';

    let rows = timelineArray.map(item => `
        <tr>
            <td width="20%">${escapeHtml(item.time)}</td>
            <td width="30%">${escapeHtml(item.action || item.activity)}</td>
            <td width="50%">${escapeHtml(item.details || item.notes)}</td>
        </tr>
    `).join('');

    return `
        <h3>QA Timeline</h3>
        <table class="report-table" style="margin-bottom: 30px;">
            <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Details</th>
            </tr>
            ${rows}
        </table>
    `;
}

// Helpers
function getVal(data, override, key) {
    if (override && override[key] !== undefined && override[key] !== '') return override[key];
    if (data && data[key] !== undefined && data[key] !== '') return data[key];
    return undefined;
}

function avg(a, b) {
    const na = Number(a); const nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return ((na + nb) / 2).toFixed(2);
    if (!isNaN(na)) return na.toFixed(2);
    if (!isNaN(nb)) return nb.toFixed(2);
    return undefined;
}

function diff(a, b) {
    const na = Number(a); const nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return Math.abs(na - nb).toFixed(2);
    return undefined;
}

function formatNum(val) {
    if (val === undefined || val === null || val === '') return '-';
    return val;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatLabel(prop) {
    const result = prop.replace(/([A-Z])/g, " $1");
    let mapped = result.charAt(0).toUpperCase() + result.slice(1);
    mapped = mapped.replace(/-/g, ' '); // handle hyphenated keys like "light-fwd-port" -> "light fwd port"
    // Title Case it
    return mapped.replace(
        /\\w\\S*/g,
        function (txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
    );
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
