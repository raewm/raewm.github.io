/**
 * report-renderer.js
 * The "Final Output" engine for the Trip Report.
 * Aggregates metadata, timeline logs, and vessel-specific QA checks
 * into a professional, printable HTML document.
 */

/**
 * The primary entry point for the Preview tab.
 * Generates technical sheets based on a snapshot of appState.
 */
function renderReport() {
    const target = document.getElementById('report-render-target');
    const state = window.appState;
    const meta = state.meta;

    // Safety Check: Avoid rendering empty structure if no data is present
    if (!state.sourceJson) {
        target.innerHTML = '<div class="text-center text-muted p-4" style="margin-top: 100px;">Please load a JSON file to see the preview.</div>';
        return;
    }

    // 1. Core Document Structure (Header, Project Info, methodology)
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
                <strong>Prepared by:</strong> ${escapeHtml(meta.preparedBy)}<br>
                <strong>QA Performed by:</strong> ${escapeHtml(meta.qaTeam)}
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
        <p style="text-align: justify; margin-bottom: 30px; font-size: 10pt; line-height: 1.5;">${escapeHtml(meta.methods).replace(/\n/g, '<br>')}</p>

        ${renderTimeline(state.timeline)}

        <div class="page-break"></div>

        <h2 style="text-align: center; font-size: 16pt; font-weight: bold; margin-bottom: 20px; border-bottom: none;">QA CHECK DATA OBSERVATION SHEETS</h2>

        <!-- Detailed Check Data for each Vessel -->
        ${renderChecks(state)}
    `;

    // 2. Deployment: Update UI Preview and Print Context
    target.innerHTML = reportHtml;

    // Synchronization with the hidden print-only container
    document.getElementById('print-container').innerHTML = reportHtml;
}

/**
 * Helper to render a comma-separated list of plants in the summary.
 */
function renderVesselList(plants) {
    if (!plants || plants.length === 0) return 'None';
    return plants.map(p => `${escapeHtml(p.name)} (${escapeHtml(p.vesselType)})`).join(', ');
}

/**
 * Iterates through all plants and their respective checks.
 * Applies the 'overrides' layer on top of 'original' data.
 */
function renderChecks(state) {
    let html = '';
    const plants = state.plants || [];
    const overrides = state.overrides || {};

    // Standard Print Order for Audit Sheets
    const order = [
        'positionCheck',
        'draftSensorLight',
        'draftSensorLightFwd',
        'draftSensorLightAft',
        'draftSensorLoaded',
        'draftSensorLoadedFwd',
        'draftSensorLoadedAft',
        'draftSensorSimulated',
        'ullageLight',
        'ullageLightFwd',
        'ullageLightAft',
        'ullageLoaded',
        'ullageLoadedFwd',
        'ullageLoadedAft',
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
        'draftSensorLightFwd': 'Draft Sensor Check (Light - Forward)',
        'draftSensorLightAft': 'Draft Sensor Check (Light - Aft)',
        'draftSensorLoaded': 'Draft Sensor Check (Loaded)',
        'draftSensorLoadedFwd': 'Draft Sensor Check (Loaded - Forward)',
        'draftSensorLoadedAft': 'Draft Sensor Check (Loaded - Aft)',
        'draftSensorSimulated': 'Draft Sensor Check (Simulated)',
        'ullageLight': 'Ullage Check (Light)',
        'ullageLightFwd': 'Ullage Check (Light - Forward)',
        'ullageLightAft': 'Ullage Check (Light - Aft)',
        'ullageLoaded': 'Ullage Check (Loaded)',
        'ullageLoadedFwd': 'Ullage Check (Loaded - Forward)',
        'ullageLoadedAft': 'Ullage Check (Loaded - Aft)',
        'hullStatus': 'Hull Status Check',
        'dragheadDepth': 'Draghead Depth Check',
        'suctionMouthDepth': 'Suction Mouth Depth Check',
        'velocity': 'Velocity Check',
        'bucketDepth': 'Bucket Depth Check',
        'bucketPosition': 'Bucket Position Check'
    };

    /**
     * Predicate to skip sections that contain only empty/null fields.
     */
    function hasAnyValue(obj) {
        if (!obj) return false;
        return Object.values(obj).some(v => v !== '' && v !== null && v !== undefined && v !== false);
    }

    if (plants.length > 0) {
        // Multi-Plant rendering logic
        plants.forEach((plant, pIdx) => {
            const plantChecks = plant.checks || {};
            let plantHtml = '';

            order.forEach(type => {
                if (plantChecks[type] && hasAnyValue(plantChecks[type])) {
                    plantHtml += `<h4 style="margin-top: 20px; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 5px;">${labels[type]}</h4>`;

                    const data = plantChecks[type];
                    // Merged Override Logic: 
                    // 1. Try plant-specific override [pIdx][type]
                    // 2. Fallback to generic override [type] (for legacy data)
                    const override = (overrides[pIdx] && overrides[pIdx][type]) || overrides[type] || {};

                    // Choose appropriate table engine
                    if (type === 'draftSensorSimulated') {
                        plantHtml += renderSimulatedDraft(data, override, null, type);
                    } else if (type.startsWith('draftSensor') || type.startsWith('ullage')) {
                        plantHtml += renderShipData(data, override, type);
                    } else if (type === 'hullStatus') {
                        plantHtml += renderHullStatus(data, override);
                    } else if (type === 'dragheadDepth') {
                        plantHtml += renderDragheadTable(data, override);
                    } else if (type === 'suctionMouthDepth') {
                        plantHtml += renderSuctionTable(data, override);
                    } else if (type === 'bucketDepth') {
                        plantHtml += renderBucketTable(data, override);
                    } else if (type === 'velocity') {
                        plantHtml += renderVelocityTable(data, override);
                    } else {
                        plantHtml += renderGenericTable(data, override);
                    }
                }
            });

            if (plantHtml) {
                // Wrap each plant's data in a distinct visual card
                html += `
                    <div class="vessel-checks-section" style="margin-top: 30px; border: 1px solid #ccc; padding: 15px; border-radius: 8px; background: #fafafa;">
                        <h3 style="margin-top: 0; color: #2c3e50; border-bottom: 2px solid #2c3e50;">${escapeHtml(plant.name || `Vessel #${pIdx + 1}`)} (${escapeHtml(plant.vesselType)})</h3>
                        ${plantHtml}
                    </div>
                `;
            }
        });
    } else {
        // Legacy Fallback for files without a 'plants' array
        const checks = state.qaChecks || {};
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
                } else if (type === 'suctionMouthDepth') {
                    html += renderSuctionTable(data, override);
                } else if (type === 'bucketDepth') {
                    html += renderBucketTable(data, override);
                } else if (type === 'velocity') {
                    html += renderVelocityTable(data, override);
                } else {
                    html += renderGenericTable(data, override);
                }
            }
        });
    }

    return html;
}

/**
 * Specialized Renderer: Ship Measurements (Draft/Ullage).
 * Computes Port/Starboard averages and differences from system readings.
 */
function renderShipData(data, override, typeName) {
    let html = '';

    // Human-to-Internal key mapping for variants
    const prefixMap = {
        'draftSensorLight': 'light-',
        'draftSensorLightFwd': 'light-',
        'draftSensorLightAft': 'light-',
        'draftSensorLoaded': 'loaded-',
        'draftSensorLoadedFwd': 'loaded-',
        'draftSensorLoadedAft': 'loaded-',
        'ullageLight': 'ullage-light-',
        'ullageLightFwd': 'ullage-light-',
        'ullageLightAft': 'ullage-light-',
        'ullageLoaded': 'ullage-loaded-',
        'ullageLoadedFwd': 'ullage-loaded-',
        'ullageLoadedAft': 'ullage-loaded-'
    };
    const prefix = prefixMap[typeName] || '';

    const isFwdOnly = typeName.endsWith('Fwd');
    const isAftOnly = typeName.endsWith('Aft');

    // Attribute extraction with override precedence
    let fwdPort = getVal(data, override, `${prefix}fwd-port`);
    let fwdStbd = getVal(data, override, `${prefix}fwd-stbd`);
    let aftPort = getVal(data, override, `${prefix}aft-port`);
    let aftStbd = getVal(data, override, `${prefix}aft-stbd`);
    let dqmFwd = getVal(data, override, `${prefix}dqm-fwd`);
    let dqmAft = getVal(data, override, `${prefix}dqm-aft`);

    // Verify presence of data before attempting calculation
    if (fwdPort !== undefined || fwdStbd !== undefined || aftPort !== undefined || aftStbd !== undefined || dqmFwd !== undefined || dqmAft !== undefined) {
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
        ${!isAftOnly ? `
        <tr>
            <td><strong>Forward</strong></td>
            <td class="text-center">${formatNum(fwdPort)}</td>
            <td class="text-center">${formatNum(fwdStbd)}</td>
            <td class="text-center">${formatNum(fwdAvg)}</td>
            <td class="text-center">${formatNum(dqmFwd)}</td>
            <td class="text-center">${formatNum(fwdDiff)}</td>
        </tr>` : ''}
        ${!isFwdOnly ? `
        <tr>
            <td><strong>Aft</strong></td>
            <td class="text-center">${formatNum(aftPort)}</td>
            <td class="text-center">${formatNum(aftStbd)}</td>
            <td class="text-center">${formatNum(aftAvg)}</td>
            <td class="text-center">${formatNum(dqmAft)}</td>
            <td class="text-center">${formatNum(aftDiff)}</td>
        </tr>` : ''}
        </table>`;
    }

    // 2. Secondary Logic: Append Simulated Draft offsets if present
    if (typeName.startsWith('draftSensor')) {
        const simPrefix = `sim-${prefix}`;
        const hasSim = Object.keys(data).some(k => k.startsWith(simPrefix));
        if (hasSim) {
            html += renderSimulatedDraft(data, override, simPrefix, typeName);
        }
    }

    // 3. Remarks Consolidation: Aggregate from various legacy check naming conventions
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

/**
 * Specialized Renderer: Simulated Draft Tables.
 * Renders the 3-point depth verification for sensors.
 */
function renderSimulatedDraft(data, override, prefixOverride, typeName) {
    let html = '';
    const prefix = prefixOverride || 'sim-';

    const isFwdOnly = typeName && typeName.endsWith('Fwd');
    const isAftOnly = typeName && typeName.endsWith('Aft');

    ['fwd', 'aft'].forEach(pos => {
        if (pos === 'fwd' && isAftOnly) return;
        if (pos === 'aft' && isFwdOnly) return;

        let rows = '';
        [1, 2, 3].forEach(num => {
            let offset = parseFloat(getVal(data, override, `${prefix}${pos}-offset`)) || 0;
            let depth = getVal(data, override, `${prefix}${pos}-depth-${num}`) || getVal(data, override, `${prefix}${pos}-depth${num}`);
            let reading = getVal(data, override, `${prefix}${pos}-reading-${num}`) || getVal(data, override, `${prefix}${pos}-reading${num}`);

            // Re-calculate difference using offset: |(depth + offset) - reading|
            let diffVal = undefined;
            if (depth !== undefined && reading !== undefined) {
                diffVal = Math.abs((parseFloat(depth) + offset) - parseFloat(reading)).toFixed(2);
            }

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
            let offset = parseFloat(getVal(data, override, `${prefix}${pos}-offset`)) || 0;
            html += `<h4 style="margin: 15px 0 5px;">${pos === 'fwd' ? 'Forward' : 'Aft'} Sensors — Offset: ${formatNum(offset)} ft</h4>
            <table class="report-table">
                <tr>
                    <th width="40%">Measurement</th>
                    <th width="20%" class="text-center">Test Depth (ft)</th>
                    <th width="20%" class="text-center">System Reading (ft)</th>
                    <th width="20%" class="text-center">Difference</th>
                </tr>
                ${rows}
            </table>`;
        }
    });

    if (!prefixOverride) {
        let remarks = getVal(data, override, `remarks`);
        if (remarks) {
            html += `<p style="font-size: 10pt; font-style: italic;">Remarks: ${escapeHtml(remarks.toString())}</p>`;
        }
    }

    return html;
}

/**
 * Specialized Renderer: Draghead Depth Verification.
 * Supports Port, Center, and Starboard configurations.
 */
function renderDragheadTable(data, override) {
    let html = '';
    let dragheads = [
        { key: 'port', label: 'Port Draghead', checkKey: 'draghead-check-port', altCheckKey: 'dh-port-chk' },
        { key: 'center', label: 'Center Draghead', checkKey: 'draghead-check-center', altCheckKey: 'dh-center-chk' },
        { key: 'stbd', label: 'Starboard Draghead', checkKey: 'draghead-check-stbd', altCheckKey: 'dh-stbd-chk' }
    ];

    dragheads.forEach(dh => {
        // Skip this draghead if it was explicitly unchecked in the app
        const isChecked = getVal(data, override, dh.checkKey) !== false && getVal(data, override, dh.altCheckKey) !== false;
        if (!isChecked) return;

        let rows = '';
        let offset = parseFloat(getVal(data, override, `draghead-${dh.key}-offset`)) || parseFloat(getVal(data, override, `dh-${dh.key}-offset`)) || 0;

        [1, 2, 3].forEach(num => {
            let manual = getVal(data, override, `draghead-${dh.key}-manual-${num}`) || getVal(data, override, `dh-${dh.key}-man-${num}`);
            let dqm = getVal(data, override, `draghead-${dh.key}-dqm-${num}`) || getVal(data, override, `dh-${dh.key}-dqm-${num}`);

            let diffVal = undefined;
            if (manual !== undefined && dqm !== undefined) {
                diffVal = Math.abs((parseFloat(manual) + offset) - parseFloat(dqm)).toFixed(2);
            }

            if (manual !== undefined || dqm !== undefined) {
                rows += `
                <tr>
                    <td class="text-center">Depth Measurement ${num}</td>
                    <td class="text-center">${formatNum(manual)}</td>
                    <td class="text-center">${formatNum(dqm)}</td>
                    <td class="text-center">${formatNum(diffVal)}</td>
                </tr>`;
            }
        });

        if (rows !== '') {
            html += `
            <div style="margin-bottom: 10px;">
                <h4 style="margin:0 0 5px 0; font-size:11pt; color:#333;">${dh.label} — Offset: ${formatNum(offset)} ft</h4>
                <table class="report-table">
                    <tr>
                        <th width="40%">Measurement</th>
                        <th width="20%" class="text-center">Measured (ft)</th>
                        <th width="20%" class="text-center">DQM Reported (ft)</th>
                        <th width="20%" class="text-center">Difference</th>
                    </tr>
                    ${rows}
                </table>
            </div>`;
        }
    });

    let remarks = getVal(data, override, 'draghead-remarks') || getVal(data, override, 'remarks');
    if (remarks) html += `<p style="font-size: 10pt; font-style: italic;">Remarks: ${escapeHtml(remarks.toString())}</p>`;

    return html || '<p>No draghead data recorded.</p>';
}

/**
 * Specialized Renderer: Suction Mouth Depth (Cutterhead).
 */
function renderSuctionTable(data, override) {
    let rows = '';
    let offset = parseFloat(getVal(data, override, 'suction-offset')) || 0;

    [1, 2, 3].forEach(num => {
        let manual = getVal(data, override, `suction-manual-${num}`) || getVal(data, override, `suction-man-${num}`);
        let dqm = getVal(data, override, `suction-dqm-${num}`);

        let diffVal = undefined;
        if (manual !== undefined && dqm !== undefined) {
            diffVal = Math.abs((parseFloat(manual) + offset) - parseFloat(dqm)).toFixed(2);
        }

        if (manual !== undefined || dqm !== undefined) {
            rows += `
            <tr>
                <td class="text-center">Measurement ${num}</td>
                <td class="text-center">${formatNum(manual)}</td>
                <td class="text-center">${formatNum(dqm)}</td>
                <td class="text-center">${formatNum(diffVal)}</td>
            </tr>`;
        }
    });

    if (!rows) return '<p>No suction mouth data recorded.</p>';

    let html = `
        <h4 style="margin: 15px 0 5px; font-size:11pt; color:#333;">Suction Mouth — Offset: ${formatNum(offset)} ft</h4>
        <table class="report-table">
            <tr>
                <th width="40%">Measurement</th>
                <th width="20%" class="text-center">Measured (ft)</th>
                <th width="20%" class="text-center">DQM Reported (ft)</th>
                <th width="20%" class="text-center">Difference</th>
            </tr>
            ${rows}
        </table>
    `;

    let remarks = getVal(data, override, 'suction-remarks') || getVal(data, override, 'remarks');
    if (remarks) html += `<p style="font-size: 10pt; font-style: italic;">Remarks: ${escapeHtml(remarks.toString())}</p>`;

    return html;
}

/**
 * Specialized Renderer: Bucket Depth (Mechanical).
 */
function renderBucketTable(data, override) {
    let rows = '';
    let offset = parseFloat(getVal(data, override, 'bucket-offset')) || 0;

    [1, 2, 3].forEach(num => {
        let manual = getVal(data, override, `bucket-manual-${num}`) || getVal(data, override, `bucket-man-${num}`);
        let dqm = getVal(data, override, `bucket-dqm-${num}`);

        let diffVal = undefined;
        if (manual !== undefined && dqm !== undefined) {
            diffVal = Math.abs((parseFloat(manual) + offset) - parseFloat(dqm)).toFixed(2);
        }

        if (manual !== undefined || dqm !== undefined) {
            rows += `
            <tr>
                <td class="text-center">Measurement ${num}</td>
                <td class="text-center">${formatNum(manual)}</td>
                <td class="text-center">${formatNum(dqm)}</td>
                <td class="text-center">${formatNum(diffVal)}</td>
            </tr>`;
        }
    });

    if (!rows) return '<p>No bucket depth data recorded.</p>';

    let html = `
        <h4 style="margin: 15px 0 5px; font-size:11pt; color:#333;">Bucket/Grab — Offset: ${formatNum(offset)} ft</h4>
        <table class="report-table">
            <tr>
                <th width="40%">Measurement</th>
                <th width="20%" class="text-center">Measured (ft)</th>
                <th width="20%" class="text-center">DQM Reported (ft)</th>
                <th width="20%" class="text-center">Difference</th>
            </tr>
            ${rows}
        </table>
    `;

    let remarks = getVal(data, override, 'bucket-depth-remarks') || getVal(data, override, 'remarks');
    if (remarks) html += `<p style="font-size: 10pt; font-style: italic;">Remarks: ${escapeHtml(remarks.toString())}</p>`;

    return html;
}

/**
 * Specialized Renderer: Hull Status with Photos.
 * Embeds base64 or URL images for visual verification of sensors.
 */
function renderHullStatus(data, override) {
    let html = '<div style="display: flex; flex-wrap: wrap; gap: 20px; margin-top: 10px;">';

    // Aggregate known photo keys from both App 1 and App 2
    const sections = [
        { key: 'photo-fwd', label: 'Forward Marks' },
        { key: 'photo-aft', label: 'Aft Marks' },
        { key: 'photo-draft-sensor', label: 'Draft Sensor' },
        { key: 'photo-additional', label: 'Additional' },
        { key: 'hull-open-photo', label: 'Closed to Open' },
        { key: 'hull-close-photo', label: 'Open to Closed' }
    ];

    let hasAnyPhoto = false;

    // Numerical/Boolean state check
    const hullOpened = getVal(data, override, 'hull-opened');
    if (hullOpened) {
        html += `<p style="margin: 0 0 10px 0; font-size: 10pt;"><strong>Hull Opened:</strong> ${hullOpened.toUpperCase()}</p>`;
    }

    sections.forEach(s => {
        let val = getVal(data, override, s.key);
        if (val && val.length > 10) {
            hasAnyPhoto = true;
            html += `
                <div style="flex: 1; min-width: 200px; max-width: 45%; border: 1px solid #eee; padding: 10px; border-radius: 4px;">
                    <p style="margin: 0 0 5px 0; font-weight: bold; font-size: 10pt;">${s.label}</p>
                    <img src="${val}" style="width: 100%; height: auto; border-radius: 2px;" alt="${s.label}">
                </div>
            `;
        }
    });

    html += '</div>';

    let remarks = getVal(data, override, 'remarks') || getVal(data, override, 'hull-remarks');
    if (remarks) {
        html += `<p style="font-size: 10pt; font-style: italic; margin-top: 10px;">Remarks: ${escapeHtml(remarks.toString())}</p>`;
    }

    const hasAnyContent = hasAnyPhoto || remarks || hullOpened;
    return hasAnyContent ? html : '<p>No hull status data recorded.</p>';
}

/**
 * Specialized Renderer: Velocity Check (Dye or Meter).
 * Handles time-distance and direct comparison audits.
 */
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

/**
 * Fallback Renderer: Generic Key-Value Table.
 * Recursively builds tables for nested objects.
 * Handles photo embedding for any key containing "photo".
 */
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

/**
 * Renders the Audit Timeline sheet.
 * Maps 'action'/'activity' and 'details'/'notes' permutations from different app versions.
 */
function renderTimeline(timelineArray) {
    if (!timelineArray || timelineArray.length === 0) return '';

    let rows = timelineArray.map(item => {
        let actionText = (item.action || item.activity || '').trim();
        const commentText = (item.details || item.notes || '').trim();
        
        // Sanitization Layer: Remove unexplained ", 0" from legacy app strings
        actionText = actionText.replace(/,\s*0\s*(?=\))/g, '');

        let combinedAction = '';
        if (actionText.toLowerCase() === 'comment') {
            // Case: Action is a generic "Comment" placeholder; omit it for the actual content
            combinedAction = `<strong>Comment:</strong> ${escapeHtml(commentText)}`;
        } else if (actionText && commentText) {
            // Case: Specific action with additional details; keep on one line
            combinedAction = `${escapeHtml(actionText)} <span style="font-size: 0.9em; font-style: italic;">(Comment: ${escapeHtml(commentText)})</span>`;
        } else {
            // fallback for single-field entries
            combinedAction = escapeHtml(actionText || commentText);
            if (!actionText && commentText) {
                combinedAction = `<strong>Comment:</strong> ${escapeHtml(commentText)}`;
            }
        }

        return `
        <tr>
            <td width="20%">${escapeHtml(item.time)}</td>
            <td width="80%">${combinedAction}</td>
        </tr>
    `}).join('');

    return `
        <h3>QA Timeline</h3>
        <table class="report-table" style="margin-bottom: 30px;">
            <tr>
                <th width="20%">Time</th>
                <th width="80%">Action / Comment</th>
            </tr>
            ${rows}
        </table>
    `;
}

// Helpers

/**
 * Safe Value Retrieval.
 * Checks for user overrides before falling back to original audit data.
 */
function getVal(data, override, key) {
    if (override && override[key] !== undefined && override[key] !== '') return override[key];
    if (data && data[key] !== undefined && data[key] !== '') return data[key];
    return undefined;
}

/**
 * Arithmetic Average.
 * Returns a fixed 2-decimal string. Handles missing single values gracefully.
 */
function avg(a, b) {
    const na = Number(a); const nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return ((na + nb) / 2).toFixed(2);
    if (!isNaN(na)) return na.toFixed(2);
    if (!isNaN(nb)) return nb.toFixed(2);
    return undefined;
}

/**
 * Arithmetic Difference (Absolute).
 */
function diff(a, b) {
    const na = Number(a); const nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return Math.abs(na - nb).toFixed(2);
    return undefined;
}

/**
 * Formats a number for report display (returns '-' for null/undefined).
 */
function formatNum(val) {
    if (val === undefined || val === null || val === '') return '-';
    // If it's a number (or string that looks like one), format to 2 decimals
    const n = Number(val);
    if (!isNaN(n)) return n.toFixed(2);
    return val;
}

/**
 * Formats a date string into "Month Day, Year".
 */
function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Humanizes technical keys (camelCase/kebab-case -> Title Case).
 */
function formatLabel(prop) {
    const result = prop.replace(/([A-Z])/g, " $1");
    let mapped = result.charAt(0).toUpperCase() + result.slice(1);
    mapped = mapped.replace(/-/g, ' '); // handle hyphenated keys like "light-fwd-port" -> "light fwd port"

    // Proper Title Casing
    return mapped.replace(
        /\w\S*/g,
        function (txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
    );
}

/**
 * Primitive XSS Protection for report generation.
 */
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
