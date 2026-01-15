// Solar Panel Manager UI

class SolarManager {
    constructor(containerId, config) {
        this.container = document.getElementById(containerId);
        this.config = config;
        this.nasaAPI = new NASAPowerAPI();
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="section-header">
                <h2>Solar Panels</h2>
                <button class="btn btn-primary" onclick="solarManager.addPanel()">
                    <span class="icon">+</span> Add Solar Panel
                </button>
            </div>

            <div class="location-section">
                <h3>Site Location</h3>
                <div class="location-grid">
                    <div class="input-group">
                        <label>Location Name</label>
                        <input type="text" 
                               value="${this.config.location.name}" 
                               onchange="solarManager.updateLocation('name', this.value)">
                    </div>
                    <div class="input-group">
                        <label>Latitude (°)</label>
                        <input type="number" 
                               value="${this.config.location.latitude}" 
                               onchange="solarManager.updateLocation('latitude', this.value)"
                               min="-90" max="90" step="0.0001">
                    </div>
                    <div class="input-group">
                        <label>Longitude (°)</label>
                        <input type="number" 
                               value="${this.config.location.longitude}" 
                               onchange="solarManager.updateLocation('longitude', this.value)"
                               min="-180" max="180" step="0.0001">
                    </div>
                    <div class="input-group">
                        <button class="btn btn-secondary" onclick="solarManager.fetchSolarData()">
                            <span class="icon">☀</span> Fetch Solar Data
                        </button>
                    </div>
                </div>
                ${this.renderSolarDataStatus()}
            </div>

            <div id="panels-list" class="items-list">
                ${this.renderPanels()}
            </div>

            <div class="summary-box">
                <h3>Solar System Summary</h3>
                <div class="summary-grid">
                    <div class="summary-item">
                        <span class="summary-label">Total Panel Power:</span>
                        <
span class="summary-value">${this.getTotalPanelPower()} W</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Number of Panels:</span>
                        <span class="summary-value">${this.config.solarPanels.length}</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderSolarDataStatus() {
        if (!this.config.solarData) {
            return `<div class="info-message">Click "Fetch Solar Data" to retrieve solar radiation data for this location.</div>`;
        }

        const avgGHI = this.config.solarData.monthlyData.reduce((sum, m) => sum + m.ghi, 0) / 12;
        return `
            <div class="success-message">
                Solar data loaded from ${this.config.solarData.source}<br>
                Average GHI: ${avgGHI.toFixed(2)} kWh/m²/day
            </div>
        `;
    }

    renderPanels() {
        if (this.config.solarPanels.length === 0) {
            return '<div class="empty-state">No solar panels added. Click "Add Solar Panel" to get started.</div>';
        }

        return this.config.solarPanels.map((panel, index) => `
            <div class="item-card" data-id="${panel.id}">
                <div class="item-header">
                    <h3>Solar Panel ${index + 1}</h3>
                    <button class="btn-icon btn-delete" onclick="solarManager.deletePanel('${panel.id}')" title="Delete">
                        <span>×</span>
                    </button>
                </div>
                <div class="item-grid">
                    <div class="input-group">
                        <label>Power Rating (W)</label>
                        <input type="number" 
                               value="${panel.powerRating}" 
                               onchange="solarManager.updatePanel('${panel.id}', 'powerRating', this.value)"
                               min="0" step="1">
                    </div>
                    <div class="input-group">
                        <label>Tilt Angle (°)</label>
                        <input type="number" 
                               value="${panel.tiltAngle}" 
                               onchange="solarManager.updatePanel('${panel.id}', 'tiltAngle', this.value)"
                               min="0" max="90" step="1"
                               title="Angle from horizontal (0° = flat, 90° = vertical)">
                    </div>
                    <div class="input-group">
                        <label>Azimuth (°)</label>
                        <input type="number" 
                               value="${panel.azimuth}" 
                               onchange="solarManager.updatePanel('${panel.id}', 'azimuth', this.value)"
                               min="0" max="359" step="1"
                               title="Orientation (0°=North, 90°=East, 180°=South, 270°=West)">
                    </div>
                    <div class="input-group">
                        <label>Efficiency (%)</label>
                        <input type="number" 
                               value="${panel.efficiency}" 
                               onchange="solarManager.updatePanel('${panel.id}', 'efficiency', this.value)"
                               min="0" max="100" step="0.1">
                    </div>
                </div>
                <div class="panel-info">
                    <small>💡 Tilt: 0°=Horizontal, 90°=Vertical | Azimuth: 0°=North, 90°=East, 180°=South, 270°=West</small>
                </div>
            </div>
        `).join('');
    }

    addPanel() {
        // Default to latitude tilt facing south for northern hemisphere, north for southern
        const defaultTilt = Math.abs(this.config.location.latitude);
        const defaultAzimuth = this.config.location.latitude >= 0 ? 180 : 0;

        const panel = new SolarPanel(100, defaultTilt, defaultAzimuth, 17);
        this.config.solarPanels.push(panel);
        this.render();
    }

    updatePanel(id, field, value) {
        const panel = this.config.solarPanels.find(p => p.id === id);
        if (panel) {
            panel[field] = parseFloat(value);
            this.render();
            if (window.resultsManager) {
                window.resultsManager.calculate();
            }
        }
    }

    deletePanel(id) {
        const index = this.config.solarPanels.findIndex(p => p.id === id);
        if (index > -1) {
            this.config.solarPanels.splice(index, 1);
            this.render();
            if (window.resultsManager) {
                window.resultsManager.calculate();
            }
        }
    }

    updateLocation(field, value) {
        if (field === 'name') {
            this.config.location[field] = value;
        } else {
            this.config.location[field] = parseFloat(value);
        }
    }

    async fetchSolarData() {
        const btn = event.target.closest('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner">⏳</span> Fetching...';
        btn.disabled = true;

        try {
            const data = await this.nasaAPI.fetchWithFallback(
                this.config.location.latitude,
                this.config.location.longitude
            );
            this.config.solarData = data;
            this.render();
            if (window.resultsManager) {
                window.resultsManager.calculate();
            }
            alert('Solar radiation data fetched successfully!');
        } catch (error) {
            alert('Error fetching solar data: ' + error.message);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    getTotalPanelPower() {
        return this.config.solarPanels.reduce((sum, panel) => sum + panel.powerRating, 0);
    }
}
