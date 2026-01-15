// Wind power calculations and utilities

class WindCalculations {
    /**
     * Adjust wind speed for height using power law
     * @param {number} windSpeedRef - Reference wind speed (m/s)
     * @param {number} heightRef - Reference height (m)
     * @param {number} heightTarget - Target height (m)
     * @param {number} alpha - Power law exponent (typically 0.14 for open water)
     * @returns {number} Wind speed at target height (m/s)
     */
    static adjustWindSpeedForHeight(windSpeedRef, heightRef, heightTarget, alpha = 0.14) {
        return windSpeedRef * Math.pow(heightTarget / heightRef, alpha);
    }

    /**
     * Calculate air density at given conditions
     * @param {number} temperature - Air temperature (°C)
     * @param {number} pressure - Atmospheric pressure (hPa/mbar)
     * @param {number} humidity - Relative humidity (0-100%)
     * @returns {number} Air density (kg/m³)
     */
    static getAirDensity(temperature = 15, pressure = 1013.25, humidity = 50) {
        const tempK = temperature + 273.15;

        // Saturation vapor pressure (Magnus formula)
        const es = 6.112 * Math.exp((17.67 * temperature) / (temperature + 243.5));

        // Actual vapor pressure
        const e = (humidity / 100) * es;

        // Partial pressure of dry air
        const pd = pressure - e;

        // Air density (kg/m³)
        const Rd = 287.05; // Specific gas constant for dry air (J/(kg·K))
        const Rv = 461.495; // Specific gas constant for water vapor (J/(kg·K))

        const density = (pd / (Rd * tempK)) + (e / (Rv * tempK));

        return density;
    }

    /**
     * Correct power output for air density
     * @param {number} power - Power at standard conditions (W)
     * @param {number} actualDensity - Actual air density (kg/m³)
     * @param {number} standardDensity - Standard air density (1.225 kg/m³)
     * @returns {number} Corrected power (W)
     */
    static correctForAirDensity(power, actualDensity, standardDensity = 1.225) {
        return power * (actualDensity / standardDensity);
    }

    /**
     * Calculate average power from wind speed distribution
     * Assumes Weibull distribution
     * @param {number} avgWindSpeed - Average wind speed (m/s)
     * @param {Function} powerCurveFunc - Function that takes wind speed and returns power
     * @param {number} k - Weibull shape parameter (typically 2 for ocean locations)
     * @returns {number} Average power output (W)
     */
    static calculateAveragePower(avgWindSpeed, powerCurveFunc, k = 2) {
        // For simplicity, we'll use a discrete approximation
        // In reality, you'd integrate over the Weibull distribution

        // For a Weibull distribution with shape parameter k=2 (Rayleigh),
        // we can approximate by sampling at multiple wind speeds

        let totalPower = 0;
        let totalProbability = 0;

        // Sample wind speeds from 0 to 30 m/s
        const numSamples = 60;
        for (let i = 0; i <= numSamples; i++) {
            const windSpeed = (i / numSamples) * 30;

            // Weibull probability density
            const c = avgWindSpeed / 0.886; // Scale parameter for k=2
            const probability = (k / c) * Math.pow(windSpeed / c, k - 1) *
                Math.exp(-Math.pow(windSpeed / c, k));

            const power = powerCurveFunc(windSpeed);

            totalPower += power * probability;
            totalProbability += probability;
        }

        // Normalize (approximation of integration)
        return totalPower * (30 / numSamples);
    }

    /**
     * Simple average power calculation (using average wind speed directly)
     * This is a simplified approach suitable for monthly averages
     * @param {number} avgWindSpeed - Average wind speed (m/s)
     * @param {Function} powerCurveFunc - Function that takes wind speed and returns power
     * @returns {number} Approximate average power (W)
     */
    static simpleAveragePower(avgWindSpeed, powerCurveFunc) {
        // Simple approximation: just use the power at average wind speed
        // This underestimates actual power due to cubic relationship
        // Better approximation: use power at (V³)^(1/3) ≈ V for distribution

        // For Rayleigh distribution (k=2), the cube root of mean cube
        // is approximately 1.3 times the mean
        const effectiveWindSpeed = avgWindSpeed * 1.2;

        return powerCurveFunc(effectiveWindSpeed);
    }
}
