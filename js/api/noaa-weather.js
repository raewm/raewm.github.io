// NOAA Weather API integration for wind speed data

class NOAAWeatherAPI {
    constructor() {
        this.baseUrl = 'https://api.weather.gov';
        this.userAgent = 'BuoyPowerBudget/1.0';
    }

    /**
     * Fetch wind speed data for a location
     * @param {number} latitude 
     * @param {number} longitude 
     * @returns {Promise<Object>} Wind speed data
     */
    async fetchWindData(latitude, longitude) {
        try {
            // First, get the grid point for this location
            const pointUrl = `${this.baseUrl}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
            console.log('Fetching NOAA point data:', pointUrl);

            const pointResponse = await fetch(pointUrl, {
                headers: {
                    'User-Agent': this.userAgent
                }
            });

            if (!pointResponse.ok) {
                throw new Error(`NOAA API error: ${pointResponse.status}`);
            }

            const pointData = await pointResponse.json();

            // Get observation stations
            const stationsUrl = pointData.properties.observationStations;

            if (!stationsUrl) {
                throw new Error('No observation stations found for this location');
            }

            const stationsResponse = await fetch(stationsUrl, {
                headers: {
                    'User-Agent': this.userAgent
                }
            });

            if (!stationsResponse.ok) {
                throw new Error('Failed to fetch weather stations');
            }

            const stationsData = await stationsResponse.json();

            // Note: Getting historical averages from NOAA API is complex
            // For a production app, you'd need to use NOAA's Climate Data API
            // For now, we'll return metadata and suggest manual input

            return {
                location: {
                    latitude: latitude,
                    longitude: longitude
                },
                nearestStations: stationsData.features.slice(0, 3).map(station => ({
                    id: station.properties.stationIdentifier,
                    name: station.properties.name
                })),
                fetchedAt: new Date().toISOString(),
                source: 'NOAA NWS API',
                note: 'Historical wind averages require manual input or NOAA Climate Data API access'
            };
        } catch (error) {
            console.error('Error fetching NOAA data:', error);
            throw error;
        }
    }

    /**
     * Get fallback wind data based on location type
     * @param {number} latitude 
     * @param {number} longitude 
     * @param {string} locationType - 'coastal', 'offshore', or 'inland'
     * @returns {Object} Estimated wind data
     */
    getFallbackData(latitude, longitude, locationType = 'offshore') {
        // Typical wind speeds by location type
        const baseWindSpeeds = {
            'offshore': 7.0,    // m/s - typical offshore average
            'coastal': 5.5,     // m/s - coastal areas
            'inland': 4.0       // m/s - inland areas
        };

        const baseSpeed = baseWindSpeeds[locationType] || 6.0;

        // Create monthly variation
        const monthlyData = [];
        for (let month = 1; month <= 12; month++) {
            // Wind tends to be stronger in winter (for northern hemisphere)
            const dayOfYear = (month - 1) * 30 + 15;
            const seasonalFactor = Math.cos((dayOfYear - 172) * 2 * Math.PI / 365);

            // Adjust for hemisphere
            const hemisphereAdjusted = latitude >= 0 ? seasonalFactor : -seasonalFactor;

            const avgSpeed = baseSpeed * (1 + 0.2 * hemisphereAdjusted);

            monthlyData.push({
                month: month,
                avgWindSpeed: Math.max(avgSpeed, 2.0), // m/s
                maxWindSpeed: avgSpeed * 1.8, // Estimated max
                minWindSpeed: avgSpeed * 0.5  // Estimated min
            });
        }

        return {
            location: {
                latitude: latitude,
                longitude: longitude
            },
            monthlyData: monthlyData,
            locationType: locationType,
            fetchedAt: new Date().toISOString(),
            source: 'Estimated (Manual input recommended)'
        };
    }

    /**
     * Create wind data from manual input
     * @param {number[]} monthlyWindSpeeds - Array of 12 average wind speeds (m/s)
     * @returns {Object}
     */
    createManualWindData(latitude, longitude, monthlyWindSpeeds) {
        if (!Array.isArray(monthlyWindSpeeds) || monthlyWindSpeeds.length !== 12) {
            throw new Error('Must provide 12 monthly wind speed values');
        }

        const monthlyData = monthlyWindSpeeds.map((speed, index) => ({
            month: index + 1,
            avgWindSpeed: parseFloat(speed) || 0,
            maxWindSpeed: speed * 1.8,
            minWindSpeed: speed * 0.5
        }));

        return {
            location: {
                latitude: latitude,
                longitude: longitude
            },
            monthlyData: monthlyData,
            fetchedAt: new Date().toISOString(),
            source: 'Manual input'
        };
    }

    /**
     * Fetch with fallback
     * @param {number} latitude 
     * @param {number} longitude 
     * @param {string} locationType 
     * @returns {Promise<Object>}
     */
    async fetchWithFallback(latitude, longitude, locationType = 'offshore') {
        try {
            const data = await this.fetchWindData(latitude, longitude);
            // If we got station data but no wind averages, use fallback
            return this.getFallbackData(latitude, longitude, locationType);
        } catch (error) {
            console.warn('Using fallback wind data due to API error');
            return this.getFallbackData(latitude, longitude, locationType);
        }
    }
}
