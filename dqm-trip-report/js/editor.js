// editor.js
// Renders the editable QA check fields from the loaded JSON

const checkLabels = {
    'positionCheck': 'Position Check',
    'hullStatus': 'Hull Status',
    'draftSensorLight': 'Draft Sensor (Light)',
    'draftSensorLoaded': 'Draft Sensor (Loaded)',
    'draftSensorSimulated': 'Draft Sensor (Simulated)',
    'ullageLight': 'Ullage (Light)',
    'ullageLoaded': 'Ullage (Loaded)',
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

    // Render Timeline Editor First
    renderTimelineEditor(container);

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
        if (checkType.startsWith('draftSensor') || checkType.startsWith('ullage')) {
            renderCustomShipData(data, overrides[checkType] || {}, body, checkType);
        } else if (checkType === 'dragheadDepth') {
            renderCustomTableData(data, overrides[checkType] || {}, body, checkType, 'Draghead Depth');
        } else if (checkType === 'velocity') {
            renderVelocityData(data, overrides[checkType] || {}, body, checkType);
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

// Custom layout for Draft/Ullage (Light/Loaded/Simulated)
function renderCustomShipData(dataObj, overrideObj, parentDom, checkType) {
    // Render Simulated Draft
    const simKeys = Object.keys(dataObj).filter(k => k.toLowerCase().includes('sim-') || k.toLowerCase().includes('simulated'));
    if (simKeys.length > 0) {
        const wrap = document.createElement('div');
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
                            buildSingleInput(k, dataObj[k], overrideObj[k], lineGrid, checkType, k, getSimShortLabel(k));
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
        remainingKeys.forEach(k => buildSingleInput(k, dataObj[k], overrideObj[k], grid, checkType, k));
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
function renderCustomTableData(dataObj, overrideObj, parentDom, checkType, title) {
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
                        buildSingleInput(k, dataObj[k], overrideObj[k], lineGrid, checkType, k, getDragheadShortLabel(k) + ` ${num}`);
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
        remainingKeys.forEach(k => buildSingleInput(k, dataObj[k], overrideObj[k], grid, checkType, k));
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

function renderVelocityData(dataObj, overrideObj, parentDom, checkType) {
    const wrap = document.createElement('div');

    // Top level info
    const topKeys = ['velocity-pipe-length', 'velocity-method', 'velocity-cal-date'];
    const topGrid = document.createElement('div');
    topGrid.className = 'form-grid';
    topGrid.style.marginBottom = '20px';
    topKeys.forEach(k => {
        if (dataObj[k] !== undefined) buildSingleInput(k, dataObj[k], overrideObj[k], topGrid, checkType, k);
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
                    buildSingleInput(k, dataObj[k], overrideObj[k], lineGrid, checkType, k, getVelocityShortLabel(k));
                });
                wrap.appendChild(lineGrid);
            }
        });
    });

    const remainingKeys = Object.keys(dataObj).filter(k => !topKeys.includes(k) && !k.includes('-dye-') && !k.includes('-meter-'));
    if (remainingKeys.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'form-grid';
        remainingKeys.forEach(k => buildSingleInput(k, dataObj[k], overrideObj[k], grid, checkType, k));
        wrap.appendChild(grid);
    }

    parentDom.appendChild(wrap);
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

    let currentValue = originalValue;
    if (overrideValue !== undefined) {
        currentValue = overrideValue;
    }

    // Feature: If the field is a photo, render a file input and image preview
    if (savePath.toLowerCase().includes('photo')) {
        const photoContainer = document.createElement('div');
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
                    saveOverride(checkType, savePath, dataUrl);
                };
                reader.readAsDataURL(file);
            }
        });

        clearBtn.onclick = () => {
            fileInput.value = '';
            preview.src = '';
            preview.style.display = 'none';
            clearBtn.style.display = 'none';
            saveOverride(checkType, savePath, '');
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
            saveOverride(checkType, savePath, newVal);
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

function renderTimelineEditor(parentDom) {
    if (!window.appState.timeline) {
        window.appState.timeline = [];
    }

    let section = document.getElementById('timeline-editor-section');
    if (!section) {
        section = document.createElement('div');
        section.id = 'timeline-editor-section';
        section.className = 'editor-section';
        parentDom.appendChild(section);
    }

    // Clear out existing content to allow clean re-rendering
    section.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'editor-section-header';
    header.style.backgroundColor = '#2c3e50';
    header.textContent = 'Trip Timeline';

    const body = document.createElement('div');
    body.className = 'editor-section-body';
    // If the section already existed, it should default to open to prevent jarring UX during active editing
    body.style.display = 'block';

    header.addEventListener('click', () => {
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? 'block' : 'none';
        header.classList.toggle('active', isHidden);
    });

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '15px';

    window.appState.timeline.forEach((item, index) => {
        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '100px 1fr 2fr 40px';
        row.style.gap = '10px';
        row.style.alignItems = 'start';
        row.style.padding = '10px';
        row.style.backgroundColor = 'rgba(255,255,255,0.02)';
        row.style.border = '1px solid rgba(255,255,255,0.05)';
        row.style.borderRadius = '4px';

        const timeWrap = document.createElement('div');
        timeWrap.innerHTML = `<label style="display:block;margin-bottom:5px;font-size:11px;color:#aaa;">Time</label>`;
        const timeInput = document.createElement('input');
        timeInput.type = 'time';

        // Convert "5:12 PM" -> "17:12" for <input type="time">
        function parseTimeToInputFormat(timeStr) {
            if (!timeStr) return '';
            const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (!match) return timeStr; // Fallback if already HH:MM or unknown format
            let [, h, m, modifier] = match;
            let hours = parseInt(h, 10);
            if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
            if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
            return `${hours.toString().padStart(2, '0')}:${m}`;
        }

        function formatTimeFromInput(val24) {
            if (!val24) return '';
            const [h, m] = val24.split(':');
            let hours = parseInt(h, 10);
            const modifier = hours >= 12 ? 'PM' : 'AM';
            if (hours > 12) hours -= 12;
            if (hours === 0) hours = 12;
            return `${hours}:${m} ${modifier}`;
        }

        timeInput.value = parseTimeToInputFormat(item.time);
        timeInput.addEventListener('input', (e) => {
            window.appState.timeline[index].time = formatTimeFromInput(e.target.value);
            window.updatePreview();
        });
        timeWrap.appendChild(timeInput);

        const actWrap = document.createElement('div');
        actWrap.innerHTML = `<label style="display:block;margin-bottom:5px;font-size:11px;color:#aaa;">Activity</label>`;
        const actInput = document.createElement('input');
        actInput.type = 'text';
        actInput.value = item.activity || '';
        actInput.addEventListener('input', (e) => {
            window.appState.timeline[index].activity = e.target.value;
            window.updatePreview();
        });
        actWrap.appendChild(actInput);

        const notesWrap = document.createElement('div');
        notesWrap.innerHTML = `<label style="display:block;margin-bottom:5px;font-size:11px;color:#aaa;">Notes</label>`;
        const notesInput = document.createElement('textarea');
        notesInput.rows = 2;
        notesInput.value = item.notes || '';
        notesInput.addEventListener('input', (e) => {
            window.appState.timeline[index].notes = e.target.value;
            window.updatePreview();
        });
        notesWrap.appendChild(notesInput);

        const delBtnWrap = document.createElement('div');
        delBtnWrap.innerHTML = `<label style="display:block;margin-bottom:5px;font-size:11px;color:transparent;">Del</label>`;
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.innerHTML = '🗑️';
        delBtn.className = 'btn btn-danger';
        delBtn.style.padding = '8px';
        delBtn.style.width = '100%';
        delBtn.onclick = () => {
            if (confirm('Remove this timeline entry?')) {
                window.appState.timeline.splice(index, 1);
                window.updatePreview();
                renderTimelineEditor(parentDom);
            }
        };
        delBtnWrap.appendChild(delBtn);

        row.appendChild(timeWrap);
        row.appendChild(actWrap);
        row.appendChild(notesWrap);
        row.appendChild(delBtnWrap);
        wrap.appendChild(row);
    });

    const addBtnWrap = document.createElement('div');
    addBtnWrap.style.marginTop = '15px';
    addBtnWrap.style.textAlign = 'center';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn-secondary';
    addBtn.textContent = '+ Add Timeline Entry';
    addBtn.onclick = () => {
        window.appState.timeline.push({ time: '', activity: '', notes: '' });
        window.updatePreview();
        renderTimelineEditor(parentDom);
    };
    addBtnWrap.appendChild(addBtn);
    wrap.appendChild(addBtnWrap);

    body.appendChild(wrap);
    section.appendChild(header);
    section.appendChild(body);
}
