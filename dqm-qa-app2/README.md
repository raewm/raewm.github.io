# DQM QA Check (Optimized Unified Audit)

## Overview
**DQM QA Check** is the modern, streamlined interface for performing DQM system audits. It features a neutral "DQM Blue" professional theme and is specifically optimized for multi-vessel operations where speed and clear visual feedback are paramount.

## Key Improvements
- **Two-Step Workflow**: Uses a sequential "Plant -> Check" selection process to reduce errors and improve speed.
- **Visual Feedback System**:
    - **Check Completeness**: Individual check buttons (e.g., Draft Light) turn solid green once a record is logged to the timeline.
    - **Vessel Readiness**: Vessel selection buttons turn green once all required checks for that plant's profile have been completed.
- **Unified Theme**: A professional high-contrast dark theme designed for visibility in direct sunlight or dark bridge environments.
- **Stability**: Integrated crash protection for large photo uploads, ensuring data persistence even on hardware with limited resources.

## User Workflow
1. **Choose Vessel**: On the main dashboard, select the vessel you are currently auditing.
2. **Select Check**: Choose the specific QA check category from the filtered list.
3. **Capture & Compare**: 
    - Enter Manual and DQM system data.
    - Use "Capture Signature" or "Photo" if required.
    - View the instant difference calculation.
4. **Log & Confirm**: Click "Log to Timeline". The button will turn green, indicating the data is saved for this session.
5. **Report Preparation**: Once all vessels are audited, use the **JSON Export** feature to save the master audit file.

## Data Persistence
The app uses browser-based local storage. Your progress is saved as you work. If you accidentally close the browser, your data will be restored upon re-opening.
