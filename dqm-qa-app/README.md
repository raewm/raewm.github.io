# DQM QA Check Application (Field Audit Tool)

## Overview
The **DQM QA Check Application** is a mobile-optimized web tool designed for USACE QA Team Members and Inspectors to perform standardized Quality Assurance (QA) audits on dredging vessels. It ensures that onboard DQM systems are accurately reporting critical data (depth, draft, position) by comparing system readings against physical manual measurements.

## Core Features
- **Multi-Plant Management**: Perform audits for multiple vessels (Scows, Hoppers, Pipelines) within a single session.
- **SOP-Aligned Checks**: Guided forms for:
    - **GPS Position Check**: Compare handheld GPS against ship system.
    - **Draft Sensor Check**: Verify light, loaded, and simulated draft readings.
    - **Ullage Check**: Measure remaining hopper capacity.
    - **Draghead/Suction Depth**: Physical tape verification of head depth.
    - **Velocity Check**: Dye tests or external flow meter comparisons.
    - **Hull Status**: Monitor closure status and physical condition.
- **Visual Verification**: Integrated buttons to **Take Photo** or **Upload Photo** directly into the audit record.
- **Real-time Calculations**: Automatic calculation of "Difference" values based on manual and system inputs.
- **Draft Persistence**: Auto-saves your progress locally in the browser to prevent data loss.

## User Workflow
1. **Initialize Audit**: Add vessels using the "+ Add New Plant" button.
2. **Select Vessel Type**: Choose between Hopper, Scow, Pipeline, or Mechanical to load relevant check modules.
3. **Data Entry**: Navigate through the collapsible sections. Enter physical measurements in the "Manual" fields and read values from the ship's DQM display for the "DQM" fields.
4. **Log to Timeline**: Use the "Log to Timeline" buttons after completing a check to create a chronological record of the audit.
5. **Finalize**: Click **Generate JSON Export** at the bottom of the page to save the audit file. This file will be used by the **DQM Trip Report Generator**.

## Browser Compatibility
Supports all modern browsers (Chrome, Edge, Safari, Firefox). Optimized for tablets and smartphones.
