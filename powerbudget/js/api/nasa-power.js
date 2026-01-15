// NASA POWER API integration for solar radiation data

class NASAPowerAPI {
    constructor() {
        this.baseUrl = 'https://power.larc.nasa.gov/api/temporal/monthly/point';
        this.parameters = [
            'ALLSKY_SFC_SW_DWN',  // All Sky Surface Shortwave Downward Irradiance (kWh/m^2/day)
            'CLRSKY_SFC_SW_DWN',  // Clear Sky Surface Shortwave Downward Irradiance
            'ALLSKY_SFC_SW_DIFF'   // All Sky Surface Diffuse Irradiance
        ];
    }

    /**
     * Fetch solar radiation data for a location
     * @param {number} latitude - Latitude in decimal degrees
     * @param {number} longitude - Longitude in decimal degrees
     * @returns {Promise<Object>} Solar radiation data by month
     */
    async fetchSolarData(latitude, longitude) {
        try {
            const params = new URLSearchParams({
                parameters: this.parameters.join(','),
                community: 'RE',
                longitude: longitude.toFixed(4),
                latitude: latitude.toFixed(4),
                format: 'JSON'
            });

            const url = `${this.baseUrl}?${params.toString()}`;
            console.log('Fetching NASA POWER data:', url);

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`NASA POWER API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.properties || !data.properties.parameter) {
                throw new Error('Invalid response format from NASA POWER API');
            }

            return this.processSolarData(data);
        } catch (error) {
            console.error('Error fetching NASA POWER data:', error);
            throw error;
        }
    }

    /**
     * Process NASA POWER API response into usable format
     * @param {Object} data - Raw API response
     * @returns {Object} Processed solar data
     */
    processSolarData(data) {
        const params = data.properties.parameter;
        const metadata = data.geometry.coordinates; // [lon, lat]

        // Extract monthly averages (1-12)
        const monthlyData = [];
        for (let month = 1; month <= 12; month++) {
            monthlyData.push({
                month: month,
                // GHI - Global Horizontal Irradiance in kWh/m²/day
                ghi: params.ALLSKY_SFC_SW_DWN[month] || 0,
                // Clear sky irradiance
                clearSkyGHI: params.CLRSKY_SFC_SW_DWN[month] || 0,
                // Diffuse irradiance
                diffuse: params.ALLSKY_SFC_SW_DIFF[month] || 0
            });
        }

        return {
            location: {
                latitude: metadata[1],
                longitude: metadata[0]
            },
            monthlyData: monthlyData,
            fetchedAt: new Date().toISOString(),
            source: 'NASA POWER API'
        };
    }

    /**
     * Get fallback solar data if API fails
     * @param {number} latitude - Latitude in decimal degrees
     * @returns {Object} Estimated solar data based on latitude
     */
    getFallbackData(latitude) {
        // Rough estimates based on latitude
        const absLat = Math.abs(latitude);
        let baseGHI;

        if (absLat < 25) {
            // Tropical
            baseGHI = 5.5;
        } else if (absLat < 40) {
            // Subtropical
            baseGHI = 4.5;
        } else if (absLat < 50) {
            // Temperate
            baseGHI = 3.5;
        } else {
            // High latitude
            baseGHI = 2.5;
        }

        // Create seasonal variation
        const monthlyData = [];
        for (let month = 1; month <= 12; month++) {
            // Simple sinusoidal variation
            const dayOfYear = (month - 1) * 30 + 15;
            const seasonalFactor = Math.cos((dayOfYear - 172) * 2 * Math.PI / 365);

            // Adjust for hemisphere
            const hemisphereAdjusted = latitude >= 0 ? seasonalFactor : -seasonalFactor;

            const ghi = baseGHI * (1 + 0.3 * hemisphereAdjusted);

            monthlyData.push({
                month: month,
                ghi: Math.max(ghi, 0.5),
                clearSkyGHI: ghi * 1.2,
                diffuse: ghi * 0.3
            });
        }

        return {
            location: {
                latitude: latitude,
                longitude: 0
            },
            monthlyData: monthlyData,
            fetchedAt: new Date().toISOString(),
            source: 'Estimated (API unavailable)'
        };
    }

    /**
     * Fetch data with automatic fallback
     * @param {number} latitude 
     * @param {number} longitude 
     * @returns {Promise<Object>}
     */
    async fetchWithFallback(latitude, longitude) {
        try {
            return await this.fetchSolarData(latitude, longitude);
        } catch (error) {
            console.warn('Using fallback solar data due to API error');
            return this.getFallbackData(latitude);
        }
    }
}
