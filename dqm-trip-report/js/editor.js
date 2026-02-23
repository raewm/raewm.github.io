// editor.js
// Renders the editable QA check fields from the loaded JSON

const checkLabels = {
    'positionCheck': 'Position Check',
    'hullStatus': 'Hull Status',
    'draftSensor': 'Draft Sensor (Light & Loaded)',
    'ullage': 'Ullage (Light & Loaded)',
    'dragheadDepth': 'Draghead Depth',
    'suctionMouthDepth': 'Suction Mouth Depth',
    'velocity': 'Velocity',
    'bucketDepth': 'Bucket Depth',
    'bucketPosition': 'Bucket Position'
};

function renderEditor() {
    const container = document.getElementById('editor-container');
    const qaChecks = window.appState.qaChecks || {};
    const overrides = window.appState.overrides || {};

    if (Object.keys(qaChecks).length === 0) {
        container.innerHTML = '<div class="text-center text-muted p-4">No QA checks found in the loaded data.</div>';
        return;
    }

    container.innerHTML = '';

    for (const [checkType, data] of Object.entries(qaChecks)) {
        if (!data || Object.keys(data).length === 0) continue;

        const section = document.createElement('div');
        section.className = 'editor-section';

        const header = document.createElement('div');
        header.className = 'editor-section-header';
        header.textContent = checkLabels[checkType] || formatLabel(checkType);

        const body = document.createElement('div');
        body.className = 'editor-section-body';

        // Provide custom layout for specific complex checks
        if (checkType === 'draftSensor' || checkType === 'ullage') {
            renderCustomShipData(data, overrides[checkType] || {}, body, checkType);
        } else if (checkType === 'dragheadDepth') {
            renderCustomTableData(data, overrides[checkType] || {}, body, checkType, 'Draghead Depth');
        } else {
            // Fallback generic grid
            const grid = document.createElement('div');
            grid.className = 'form-grid';
            buildInputs(data, overrides[checkType] || {}, grid, checkType, '');
            body.appendChild(grid);
        }

        section.appendChild(header);
        section.appendChild(body);

        header.addEventListener('click', () => {
            section.classList.toggle('open');
        });

        container.appendChild(section);
    }
}

// Custom layout for Draft/Ullage (Light/Loaded grouped)
function renderCustomShipData(dataObj, overrideObj, parentDom, checkType) {
    const conditions = ['Light', 'Loaded'];

    conditions.forEach(cond => {
        const condKeys = Object.keys(dataObj).filter(k => k.toLowerCase().includes(cond.toLowerCase()));
        if (condKeys.length === 0) return;

        const wrap = document.createElement('div');
        wrap.style.marginBottom = '20px';
        wrap.style.padding = '15px';
        wrap.style.backgroundColor = 'rgba(255,255,255,0.02)';
        wrap.style.borderRadius = '8px';
        wrap.style.border = '1px solid rgba(255,255,255,0.1)';
        wrap.innerHTML = `<h4 style="margin-bottom:15px; color:var(--primary); font-size: 1.1em;">${cond} Readings</h4>`;

        const fwdKeys = condKeys.filter(k => k.toLowerCase().includes('fwd'));
        const aftKeys = condKeys.filter(k => k.toLowerCase().includes('aft'));
        const otherKeys = condKeys.filter(k => !k.toLowerCase().includes('fwd') && !k.toLowerCase().includes('aft'));

        // Define sort order: Port, Starboard, DQM
        const sortOrder = ['port', 'stbd', 'dqm'];
        const sortFn = (a, b) => {
            const aIdx = sortOrder.findIndex(o => a.toLowerCase().includes(o));
            const bIdx = sortOrder.findIndex(o => b.toLowerCase().includes(o));
            return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
        };

        // Render Fwd row
        if (fwdKeys.length > 0) {
            const fwdWrap = document.createElement('div');
            fwdWrap.style.marginBottom = '15px';
            fwdWrap.innerHTML = `<h5 style="margin-bottom:8px; color:#aaa;">Forward</h5>`;
            const fwdGrid = document.createElement('div');
            fwdGrid.style.display = 'grid';
            fwdGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
            fwdGrid.style.gap = '15px';

            fwdKeys.sort(sortFn).forEach(k => {
                buildSingleInput(k, dataObj[k], overrideObj[k], fwdGrid, checkType, k, getShortLabel(k));
            });
            fwdWrap.appendChild(fwdGrid);
            wrap.appendChild(fwdWrap);
        }

        // Render Aft row
        if (aftKeys.length > 0) {
            const aftWrap = document.createElement('div');
            aftWrap.style.marginBottom = '15px';
            aftWrap.innerHTML = `<h5 style="margin-bottom:8px; color:#aaa;">Aft</h5>`;
            const aftGrid = document.createElement('div');
            aftGrid.style.display = 'grid';
            aftGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
            aftGrid.style.gap = '15px';

            aftKeys.sort(sortFn).forEach(k => {
                buildSingleInput(k, dataObj[k], overrideObj[k], aftGrid, checkType, k, getShortLabel(k));
            });
            aftWrap.appendChild(aftGrid);
            wrap.appendChild(aftWrap);
        }

        // Render Other
        if (otherKeys.length > 0) {
            const otherGrid = document.createElement('div');
            otherGrid.className = 'form-grid';
            otherKeys.forEach(k => buildSingleInput(k, dataObj[k], overrideObj[k], otherGrid, checkType, k));
            wrap.appendChild(otherGrid);
        }

        parentDom.appendChild(wrap);
    });

    // Render any keys that aren't Light or Loaded (e.g. remarks)
    const otherMain = Object.keys(dataObj).filter(k => !k.toLowerCase().includes('light') && !k.toLowerCase().includes('loaded'));
    if (otherMain.length > 0) {
        const wrap = document.createElement('div');
        const grid = document.createElement('div');
        grid.className = 'form-grid';
        otherMain.forEach(k => buildSingleInput(k, dataObj[k], overrideObj[k], grid, checkType, k));
        wrap.appendChild(grid);
        parentDom.appendChild(wrap);
    }
}

function getShortLabel(prop) {
    const low = prop.toLowerCase();
    if (low.includes('port')) return 'Port';
    if (low.includes('stbd')) return 'Starboard';
    if (low.includes('dqm')) return 'DQM System';
    return null;
}

// Custom layout for array-like table data (Draghead 1, 2, 3)
function renderCustomTableData(dataObj, overrideObj, parentDom, checkType, title) {
    const grid = document.createElement('div');
    grid.className = 'form-grid';

    for (const [key, value] of Object.entries(dataObj)) {
        buildSingleInput(key, value, overrideObj[key], grid, checkType, key);
    }

    parentDom.appendChild(grid);
}

// Generic recursive builder
function buildInputs(dataObj, overrideObj, parentGrid, checkType, path) {
    for (const [key, value] of Object.entries(dataObj)) {
        const currentPath = path ? `${path}.${key}` : key;

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const sectionWrap = document.createElement('div');
            sectionWrap.style.gridColumn = '1 / -1';
            sectionWrap.style.marginTop = '10px';
            sectionWrap.style.paddingLeft = '10px';
            sectionWrap.style.borderLeft = '2px solid #555';

            const title = document.createElement('h4');
            title.textContent = formatLabel(key);
            title.style.marginBottom = '10px';
            title.style.color = '#ccc';
            sectionWrap.appendChild(title);

            const nestedGrid = document.createElement('div');
            nestedGrid.className = 'form-grid';

            buildInputs(value, overrideObj[key] || {}, nestedGrid, checkType, currentPath);
            sectionWrap.appendChild(nestedGrid);
            parentGrid.appendChild(sectionWrap);
        } else {
            buildSingleInput(currentPath, value, overrideObj[key], parentGrid, checkType, currentPath);
        }
    }
}

// Builds one input group
function buildSingleInput(displayPath, originalValue, overrideValue, parentGrid, checkType, savePath, customLabel = null) {
    const displayLabel = customLabel || formatLabel(displayPath.split('.').pop());

    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.textContent = displayLabel;

    const input = document.createElement('input');
    input.type = typeof originalValue === 'number' ? 'number' : 'text';

    if (input.type === 'number') {
        input.step = 'any';
    }

    let currentValue = originalValue;
    if (overrideValue !== undefined) {
        currentValue = overrideValue;
    }
    input.value = currentValue !== null && currentValue !== undefined ? currentValue : '';

    input.addEventListener('input', (e) => {
        let newVal = e.target.value;
        if (input.type === 'number') {
            newVal = newVal === '' ? '' : Number(newVal);
        }
        saveOverride(checkType, savePath, newVal);
    });

    group.appendChild(label);
    group.appendChild(input);
    parentGrid.appendChild(group);
}

function formatLabel(prop) {
    const result = prop.replace(/([A-Z])/g, " $1");
    return result.charAt(0).toUpperCase() + result.slice(1);
}

function saveOverride(checkType, pathStr, value) {
    if (!window.appState.overrides) {
        window.appState.overrides = {};
    }
    if (!window.appState.overrides[checkType]) {
        window.appState.overrides[checkType] = {};
    }

    const parts = pathStr.split('.');
    let current = window.appState.overrides[checkType];

    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) current[part] = {};
        current = current[part];
    }

    current[parts[parts.length - 1]] = value;
    window.saveDraft();
}
