# CSV Import Instructions

## Quick Start

1. **Download the template**: Use [import-template.csv](file:///C:/Users/willi/.gemini/antigravity/scratch/pilot-logbook/import-template.csv) as your starting point
2. **Fill in your data**: Edit the CSV file with your flight information
3. **Import**: Click the "Import CSV" button in the logbook application and select your file

## CSV Format

### Required Fields
- `date` - Flight date in YYYY-MM-DD format (e.g., 2026-01-15)
- `aircraft` - Aircraft registration (e.g., N12345)
- `from` - Departure airport code (e.g., KJFK)
- `to` - Arrival airport code (e.g., KBOS)
- `totalTime` - Total flight time in hours (e.g., 2.5)

### Optional Fields
All other fields are optional. Leave blank or use 0 if not applicable:

**Aircraft Information**:
- `aircraftType` - Aircraft make/model (e.g., C172, PA-28-180)

**Flight Times** (in hours):
- `picTime` - Pilot in command time
- `dualTime` - Dual received time
- `crossCountryTime` - Cross country time
- `nightTime` - Night time
- `instrumentTime` - Total instrument time (or use actualInstrument + simulatedInstrument)
- `actualInstrument` - Actual instrument time
- `simulatedInstrument` - Simulated instrument time (hood/foggles)
- `simulatorTime` - Flight simulator/FTD time
- `highPerformance` - High performance aircraft time
- `complex` - Complex aircraft time

**Takeoffs & Landings** (counts):
- `dayTakeoffs` - Day takeoffs
- `dayLandings` - Day landings
- `nightTakeoffs` - Night takeoffs
- `nightLandings` - Night full-stop landings

**Instrument Operations** (counts):
- `approaches` - Instrument approaches
- `holds` - Holding procedures

**Notes**:
- `remarks` - Any additional notes about the flight

## Example CSV

```csv
date,aircraft,aircraftType,from,to,totalTime,picTime,nightTime,approaches,remarks
2026-01-15,N12345,C172,KJFK,KBOS,2.5,2.5,0,0,Practice flight
2026-01-14,N67890,PA-28-180,KBOS,KLGA,1.5,1.5,0.5,2,Night currency
```

## Tips

- **Excel/Google Sheets**: You can use spreadsheet software to edit the CSV
- **Commas in text**: If your remarks contain commas, wrap the text in quotes: `"Practice flight, good weather"`
- **Date format**: Always use YYYY-MM-DD format for dates
- **Decimal numbers**: Use periods (not commas) for decimals: `2.5` not `2,5`
- **Empty fields**: Leave blank or use 0 for numeric fields

## Common Issues

**Import fails**:
- Check that the first row contains the exact header names from the template
- Verify dates are in YYYY-MM-DD format
- Ensure numeric fields contain only numbers (no text)

**Missing data after import**:
- Verify the column headers match exactly (case-sensitive)
- Check for extra spaces in header names

## Exporting from Other Systems

If you're migrating from another logbook:

1. Export your data as CSV from your current system
2. Open in Excel/Google Sheets
3. Rearrange columns to match the template headers
4. Save as CSV
5. Import into this application

Need help? Check that your CSV file opens correctly in a text editor and matches the template format.
