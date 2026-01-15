// Battery Manager UI

class BatteryManager {
    constructor(containerId, config) {
        this.container = document.getElementById(containerId);
        this.config = config;
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="section-header">
                <h2>Battery System</h2>
                <button class="btn btn-primary" onclick="batteryManager.addBattery()">
                    <span class="icon">+</span> Add Battery Bank
                </button>
            </div>

            <div id="batteries-list" class="items-list">
                ${this.renderBatteries()}
            </div>

            <div class="summary-box">
                <h3>Battery Summary</h3>
                <div class="summary-grid">
                    <div class="summary-item">
                        <span class="summary-label">Total Capacity:</span>
                        <span class="summary-value">${this.getTotalCapacity().toFixed(0)} Wh</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Usable Capacity:</span>
                        <span class="summary-value">${this.getUsableCapacity().toFixed(0)} Wh</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderBatteries() {
        if (this.config.batteries.length === 0) {
            return '<div class="empty-state">No batteries configured. Click "Add Battery Bank" to get started.</div>';
        }

        return this.config.batteries.map(battery => `
            <div class="item-card" data-id="${battery.id}">
                <div class="item-header">
                    <h3>Battery Bank</h3>
                    <button class="btn-icon btn-delete" onclick="batteryManager.deleteBattery('${battery.id}')" title="Delete">
                        <span>×</span>
                    </button>
                </div>
                <div class="item-grid">
                    <div class="input-group">
                        <label>Type</label>
                        <select onchange="batteryManager.updateBattery('${battery.id}', 'type', this.value)" value="${battery.type}">
                            <option value="Lead-Acid" ${battery.type === 'Lead-Acid' ? 'selected' : ''}>Lead-Acid</option>
                            <option value="AGM" ${battery.type === 'AGM' ? 'selected' : ''}>AGM</option>
                            <option value="Gel" ${battery.type === 'Gel' ? 'selected' : ''}>Gel</option>
                            <option value="Lithium-Ion" ${battery.type === 'Lithium-Ion' ? 'selected' : ''}>Lithium-Ion</option>
                            <option value="LiFePO4" ${battery.type === 'LiFePO4' ? 'selected' : ''}>LiFePO4</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Voltage (V)</label>
                        <input type="number" 
                               value="${battery.voltage}" 
                               onchange="batteryManager.updateBattery('${battery.id}', 'voltage', this.value)"
                               min="0" step="0.1">
                    </div>
                    <div class="input-group">
                        <label>Capacity (Ah)</label>
                        <input type="number" 
                               value="${battery.capacityAh}" 
                               onchange="batteryManager.updateBattery('${battery.id}', 'capacityAh', this.value)"
                               min="0" step="1">
                    </div>
                    <div class="input-group">
                        <label>Quantity</label>
                        <input type="number" 
                               value="${battery.quantity}" 
                               onchange="batteryManager.updateBattery('${battery.id}', 'quantity', this.value)"
                               min="1" step="1">
                    </div>
                    <div class="input-group">
                        <label>Depth of Discharge (%)</label>
                        <input type="number" 
                               value="${battery.depthOfDischarge}" 
                               onchange="batteryManager.updateBattery('${battery.id}', 'depthOfDischarge', this.value)"
                               min="0" max="100" step="1">
                    </div>
                    <div class="input-group result">
                        <label>Total Energy</label>
                        <input type="text" value="${battery.getTotalCapacity().toFixed(0)} Wh" readonly class="result-value">
                    </div>
                    <div class="input-group result">
                        <label>Usable Energy</label>
                        <input type="text" value="${battery.getUsableCapacity().toFixed(0)} Wh" readonly class="result-value">
                    </div>
                </div>
            </div>
        `).join('');
    }

    addBattery() {
        const battery = new Battery('Lead-Acid', 12, 100, 1, 50);
        this.config.batteries.push(battery);
        this.render();
    }

    updateBattery(id, field, value) {
        const battery = this.config.batteries.find(b => b.id === id);
        if (battery) {
            if (field === 'type') {
                battery[field] = value;
                // Update DoD to default for this type
                battery.depthOfDischarge = battery.getDefaultDoD(value);
            } else {
                battery[field] = parseFloat(value);
            }
            this.render();
            if (window.resultsManager) {
                window.resultsManager.calculate();
            }
        }
    }

    deleteBattery(id) {
        const index = this.config.batteries.findIndex(b => b.id === id);
        if (index > -1) {
            this.config.batteries.splice(index, 1);
            this.render();
            if (window.resultsManager) {
                window.resultsManager.calculate();
            }
        }
    }

    getTotalCapacity() {
        return this.config.batteries.reduce((sum, battery) => sum + battery.getTotalCapacity(), 0);
    }

    getUsableCapacity() {
        return this.config.batteries.reduce((sum, battery) => sum + battery.getUsableCapacity(), 0);
    }
}
