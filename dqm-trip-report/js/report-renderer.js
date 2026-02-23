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
        'draftSensorLight',
        'draftSensorLoaded',
        'draftSensorSimulated',
        'ullageLight',
        'ullageLoaded',
        'hullStatus',
        'dragheadDepth',
        'suctionMouthDepth',
        'velocity',
        'bucketDepth',
        'bucketPosition'
    ];

    const labels = {
        'positionCheck': 'GPS Position Check',
        'draftSensorLight': 'Draft Sensor Check (Light)',
        'draftSensorLoaded': 'Draft Sensor Check (Loaded)',
        'draftSensorSimulated': 'Draft Sensor Check (Simulated)',
        'ullageLight': 'Ullage Check (Light)',
        'ullageLoaded': 'Ullage Check (Loaded)',
        'hullStatus': 'Hull Status Check',
        'dragheadDepth': 'Draghead Depth Check',
        'suctionMouthDepth': 'Suction Mouth Depth Check',
        'velocity': 'Velocity Check',
        'bucketDepth': 'Bucket Depth Check',
        'bucketPosition': 'Bucket Position Check'
    };

    // Only render a check if at least one of its values is non-empty
    function hasAnyValue(obj) {
        if (!obj) return false;
        return Object.values(obj).some(v => v !== '' && v !== null && v !== undefined);
    }

    order.forEach(type => {
        if (checks[type] && hasAnyValue(checks[type])) {
            html += `<h3>${labels[type]}</h3>`;

            const data = checks[type];
            const override = overrides[type] || {};

            if (type === 'draftSensorSimulated') {
                html += renderSimulatedDraft(data, override);
            } else if (type.startsWith('draftSensor') || type.startsWith('ullage')) {
                html += renderShipData(data, override, type);
            } else if (type === 'dragheadDepth') {
                html += renderDragheadTable(data, override);
            } else if (type === 'velocity') {
                html += renderVelocityTable(data, override);
            } else {
                html += renderGenericTable(data, override);
            }
        }
    });

    return html;
}

// Renders the complex 1-line tables for Draft and Ullage variants
function renderShipData(data, override, typeName) {
    let html = '';

    // Map check type to the exact key prefix used by the QA app
    const prefixMap = {
        'draftSensorLight': 'light-',
        'draftSensorLoaded': 'loaded-',
        'ullageLight': 'ullage-light-',
        'ullageLoaded': 'ullage-loaded-'
    };
    const prefix = prefixMap[typeName] || '';

    let fwdPort = getVal(data, override, `${prefix}fwd-port`);
    let fwdStbd = getVal(data, override, `${prefix}fwd-stbd`);
    let aftPort = getVal(data, override, `${prefix}aft-port`);
    let aftStbd = getVal(data, override, `${prefix}aft-stbd`);
    let dqmFwd = getVal(data, override, `${prefix}dqm-fwd`);
    let dqmAft = getVal(data, override, `${prefix}dqm-aft`);

    // Compute averages
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

    // Remarks: try type-specific key first, then generic
    let remarks = getVal(data, override, `${prefix}remarks`)
        || getVal(data, override, `remarks`)
        || getVal(data, override, `draft-${typeName.includes('light') ? 'light' : 'loaded'}-remarks`)
        || getVal(data, override, `draft-light-remarks`)
        || getVal(data, override, `draft-loaded-remarks`);
    if (remarks) {
        html += `<p style="font-size: 10pt; font-style: italic;">Remarks: ${escapeHtml(remarks.toString())}</p>`;
    }

    return html;
}

function renderSimulatedDraft(data, override) {
    let html = '';
    ['fwd', 'aft'].forEach(pos => {
        let rows = '';
        [1, 2, 3].forEach(num => {
            let depth = getVal(data, override, `sim-${pos}-depth-${num}`) || getVal(data, override, `sim-${pos}-depth${num}`);
            let reading = getVal(data, override, `sim-${pos}-reading-${num}`) || getVal(data, override, `sim-${pos}-reading${num}`);
            let diffVal = diff(depth, reading);

            if (depth !== undefined || reading !== undefined) {
                rows += `
                <tr>
                    <td class="text-center">Position ${num}</td>
                    <td class="text-center">${formatNum(depth)}</td>
                    <td class="text-center">${formatNum(reading)}</td>
                    <td class="text-center">${formatNum(diffVal)}</td>
                </tr>`;
            }
        });

        if (rows) {
            html += `<h4 style="margin: 15px 0 5px;">${pos === 'fwd' ? 'Forward' : 'Aft'} Sensors</h4>
            <table class="report-table">
                <tr>
                    <th width="40%">Measurement</th>
                    <th width="20%" class="text-center">Physical Depth (ft)</th>
                    <th width="20%" class="text-center">System Reading (ft)</th>
                    <th width="20%" class="text-center">Difference</th>
                </tr>
                ${rows}
            </table>`;
        }
    });

    let remarks = getVal(data, override, `remarks`);
    if (remarks) {
        html += `<p style="font-size: 10pt; font-style: italic;">Remarks: ${escapeHtml(remarks.toString())}</p>`;
    }

    return html;
}

// Special Draghead rendering
function renderDragheadTable(data, override) {
    let html = '';
    let dragheads = [
        { key: 'port', label: 'Port Draghead' },
        { key: 'center', label: 'Center Draghead' },
        { key: 'stbd', label: 'Starboard Draghead' }
    ];

    dragheads.forEach(dh => {
        let rows = '';
        [1, 2, 3].forEach(num => {
            let manual = getVal(data, override, `draghead-${dh.key}-manual-${num}`);
            let dqm = getVal(data, override, `draghead-${dh.key}-dqm-${num}`);
            let diff = getVal(data, override, `draghead-${dh.key}-diff-${num}`);

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

        if (rows !== '') {
            html += `
            <div style="margin-bottom: 10px;">
                <h4 style="margin:0 0 5px 0; font-size:11pt; color:#333;">${dh.label}</h4>
                <table class="report-table">
                    <tr>
                        <th width="40%">Measurement</th>
                        <th width="20%" class="text-center">Manual QA (ft)</th>
                        <th width="20%" class="text-center">DQM System (ft)</th>
                        <th width="20%" class="text-center">Difference</th>
                    </tr>
                    ${rows}
                </table>
            </div>`;
        }
    });

    let remarks = getVal(data, override, 'draghead-remarks');

    if (remarks) html += `<p style="font-size: 10pt; font-style: italic;">Remarks: ${escapeHtml(remarks.toString())}</p>`;

    return html || '<p>No draghead data recorded.</p>';
}


// Special Draghead rendering
function renderVelocityTable(data, override) {
    let method = getVal(data, override, 'velocity-method');
    let html = '';

    if (method === 'dye') {
        let pipeLength = getVal(data, override, 'velocity-pipe-length');
        if (pipeLength) {
            html += `<p style="margin-bottom: 5px; font-size: 10pt;"><strong>Pipeline Length:</strong> ${escapeHtml(pipeLength.toString())} ft</p>`;
        }

        let rows = '';
        [1, 2, 3].forEach(num => {
            let time = getVal(data, override, `velocity-dye-time-${num}`);
            let calc = getVal(data, override, `velocity-dye-calc-${num}`);
            let dqm = getVal(data, override, `velocity-dye-dqm-${num}`);
            let diff = getVal(data, override, `velocity-dye-diff-${num}`);

            if (time !== undefined || dqm !== undefined) {
                rows += `
                <tr>
                    <td class="text-center">Test ${num}</td>
                    <td class="text-center">${formatNum(time)}</td>
                    <td class="text-center">${formatNum(calc)}</td>
                    <td class="text-center">${formatNum(dqm)}</td>
                    <td class="text-center">${formatNum(diff)}</td>
                </tr>`;
            }
        });

        if (rows !== '') {
            html += `
            <table class="report-table">
                <tr>
                    <th width="20%">Test</th>
                    <th width="20%" class="text-center">Travel Time (sec)</th>
                    <th width="20%" class="text-center">Calc Velocity (ft/s)</th>
                    <th width="20%" class="text-center">DQM Velocity (ft/s)</th>
                    <th width="20%" class="text-center">Difference</th>
                </tr>
                ${rows}
            </table>`;
        }
    } else if (method === 'meter') {
        let calDate = getVal(data, override, 'velocity-cal-date');
        if (calDate) {
            html += `<p style="margin-bottom: 5px; font-size: 10pt;"><strong>Meter Calibration Date:</strong> ${escapeHtml(calDate)}</p>`;
        }

        let rows = '';
        [1, 2, 3].forEach(num => {
            let manual = getVal(data, override, `velocity-meter-manual-${num}`);
            let dqm = getVal(data, override, `velocity-meter-dqm-${num}`);
            let diff = getVal(data, override, `velocity-meter-diff-${num}`);

            if (manual !== undefined || dqm !== undefined) {
                rows += `
                <tr>
                    <td class="text-center">Test ${num}</td>
                    <td class="text-center">${formatNum(manual)}</td>
                    <td class="text-center">${formatNum(dqm)}</td>
                    <td class="text-center">${formatNum(diff)}</td>
                </tr>`;
            }
        });

        if (rows !== '') {
            html += `
            <table class="report-table">
                <tr>
                    <th width="40%">Test</th>
                    <th width="20%" class="text-center">Meter Velocity (ft/s)</th>
                    <th width="20%" class="text-center">DQM Velocity (ft/s)</th>
                    <th width="20%" class="text-center">Difference</th>
                </tr>
                ${rows}
            </table>`;
        }
    }

    let remarks = getVal(data, override, 'velocity-remarks');

    if (remarks) html += `<p style="font-size: 10pt; font-style: italic;">Remarks: ${escapeHtml(remarks.toString())}</p>`;

    return html || '<p>No velocity data recorded.</p>';
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
                let isImage = typeof finalVal === 'string' && finalVal.startsWith('data:image/');

                if (isImage) {
                    displayStr = `<img src="${finalVal}" style="max-width: 100%; max-height: 300px; display: block; margin: 5px 0; border: 1px solid #ccc; padding: 3px; background: #fff;" alt="Photo">`;
                } else if (finalVal === null || finalVal === undefined || finalVal === '') {
                    displayStr = 'N/A';
                }

                rows += `
                <tr>
                    <td width="40%" style="font-weight: 500;">${prefix}${formatLabel(key)}</td>
                    <td width="60%">${isImage ? displayStr : escapeHtml(String(displayStr))}</td>
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
