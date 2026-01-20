# Weber DCOE 40 Configuration Calculator

A comprehensive web-based carburetor configuration tool for Weber DCOE 40 dual-throat sidedraft carburetors. This standalone application provides calculations, real-world examples, interactive tuning simulation, and troubleshooting guides.

## Features

✅ **Configuration Calculator** - Calculate optimal jetting based on engine specifications
✅ **12 Real-World Examples** - Verified configurations from classic engines
✅ **Interactive Simulator** - Experiment with component changes and see real-time impact
✅ **Troubleshooting Guide** - Comprehensive symptom-based diagnostics
✅ **Tuning Procedure** - Systematic step-by-step tuning approach

## Usage

### Run Standalone (No Web Server Required)

Simply open `index.html` in any modern web browser. The application works completely offline with no dependencies.

### Features Overview

#### Calculator
1. Select a preset or enter custom engine specifications
2. Configure displacement, compression ratio, RPM, camshaft, usage
3. Click "Calculate Configuration" to get jetting recommendations

#### Interactive Simulator
1. Calculate a configuration or load an example
2. Go to the Simulator tab
3. Click "From Calculator" to load baseline
4. Adjust components (main jet, air corrector, etc.) with +/- buttons
5. See instant feedback on mixture status across all RPM ranges
6. View performance characteristic predictions
7. Get safety warnings for dangerous configurations

#### Example Configurations
- Filter by usage type (street/sport/race) or verified status
- Click any configuration to load it into the calculator
- Includes: Triumph TR250/TR6, Ford Kent, Alfa Romeo, BMW M10, VW Type 1, MG B-Series, Porsche 911, Datsun 240Z, Mini Cooper S, Fiat 124 Spider

#### Troubleshooting
- Search by symptom (hesitation, backfire, etc.)
- Filter by RPM range (idle, transition, mid-range, high RPM)
- Get specific causes and solutions for each problem

## Files

- `index.html` - Main application (open this file)
- `app.js` - Bundled JavaScript (all modules combined)
- `styles.css` - Styling and design
- `README.md` - This file

## Technical Details

- Pure HTML/CSS/JavaScript - no frameworks or dependencies
- Runs entirely client-side
- Works offline
- Mobile-responsive design
- Based on proven Weber tuning formulas and real-world data

## Browser Compatibility

Works in all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

Educational and personal use.

## Credits

Formulas and jetting data sourced from Weber tuning manuals, classic car forums, and verified real-world configurations.
