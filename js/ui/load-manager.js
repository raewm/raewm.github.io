// Load Manager UI

class LoadManager {
    constructor(containerId, config) {
        this.container = document.getElementById(containerId);
        this.config = config;
        this.templates = null;
        this.init();
    }

    async init() {
        await this.loadTemplates();
        this.render();
    }

    async loadTemplates() {
        try {
            const response = await fetch('data/equipment-templates.json');
            this.templates = await response.json();
        } catch (error) {
            console.error('Error loading equipment templates:', error);
            this.templates = { categories: {} };
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="section-header">
                <h2>Equipment Loads</h2>
                <button class="btn btn-primary" onclick="loadManager.addLoad()">
                    <span class="icon">+</span> Add Equipment
                </button>
            </div>
            
            <div class="load-controls">
                <label>Load from template:</label>
                <select id="template-select" onchange="loadManager.selectTemplate(this.value)">
                    <option value="">-- Select Equipment Template --</option>
                    ${this.renderTemplateOptions()}
                </select>
            </div>

            <div id="loads-list" class="items-list">
                ${this.renderLoads()}
            </div>

            <div class="summary-box">
                <h3>Load Summary</h3>
                <div class="summary-grid">
                    <div class="summary-item">
                        <span class="summary-label">Average Power:</span>
                        <span class="summary-value">${this.getTotalAveragePower().toFixed(1)} W</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Daily Energy:</span>
                        <span class="summary-value">${this.getTotalDailyEnergy().toFixed(0)} Wh</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderTemplateOptions() {
        if (!this.templates || !this.templates.categories) return '';

        let html = '';
        for (const [category, items] of Object.entries(this.templates.categories)) {
            html += `<optgroup label="${category.toUpperCase()}">`;
            items.forEach((item, index) => {
                const value = JSON.stringify(item);
                html += `<option value='${value.replace(/'/g, '&apos;')}'>${item.name}</option>`;
            });
            html += `</optgroup>`;
        }
        return html;
    }

    renderLoads() {
        if (this.config.loads.length === 0) {
            return '<div class="empty-state">No equipment added. Click "Add Equipment" or select a template to get started.</div>';
        }

        return this.config.loads.map(load => `
            <div class="item-card" data-id="${load.id}">
                <div class="item-header">
                    <input type="text" 
                           class="item-name" 
                           value="${load.name}" 
                           onchange="loadManager.updateLoad('${load.id}', 'name', this.value)"
                           placeholder="Equipment name">
                    <button class="btn-icon btn-delete" onclick="loadManager.deleteLoad('${load.id}')" title="Delete">
                        <span>×</span>
                    </button>
                </div>
                <div class="item-grid">
                    <div class="input-group">
                        <label>Power ON (W)</label>
                        <input type="number" 
                               value="${load.powerOn}" 
                               onchange="loadManager.updateLoad('${load.id}', 'powerOn', this.value)"
                               min="0" step="0.1">
                    </div>
                    <div class="input-group">
                        <label>Power IDLE (W)</label>
                        <input type="number" 
                               value="${load.powerIdle}" 
                               onchange="loadManager.updateLoad('${load.id}', 'powerIdle', this.value)"
                               min="0" step="0.1">
                    </div>
                    <div class="input-group">
                        <label>Duty Cycle (%)</label>
                        <input type="number" 
                               value="${load.dutyCycle}" 
                               onchange="loadManager.updateLoad('${load.id}', 'dutyCycle', this.value)"
                               min="0" max="100" step="1">
                    </div>
                    <div class="input-group result">
                        <label>Avg Power</label>
                        <input type="text" value="${load.getAveragePower().toFixed(2)} W" readonly class="result-value">
                    </div>
                </div>
            </div>
        `).join('');
    }

    addLoad(template = null) {
        let load;
        if (template) {
            load = new Load(template.name, template.powerOn, template.powerIdle, template.dutyCycle);
        } else {
            load = new Load('New Equipment', 0, 0, 100);
        }
        this.config.loads.push(load);
        this.render();
    }

    selectTemplate(value) {
        if (!value) return;
        try {
            const template = JSON.parse(value);
            this.addLoad(template);
            document.getElementById('template-select').value = '';
        } catch (error) {
            console.error('Error parsing template:', error);
        }
    }

    updateLoad(id, field, value) {
        const load = this.config.loads.find(l => l.id === id);
        if (load) {
            load[field] = field === 'name' ? value : parseFloat(value);
            this.render();
            if (window.resultsManager) {
                window.resultsManager.calculate();
            }
        }
    }

    deleteLoad(id) {
        const index = this.config.loads.findIndex(l => l.id === id);
        if (index > -1) {
            this.config.loads.splice(index, 1);
            this.render();
            if (window.resultsManager) {
                window.resultsManager.calculate();
            }
        }
    }

    getTotalAveragePower() {
        return this.config.loads.reduce((sum, load) => sum + load.getAveragePower(), 0);
    }

    getTotalDailyEnergy() {
        return this.config.loads.reduce((sum, load) => sum + load.getDailyEnergy(), 0);
    }
}
