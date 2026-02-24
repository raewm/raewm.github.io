// editor.js
// Renders the editable QA check fields from the loaded JSON

const checkLabels = {
    'positionCheck': 'Position Check',
    'hullStatus': 'Hull Status',
    'draftSensorLight': 'Draft Sensor (Light)',
    'draftSensorLightFwd': 'Draft Sensor (Light - Fwd)',
    'draftSensorLightAft': 'Draft Sensor (Light - Aft)',
    'draftSensorLoaded': 'Draft Sensor (Loaded)',
    'draftSensorLoadedFwd': 'Draft Sensor (Loaded - Fwd)',
    'draftSensorLoadedAft': 'Draft Sensor (Loaded - Aft)',
    'draftSensorSimulated': 'Draft Sensor (Simulated)',
    'ullageLight': 'Ullage (Light)',
    'ullageLightFwd': 'Ullage (Light - Fwd)',
    'ullageLightAft': 'Ullage (Light - Aft)',
    'ullageLoaded': 'Ullage (Loaded)',
    'ullageLoadedFwd': 'Ullage (Loaded - Fwd)',
    'ullageLoadedAft': 'Ullage (Loaded - Aft)',
    'dragheadDepth': 'Draghead Depth',
    'suctionMouthDepth': 'Suction Mouth Depth',
    'velocity': 'Velocity',
    'bucketDepth': 'Bucket Depth',
    'bucketPosition': 'Bucket Position'
};

function renderEditor() {
    const container = document.getElementById('editor-container');
    const plants = window.appState.plants || [];
    const legacyChecks = window.appState.qaChecks || {};
    const overrides = window.appState.overrides || {};

    if (plants.length === 0 && Object.keys(legacyChecks).length === 0) {
        container.innerHTML = '<div class="text-center text-muted p-4">No QA checks found in the loaded data.</div>';
        return;
    }

    container.innerHTML = '';

    // Render Timeline Editor First
    renderTimelineEditor(container);

    if (plants.length > 0) {
        plants.forEach((plant, pIdx) => {
            const plantChecks = plant.checks || {};
            if (Object.keys(plantChecks).length === 0) return;

            const plantHeader = document.createElement('h3');
            plantHeader.style.margin = '30px 0 15px 0';
            plantHeader.style.padding = '10px';
            plantHeader.style.backgroundColor = 'rgba(255,255,255,0.05)';
            plantHeader.style.borderRadius = '4px';
            plantHeader.style.color = 'var(--accent-primary)';
            plantHeader.textContent = `${plant.name || `Vessel #${pIdx + 1}`} (${plant.vesselType})`;
            container.appendChild(plantHeader);

            for (const [checkType, data] of Object.entries(plantChecks)) {
                if (!data || Object.keys(data).length === 0) continue;
                renderSection(checkType, data, (overrides[pIdx] && overrides[pIdx][checkType]) || {}, container, pIdx);
            }
        });
    } else {
        // Fallback for legacy top-level checks
        for (const [checkType, data] of Object.entries(legacyChecks)) {
            if (!data || Object.keys(data).length === 0) continue;
            renderSection(checkType, data, overrides[checkType] || {}, container, null);
        }
    }
}

function renderSection(checkType, data, overrideObj, container, plantIdx) {
    const section = document.createElement('div');
    section.className = 'editor-section';

    const header = document.createElement('div');
    header.className = 'editor-section-header';
    header.textContent = checkLabels[checkType] || formatLabel(checkType);

    const body = document.createElement('div');
    body.className = 'editor-section-body';

    // Provide custom layout for specific complex checks
    if (checkType.startsWith('draftSensor') || checkType.startsWith('ullage')) {
        renderCustomShipData(data, overrideObj, body, checkType, plantIdx);
    } else if (checkType === 'dragheadDepth') {
        renderCustomTableData(data, overrideObj, body, checkType, 'Draghead Depth', plantIdx);
    } else if (checkType === 'velocity') {
        renderVelocityData(data, overrideObj, body, checkType, plantIdx);
    } else {
        // Fallback generic grid
        const grid = document.createElement('div');
        grid.className = 'form-grid';
        buildInputs(data, overrideObj, grid, checkType, '', plantIdx);
        body.appendChild(grid);
    }

    section.appendChild(header);
    section.appendChild(body);

    header.addEventListener('click', () => {
        section.classList.toggle('open');
    });

    container.appendChild(section);
}

// Custom layout for Draft/Ullage (Light/Loaded/Simulated)
function renderCustomShipData(dataObj, overrideObj, parentDom, checkType, plantIdx) {
    // Render Simulated Draft
    const simKeys = Object.keys(dataObj).filter(k => k.toLowerCase().includes('sim-') || k.toLowerCase().includes('simulated'));
    if (simKeys.length > 0) {
        const wrap = document.createElement('div');
        // ... (styling omitted for brevity, but I should keep it)
        wrap.style.marginBottom = '20px';
        wrap.style.padding = '15px';
        wrap.style.backgroundColor = 'rgba(255,255,255,0.02)';
        wrap.style.borderRadius = '8px';
        wrap.style.border = '1px solid rgba(255,255,255,0.1)';

        ['fwd', 'aft'].forEach(pos => {
            const posKeys = simKeys.filter(k => k.toLowerCase().includes(pos));
            if (posKeys.length > 0) {
                const posWrap = document.createElement('div');
                posWrap.style.marginBottom = '15px';
                posWrap.innerHTML = `<h5 style="margin-bottom:8px; color:#aaa;">${pos === 'fwd' ? 'Forward' : 'Aft'} (Simulated)</h5>`;

                [1, 2, 3].forEach(num => {
                    const lineKeys = posKeys.filter(k => k.includes(`-${num}`));
                    if (lineKeys.length > 0) {
                        const lineGrid = document.createElement('div');
                        lineGrid.style.display = 'grid';
                        lineGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
                        lineGrid.style.gap = '15px';
                        lineGrid.style.marginBottom = '10px';

                        const sortOrder = ['depth', 'reading', 'diff'];
                        const sortFn = (a, b) => {
                            const aIdx = sortOrder.findIndex(o => a.toLowerCase().includes(o));
                            const bIdx = sortOrder.findIndex(o => b.toLowerCase().includes(o));
                            return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
                        };

                        lineKeys.sort(sortFn).forEach(k => {
                            buildSingleInput(k, dataObj[k], overrideObj[k], lineGrid, checkType, k, getSimShortLabel(k), plantIdx);
                        });
                        posWrap.appendChild(lineGrid);
                    }
                });
                wrap.appendChild(posWrap);
            }
        });

        parentDom.appendChild(wrap);
    }

    // Render Light or Loaded Draft/Ullage
    const condKeys = Object.keys(dataObj).filter(k => !k.toLowerCase().includes('sim-') && !k.toLowerCase().includes('remarks'));
    if (condKeys.length > 0) {
        const wrap = document.createElement('div');
        wrap.style.marginBottom = '20px';
        wrap.style.padding = '15px';
        wrap.style.backgroundColor = 'rgba(255,255,255,0.02)';
        wrap.style.borderRadius = '8px';
        wrap.style.border = '1px solid rgba(255,255,255,0.1)';

        const fwdKeys = condKeys.filter(k => k.toLowerCase().includes('fwd'));
        const aftKeys = condKeys.filter(k => k.toLowerCase().includes('aft'));
        const otherKeys = condKeys.filter(k => !k.toLowerCase().includes('fwd') && !k.toLowerCase().includes('aft'));

        // Define sort order: Port, Starboard, Avg, DQM, Diff
        const sortOrder = ['port', 'stbd', 'avg', 'dqm', 'diff'];
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
                buildSingleInput(k, dataObj[k], overrideObj[k], fwdGrid, checkType, k, getShortLabel(k), plantIdx);
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
                buildSingleInput(k, dataObj[k], overrideObj[k], aftGrid, checkType, k, getShortLabel(k), plantIdx);
            });
            aftWrap.appendChild(aftGrid);
            wrap.appendChild(aftWrap);
        }

        // Render Other
        if (otherKeys.length > 0) {
            const otherGrid = document.createElement('div');
            otherGrid.className = 'form-grid';
            otherKeys.forEach(k => buildSingleInput(k, dataObj[k], overrideObj[k], otherGrid, checkType, k, null, plantIdx));
            wrap.appendChild(otherGrid);
        }

        parentDom.appendChild(wrap);
    }

    // Render any keys that aren't specific to the layout above (like remarks, strings)
    const remainingKeys = Object.keys(dataObj).filter(k =>
        !k.toLowerCase().includes('fwd') &&
        !k.toLowerCase().includes('aft') &&
        !k.toLowerCase().includes('port') &&
        !k.toLowerCase().includes('stbd') &&
        !k.toLowerCase().includes('dqm') &&
        !k.toLowerCase().includes('sim-') &&
        !k.toLowerCase().includes('avg') &&
        !k.toLowerCase().includes('diff')
    );
    if (remainingKeys.length > 0) {
        const wrap = document.createElement('div');
        const grid = document.createElement('div');
        grid.className = 'form-grid';
        remainingKeys.forEach(k => buildSingleInput(k, dataObj[k], overrideObj[k], grid, checkType, k, null, plantIdx));
        wrap.appendChild(grid);
        parentDom.appendChild(wrap);
    }
}

function getShortLabel(prop) {
    const low = prop.toLowerCase();
    if (low.includes('port')) return 'Port';
    if (low.includes('stbd')) return 'Starboard';
    if (low.includes('avg')) return 'Average';
    if (low.includes('dqm')) return 'DQM System';
    if (low.includes('diff')) return 'Difference';
    return null;
}

function getSimShortLabel(prop) {
    const low = prop.toLowerCase();
    if (low.includes('depth')) return 'Depth';
    if (low.includes('reading')) return 'Reading';
    if (low.includes('diff')) return 'Difference';
    return null;
}

function getDragheadShortLabel(prop) {
    const low = prop.toLowerCase();
    if (low.includes('manual')) return 'Manual';
    if (low.includes('dqm')) return 'DQM System';
    if (low.includes('diff')) return 'Difference';
    return null;
}

// Custom layout for array-like table data (Draghead Port, Center, Stbd)
function renderCustomTableData(dataObj, overrideObj, parentDom, checkType, title, plantIdx) {
    const wrap = document.createElement('div');

    const dragheads = [
        { key: 'port', label: 'Port Draghead' },
        { key: 'center', label: 'Center Draghead' },
        { key: 'stbd', label: 'Starboard Draghead' }
    ];

    dragheads.forEach(dh => {
        const dhKeys = Object.keys(dataObj).filter(k => k.includes(`-${dh.key}-`));
        if (dhKeys.length > 0) {
            const dhWrap = document.createElement('div');
            dhWrap.style.marginBottom = '20px';
            dhWrap.innerHTML = `<h5 style="margin-bottom:8px; color:#aaa; font-size:13px; text-transform:uppercase; letter-spacing:0.5px;">${dh.label}</h5>`;

            [1, 2, 3].forEach(num => {
                const numKeys = dhKeys.filter(k => k.includes(`-${num}`));
                if (numKeys.length > 0) {
                    const lineGrid = document.createElement('div');
                    lineGrid.style.display = 'grid';
                    lineGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
                    lineGrid.style.gap = '15px';
                    lineGrid.style.marginBottom = '10px';

                    const sortOrder = ['manual', 'dqm', 'diff'];
                    const sortFn = (a, b) => {
                        const aIdx = sortOrder.findIndex(o => a.toLowerCase().includes(o));
                        const bIdx = sortOrder.findIndex(o => b.toLowerCase().includes(o));
                        return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
                    };

                    numKeys.sort(sortFn).forEach(k => {
                        buildSingleInput(k, dataObj[k], overrideObj[k], lineGrid, checkType, k, getDragheadShortLabel(k) + ` ${num}`, plantIdx);
                    });
                    dhWrap.appendChild(lineGrid);
                }
            });
            wrap.appendChild(dhWrap);
        }
    });

    const remainingKeys = Object.keys(dataObj).filter(k => !k.includes('-port-') && !k.includes('-center-') && !k.includes('-stbd-'));
    if (remainingKeys.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'form-grid';
        remainingKeys.forEach(k => buildSingleInput(k, dataObj[k], overrideObj[k], grid, checkType, k, null, plantIdx));
        wrap.appendChild(grid);
    }

    parentDom.appendChild(wrap);
}

function getVelocityShortLabel(prop) {
    const low = prop.toLowerCase();
    if (low.includes('time')) return 'Travel Time';
    if (low.includes('calc')) return 'Calc Velocity';
    if (low.includes('dqm')) return 'DQM Velocity';
    if (low.includes('diff')) return 'Difference';
    if (low.includes('manual')) return 'Meter Velocity';
    return null;
}

function renderVelocityData(dataObj, overrideObj, parentDom, checkType, plantIdx) {
    const wrap = document.createElement('div');

    // Top level info
    const topKeys = ['velocity-pipe-length', 'velocity-method', 'velocity-cal-date'];
    const topGrid = document.createElement('div');
    topGrid.className = 'form-grid';
    topGrid.style.marginBottom = '20px';
    topKeys.forEach(k => {
        if (dataObj[k] !== undefined) buildSingleInput(k, dataObj[k], overrideObj[k], topGrid, checkType, k, null, plantIdx);
    });
    if (topGrid.children.length > 0) wrap.appendChild(topGrid);

    // Tests (Dye or Meter)
    ['dye', 'meter'].forEach(method => {
        [1, 2, 3].forEach(num => {
            const numKeys = Object.keys(dataObj).filter(k => k.includes(`-${method}-`) && k.includes(`-${num}`));
            if (numKeys.length > 0) {
                const header = document.createElement('h5');
                header.style.marginBottom = '8px';
                header.style.color = '#aaa';
                header.style.fontSize = '12px';
                header.textContent = `${method === 'dye' ? 'Dye' : 'Meter'} Test ${num}`;
                wrap.appendChild(header);

                const lineGrid = document.createElement('div');
                lineGrid.style.display = 'grid';
                lineGrid.style.gridTemplateColumns = method === 'dye' ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)';
                lineGrid.style.gap = '15px';
                lineGrid.style.marginBottom = '15px';

                const sortOrder = method === 'dye' ? ['time', 'calc', 'dqm', 'diff'] : ['manual', 'dqm', 'diff'];
                const sortFn = (a, b) => {
                    const aIdx = sortOrder.findIndex(o => a.toLowerCase().includes(o));
                    const bIdx = sortOrder.findIndex(o => b.toLowerCase().includes(o));
                    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
                };

                numKeys.sort(sortFn).forEach(k => {
                    buildSingleInput(k, dataObj[k], overrideObj[k], lineGrid, checkType, k, getVelocityShortLabel(k), plantIdx);
                });
                wrap.appendChild(lineGrid);
            }
        });
    });

    const remainingKeys = Object.keys(dataObj).filter(k => !topKeys.includes(k) && !k.includes('-dye-') && !k.includes('-meter-'));
    if (remainingKeys.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'form-grid';
        remainingKeys.forEach(k => buildSingleInput(k, dataObj[k], overrideObj[k], grid, checkType, k, null, plantIdx));
        wrap.appendChild(grid);
    }

    parentDom.appendChild(wrap);
}

// Generic recursive builder
function buildInputs(dataObj, overrideObj, parentGrid, checkType, path, plantIdx) {
    for (const [key, value] of Object.entries(dataObj)) {
        const currentPath = path ? `${path}.${key}` : key;

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const sectionWrap = document.createElement('div');
            // ... (styling)
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

            buildInputs(value, overrideObj[key] || {}, nestedGrid, checkType, currentPath, plantIdx);
            sectionWrap.appendChild(nestedGrid);
            parentGrid.appendChild(sectionWrap);
        } else {
            buildSingleInput(currentPath, value, overrideObj[key], parentGrid, checkType, currentPath, null, plantIdx);
        }
    }
}

// Builds one input group
function buildSingleInput(displayPath, originalValue, overrideValue, parentGrid, checkType, savePath, customLabel, plantIdx) {
    const displayLabel = customLabel || formatLabel(displayPath.split('.').pop());

    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.textContent = displayLabel;

    let currentValue = originalValue;
    if (overrideValue !== undefined) {
        currentValue = overrideValue;
    }

    // Feature: If the field is a photo, render a file input and image preview
    if (savePath.toLowerCase().includes('photo')) {
        const photoContainer = document.createElement('div');
        // ... (as before, but update saveOverride call)
        photoContainer.style.display = 'flex';
        photoContainer.style.flexDirection = 'column';
        photoContainer.style.gap = '10px';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.padding = '5px 0';
        fileInput.style.backgroundColor = 'transparent';
        fileInput.style.border = 'none';

        const preview = document.createElement('img');
        preview.style.maxWidth = '100%';
        preview.style.maxHeight = '200px';
        preview.style.objectFit = 'contain';
        preview.style.borderRadius = '4px';
        preview.style.border = '1px solid #444';
        preview.style.backgroundColor = '#111';

        const hasImage = typeof currentValue === 'string' && currentValue.startsWith('data:image/');
        preview.style.display = hasImage ? 'block' : 'none';
        preview.src = hasImage ? currentValue : '';

        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear Photo';
        clearBtn.className = 'btn';
        clearBtn.style.alignSelf = 'flex-start';
        clearBtn.style.padding = '4px 8px';
        clearBtn.style.fontSize = '12px';
        clearBtn.style.display = hasImage ? 'block' : 'none';

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const dataUrl = ev.target.result;
                    preview.src = dataUrl;
                    preview.style.display = 'block';
                    clearBtn.style.display = 'block';
                    saveOverride(checkType, savePath, dataUrl, plantIdx);
                };
                reader.readAsDataURL(file);
            }
        });

        clearBtn.onclick = () => {
            fileInput.value = '';
            preview.src = '';
            preview.style.display = 'none';
            clearBtn.style.display = 'none';
            saveOverride(checkType, savePath, '', plantIdx);
        };

        photoContainer.appendChild(fileInput);
        photoContainer.appendChild(preview);
        photoContainer.appendChild(clearBtn);

        group.appendChild(label);
        group.appendChild(photoContainer);

    } else {
        // Standard Text/Number Input
        const input = document.createElement('input');
        input.type = typeof originalValue === 'number' ? 'number' : 'text';

        if (input.type === 'number') {
            input.step = 'any';
        }

        input.value = currentValue !== null && currentValue !== undefined ? currentValue : '';

        input.addEventListener('input', (e) => {
            let newVal = e.target.value;
            if (input.type === 'number') {
                newVal = newVal === '' ? '' : Number(newVal);
            }
            saveOverride(checkType, savePath, newVal, plantIdx);
        });

        group.appendChild(label);
        group.appendChild(input);
    }

    parentGrid.appendChild(group);
}

function formatLabel(prop) {
    const result = prop.replace(/([A-Z])/g, " $1");
    return result.charAt(0).toUpperCase() + result.slice(1);
}

function saveOverride(checkType, pathStr, value, plantIdx = null) {
    if (!window.appState.overrides) {
        window.appState.overrides = {};
    }

    let root = window.appState.overrides;
    if (plantIdx !== null) {
        if (!root[plantIdx]) root[plantIdx] = {};
        root = root[plantIdx];
    }

    if (!root[checkType]) {
        root[checkType] = {};
    }

    const parts = pathStr.split('.');
    let current = root[checkType];

    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) current[part] = {};
        current = current[part];
    }

    current[parts[parts.length - 1]] = value;
    window.saveDraft();
}

function renderTimelineEditor(parentDom) {
    if (!window.appState.timeline) {
        window.appState.timeline = [];
    }

    let section = document.getElementById('timeline-editor-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'timeline-editor-section';
        section.className = 'editor-section mb-4';
        parentDom.appendChild(section);
    }

    section.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'editor-section-header';
    header.style.backgroundColor = '#2c3e50';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.padding = '10px 15px';
    header.innerHTML = `<span style="font-weight: 600; letter-spacing: 0.5px;">TRIP TIMELINE</span>`;

    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '8px';

    const sortBtn = document.createElement('button');
    sortBtn.className = 'btn-secondary';
    sortBtn.style.padding = '5px 12px';
    sortBtn.style.fontSize = '12px';
    sortBtn.style.borderRadius = '4px';
    sortBtn.textContent = '⇅ SORT';
    sortBtn.title = 'Sort entries chronologically';
    sortBtn.onclick = (e) => {
        e.stopPropagation();
        window.appState.timeline.sort((a, b) => {
            const timeA = (a.time || '').trim();
            const timeB = (b.time || '').trim();
            return timeA.localeCompare(timeB);
        });
        renderTimelineEditor(parentDom);
        if (typeof window.updatePreview === 'function') window.updatePreview();
    };

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-primary';
    addBtn.style.padding = '5px 12px';
    addBtn.style.fontSize = '12px';
    addBtn.style.borderRadius = '4px';
    addBtn.textContent = '+ ADD ENTRY';
    addBtn.onclick = (e) => {
        e.stopPropagation();
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;
        window.appState.timeline.push({ time: timeStr, activity: '', details: '' });
        renderTimelineEditor(parentDom);
        if (typeof window.updatePreview === 'function') window.updatePreview();
    };

    btnGroup.appendChild(sortBtn);
    btnGroup.appendChild(addBtn);
    header.appendChild(btnGroup);

    const body = document.createElement('div');
    body.className = 'editor-section-body';
    body.style.padding = '0'; // Clean table look
    body.style.display = 'block';

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '13px';

    // Table Header
    const thead = document.createElement('thead');
    thead.style.backgroundColor = 'rgba(255,255,255,0.05)';
    thead.innerHTML = `
        <tr>
            <th id="timeline-time-header" style="padding: 10px; text-align: left; width: 100px; border-bottom: 1px solid var(--border); cursor: pointer;" title="Click to sort chronologically">TIME ⇅</th>
            <th style="padding: 10px; text-align: left; border-bottom: 1px solid var(--border);">ACTIVITY</th>
            <th style="padding: 10px; text-align: left; border-bottom: 1px solid var(--border);">DETAILS</th>
            <th style="padding: 10px; text-align: center; width: 50px; border-bottom: 1px solid var(--border);"></th>
        </tr>
    `;
    table.appendChild(thead);

    thead.querySelector('#timeline-time-header').onclick = () => {
        window.appState.timeline.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        renderTimelineEditor(parentDom);
        if (typeof window.updatePreview === 'function') window.updatePreview();
    };

    const tbody = document.createElement('tbody');
    window.appState.timeline.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';

        // Time Cell
        const tdTime = document.createElement('td');
        tdTime.style.padding = '8px 10px';
        const invTime = document.createElement('input');
        invTime.type = 'text';
        invTime.value = item.time || '';
        invTime.style.width = '100%';
        invTime.style.background = 'transparent';
        invTime.style.border = 'none';
        invTime.style.color = 'var(--text-main)';
        invTime.style.fontSize = 'inherit';
        invTime.oninput = (e) => {
            window.appState.timeline[index].time = e.target.value;
            if (typeof window.updatePreview === 'function') window.updatePreview();
        };
        tdTime.appendChild(invTime);

        // Activity Cell
        const tdAct = document.createElement('td');
        tdAct.style.padding = '8px 10px';
        const invAct = document.createElement('input');
        invAct.type = 'text';
        invAct.value = item.activity || '';
        invAct.style.width = '100%';
        invAct.style.background = 'transparent';
        invAct.style.border = 'none';
        invAct.style.color = 'var(--text-main)';
        invAct.style.fontSize = 'inherit';
        invAct.oninput = (e) => {
            window.appState.timeline[index].activity = e.target.value;
            if (typeof window.updatePreview === 'function') window.updatePreview();
        };
        tdAct.appendChild(invAct);

        // Details Cell
        const tdDet = document.createElement('td');
        tdDet.style.padding = '8px 10px';
        const invDet = document.createElement('input');
        invDet.type = 'text';
        invDet.value = item.details || item.notes || '';
        invDet.style.width = '100%';
        invDet.style.background = 'transparent';
        invDet.style.border = 'none';
        invDet.style.color = 'var(--text-main)';
        invDet.style.fontSize = 'inherit';
        invDet.oninput = (e) => {
            window.appState.timeline[index].details = e.target.value;
            if (typeof window.updatePreview === 'function') window.updatePreview();
        };
        tdDet.appendChild(invDet);

        // Action Cell
        const tdAction = document.createElement('td');
        tdAction.style.padding = '8px 10px';
        tdAction.style.textAlign = 'center';
        const delBtn = document.createElement('button');
        delBtn.innerHTML = '🗑️';
        delBtn.style.background = 'transparent';
        delBtn.style.border = 'none';
        delBtn.style.cursor = 'pointer';
        delBtn.style.opacity = '0.5';
        delBtn.style.transition = 'opacity 0.2s';
        delBtn.onmouseover = () => delBtn.style.opacity = '1';
        delBtn.onmouseout = () => delBtn.style.opacity = '0.5';
        delBtn.onclick = () => {
            if (confirm('Remove this timeline entry?')) {
                window.appState.timeline.splice(index, 1);
                renderTimelineEditor(parentDom);
                if (typeof window.updatePreview === 'function') window.updatePreview();
            }
        };
        tdAction.appendChild(delBtn);

        tr.appendChild(tdTime);
        tr.appendChild(tdAct);
        tr.appendChild(tdDet);
        tr.appendChild(tdAction);
        tbody.appendChild(tr);
    });

    if (window.appState.timeline.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" style="padding: 30px; text-align: center; color: var(--text-muted); font-style: italic;">No timeline entries recorded.</td>`;
        tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    body.appendChild(table);
    section.appendChild(header);
    section.appendChild(body);
}
