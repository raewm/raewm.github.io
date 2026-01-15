// Core data models for the power budgeting application

/**
 * Represents an equipment load on the buoy
 */
class Load {
    constructor(name = '', powerOn = 0, powerIdle = 0, dutyCycle = 100) {
        this.id = this.generateId();
        this.name = name;
        this.powerOn = parseFloat(powerOn) || 0; // Watts
        this.powerIdle = parseFloat(powerIdle) || 0; // Watts
        this.dutyCycle = parseFloat(dutyCycle) || 100; // Percentage (0-100)
    }

    /**
     * Calculate average power consumption
     * @returns {number} Average power in Watts
     */
    getAveragePower() {
        const onTime = this.dutyCycle / 100;
        const idleTime = 1 - onTime;
        return (this.powerOn * onTime) + (this.powerIdle * idleTime);
    }

    /**
     * Calculate daily energy consumption
     * @returns {number} Energy in Wh
     */
    getDailyEnergy() {
        return this.getAveragePower() * 24;
    }

    generateId() {
        return 'load_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            powerOn: this.powerOn,
            powerIdle: this.powerIdle,
            dutyCycle: this.dutyCycle
        };
    }

    static fromJSON(data) {
        const load = new Load(data.name, data.powerOn, data.powerIdle, data.dutyCycle);
        load.id = data.id;
        return load;
    }
}

/**
 * Represents a battery system
 */
class Battery {
    constructor(type = 'Lead-Acid', voltage = 12, capacityAh = 100, quantity = 1, depthOfDischarge = 50) {
        this.id = this.generateId();
        this.type = type;
        this.voltage = parseFloat(voltage) || 12;
        this.capacityAh = parseFloat(capacityAh) || 100;
        this.quantity = parseInt(quantity) || 1;
        this.depthOfDischarge = parseFloat(depthOfDischarge) || this.getDefaultDoD(type);
    }

    /**
     * Get default depth of discharge for battery type
     */
    getDefaultDoD(type) {
        const defaults = {
            'Lead-Acid': 50,
            'AGM': 50,
            'Gel': 50,
            'Lithium-Ion': 80,
            'LiFePO4': 80
        };
        return defaults[type] || 50;
    }

    /**
     * Get total energy storage capacity
     * @returns {number} Usable energy in Wh
     */
    getUsableCapacity() {
        return this.voltage * this.capacityAh * this.quantity * (this.depthOfDischarge / 100);
    }

    /**
     * Get total capacity
     * @returns {number} Total energy in Wh
     */
    getTotalCapacity() {
        return this.voltage * this.capacityAh * this.quantity;
    }

    generateId() {
        return 'battery_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            voltage: this.voltage,
            capacityAh: this.capacityAh,
            quantity: this.quantity,
            depthOfDischarge: this.depthOfDischarge
        };
    }

    static fromJSON(data) {
        const battery = new Battery(
            data.type,
            data.voltage,
            data.capacityAh,
            data.quantity,
            data.depthOfDischarge
        );
        battery.id = data.id;
        return battery;
    }
}

/**
 * Represents a solar panel
 */
class SolarPanel {
    constructor(powerRating = 100, tiltAngle = 0, azimuth = 180, efficiency = 17) {
        this.id = this.generateId();
        this.powerRating = parseFloat(powerRating) || 100; // Watts (STC rating)
        this.tiltAngle = parseFloat(tiltAngle) || 0; // degrees from horizontal
        this.azimuth = parseFloat(azimuth) || 180; // degrees (0=N, 90=E, 180=S, 270=W)
        this.efficiency = parseFloat(efficiency) || 17; // percentage
        this.temperatureCoefficient = -0.4; // %/°C (typical for silicon panels)
    }

    generateId() {
        return 'solar_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    toJSON() {
        return {
            id: this.id,
            powerRating: this.powerRating,
            tiltAngle: this.tiltAngle,
            azimuth: this.azimuth,
            efficiency: this.efficiency,
            temperatureCoefficient: this.temperatureCoefficient
        };
    }

    static fromJSON(data) {
        const panel = new SolarPanel(
            data.powerRating,
            data.tiltAngle,
            data.azimuth,
            data.efficiency
        );
        panel.id = data.id;
        panel.temperatureCoefficient = data.temperatureCoefficient || -0.4;
        return panel;
    }
}

/**
 * Represents a wind generator
 */
class WindGenerator {
    constructor(name = 'Custom', ratedPower = 400) {
        this.id = this.generateId();
        this.name = name;
        this.ratedPower = parseFloat(ratedPower) || 400; // Watts
        this.cutInSpeed = 3.0; // m/s
        this.ratedSpeed = 12.5; // m/s
        this.cutOutSpeed = 25.0; // m/s
        this.powerCurve = this.getDefaultPowerCurve();
    }

    /**
     * Get default power curve (wind speed vs power output)
     * Returns array of [windSpeed, power] pairs
     */
    getDefaultPowerCurve() {
        // Generic power curve based on rated power
        const rated = this.ratedPower;
        return [
            [0, 0],
            [2, 0],
            [3, rated * 0.02],
            [4, rated * 0.08],
            [5, rated * 0.15],
            [6, rated * 0.25],
            [7, rated * 0.38],
            [8, rated * 0.52],
            [9, rated * 0.68],
            [10, rated * 0.82],
            [11, rated * 0.92],
            [12, rated * 0.98],
            [12.5, rated],
            [15, rated],
            [20, rated],
            [25, rated],
            [26, 0] // Cut out
        ];
    }

    /**
     * Get power output at given wind speed
     * @param {number} windSpeed - Wind speed in m/s
     * @returns {number} Power output in Watts
     */
    getPowerAtWindSpeed(windSpeed) {
        if (windSpeed < this.cutInSpeed || windSpeed > this.cutOutSpeed) {
            return 0;
        }

        // Linear interpolation of power curve
        const curve = this.powerCurve;
        for (let i = 0; i < curve.length - 1; i++) {
            const [ws1, p1] = curve[i];
            const [ws2, p2] = curve[i + 1];

            if (windSpeed >= ws1 && windSpeed <= ws2) {
                // Linear interpolation
                const ratio = (windSpeed - ws1) / (ws2 - ws1);
                return p1 + ratio * (p2 - p1);
            }
        }

        return 0;
    }

    generateId() {
        return 'wind_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            ratedPower: this.ratedPower,
            cutInSpeed: this.cutInSpeed,
            ratedSpeed: this.ratedSpeed,
            cutOutSpeed: this.cutOutSpeed,
            powerCurve: this.powerCurve
        };
    }

    static fromJSON(data) {
        const generator = new WindGenerator(data.name, data.ratedPower);
        generator.id = data.id;
        generator.cutInSpeed = data.cutInSpeed;
        generator.ratedSpeed = data.ratedSpeed;
        generator.cutOutSpeed = data.cutOutSpeed;
        generator.powerCurve = data.powerCurve;
        return generator;
    }
}

/**
 * Represents another power source (e.g., fuel cell, thermoelectric)
 */
class OtherPowerSource {
    constructor(name = '', averagePower = 0) {
        this.id = this.generateId();
        this.name = name;
        this.averagePower = parseFloat(averagePower) || 0; // Watts
    }

    getDailyEnergy() {
        return this.averagePower * 24;
    }

    generateId() {
        return 'other_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            averagePower: this.averagePower
        };
    }

    static fromJSON(data) {
        const source = new OtherPowerSource(data.name, data.averagePower);
        source.id = data.id;
        return source;
    }
}

/**
 * Project configuration containing all system components and location
 */
class ProjectConfig {
    constructor() {
        this.projectName = 'New Buoy Project';
        this.location = {
            latitude: 38.0,
            longitude: -70.0,
            name: 'Mid-Atlantic'
        };
        this.loads = [];
        this.batteries = [];
        this.solarPanels = [];
        this.windGenerators = [];
        this.otherSources = [];
        this.solarData = null; // Will hold NASA POWER data
        this.windData = null; // Will hold NOAA wind data
    }

    toJSON() {
        return {
            projectName: this.projectName,
            location: this.location,
            loads: this.loads.map(l => l.toJSON()),
            batteries: this.batteries.map(b => b.toJSON()),
            solarPanels: this.solarPanels.map(s => s.toJSON()),
            windGenerators: this.windGenerators.map(w => w.toJSON()),
            otherSources: this.otherSources.map(o => o.toJSON()),
            solarData: this.solarData,
            windData: this.windData
        };
    }

    static fromJSON(data) {
        const config = new ProjectConfig();
        config.projectName = data.projectName || 'Imported Project';
        config.location = data.location || { latitude: 38.0, longitude: -70.0, name: 'Unknown' };
        config.loads = (data.loads || []).map(l => Load.fromJSON(l));
        config.batteries = (data.batteries || []).map(b => Battery.fromJSON(b));
        config.solarPanels = (data.solarPanels || []).map(s => SolarPanel.fromJSON(s));
        config.windGenerators = (data.windGenerators || []).map(w => WindGenerator.fromJSON(w));
        config.otherSources = (data.otherSources || []).map(o => OtherPowerSource.fromJSON(o));
        config.solarData = data.solarData;
        config.windData = data.windData;
        return config;
    }

    exportToFile() {
        const dataStr = JSON.stringify(this.toJSON(), null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        // Create human-readable filename with timestamp
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '-');
        const safeName = this.projectName.replace(/[^a-zA-Z0-9]/g, '_');
        link.download = `${safeName}_${timestamp}.json`;

        link.click();
        URL.revokeObjectURL(url);
    }
}
