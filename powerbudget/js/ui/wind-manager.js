// Wind Generator Manager UI

class WindManager {
    constructor(containerId, config) {
        this.container = document.getElementById(containerId);
        this.config = config;
        this.noaaAPI = new NOAAWeatherAPI();
        this.generatorSpecs = null;
        this.init();
    }

    async init() {
        await this.loadGeneratorSpecs();
        this.render();
    }

    async loadGeneratorSpecs() {
        try {
            const response = await fetch('data/wind-generators.json');
            this.generatorSpecs = await response.json();
        } catch (error) {
            console.error('Error loading wind generator specs:', error);
            this.generatorSpecs = { generators: [] };
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="section-header">
                <h2>Wind Generators</h2>
                <button class="btn btn-primary" onclick="windManager.addGenerator()">
                    <span class="icon">+</span> Add Wind Generator
                </button>
            </div>

            <div class="wind-data-section">
                <h3>Wind Data</h3>
                <div class="wind-data-controls">
                    <button class="btn btn-secondary" onclick="windManager.fetchWindData()">
                        <span class="icon">💨</span> Fetch Wind Data (Estimates)
                    </button>
                    <button class="btn btn-secondary" onclick="windManager.showManualInput()">
                        <span class="icon">✏️</span> Enter Manual Data
                    </button>
                </div>
                ${this.renderWindDataStatus()}
                <div id="manual-input-section" style="display: none;">
                    ${this.renderManualInputForm()}
                </div>
            </div>

            <div id="generators-list" class="items-list">
                ${this.renderGenerators()}
            </div>

            <div class="summary-box">
                <h3>Wind System Summary</h3>
                <div class="summary-grid">
                    <div class="summary-item">
                        <span class="summary-label">Total Rated Power:</span>
                        <span class="summary-value">${this.getTotalRatedPower()} W</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Number of Generators:</span>
                        <span class="summary-value">${this.config.windGenerators.length}</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderWindDataStatus() {
        if (!this.config.windData) {
            return `<div class="info-message">Wind data not loaded. Click "Fetch Wind Data" to get estimates or enter manual data.</div>`;
        }

        const avgSpeed = this.config.windData.monthlyData.reduce((sum, m) => sum + m.avgWindSpeed, 0) / 12;
        return `
            <div class="success-message">
                Wind data loaded from ${this.config.windData.source}<br>
                Average wind speed: ${avgSpeed.toFixed(2)} m/s
            </div>
        `;
    }

    renderManualInputForm() {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const defaultSpeeds = this.config.windData ?
            this.config.windData.monthlyData.map(m => m.avgWindSpeed) :
            Array(12).fill(6.0);

        return `
            <div class="manual-input-form">
                <h4>Monthly Average Wind Speeds (m/s)</h4>
                <div class="monthly-grid">
                    ${months.map((month, i) => `
                        <div class="input-group">
                            <label>${month}</label>
                            <input type="number" 
                                   id="wind-month-${i}" 
                                   value="${defaultSpeeds[i].toFixed(1)}" 
                                   min="0" max="50" step="0.1">
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-primary" onclick="windManager.saveManualData()">
                    Save Wind Data
                </button>
            </div>
        `;
    }

    renderGenerators() {
        if (this.config.windGenerators.length === 0) {
            return '<div class="empty-state">No wind generators added. Click "Add Wind Generator" to get started.</div>';
        }

        return this.config.windGenerators.map((gen, index) => `
            <div class="item-card" data-id="${gen.id}">
                <div class="item-header">
                    <h3>Wind Generator ${index + 1}</h3>
                    <button class="btn-icon btn-delete" onclick="windManager.deleteGenerator('${gen.id}')" title="Delete">
                        <span>×</span>
                    </button>
                </div>
                <div class="generator-select">
                    <label>Generator Model:</label>
                    <select onchange="windManager.selectGeneratorModel('${gen.id}', this.value)">
                        <option value="">Custom</option>
                        ${this.renderGeneratorOptions(gen.name)}
                    </select>
                </div>
                <div class="item-grid">
                    <div class="input-group">
                        <label>Name</label>
                        <input type="text" 
                               value="${gen.name}" 
                               onchange="windManager.updateGenerator('${gen.id}', 'name', this.value)">
                    </div>
                    <div class="input-group">
                        <label>Rated Power (W)</label>
                        <input type="number" 
                               value="${gen.ratedPower}" 
                               onchange="windManager.updateGenerator('${gen.id}', 'ratedPower', this.value)"
                               min="0" step="1">
                    </div>
                    <div class="input-group">
                        <label>Cut-in Speed (m/s)</label>
                        <input type="number" 
                               value="${gen.cutInSpeed}" 
                               onchange="windManager.updateGenerator('${gen.id}', 'cutInSpeed', this.value)"
                               min="0" max="10" step="0.1">
                    </div>
                    <div class="input-group">
                        <label>Rated Speed (m/s)</label>
                        <input type="number" 
                               value="${gen.ratedSpeed}" 
                               onchange="windManager.updateGenerator('${gen.id}', 'ratedSpeed', this.value)"
                               min="0" max="30" step="0.1">
                    </div>
                    <div class="input-group">
                        <label>Cut-out Speed (m/s)</label>
                        <input type="number" 
                               value="${gen.cutOutSpeed}" 
                               onchange="windManager.updateGenerator('${gen.id}', 'cutOutSpeed', this.value)"
                               min="0" max="50" step="0.1">
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderGeneratorOptions(currentName) {
        if (!this.generatorSpecs || !this.generatorSpecs.generators) return '';

        return this.generatorSpecs.generators.map(spec =>
            `<option value='${JSON.stringify(spec).replace(/'/g, '&apos;')}' ${spec.name === currentName ? 'selected' : ''}>
                ${spec.name} (${spec.ratedPower}W)
            </option>`
        ).join('');
    }

    addGenerator() {
        const generator = new WindGenerator('Custom', 400);
        this.config.windGenerators.push(generator);
        this.render();
    }

    selectGeneratorModel(id, value) {
        if (!value) return;

        try {
            const spec = JSON.parse(value);
            const generator = this.config.windGenerators.find(g => g.id === id);
            if (generator) {
                generator.name = spec.name;
                generator.ratedPower = spec.ratedPower;
                generator.cutInSpeed = spec.cutInSpeed;
                generator.ratedSpeed = spec.ratedSpeed;
                generator.cutOutSpeed = spec.cutOutSpeed;
                generator.powerCurve = spec.powerCurve;
                this.render();
                if (window.resultsManager) {
                    window.resultsManager.calculate();
                }
            }
        } catch (error) {
            console.error('Error parsing generator spec:', error);
        }
    }

    updateGenerator(id, field, value) {
        const generator = this.config.windGenerators.find(g => g.id === id);
        if (generator) {
            generator[field] = field === 'name' ? value : parseFloat(value);
            if (field !== 'name') {
                // Reset power curve to default when parameters change
                generator.powerCurve = generator.getDefaultPowerCurve();
            }
            this.render();
            if (window.resultsManager) {
                window.resultsManager.calculate();
            }
        }
    }

    deleteGenerator(id) {
        const index = this.config.windGenerators.findIndex(g => g.id === id);
        if (index > -1) {
            this.config.windGenerators.splice(index, 1);
            this.render();
            if (window.resultsManager) {
                window.resultsManager.calculate();
            }
        }
    }

    async fetchWindData() {
        const btn = event.target;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner">⏳</span> Fetching...';
        btn.disabled = true;

        try {
            const data = await this.noaaAPI.fetchWithFallback(
                this.config.location.latitude,
                this.config.location.longitude,
                'offshore'
            );
            this.config.windData = data;
            this.render();
            if (window.resultsManager) {
                window.resultsManager.calculate();
            }
            alert('Wind data estimates generated. Consider entering manual data for better accuracy.');
        } catch (error) {
            alert('Error fetching wind data: ' + error.message);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    showManualInput() {
        const section = document.getElementById('manual-input-section');
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
    }

    saveManualData() {
        const speeds = [];
        for (let i = 0; i < 12; i++) {
            const input = document.getElementById(`wind-month-${i}`);
            speeds.push(parseFloat(input.value) || 0);
        }

        this.config.windData = this.noaaAPI.createManualWindData(
            this.config.location.latitude,
            this.config.location.longitude,
            speeds
        );

        this.render();
        if (window.resultsManager) {
            window.resultsManager.calculate();
        }
        alert('Manual wind data saved successfully!');
    }

    getTotalRatedPower() {
        return this.config.windGenerators.reduce((sum, gen) => sum + gen.ratedPower, 0);
    }
}
