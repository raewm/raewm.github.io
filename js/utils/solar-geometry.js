// Solar geometry and radiation calculations

class SolarGeometry {
    /**
     * Calculate solar declination angle for a given day of year
     * @param {number} dayOfYear - Day of year (1-365)
     * @returns {number} Declination in degrees
     */
    static getSolarDeclination(dayOfYear) {
        // Cooper's equation
        const declination = 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * Math.PI / 180);
        return declination;
    }

    /**
     * Calculate hour angle for a given time
     * @param {number} solarTime - Solar time in hours (0-24)
     * @returns {number} Hour angle in degrees
     */
    static getHourAngle(solarTime) {
        return 15 * (solarTime - 12);
    }

    /**
     * Calculate solar altitude angle
     * @param {number} latitude - Latitude in degrees
     * @param {number} declination - Solar declination in degrees
     * @param {number} hourAngle - Hour angle in degrees
     * @returns {number} Altitude angle in degrees
     */
    static getSolarAltitude(latitude, declination, hourAngle) {
        const latRad = latitude * Math.PI / 180;
        const decRad = declination * Math.PI / 180;
        const haRad = hourAngle * Math.PI / 180;

        const sinAlt = Math.sin(latRad) * Math.sin(decRad) +
            Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);

        return Math.asin(sinAlt) * 180 / Math.PI;
    }

    /**
     * Calculate solar azimuth angle
     * @param {number} latitude - Latitude in degrees
     * @param {number} declination - Solar declination in degrees
     * @param {number} hourAngle - Hour angle in degrees
     * @param {number} altitude - Solar altitude in degrees
     * @returns {number} Azimuth angle in degrees (0=N, 90=E, 180=S, 270=W)
     */
    static getSolarAzimuth(latitude, declination, hourAngle, altitude) {
        const latRad = latitude * Math.PI / 180;
        const decRad = declination * Math.PI / 180;
        const altRad = altitude * Math.PI / 180;

        const cosAz = (Math.sin(decRad) - Math.sin(altRad) * Math.sin(latRad)) /
            (Math.cos(altRad) * Math.cos(latRad));

        let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180 / Math.PI;

        // Adjust for afternoon (hour angle > 0)
        if (hourAngle > 0) {
            azimuth = 360 - azimuth;
        }

        return azimuth;
    }

    /**
     * Calculate angle of incidence on a tilted surface
     * @param {number} tilt - Panel tilt angle from horizontal (degrees)
     * @param {number} panelAzimuth - Panel azimuth (degrees, 0=N, 180=S)
     * @param {number} solarAltitude - Solar altitude (degrees)
     * @param {number} solarAzimuth - Solar azimuth (degrees)
     * @returns {number} Angle of incidence (degrees)
     */
    static getIncidenceAngle(tilt, panelAzimuth, solarAltitude, solarAzimuth) {
        const tiltRad = tilt * Math.PI / 180;
        const altRad = solarAltitude * Math.PI / 180;
        const azDiffRad = (solarAzimuth - panelAzimuth) * Math.PI / 180;

        const cosIncidence = Math.sin(altRad) * Math.cos(tiltRad) +
            Math.cos(altRad) * Math.sin(tiltRad) * Math.cos(azDiffRad);

        return Math.acos(Math.max(-1, Math.min(1, cosIncidence))) * 180 / Math.PI;
    }

    /**
     * Calculate irradiance on tilted surface
     * @param {number} ghi - Global Horizontal Irradiance (W/m² or kWh/m²/day)
     * @param {number} diffuse - Diffuse irradiance
     * @param {number} tilt - Panel tilt angle (degrees)
     * @param {number} panelAzimuth - Panel azimuth (degrees)
     * @param {number} latitude - Site latitude (degrees)
     * @param {number} dayOfYear - Day of year (1-365)
     * @returns {number} Irradiance on tilted surface
     */
    static getIrradianceOnTilt(ghi, diffuse, tilt, panelAzimuth, latitude, dayOfYear) {
        // Simplified calculation using monthly average data
        // For daily averages, we use an isotropic sky model

        const direct = ghi - diffuse;
        const tiltRad = tilt * Math.PI / 180;
        const latRad = latitude * Math.PI / 180;

        // Calculate average solar position for the day
        const declination = this.getSolarDeclination(dayOfYear);
        const decRad = declination * Math.PI / 180;

        // Rb: ratio of beam radiation on tilted surface to horizontal
        // Simplified for monthly averages
        const cosZenith = Math.sin(latRad) * Math.sin(decRad) +
            Math.cos(latRad) * Math.cos(decRad);

        const cosTilt = Math.sin(latRad - tiltRad) * Math.sin(decRad) +
            Math.cos(latRad - tiltRad) * Math.cos(decRad);

        const Rb = Math.max(0, cosTilt / cosZenith);

        // Total radiation on tilted surface (isotropic model)
        const tiltedDirect = direct * Rb;
        const tiltedDiffuse = diffuse * (1 + Math.cos(tiltRad)) / 2;
        const groundReflected = ghi * 0.2 * (1 - Math.cos(tiltRad)) / 2; // 0.2 = albedo

        return tiltedDirect + tiltedDiffuse + groundReflected;
    }

    /**
     * Apply temperature derating to PV power output
     * @param {number} power - Power at STC (W)
     * @param {number} cellTemp - Estimated cell temperature (°C)
     * @param {number} tempCoeff - Temperature coefficient (%/°C)
     * @param {number} stcTemp - Standard test condition temperature (25°C)
     * @returns {number} Derated power (W)
     */
    static applyTemperatureDerating(power, cellTemp, tempCoeff = -0.4, stcTemp = 25) {
        const tempDiff = cellTemp - stcTemp;
        const derating = 1 + (tempCoeff / 100) * tempDiff;
        return power * Math.max(0, derating);
    }

    /**
     * Estimate cell temperature from ambient temperature and irradiance
     * @param {number} ambientTemp - Ambient temperature (°C)
     * @param {number} irradiance - Irradiance (W/m²)
     * @param {number} noct - Nominal Operating Cell Temperature (°C), typically 45
     * @returns {number} Estimated cell temperature (°C)
     */
    static estimateCellTemperature(ambientTemp, irradiance, noct = 45) {
        // Simplified model
        const stcIrradiance = 1000; // W/m²
        const stcAmbient = 20; // °C

        return ambientTemp + (noct - stcAmbient) * (irradiance / stcIrradiance);
    }
}
