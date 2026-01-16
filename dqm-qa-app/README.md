# DQM QA Check Mobile Application

A mobile-compatible web application for conducting USACE Dredging Quality Management Program (DQM) field QA checks.

## Features

✅ **Mobile-First Design** - Touch-friendly interface optimized for field use  
✅ **Multiple Vessel Support** - Add multiple plants per QA check  
✅ **Profile-Based Forms** - Dynamic forms based on vessel type and profile  
✅ **GPS Integration** - Automatic position capture using device GPS  
✅ **Offline Capable** - Works completely offline with local storage  
✅ **JSON Export** - Export data with dynamic filenames  
✅ **Auto-Save** - Automatic draft saving to prevent data loss  
✅ **Dark Mode** - Premium dark theme for outdoor visibility  

## Supported Vessels & Profiles

### Scow
- **Monitoring Profile**: Position check, hull status check, draft sensor checks
- **Ullage Profile**: Position check, hull status check, draft sensor checks, ullage check

### Hopper Dredge
- **Standard Profile**: Position check, hull status check, draft sensor checks, ullage check, draghead depth check

### Pipeline Dredge
- **Standard Profile**: Position check, suction mouth depth check, velocity check
- **Small Business Profile**: Position check, suction mouth depth check

## Quick Start

1. Open `index.html` in a web browser (Chrome, Safari, Firefox, Edge)
2. Fill in the check date and inspector information
3. Add plants by filling in the plant name, vessel type, and profile
4. Complete the relevant QA check forms that appear
5. Click "💾 Save Draft" to save your progress (auto-saves as you type)
6. Click "📥 Export JSON" to download your completed check

## GPS Usage

For position checks, click the "📡 Capture Device GPS" button to automatically fill in latitude and longitude from your device's GPS. Make sure to allow location access when prompted by your browser.

**Note**: GPS accuracy depends on your device and environment. For best results:
- Use outdoors with clear sky view
- Wait for GPS to acquire satellites
- Allow location access in browser settings

## Data Export

Exported JSON files follow this naming convention:
- Single plant: `DQM_QA_PlantName_2026-01-16.json`
- Multiple plants: `DQM_QA_Plant1_Plant2_2026-01-16.json`

The JSON file contains all metadata and QA check data in a structured format for further processing.

## Data Persistence

The application automatically saves your work to browser local storage. Your data will persist even if you close the browser or lose connection. To clear all data, click "🗑️ Clear All" (requires confirmation).

## Browser Compatibility

- ✅ Chrome/Edge (recommended)
- ✅ Safari (iOS/macOS)
- ✅ Firefox
- ✅ Mobile browsers

## Files

- `index.html` - Main application page
- `styles.css` - Styling and responsive design
- `app.js` - Application logic and functionality

## Technical Details

- Pure HTML/CSS/JavaScript (no frameworks required)
- Uses browser Geolocation API for GPS
- LocalStorage API for data persistence
- Responsive CSS Grid for layouts
- Touch-friendly controls (44px minimum)

## Privacy & Security

- All data stays on your device
- No external servers or data transmission
- Data only exports when you click "Export JSON"
- GPS coordinates only captured when you click the GPS button

## Future Enhancements

- Camera integration for direct photo capture
- Import JSON to resume/edit previous checks
- PDF export option
- Data validation warnings
- Multi-language support

---

**USACE National Dredging Quality Management Program**
