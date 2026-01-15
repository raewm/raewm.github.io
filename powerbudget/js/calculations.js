// Power budget calculation engine

class PowerCalculations {
    /**
     * Calculate monthly solar power generation for a panel
     * @param {SolarPanel} panel - Solar panel object
     * @param {Object} solarData - Solar radiation data from NASA POWER
     * @param {number} latitude - Site latitude
     * @returns {Array} Monthly generation data
     */
    static calculateSolarGeneration(panel, solarData, latitude) {
        if (!solarData || !solarData.monthlyData) {
            return Array(12).fill(0);
        }

        const monthlyGeneration = [];

        for (let month = 1; month <= 12; month++) {
            const monthData = solarData.monthlyData.find(m => m.month === month);
            if (!monthData) {
                monthlyGeneration.push(0);
                continue;
            }

            // GHI in kWh/m²/day
            const ghi = monthData.ghi;
            const diffuse = monthData.diffuse;

            // Calculate day of year (middle of month)
            const dayOfYear = (month - 1) * 30 + 15;

            // Calculate irradiance on tilted surface
            const tiltedIrradiance = SolarGeometry.getIrradianceOnTilt(
                ghi,
                diffuse,
                panel.tiltAngle,
                panel.azimuth,
                latitude,
                dayOfYear
            );

            // Panel efficiency losses
            const systemEfficiency = 0.85; // Losses from wiring, soiling, etc.

            // Calculate daily energy generation
            // Panel rating is in watts at 1000 W/m² STC
            // tiltedIrradiance is in kWh/m²/day
            // Convert to peak sun hours
            const peakSunHours = tiltedIrradiance;

            // Daily energy in Wh
            const dailyEnergy = panel.powerRating * peakSunHours * systemEfficiency;

            // Monthly energy in Wh (approximate days in month)
            const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            const monthlyEnergy = dailyEnergy * daysInMonth[month - 1];

            monthlyGeneration.push(monthlyEnergy);
        }

        return monthlyGeneration;
    }

    /**
     * Calculate total solar generation from all panels
     * @param {Array<SolarPanel>} panels 
     * @param {Object} solarData 
     * @param {number} latitude 
     * @returns {Array} Monthly totals in Wh
     */
    static calculateTotalSolarGeneration(panels, solarData, latitude) {
        const totals = Array(12).fill(0);

        panels.forEach(panel => {
            const generation = this.calculateSolarGeneration(panel, solarData, latitude);
            generation.forEach((value, index) => {
                totals[index] += value;
            });
        });

        return totals;
    }

    /**
     * Calculate monthly wind power generation
     * @param {WindGenerator} generator 
     * @param {Object} windData - Wind speed data
     * @returns {Array} Monthly generation in Wh
     */
    static calculateWindGeneration(generator, windData) {
        if (!windData || !windData.monthlyData) {
            return Array(12).fill(0);
        }

        const monthlyGeneration = [];

        for (let month = 1; month <= 12; month++) {
            const monthData = windData.monthlyData.find(m => m.month === month);
            if (!monthData) {
                monthlyGeneration.push(0);
                continue;
            }

            const avgWindSpeed = monthData.avgWindSpeed;

            // Calculate average power using simplified method
            const avgPower = WindCalculations.simpleAveragePower(
                avgWindSpeed,
                (ws) => generator.getPowerAtWindSpeed(ws)
            );

            // Monthly energy in Wh
            const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            const monthlyEnergy = avgPower * 24 * daysInMonth[month - 1];

            monthlyGeneration.push(monthlyEnergy);
        }

        return monthlyGeneration;
    }

    /**
     * Calculate total wind generation from all generators
     * @param {Array<WindGenerator>} generators 
     * @param {Object} windData 
     * @returns {Array} Monthly totals in Wh
     */
    static calculateTotalWindGeneration(generators, windData) {
        const totals = Array(12).fill(0);

        generators.forEach(generator => {
            const generation = this.calculateWindGeneration(generator, windData);
            generation.forEach((value, index) => {
                totals[index] += value;
            });
        });

        return totals;
    }

    /**
     * Calculate monthly power consumption from loads
     * @param {Array<Load>} loads 
     * @returns {Array} Monthly consumption in Wh
     */
    static calculateMonthlyConsumption(loads) {
        const monthlyConsumption = [];

        for (let month = 1; month <= 12; month++) {
            let totalDailyEnergy = 0;

            loads.forEach(load => {
                totalDailyEnergy += load.getDailyEnergy();
            });

            const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            const monthlyEnergy = totalDailyEnergy * daysInMonth[month - 1];

            monthlyConsumption.push(monthlyEnergy);
        }

        return monthlyConsumption;
    }

    /**
     * Calculate other power source generation
     * @param {Array<OtherPowerSource>} sources 
     * @returns {Array} Monthly generation in Wh
     */
    static calculateOtherGeneration(sources) {
        const monthlyGeneration = [];

        for (let month = 1; month <= 12; month++) {
            let totalDailyEnergy = 0;

            sources.forEach(source => {
                totalDailyEnergy += source.getDailyEnergy();
            });

            const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            const monthlyEnergy = totalDailyEnergy * daysInMonth[month - 1];

            monthlyGeneration.push(monthlyEnergy);
        }

        return monthlyGeneration;
    }

    /**
     * Calculate complete power budget
     * @param {ProjectConfig} config 
     * @returns {Object} Complete budget analysis
     */
    static calculatePowerBudget(config) {
        const latitude = config.location.latitude;

        // Calculate generation
        const solarGen = this.calculateTotalSolarGeneration(
            config.solarPanels,
            config.solarData,
            latitude
        );

        const windGen = this.calculateTotalWindGeneration(
            config.windGenerators,
            config.windData
        );

        const otherGen = this.calculateOtherGeneration(config.otherSources);

        // Calculate consumption
        const consumption = this.calculateMonthlyConsumption(config.loads);

        // Calculate totals and net
        const monthlyData = [];
        let annualGeneration = 0;
        let annualConsumption = 0;

        for (let month = 0; month < 12; month++) {
            const totalGen = solarGen[month] + windGen[month] + otherGen[month];
            const totalCons = consumption[month];
            const net = totalGen - totalCons;

            annualGeneration += totalGen;
            annualConsumption += totalCons;

            monthlyData.push({
                month: month + 1,
                solarGeneration: solarGen[month],
                windGeneration: windGen[month],
                otherGeneration: otherGen[month],
                totalGeneration: totalGen,
                consumption: totalCons,
                netEnergy: net,
                surplus: net > 0,
                percentOfDemand: totalCons > 0 ? (totalGen / totalCons * 100) : 0
            });
        }

        // Battery analysis
        const batteryCapacity = config.batteries.reduce(
            (sum, b) => sum + b.getUsableCapacity(),
            0
        );

        const avgDailyConsumption = annualConsumption / 365;
        const autonomyDays = batteryCapacity / avgDailyConsumption;

        // Find worst month
        const worstMonth = monthlyData.reduce((worst, current) => {
            return current.netEnergy < worst.netEnergy ? current : worst;
        });

        return {
            monthlyData: monthlyData,
            summary: {
                annualGeneration: annualGeneration,
                annualConsumption: annualConsumption,
                netAnnual: annualGeneration - annualConsumption,
                solarContribution: solarGen.reduce((a, b) => a + b, 0),
                windContribution: windGen.reduce((a, b) => a + b, 0),
                otherContribution: otherGen.reduce((a, b) => a + b, 0),
                batteryCapacity: batteryCapacity,
                autonomyDays: autonomyDays,
                worstMonth: worstMonth,
                systemAdequate: worstMonth.netEnergy >= 0 && batteryCapacity > avgDailyConsumption
            }
        };
    }

    /**
     * Simulate battery state of charge over time
     * @param {Object} budget - Power budget from calculatePowerBudget
     * @param {number} batteryCapacity - Total battery capacity in Wh
     * @param {number} initialSOC - Initial state of charge (0-100%)
     * @returns {Array} Daily SOC values
     */
    static simulateBatterySOC(budget, batteryCapacity, initialSOC = 100) {
        const dailySOC = [];
        let currentSOC = initialSOC / 100 * batteryCapacity;

        const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

        budget.monthlyData.forEach((monthData, monthIndex) => {
            const days = daysInMonth[monthIndex];
            const dailyNet = monthData.netEnergy / days;

            for (let day = 0; day < days; day++) {
                currentSOC += dailyNet;

                // Clamp to battery capacity
                currentSOC = Math.max(0, Math.min(batteryCapacity, currentSOC));

                const socPercent = (currentSOC / batteryCapacity) * 100;
                dailySOC.push({
                    day: dailySOC.length + 1,
                    soc: socPercent,
                    energy: currentSOC
                });

                // Check if battery is depleted
                if (currentSOC === 0) {
                    console.warn(`Battery depleted on day ${dailySOC.length}`);
                }
            }
        });

        return dailySOC;
    }
}
