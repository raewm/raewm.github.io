/**
 * data-check.js
 * Integration Verification Data Check module for the DQM Trip Report.
 * Ported and adapted from dpip-review/app.js.
 *
 * Renders per-plant displacement and volume verification panels for
 * all Hopper and Scow vessels found in the loaded QA data.
 *
 * Business Rules:
 *   Hopper         → Displacement Check (light + loaded) + Volume Check (light + loaded)
 *   Scow (standard)→ Displacement Check only
 *   Scow (ullage)  → Displacement Check + Volume Check (toggle)
 *   Pipeline / Mech→ No panels shown
 *
 * vesselType values come directly from dqm-qa-app2:
 *   'Hopper Dredge', 'Scow', 'Pipeline Dredge', 'Mechanical Dredge'
 * profile values: 'Standard', 'Ullage', 'Monitoring', 'Small Business'
 */

/**
 * Returns a fresh, zeroed-out data check state object for a single plant.
 */
function getDefaultDataCheckState() {
    const defaultSection = (isVolume) => ({
        ...(isVolume
            ? { reportedUllageFwd: '', reportedUllageAft: '', reportedVolume: '' }
            : { reportedDraftFwd: '', reportedDraftAft: '', reportedDisplacement: '' }),
        method: 'table',
        tableParams: { x1: '', y1: '', x2: '', y2: '' },
        equationParams: { coefA: '', coefB: '', coefC: '' }
    });
    return {
        isUllageProfile: false,
        displacementLight:  defaultSection(false),
        displacementLoaded: defaultSection(false),
        volumeLight:        defaultSection(true),
        volumeLoaded:       defaultSection(true)
    };
}

/**
 * Computes the interpolated/quadratic result from state data alone.
 * Used by both the live UI and the report renderer so we don't depend on DOM reads.
 *
 * @param {Object} data       - One of the four section objects (displacementLight etc.)
 * @param {string} sectionKey - e.g. 'displacementLight'
 * @returns {number|null}
 */
function computeVerificationValue(data, sectionKey) {
    const isDisp = sectionKey.startsWith('displacement');
    const fwd = parseFloat(isDisp ? data.reportedDraftFwd : data.reportedUllageFwd);
    const aft = parseFloat(isDisp ? data.reportedDraftAft : data.reportedUllageAft);
    // Require at least one valid value; average the two if both present
    const hasFwd = !isNaN(fwd);
    const hasAft = !isNaN(aft);
    if (!hasFwd && !hasAft) return null;
    const x = (hasFwd && hasAft) ? (fwd + aft) / 2 : (hasFwd ? fwd : aft);
    if (isNaN(x)) return null;

    if (data.method === 'table') {
        const x1 = parseFloat(data.tableParams.x1);
        const y1 = parseFloat(data.tableParams.y1);
        const x2 = parseFloat(data.tableParams.x2);
        const y2 = parseFloat(data.tableParams.y2);
        if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2) && x1 !== x2) {
            return y1 + (x - x1) * ((y2 - y1) / (x2 - x1));
        }
    } else {
        const a = parseFloat(data.equationParams.coefA) || 0;
        const b = parseFloat(data.equationParams.coefB) || 0;
        const c = parseFloat(data.equationParams.coefC) || 0;
        return (a * x * x) + (b * x) + c;
    }
    return null;
}

/**
 * Returns true if the plant qualifies for Displacement Check.
 * Qualifying: any Hopper Dredge, any Scow profile.
 */
function qualifiesForDisplacement(vesselType) {
    const t = (vesselType || '').toLowerCase();
    return t.includes('hopper') || t === 'scow';
}

/**
 * Returns true if the plant qualifies for Volume Check.
 * Hopper Dredge always qualifies.
 * Scow-Ullage profile auto-qualifies; standard Scow can be promoted via the
 * isUllageProfile manual checkbox override stored in dc.isUllageProfile.
 */
function qualifiesForVolume(vesselType, profile, isUllageOverride) {
    const t = (vesselType || '').toLowerCase();
    if (t.includes('hopper')) return true;
    if (t === 'scow') {
        // Ullage profile auto-qualifies; manual checkbox overrides for others
        return (profile || '').toLowerCase() === 'ullage' || !!isUllageOverride;
    }
    return false;
}

/**
 * Global toggle handler called from inline onclick on method buttons.
 * Signature matches the multi-plant pattern: (pIdx, sectionKey, method).
 */
window.setCheckMethod = function(pIdx, sectionKey, method) {
    if (
        window.appState.dataCheck &&
        window.appState.dataCheck[pIdx] &&
        window.appState.dataCheck[pIdx][sectionKey]
    ) {
        window.appState.dataCheck[pIdx][sectionKey].method = method;
    }
    if (typeof saveDraft === 'function') saveDraft();
    renderDataCheck();
};

/**
 * Main entry point.
 * Clears and rebuilds the #data-check-container for every qualifying plant.
 * Called from file-loader.js (on load) and ui-tabs.js (on tab switch).
 */
function renderDataCheck() {
    const container = document.getElementById('data-check-container');
    if (!container) return;

    container.innerHTML = '';

    // Ensure the dataCheck map exists
    if (!window.appState.dataCheck) window.appState.dataCheck = {};

    const plants = window.appState.plants || [];
    const qualifying = plants
        .map((plant, pIdx) => ({ plant, pIdx }))
        .filter(({ plant }) => qualifiesForDisplacement(plant.vesselType));

    if (qualifying.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted p-4" style="margin-top: 2rem;">
                No Hopper or Scow vessels found in the loaded data.<br>
                Load a QA file containing qualifying vessels to use this feature.
            </div>`;
        return;
    }

    qualifying.forEach(({ plant, pIdx }, listIdx) => {
        // Initialize state for new plants
        if (!window.appState.dataCheck[pIdx]) {
            window.appState.dataCheck[pIdx] = getDefaultDataCheckState();
        }
        const dc        = window.appState.dataCheck[pIdx];
        const vType     = plant.vesselType;
        const vProfile  = plant.profile || '';
        // Auto-seed isUllageProfile from the plant profile on first load
        if (vProfile.toLowerCase() === 'ullage' && !dc.isUllageProfile) {
            dc.isUllageProfile = true;
        }
        const showVol   = qualifiesForVolume(vType, vProfile, dc.isUllageProfile);
        const isScow    = (vType || '').toLowerCase() === 'scow';

        // Build this plant's panel HTML as one string
        let html = `
            <div style="margin-bottom:1rem; padding:0.75rem 1rem;
                        background:rgba(52,152,219,0.08); border-radius:8px;
                        border-left:3px solid var(--primary);">
                <h3 style="margin:0; color:var(--primary); font-size:1rem;">
                    ${plant.name || `Vessel #${pIdx + 1}`}
                    <span style="font-weight:400; font-size:0.85em; color:var(--text-muted);">
                        (${vType})
                    </span>
                </h3>
            </div>`;

        if (isScow) {
            html += `
                <div class="form-group" style="margin-bottom:1.5rem;">
                    <label style="display:flex; align-items:center; gap:0.5rem;
                                  font-size:0.9rem; cursor:pointer; color:var(--text-main);">
                        <input type="checkbox" id="is-ullage-profile-${pIdx}"
                               ${dc.isUllageProfile ? 'checked' : ''}
                               style="width:1.2rem; height:1.2rem; accent-color:var(--primary);">
                        Is this an Ullage Profile Scow? (Requires Volume Check)
                    </label>
                </div>`;
        }
        // Note: only show the manual toggle for scows; hopper volume is always shown

        html += buildCalculatorSection(dc, 'displacementLight',  'Displacement Check — Light Ship',  'Draft',  'Displacement', pIdx);
        html += buildCalculatorSection(dc, 'displacementLoaded', 'Displacement Check — Fully Loaded', 'Draft',  'Displacement', pIdx);

        if (showVol) {
            html += buildCalculatorSection(dc, 'volumeLight',  'Volume Check — Light Ship',  'Ullage', 'Volume', pIdx);
            html += buildCalculatorSection(dc, 'volumeLoaded', 'Volume Check — Fully Loaded', 'Ullage', 'Volume', pIdx);
        }

        if (listIdx < qualifying.length - 1) {
            html += '<hr style="border:none; border-top:1px solid var(--border); margin:2rem 0;">';
        }

        // Inject into DOM via a wrapper so listeners can be bound immediately after
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        container.appendChild(wrapper);

        // Bind the scow ullage profile toggle
        if (isScow) {
            const chk = document.getElementById(`is-ullage-profile-${pIdx}`);
            if (chk) {
                chk.addEventListener('change', (e) => {
                    window.appState.dataCheck[pIdx].isUllageProfile = e.target.checked;
                    if (typeof saveDraft === 'function') saveDraft();
                    renderDataCheck();
                });
            }
        }

        // Attach live-calculation listeners
        attachCalculatorListeners(dc, 'displacementLight',  'Draft',  'Displacement', pIdx);
        attachCalculatorListeners(dc, 'displacementLoaded', 'Draft',  'Displacement', pIdx);
        if (showVol) {
            attachCalculatorListeners(dc, 'volumeLight',  'Ullage', 'Volume', pIdx);
            attachCalculatorListeners(dc, 'volumeLoaded', 'Ullage', 'Volume', pIdx);
        }
    });
}

/**
 * Builds the HTML string for a single interpolation/equation panel.
 * Element IDs use the compound key `${sectionKey}-p${pIdx}` to stay
 * unique across multiple plants.
 */
function buildCalculatorSection(dc, sectionKey, title, inputLabel, outputLabel, pIdx) {
    const data = dc[sectionKey];
    if (!data) return '';

    const uid    = `${sectionKey}-p${pIdx}`;
    const isDisp = sectionKey.startsWith('displacement');
    const repFwd = isDisp ? data.reportedDraftFwd   : data.reportedUllageFwd;
    const repAft = isDisp ? data.reportedDraftAft   : data.reportedUllageAft;
    const repOut = isDisp ? data.reportedDisplacement : data.reportedVolume;

    // Compute average for display in the avg field (may be empty if both blank)
    const fwdVal = parseFloat(repFwd);
    const aftVal = parseFloat(repAft);
    let avgDisplay = '';
    if (!isNaN(fwdVal) && !isNaN(aftVal)) avgDisplay = ((fwdVal + aftVal) / 2).toFixed(4);
    else if (!isNaN(fwdVal))              avgDisplay = fwdVal.toFixed(4);
    else if (!isNaN(aftVal))              avgDisplay = aftVal.toFixed(4);

    let html = `
        <div class="data-check-panel">
            <h3 style="border-bottom:2px solid var(--border); padding-bottom:0.5rem;
                        font-size:1rem; margin-bottom:1rem;">${title}</h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:0.5rem;">
                <div class="form-group" style="margin:0;">
                    <label>Reported ${inputLabel} Forward</label>
                    <input type="number" step="any" id="${uid}-fwd" value="${repFwd}">
                </div>
                <div class="form-group" style="margin:0;">
                    <label>Reported ${inputLabel} Aft</label>
                    <input type="number" step="any" id="${uid}-aft" value="${repAft}">
                </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size:0.8rem; color:var(--text-muted);">Averaged ${inputLabel}</label>
                    <input type="text" readonly id="${uid}-avg"
                           value="${avgDisplay}"
                           style="background:transparent; border:1px dashed var(--border);
                                  color:var(--text-muted); font-style:italic;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label>Reported ${outputLabel}</label>
                    <input type="number" step="any" id="${uid}-output" value="${repOut}">
                </div>
            </div>
            <h4 style="margin:1rem 0 0.5rem; font-size:0.85rem; color:var(--text-muted);
                        text-transform:uppercase; letter-spacing:0.04em;">DPIP Verification Method</h4>
            <div style="display:flex; gap:0.5rem; margin-bottom:1rem;">
                <button class="btn btn-small ${data.method === 'table' ? 'btn-primary' : 'btn-secondary'}"
                        onclick="setCheckMethod(${pIdx}, '${sectionKey}', 'table')">
                    Table Interpolation
                </button>
                <button class="btn btn-small ${data.method === 'equation' ? 'btn-primary' : 'btn-secondary'}"
                        onclick="setCheckMethod(${pIdx}, '${sectionKey}', 'equation')">
                    Equation Solver
                </button>
            </div>`;

    if (data.method === 'table') {
        html += `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:0.75rem;">
                <div class="form-group" style="margin:0;">
                    <label>x1 (Smaller ${inputLabel} From Table)</label>
                    <input type="number" step="any" id="${uid}-x1" value="${data.tableParams.x1}">
                </div>
                <div class="form-group" style="margin:0;">
                    <label>y1 (Smaller ${outputLabel} From Table)</label>
                    <input type="number" step="any" id="${uid}-y1" value="${data.tableParams.y1}">
                </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:0.75rem;">
                <div class="form-group" style="margin:0;">
                    <label>x2 (Larger ${inputLabel} From Table)</label>
                    <input type="number" step="any" id="${uid}-x2" value="${data.tableParams.x2}">
                </div>
                <div class="form-group" style="margin:0;">
                    <label>y2 (Larger ${outputLabel} From Table)</label>
                    <input type="number" step="any" id="${uid}-y2" value="${data.tableParams.y2}">
                </div>
            </div>`;
    } else {
        html += `
            <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:0.75rem;">
                Equation: y = Ax² + Bx + C &nbsp;(where x = Reported ${inputLabel})
            </p>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem; margin-bottom:0.75rem;">
                <div class="form-group" style="margin:0;">
                    <label>Coefficient A</label>
                    <input type="number" step="any" id="${uid}-a" value="${data.equationParams.coefA}">
                </div>
                <div class="form-group" style="margin:0;">
                    <label>Coefficient B</label>
                    <input type="number" step="any" id="${uid}-b" value="${data.equationParams.coefB}">
                </div>
                <div class="form-group" style="margin:0;">
                    <label>Coefficient C</label>
                    <input type="number" step="any" id="${uid}-c" value="${data.equationParams.coefC}">
                </div>
            </div>`;
    }

    html += `
            <div style="display:flex; align-items:center; justify-content:space-between;
                        background:var(--bg-card); padding:0.85rem 1rem;
                        border-radius:6px; margin-top:0.5rem;">
                <div class="form-group" style="margin:0; flex:2;">
                    <label style="font-size:0.8rem;">Calculated Verification ${outputLabel}</label>
                    <input type="text" readonly id="${uid}-result"
                           style="font-size:1.05rem; font-weight:700;
                                  background:transparent; border:none; padding:0;
                                  color:var(--text-main); width:100%;">
                </div>
                <div id="${uid}-match"
                     style="flex:1; text-align:right; font-weight:700; font-size:1rem;">
                </div>
            </div>
        </div>`;

    return html;
}

/**
 * Wires up input listeners on a single calculator section so results
 * recalculate live as the user types.
 */
function attachCalculatorListeners(dc, sectionKey, inputLabel, outputLabel, pIdx) {
    const data = dc[sectionKey];
    if (!data) return;

    const uid      = `${sectionKey}-p${pIdx}`;
    const isDisp   = sectionKey.startsWith('displacement');
    const fwdKey   = isDisp ? 'reportedDraftFwd'      : 'reportedUllageFwd';
    const aftKey   = isDisp ? 'reportedDraftAft'      : 'reportedUllageAft';
    const outKey   = isDisp ? 'reportedDisplacement'  : 'reportedVolume';

    // Helper: update the averaged display field
    const updateAvg = () => {
        const avgEl = document.getElementById(`${uid}-avg`);
        if (!avgEl) return;
        const fVal = parseFloat(data[fwdKey]);
        const aVal = parseFloat(data[aftKey]);
        if (!isNaN(fVal) && !isNaN(aVal)) avgEl.value = ((fVal + aVal) / 2).toFixed(4);
        else if (!isNaN(fVal))            avgEl.value = fVal.toFixed(4);
        else if (!isNaN(aVal))            avgEl.value = aVal.toFixed(4);
        else                              avgEl.value = '';
    };

    const calcResult = () => {
        const calculated = computeVerificationValue(data, sectionKey);
        const resultEl   = document.getElementById(`${uid}-result`);
        const matchEl    = document.getElementById(`${uid}-match`);
        if (!resultEl || !matchEl) return;

        if (calculated !== null) {
            resultEl.value = calculated.toFixed(2);
            const reported = parseFloat(data[outKey]);
            if (!isNaN(reported) && reported !== 0) {
                const pctDiff = Math.abs(calculated - reported) / Math.abs(reported) * 100;
                if (pctDiff <= 3.0) {
                    matchEl.textContent = `✅ Within 3% (${pctDiff.toFixed(2)}%)`;
                    matchEl.style.color = 'var(--success)';
                } else {
                    matchEl.textContent = `❌ Mismatch (${pctDiff.toFixed(2)}%)`;
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
                if (typeof saveDraft === 'function') saveDraft();
            });
        }
    };

    // Wrap bindInput for Fwd/Aft so avg updates too
    const bindFwdAft = (id, obj, key) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                obj[key] = e.target.value;
                updateAvg();
                calcResult();
                if (typeof saveDraft === 'function') saveDraft();
            });
        }
    };

    bindFwdAft(`${uid}-fwd`,    data, fwdKey);
    bindFwdAft(`${uid}-aft`,    data, aftKey);
    bindInput(`${uid}-output`,  data, outKey);

    if (data.method === 'table') {
        bindInput(`${uid}-x1`, data.tableParams, 'x1');
        bindInput(`${uid}-y1`, data.tableParams, 'y1');
        bindInput(`${uid}-x2`, data.tableParams, 'x2');
        bindInput(`${uid}-y2`, data.tableParams, 'y2');
    } else {
        bindInput(`${uid}-a`, data.equationParams, 'coefA');
        bindInput(`${uid}-b`, data.equationParams, 'coefB');
        bindInput(`${uid}-c`, data.equationParams, 'coefC');
    }

    // Run once to display any previously saved values
    calcResult();
}
