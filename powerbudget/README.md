# Buoy Power Budget Calculator

A comprehensive web-based power budgeting application for oceanographic buoys and platforms. This tool helps marine engineers and researchers design and analyze power systems for remote oceanographic installations.

## Features

### Equipment Load Management
- Add multiple equipment types with individual power profiles
- Define power consumption for ON and IDLE states
- Set duty cycles (percentage of time equipment is active)
- Template library includes common oceanographic instruments:
  - CTD sensors, ADCPs, dissolved oxygen sensors
  - Underwater and surface cameras
  - Satellite and cellular modems
  - Navigation lights and beacons
  - Data loggers and single-board computers

### Battery System Configuration
- Support for multiple battery types:
  - Lead-Acid
  - AGM (Absorbed Glass Mat)
  - Gel
  - Lithium-Ion
  - LiFePO4 (Lithium Iron Phosphate)
- Configure capacity (Ah), voltage, and quantity
- Automatic depth of discharge (DoD) defaults based on battery type
- Calculate total and usable energy storage

### Solar Power Analysis
- **Individual panel configuration** - each panel can have its own:
  - Power rating (watts)
  - Tilt angle (0-90°)
  - Azimuth orientation (0-359°)
  - Efficiency percentage
- Location-based solar radiation data via **NASA POWER API**
  - Global coverage
  - Monthly averaged solar irradiance
  - Global Horizontal Irradiance (GHI)
  - Diffuse radiation components
- Advanced solar geometry calculations:
  - Sun position algorithms
  - Irradiance on tilted surfaces
  - Panel orientation optimization

### Wind Power Analysis
- Support for common marine wind generators:
  - Air Breeze Marine (200W)
  - Air X Marine (400W)
  - Silentwind (400W)
  - Superwind 350
  - Rutland 914i (90W)
  - Custom generators with editable power curves
- **NOAA Weather API** integration for wind data
- Manual wind speed entry (recommended for accuracy)
- Monthly wind speed profiles
- Power curve interpolation
- Air density corrections

### Comprehensive Results
- **Monthly power budget analysis**:
  - Solar generation breakdown
  - Wind generation breakdown
  - Total consumption
  - Net energy balance
  - Surplus/deficit indicators
- **System adequacy assessment**:
  - Annual energy summary
  - Battery autonomy calculation (days of storage)
  - Worst-case month identification
  - System sizing recommendations
- **Interactive visualizations**:
  - Monthly generation vs consumption chart
  - Net energy balance chart
  - Battery state of charge simulation (365 days)
  - Energy mix pie chart (solar/wind/other)
- **Export project data** to JSON for backup and sharing

## Technology Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (no build process required)
- **Visualization**: Chart.js 4.4
- **APIs**:
  - NASA POWER API (solar radiation data)
  - NOAA National Weather Service API (wind data)
- **Design**: Modern dark mode with maritime theme, responsive layout

## Installation & Usage

### Local Usage

1. Download or clone this repository
2. Open `index.html` in a modern web browser (Chrome, Firefox, Edge, Safari)
3. No server or build process required - runs entirely in the browser!

### Web Server (Optional)

For production deployment or to avoid CORS issues with some browsers:

```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server

# PHP
php -S localhost:8000
```

Then visit `http://localhost:8000` in your browser.

## Usage Guide

### 1. Configure Equipment Loads

- Navigate to the "Equipment Loads" tab
- Click "Add Equipment" or select from templates
- Enter power consumption for ON and IDLE states
- Set the duty cycle (percentage of time the equipment is active)
- Repeat for all equipment on your buoy

### 2. Set Up Battery System

- Go to the "Batteries" tab
- Click "Add Battery Bank"
- Select battery type (Lead-Acid, Lithium-Ion, etc.)
- Enter voltage, capacity (Ah), and quantity
- Adjust depth of discharge if needed

### 3. Add Solar Panels

- Navigate to the "Solar Panels" tab
- Enter your deployment location (latitude/longitude)
- Click "Fetch Solar Data" to retrieve solar radiation data from NASA
- Add solar panels with individual specifications:
  - **Power rating**: STC watts (e.g., 100W, 200W)
  - **Tilt angle**: 0° (flat) to 90° (vertical)
  - **Azimuth**: 0°=North, 90°=East, 180°=South, 270°=West
  - **Efficiency**: Default 17% for crystalline silicon
- Each panel can have different orientations (important for buoys!)

### 4. Add Wind Generators

- Go to the "Wind Generators" tab
- Click "Add Wind Generator"
- Select a model from the dropdown or use custom
- Enter wind speed data:
  - Option 1: Click "Fetch Wind Data" for location-based estimates
  - Option 2: Click "Enter Manual Data" for actual site measurements (recommended)

### 5. Calculate Power Budget

- Click the "Calculate Budget" button in the header
- Results will be displayed in the "Results" tab
- Review:
  - System adequacy status
  - Monthly energy balance
  - Battery state of charge simulation
  - Charts and visualizations

### 6. Save Your Work

- Click "Export" to save your project as a JSON file
- Click "Import" to load a previously saved project
- Share project files with colleagues

## Calculation Methodology

### Solar Power

Solar generation is calculated using:

1. **Solar Radiation Data**: Monthly averaged Global Horizontal Irradiance (GHI) from NASA POWER
2. **Tilt Correction**: Converts horizontal irradiance to tilted panel irradiance using:
   - Sun position algorithms (declination, solar altitude, azimuth)
   - Isotropic sky model for diffuse radiation
   - Ground reflection (albedo = 0.2)
3. **Panel Output**: `Power = Panel_Rating × Peak_Sun_Hours × System_Efficiency`
   - System efficiency accounts for wiring losses, soiling, etc. (default 85%)
4. **Temperature Derating**: Applied based on operating temperature

### Wind Power

Wind generation is calculated using:

1. **Wind Speed Data**: Monthly average wind speeds (manual input or estimates)
2. **Power Curve Interpolation**: Linear interpolation of manufacturer power curves
3. **Wind Distribution**: Simplified Weibull distribution model
4. **Output Calculation**: `Average_Power = f(wind_speed)` using generator's power curve
5. **Monthly Energy**: `Average_Power × Hours_per_Month`

### Power Budget

1. **Total Generation**: Sum of solar, wind, and other sources
2. **Total Consumption**: Sum of all equipment loads weighted by duty cycle
3. **Net Energy**: `Generation - Consumption` for each month
4. **Battery Simulation**: Day-by-day state of charge calculation considering:
   - Daily net energy
   - Battery capacity limits
   - Depth of discharge constraints

## API Information

### NASA POWER API

- **Endpoint**: `https://power.larc.nasa.gov/api/temporal/monthly/point`
- **Coverage**: Global
- **Data**: Solar and meteorological parameters
- **Free**: No API key required
- **Documentation**: https://power.larc.nasa.gov/docs/

### NOAA Weather API

- **Endpoint**: `https://api.weather.gov/points/{lat},{lon}`
- **Coverage**: United States and territories
- **Data**: Weather forecasts and observations
- **Free**: No API key required
- **Note**: Historical wind averages require manual input
- **Documentation**: https://www.weather.gov/documentation/services-web-api

## Tips for Accurate Results

1. **Use actual measurements** for wind speed data when available
2. **Consider seasonal variations** - worst-case months determine system sizing
3. **Account for degradation** - solar panels lose ~0.5% efficiency per year
4. **Include safety margins** - design for 3-7 days of battery autonomy
5. **Panel orientation**:
   - For northern hemisphere: face south, tilt = latitude
   - For southern hemisphere: face north, tilt = latitude
   - For buoys with multiple surfaces: add panels for each orientation
6. **Wind generators**:
   - Offshore locations typically have higher average wind speeds
   - Consider seasonal variation (winter winds are typically stronger)

## Project Structure

```
buoy-power-budget/
├── index.html              # Main application page
├── styles.css              # Application styles
├── js/
│   ├── models.js           # Data models (Load, Battery, SolarPanel, etc.)
│   ├── calculations.js     # Power budget calculation engine
│   ├── app.js              # Main application controller
│   ├── api/
│   │   ├── nasa-power.js   # NASA POWER API integration
│   │   └── noaa-weather.js # NOAA Weather API integration
│   ├── ui/
│   │   ├── load-manager.js        # Equipment loads UI
│   │   ├── battery-manager.js     # Battery configuration UI
│   │   ├── solar-manager.js       # Solar panels UI
│   │   ├── wind-manager.js        # Wind generators UI
│   │   └── results-dashboard.js   # Results and charts UI
│   └── utils/
│       ├── solar-geometry.js      # Solar position calculations
│       └── wind-calculations.js   # Wind power calculations
└── data/
    ├── equipment-templates.json   # Common equipment library
    └── wind-generators.json       # Wind generator specifications
```

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires modern browser with ES6 support and Canvas/Chart.js compatibility.

## Limitations

- Solar calculations use monthly averages (not hourly simulation)
- Wind power calculations use simplified Weibull distribution
- Temperature effects on batteries not modeled
- No accounting for wave action, icing, or other environmental factors
- API availability depends on internet connection

## Future Enhancements

Potential features for future versions:
- Hourly simulation for more accurate battery SOC
- Fuel cell and thermoelectric generator models
- Wave energy converter integration
- Environmental factor modeling (icing, biofouling)
- Multi-year degradation analysis
- Optimization recommendations
- PDF report generation
- Cloud storage and collaboration

## License

This project is provided as-is for educational and research purposes.

## Credits

- Solar data: NASA POWER Project
- Wind data: NOAA National Weather Service
- Visualization: Chart.js
- Equipment specifications: Various manufacturer datasheets

## Support

For questions, issues, or feature requests, please consult the documentation or contact your system administrator.

---

**Version**: 1.0.0  
**Last Updated**: January 2026
