// Main Application Logic for DPIP Review
const AppState = {
    metadata: {
        reviewerName: '',
        reviewDate: '',
        plantName: '',
        plantType: '',
        generalComments: ''
    },
    checklist: {}
};

const DQM_DPIP_STORAGE_KEY = 'dqm_dpip_draft';

// DOM Elements
const elements = {
    reviewerName: document.getElementById('reviewer-name'),
    reviewDate: document.getElementById('review-date'),
    plantName: document.getElementById('plant-name'),
    plantType: document.getElementById('plant-type'),
    generalComments: document.getElementById('general-comments'),
    
    themeToggle: document.getElementById('theme-toggle'),
    exportPdfBtn: document.getElementById('export-pdf-btn'),
    exportJsonBtn: document.getElementById('export-json-btn'),
    importJsonBtn: document.getElementById('import-json-btn'),
    importFile: document.getElementById('import-file'),
    clearBtn: document.getElementById('clear-btn'),
    
    checklistSubtitle: document.getElementById('checklist-subtitle'),
    checklistContainer: document.getElementById('checklist-container')
};

function init() {
    if (!elements.reviewDate.value) {
        elements.reviewDate.valueAsDate = new Date();
    }
    loadDraft();
    setupEventListeners();
    renderChecklist();
}

function setupEventListeners() {
    elements.reviewerName.addEventListener('input', (e) => { AppState.metadata.reviewerName = e.target.value; saveDraft(); });
    elements.reviewDate.addEventListener('change', (e) => { AppState.metadata.reviewDate = e.target.value; saveDraft(); });
    elements.plantName.addEventListener('input', (e) => { AppState.metadata.plantName = e.target.value; saveDraft(); });
    elements.plantType.addEventListener('change', (e) => { 
        AppState.metadata.plantType = e.target.value; 
        AppState.checklist = {}; 
        saveDraft(); 
        renderChecklist();
    });
    elements.generalComments.addEventListener('input', (e) => { AppState.metadata.generalComments = e.target.value; saveDraft(); });

    if (elements.themeToggle) elements.themeToggle.addEventListener('click', toggleTheme);
    if (elements.clearBtn) elements.clearBtn.addEventListener('click', clearAll);
    if (elements.exportJsonBtn) elements.exportJsonBtn.addEventListener('click', exportJson);
    if (elements.importJsonBtn) elements.importJsonBtn.addEventListener('click', () => elements.importFile && elements.importFile.click());
    if (elements.importFile) elements.importFile.addEventListener('change', importJson);
    if (elements.exportPdfBtn) elements.exportPdfBtn.addEventListener('click', generatePdf);

    // Setup Tab Listeners — only nav-level buttons with data-tab attribute
    const tabBtns = document.querySelectorAll('.app-tabs .tab-btn[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById(targetId);
            if (target) target.classList.add('active');
            
            if (targetId === 'tab-report-preview') {
                updateReportPreview();
            }
        });
    });
}

const CHECKLISTS = {
    hopper: [
        // --- Deliverables ---
        { id: 'h-s1', section: 'Deliverables' },
        { id: 'h1',  text: 'Digital Copy of DPIP' },
        { id: 'h2',  text: 'DPIP Onboard Dredge' },
        // --- Table of Contents ---
        { id: 'h-s2', section: 'Table of Contents' },
        { id: 'h3',  text: 'Table of Contents' },
        { id: 'h4',  text: 'Tabs Separating DPIP Sections' },
        // --- Cover Page ---
        { id: 'h-s3', section: 'Cover Page' },
        { id: 'h5',  text: 'Dredge Name' },
        { id: 'h6',  text: 'DPIP Date' },
        { id: 'h7',  text: 'Dredge Photo' },
        // --- Contact Information ---
        { id: 'h-s4', section: 'Contact Information' },
        { id: 'h8',  text: 'Dredge Contacts' },
        { id: 'h9',  text: 'Dredging Company' },
        { id: 'h10', text: 'Dredging Company Contact Information' },
        { id: 'h11', text: 'Dredge Monitoring System Provider' },
        { id: 'h12', text: 'Dredge Monitoring System Provider Contact Information' },
        // --- Table of Dredge Characteristics ---
        { id: 'h-s5', section: 'Table of Dredge Characteristics' },
        { id: 'h13', text: 'Dredge Dimensions' },
        { id: 'h14', text: 'Hopper Dimensions' },
        { id: 'h15', text: 'Disposal Methods' },
        { id: 'h16', text: 'Hopper Capacity' },
        { id: 'h17', text: 'Minimum & Maximum Digging Depths' },
        { id: 'h18', text: 'Minimum & Maximum Drafts & Displacements' },
        { id: 'h19', text: 'Pump RPM & Slurry Velocity Ranges' },
        { id: 'h20', text: 'Inner Diameters of Suction & Discharge Pipes' },
        // --- Sensor Data Collection Methods ---
        { id: 'h-s6', section: 'Sensor Data Collection Methods' },
        { id: 'h21', text: 'Any Averaging Occurring In Data Collection' },
        { id: 'h22', text: 'Data Route From Sensors to DQM Computer' },
        { id: 'h23', text: 'Internet Connection Type & Provider' },
        // --- Sensor Descriptions, Locations & Calibration Methods ---
        { id: 'h-s7', section: 'Sensor Descriptions, Locations & Calibration Methods' },
        { id: 'h24', text: 'Brand Name, Model & Accuracy', group: 'Positioning System' },
        { id: 'h25', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'h26', text: 'Sensor Location with Referenced Dimensions', sub: true },
        { id: 'h27', text: 'Brand Name, Model & Accuracy', group: 'Dredge Heading' },
        { id: 'h28', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'h29', text: 'Brand Name, Model & Accuracy', group: 'Hull Status' },
        { id: 'h30', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'h31', text: 'Sensor Locations with Referenced Dimensions', sub: true },
        { id: 'h32', text: 'Calibration Procedure', sub: true },
        { id: 'h33', text: 'Brand Name, Model & Accuracy', group: 'Draft' },
        { id: 'h34', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'h35', text: 'Sensor Locations with Referenced Dimensions', sub: true },
        { id: 'h36', text: 'Calibration Procedure', sub: true },
        { id: 'h37', text: 'Brand Name, Model & Accuracy', group: 'Ullage' },
        { id: 'h38', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'h39', text: 'Sensor Locations with Referenced Dimensions', sub: true },
        { id: 'h40', text: 'Calibration Procedure', sub: true },
        { id: 'h41', text: 'Brand Name, Model & Accuracy', group: 'Draghead Depth' },
        { id: 'h42', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'h43', text: 'Sensor Locations with Referenced Dimensions', sub: true },
        { id: 'h44', text: 'Calibration Procedure', sub: true },
        { id: 'h45', text: 'Brand Name, Model & Accuracy', group: 'Density' },
        { id: 'h46', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'h47', text: 'Sensor Locations with Referenced Dimensions', sub: true },
        { id: 'h48', text: 'Pipe Diameter at Density Instrumentation', sub: true },
        { id: 'h49', text: 'Calibration Procedure', sub: true },
        { id: 'h50', text: 'Brand Name, Model & Accuracy', group: 'Velocity' },
        { id: 'h51', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'h52', text: 'Sensor Locations with Referenced Dimensions', sub: true },
        { id: 'h53', text: 'Pipe Diameter at Velocity Instrumentation', sub: true },
        { id: 'h54', text: 'Calibration Procedure', sub: true },
        { id: 'h55', text: 'Brand Name, Model & Accuracy', group: 'Pump RPM' },
        { id: 'h56', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'h57', text: 'Sensor Locations with Referenced Dimensions', sub: true },
        { id: 'h58', text: 'Calibration Procedure', sub: true },
        { id: 'h59', text: 'Brand Name, Model & Accuracy', group: 'Pumpout (If Instrumented)' },
        { id: 'h60', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'h61', text: 'Sensor Locations with Referenced Dimensions', sub: true },
        { id: 'h62', text: 'Calibration Procedure', sub: true },
        // --- Calculated Parameters ---
        { id: 'h-s8', section: 'Calculated Parameters' },
        { id: 'h63', text: 'Method Used to Calculate Displacement', group: 'Displacement' },
        { id: 'h64', text: 'Tables of Fresh & Salt Water Displacement (Long Tons) vs. Draft (feet & tenths of feet)', sub: true },
        { id: 'h65', text: 'Method Used to Calculate Hopper Volume', group: 'Hopper Volume' },
        { id: 'h66', text: 'Tables of Hopper Volume (Cubic Yards) vs. Hopper Ullage (Ft & Tenths of Feet)', sub: true },
        { id: 'h67', text: 'Description of Datum for Ullage Measurements', sub: true },
        { id: 'h68', text: 'Method Used to Calculate Draghead Position', group: 'Draghead Position' },
        { id: 'h69', text: 'Method Used to Increment Load Number', group: 'Load Number' },
        // --- Quality Control ---
        { id: 'h-s9', section: 'Quality Control' },
        { id: 'h70', text: 'Description of Quality Control Process' },
        { id: 'h71', text: 'Log of Sensor Calibrations, Repairs & Modifications' },
        // --- Appendices ---
        { id: 'h-s10', section: 'Appendices' },
        { id: 'h72', text: 'Hydrostatic Curves' },
        { id: 'h73', text: 'Certified Displacement & Volume Tables' },
        { id: 'h74', text: 'Overall Dredge & Hopper Dimensions', group: 'Typical Plan View Drawing of Dredge in Feet' },
        { id: 'h75', text: 'Locations of Required Sensors Referenced to Uniform Longitudinal & Transverse Reference Points', sub: true },
        { id: 'h76', text: 'Distance Between Draft Sensors', sub: true },
        { id: 'h77', text: 'Distance Between Ullage Sensors', sub: true },
        { id: 'h78', text: 'Dimensions of Dragarms', sub: true },
        { id: 'h79', text: 'Overall Dredge & Hopper Dimensions', group: 'Typical Profile View Drawing of Dredge in Feet' },
        { id: 'h80', text: 'Locations of Required Sensors Referenced to Uniform Vertical & Longitudinal Reference Points', sub: true },
        { id: 'h81', text: 'Distance Between Draft Sensors & Draft Marks', sub: true },
        { id: 'h82', text: 'Typical Vessel Cross Section Through the Hopper' },
        { id: 'h83', text: 'Sensor Manuals & Certificates of Calibration' }
    ],
    pipeline: [
        // --- Deliverables ---
        { id: 'p-s1', section: 'Deliverables' },
        { id: 'p1',  text: 'Digital Copy of DPIP' },
        { id: 'p2',  text: 'DPIP Onboard Dredge' },
        // --- Table of Contents ---
        { id: 'p-s2', section: 'Table of Contents' },
        { id: 'p3',  text: 'Table of Contents' },
        { id: 'p4',  text: 'Tabs Separating DPIP Sections' },
        // --- Cover Page ---
        { id: 'p-s3', section: 'Cover Page' },
        { id: 'p5',  text: 'Dredge Name' },
        { id: 'p6',  text: 'DPIP Date' },
        { id: 'p7',  text: 'Dredge Photo' },
        // --- Contact Information ---
        { id: 'p-s4', section: 'Contact Information' },
        { id: 'p8',  text: 'Dredge Contacts' },
        { id: 'p9',  text: 'Dredging Company' },
        { id: 'p10', text: 'Dredging Company Contact Information' },
        { id: 'p11', text: 'Dredge Monitoring System Provider' },
        { id: 'p12', text: 'Dredge Monitoring System Provider Contact Information' },
        // --- Table of Dredge Characteristics ---
        { id: 'p-s5', section: 'Table of Dredge Characteristics' },
        { id: 'p13', text: 'Dredging Method (Cutter, Dustpan, etc.)' },
        { id: 'p14', text: 'Dredge Dimensions (Length, Width & Draft) (with & without idler barge, if applicable)' },
        { id: 'p15', text: 'Ladder Length' },
        { id: 'p16', text: 'Minimum & Maximum Digging Depths' },
        { id: 'p17', text: 'Minimum & Maximum Cut Width' },
        { id: 'p18', text: 'Number & Types of Pumps' },
        { id: 'p19', text: 'Minimum & Maximum Pump RPM' },
        { id: 'p20', text: 'Minimum & Maximum Slurry Velocity' },
        { id: 'p21', text: 'Inner Diameters of Suction & Discharge Pipes' },
        { id: 'p22', text: 'Dredge Advance Mechanism' },
        { id: 'p23', text: 'Cutter Spin Direction (if applicable)' },
        // --- Sensor Data Collection & Transmission Methods ---
        { id: 'p-s6', section: 'Sensor Data Collection & Transmission Methods' },
        { id: 'p24', text: 'Any Averaging Occurring In Data Collection' },
        { id: 'p25', text: 'Data Route From Sensors to DQM Computer' },
        { id: 'p26', text: 'Internet Connection Type & Provider' },
        { id: 'p27', text: 'Sensor Repair, Replacement, Installation, Modification or Calibration Methods' },
        { id: 'p28', text: 'Procedure to Change Contract Number' },
        { id: 'p29', text: 'Description of How the UTC Time Stamp Is Collected' },
        // --- Sensor Descriptions, Locations & Calibration Methods ---
        { id: 'p-s7', section: 'Sensor Descriptions, Locations & Calibration Methods' },
        { id: 'p30', text: 'Brand Name, Model & Accuracy', group: 'Cutter/Suction Head Horizontal Positioning' },
        { id: 'p31', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'p32', text: 'Sensor Location with Referenced Dimensions', sub: true },
        { id: 'p33', text: 'Brand Name, Model & Accuracy', group: 'Dredge Heading' },
        { id: 'p34', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'p35', text: 'Brand Name, Model & Accuracy', group: 'Cutter/Suction Head Depth' },
        { id: 'p36', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'p37', text: 'Sensor Location with Referenced Dimensions', sub: true },
        { id: 'p38', text: 'Calibration Procedure', sub: true },
        { id: 'p39', text: 'Brand Name, Model & Accuracy', group: 'Slurry Velocity' },
        { id: 'p40', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'p41', text: 'Sensor Location with Referenced Dimensions', sub: true },
        { id: 'p42', text: 'Pipe Diameter at Velocity Instrumentation', sub: true },
        { id: 'p43', text: 'Calibration Procedure', sub: true },
        { id: 'p44', text: 'Brand Name, Model & Accuracy', group: 'Slurry Density' },
        { id: 'p45', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'p46', text: 'Sensor Location with Referenced Dimensions', sub: true },
        { id: 'p47', text: 'Pipe Diameter at Density Instrumentation', sub: true },
        { id: 'p48', text: 'Calibration Procedure', sub: true },
        { id: 'p49', text: 'Brand Name, Model & Accuracy', group: 'Pump RPM' },
        { id: 'p50', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'p51', text: 'Sensor Location with Referenced Dimensions', sub: true },
        { id: 'p52', text: 'Calibration Procedure', sub: true },
        { id: 'p53', text: 'Brand Name, Model & Accuracy', group: 'Pump Vacuum' },
        { id: 'p54', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'p55', text: 'Sensor Location with Referenced Dimensions', sub: true },
        { id: 'p56', text: 'Calibration Procedure', sub: true },
        { id: 'p57', text: 'Brand Name, Model & Accuracy', group: 'Pump Outlet Pressure' },
        { id: 'p58', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'p59', text: 'Sensor Location with Referenced Dimensions', sub: true },
        { id: 'p60', text: 'Calibration Procedure', sub: true },
        // --- Manual & Calculated Parameters ---
        { id: 'p-s8', section: 'Manual & Calculated Parameters' },
        { id: 'p61', text: 'Method of Obtaining Vertical Correction (Tidal or River Gauge)', group: 'Vertical Correction' },
        { id: 'p62', text: 'Procedure for Updating Tide Station/River Stage Station Name', sub: true },
        { id: 'p63', text: 'Method & Procedure for Measuring & Reporting Pipe Lengths', group: 'Pipeline Lengths' },
        { id: 'p64', text: 'Method & Procedure for Reporting Booster Pumps Added or Removed from Service', group: 'Booster Pumps' },
        { id: 'p65', text: 'Method & Procedure for Calculating & Reporting Daily Dredge Advance', group: 'Dredge Advance' },
        { id: 'p66', text: 'Method Used to Report Outfall Position, Elevation & Heading', group: 'Outfall Information' },
        { id: 'p67', text: 'Brand Name, Model & Accuracy', group: 'Outfall Positioning (If Instrumented)' },
        { id: 'p68', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'p69', text: 'Sensor Location with Referenced Dimensions', sub: true },
        { id: 'p70', text: 'Brand Name, Model & Accuracy', group: 'Outfall Heading (If Instrumented)' },
        { id: 'p71', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'p72', text: 'Sensor Location with Referenced Dimensions', sub: true },
        { id: 'p73', text: 'Brand Name, Model & Accuracy', group: 'Outfall Elevation (If Instrumented)' },
        { id: 'p74', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'p75', text: 'Sensor Location with Referenced Dimensions', sub: true },
        { id: 'p76', text: 'Method & Procedure for Reporting Non-Effective Events', group: 'Non-Effective Events' },
        // --- Quality Control ---
        { id: 'p-s9', section: 'Quality Control' },
        { id: 'p77', text: 'Name of Quality Control Systems Manager' },
        { id: 'p78', text: 'Description of Quality Control Process' },
        { id: 'p79', text: 'Log of Sensor Calibrations, Repairs & Modifications' },
        // --- Appendices ---
        { id: 'p-s10', section: 'Appendices' },
        { id: 'p80', text: 'Overall Dredge & Ladder Dimensions', group: 'Typical Plan View Drawing of Dredge in Feet (Incl. Idler Barge if Applicable)' },
        { id: 'p81', text: 'Locations of Required Sensors Referenced to Uniform Longitudinal & Transverse Reference Points', sub: true },
        { id: 'p82', text: 'Dimensions of Suction & Discharge Piping', sub: true },
        { id: 'p83', text: 'Overall Dredge & Ladder Dimensions', group: 'Typical Profile View Drawing of Dredge in Feet (Incl. Idler Barge if Applicable)' },
        { id: 'p84', text: 'Locations of Required Sensors Referenced to Uniform Vertical & Longitudinal Reference Points', sub: true },
        { id: 'p85', text: 'Sensor Manuals & Certificates of Calibration' }
    ],
    mechanical: [
        // --- Deliverables ---
        { id: 'm-s1', section: 'Deliverables' },
        { id: 'm1',  text: 'Digital Copy of DPIP' },
        { id: 'm2',  text: 'DPIP Onboard Dredge' },
        // --- Table of Contents ---
        { id: 'm-s2', section: 'Table of Contents' },
        { id: 'm3',  text: 'Table of Contents' },
        { id: 'm4',  text: 'Tabs Separating DPIP Sections' },
        // --- Cover Page ---
        { id: 'm-s3', section: 'Cover Page' },
        { id: 'm5',  text: 'Dredge Name' },
        { id: 'm6',  text: 'DPIP Date' },
        { id: 'm7',  text: 'Dredge Photo' },
        // --- Contact Information ---
        { id: 'm-s4', section: 'Contact Information' },
        { id: 'm8',  text: 'Dredge Contacts' },
        { id: 'm9',  text: 'Dredging Company' },
        { id: 'm10', text: 'Dredging Company Contact Information' },
        { id: 'm11', text: 'Dredge Monitoring System Provider' },
        { id: 'm12', text: 'Dredge Monitoring System Provider Contact Information' },
        // --- Table of Dredge Characteristics ---
        { id: 'm-s5', section: 'Table of Dredge Characteristics' },
        { id: 'm13', text: 'Dredging Method (Clamshell, Excavator)' },
        { id: 'm14', text: 'Dredge Dimensions (Length, Width & Draft)' },
        { id: 'm15', text: 'Lifting Capacity' },
        { id: 'm16', text: 'Boom (and Stick) Length' },
        { id: 'm17', text: 'Bucket Capacity' },
        { id: 'm18', text: 'Minimum & Maximum Digging Depth' },
        { id: 'm19', text: 'Minimum & Maximum Swing Radius' },
        { id: 'm20', text: 'Dredge Advance Mechanism' },
        // --- Sensor Data Collection & Transmission Methods ---
        { id: 'm-s6', section: 'Sensor Data Collection & Transmission Methods' },
        { id: 'm21', text: 'Any Averaging Occurring In Data Collection' },
        { id: 'm22', text: 'Data Route From Sensors to DQM Computer' },
        { id: 'm23', text: 'Internet Connection Type & Provider' },
        { id: 'm24', text: 'Sensor Repair, Replacement, Installation, Modification or Calibration Methods' },
        { id: 'm25', text: 'Procedure to Change Contract Number' },
        // --- Sensor Descriptions, Locations & Calibration Methods ---
        { id: 'm-s7', section: 'Sensor Descriptions, Locations & Calibration Methods' },
        { id: 'm26', text: 'Brand Name, Model & Accuracy', group: 'Dredge Positioning' },
        { id: 'm27', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'm28', text: 'Sensor Location with Referenced Dimensions', sub: true },
        { id: 'm29', text: 'Brand Name, Model & Accuracy', group: 'Dredge Heading' },
        { id: 'm30', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'm31', text: 'Sensor Location with Referenced Dimensions', sub: true },
        { id: 'm32', text: 'Brand Name, Model & Accuracy', group: 'Boom Angle' },
        { id: 'm33', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'm34', text: 'Sensor Location with Referenced Dimensions', sub: true },
        { id: 'm35', text: 'Calibration Procedure', sub: true },
        { id: 'm36', text: 'Brand Name, Model & Accuracy', group: 'Bucket Position' },
        { id: 'm37', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'm38', text: 'Sensor Location with Referenced Dimensions', sub: true },
        { id: 'm39', text: 'Brand Name, Model & Accuracy', group: 'Bucket Heading' },
        { id: 'm40', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'm41', text: 'Sensor Location with Referenced Dimensions', sub: true },
        { id: 'm42', text: 'Brand Name, Model & Accuracy', group: 'Bucket Depth' },
        { id: 'm43', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'm44', text: 'Sensor Location with Referenced Dimensions', sub: true },
        { id: 'm45', text: 'Calibration Procedure', sub: true },
        { id: 'm46', text: 'Brand Name, Model & Accuracy', group: 'Vertical Correction (Tide)' },
        { id: 'm47', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 'm48', text: 'Sensor Location with Referenced Dimensions', sub: true },
        { id: 'm49', text: 'Calibration Procedure', sub: true },
        // --- Quality Control ---
        { id: 'm-s8', section: 'Quality Control' },
        { id: 'm50', text: 'Description of Quality Control Process' },
        { id: 'm51', text: 'Log of Sensor Calibrations, Repairs & Modifications' },
        // --- Appendices ---
        { id: 'm-s9', section: 'Appendices' },
        { id: 'm52', text: 'Overall Dredge & Boom Dimensions', group: 'Typical Plan View Drawing of Dredge in Feet' },
        { id: 'm53', text: 'Locations of Required Sensors Referenced to Uniform Longitudinal & Transverse Reference Points', sub: true },
        { id: 'm54', text: 'Overall Dredge & Boom Dimensions', group: 'Typical Profile View Drawing of Dredge in Feet' },
        { id: 'm55', text: 'Locations of Required Sensors Referenced to Uniform Vertical & Longitudinal Reference Points', sub: true },
        { id: 'm56', text: 'Sensor Manuals & Certificates of Calibration' }
    ],
    scow: [
        // --- Deliverables ---
        { id: 's-s1', section: 'Deliverables' },
        { id: 's1',  text: 'Digital Copy of DPIP' },
        { id: 's2',  text: 'DPIP Onboard Scow' },
        // --- Table of Contents ---
        { id: 's-s2', section: 'Table of Contents' },
        { id: 's3',  text: 'Table of Contents' },
        // --- Contact Information ---
        { id: 's-s3', section: 'Contact Information' },
        { id: 's4',  text: 'Scow Name/ID' },
        { id: 's5',  text: 'Dredging Company' },
        { id: 's6',  text: 'Dredging Company Contact Information' },
        { id: 's7',  text: 'Scow Monitoring System Provider' },
        { id: 's8',  text: 'Scow Monitoring System Provider Contact Information' },
        { id: 's9',  text: 'Sensor Repair, Replacement, Installation, Modification or Calibration Methods' },
        { id: 's10', text: 'System Power Supply' },
        { id: 's11', text: 'System Battery Charge Method' },
        { id: 's12', text: 'Procedure to Change Contract Number If Left On Past Contract End' },
        { id: 's13', text: 'System Telemetry' },
        // --- Dimensioned Drawings of the Scow ---
        { id: 's-s4', section: 'Dimensioned Drawings of the Scow' },
        { id: 's14', text: 'Typical Bin Cross Section', group: 'Typical Plan & Profile Views of the Scow' },
        { id: 's15', text: 'Overall Scow Dimensions', sub: true },
        { id: 's16', text: 'Locations of Required Sensors: Fore & Aft Perpendicular', sub: true },
        { id: 's17', text: 'Bin Length, Depth, Width & Zero Reference', sub: true },
        { id: 's18', text: 'External Hull Markings', sub: true },
        { id: 's19', text: 'Sensor Locations Referenced to Each Other', sub: true },
        { id: 's20', text: 'Criteria & Method Used to Increment Trip Number' },
        { id: 's21', text: 'Description of How the UTC Time Stamp Is Collected' },
        // --- Sensor Descriptions, Locations & Calibration Methods ---
        { id: 's-s5', section: 'Sensor Descriptions, Locations & Calibration Methods' },
        { id: 's22', text: 'Brand Name & Specifications', group: 'Positioning System' },
        { id: 's23', text: 'Sampling Rates For Data Acquisition', sub: true },
        { id: 's24', text: 'Instrument Used to Calculate COG', sub: true },
        { id: 's25', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 's26', text: 'Certificates of Calibration and/or Manufacturer Certificates of Compliance', sub: true },
        { id: 's27', text: 'Description of How Scow Speed Is Determined', sub: true },
        { id: 's28', text: 'Brand Name & Specifications', group: 'Hull Status' },
        { id: 's29', text: 'Certificates of Calibration and/or Manufacturer Certificates of Compliance', sub: true },
        { id: 's30', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 's31', text: 'Criteria for Determining Hull Open/Closed', sub: true },
        { id: 's32', text: 'Brand Name & Specifications', group: 'Heading' },
        { id: 's33', text: 'Certificates of Calibration and/or Manufacturer Certificates of Compliance', sub: true },
        { id: 's34', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 's35', text: 'Criteria Used to Determine Heading', sub: true },
        { id: 's36', text: 'Brand Name & Specifications', group: 'Draft' },
        { id: 's37', text: 'Certificates of Calibration and/or Manufacturer Certificates of Compliance', sub: true },
        { id: 's38', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 's39', text: 'Criteria Used to Determine Drafts', sub: true },
        { id: 's40', text: 'Method Used To Calculate Displacement', group: 'Displacement' },
        { id: 's41', text: 'Tables of Fresh & Salt Water Displacement (Long Tons) vs. Draft (feet & tenths of feet)', sub: true },
        { id: 's42', text: 'Are Tables Accurate Reflection of Current Configuration?', sub: true },
        { id: 's43', text: 'Brand Name & Specifications', group: 'Ullage' },
        { id: 's44', text: 'Certificates of Calibration and/or Manufacturer Certificates of Compliance', sub: true },
        { id: 's45', text: 'Calculations Done External to the Instrumentation', sub: true },
        { id: 's46', text: 'Criteria Used to Determine Ullage Soundings', sub: true },
        { id: 's47', text: 'Method Used To Calculate Bin Volume', group: 'Volume' },
        { id: 's48', text: 'Table of Bin Volume (Cubic Yards) vs. Ullage Soundings (feet & tenths of feet)', sub: true },
        { id: 's49', text: 'Are Tables Accurate Reflection of Current Configuration?', sub: true },
        // --- Contractor Data ---
        { id: 's-s6', section: 'Contractor Data' },
        { id: 's50', text: 'Backup Frequency' },
        { id: 's51', text: 'Backup Method' },
        { id: 's52', text: 'Post Processing' },
        { id: 's53', text: 'Archive Capability' },
        { id: 's54', text: 'Verification That Reported Values are Applicable to Sensors & Applications' },
        // --- Quality Control Plan ---
        { id: 's-s7', section: 'Quality Control Plan' },
        { id: 's55', text: 'Name of Quality Control Systems Manager' },
        { id: 's56', text: 'Procedures for Checking Collected Data Against Known Values' },
        { id: 's57', text: 'Procedures for Verifying Telemetry Is Functional' },
        { id: 's58', text: 'Log of Sensor Performance & Modifications' },
        { id: 's59', text: 'Log of Contractor Data Backup' }
    ]
};

function renderChecklist() {
    const type = AppState.metadata.plantType;
    elements.checklistContainer.innerHTML = '';
    
    if (!type) {
        elements.checklistSubtitle.textContent = 'Select a Plant Type to view required checklist items.';
        return;
    }

    elements.checklistSubtitle.textContent = `Required items for ${type.charAt(0).toUpperCase() + type.slice(1)} DPIP.`;
    const items = CHECKLISTS[type] || [];
    
    items.forEach(item => {
        // Section header row
        if (item.section) {
            const header = document.createElement('div');
            header.className = 'checklist-section-header';
            header.textContent = item.section;
            elements.checklistContainer.appendChild(header);
            return;
        }

        // Group label row (sensor name) — renders label then falls through to render checkbox
        if (item.group && !item.sub) {
            const groupRow = document.createElement('div');
            groupRow.className = 'checklist-group-label';
            groupRow.textContent = item.group;
            elements.checklistContainer.appendChild(groupRow);
            // Do NOT return — fall through to render the checkbox for this item
        }

        const stateEntry = AppState.checklist[item.id] || {};
        const isChecked = typeof stateEntry === 'boolean' ? stateEntry : !!stateEntry.checked;
        const commentVal = typeof stateEntry === 'object' && stateEntry !== null ? (stateEntry.comment || '') : '';

        const div = document.createElement('div');
        div.className = 'checklist-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `check-${item.id}`;
        checkbox.checked = isChecked;
        
        checkbox.addEventListener('change', (e) => {
            const cur = AppState.checklist[item.id] || {};
            AppState.checklist[item.id] = { checked: e.target.checked, comment: typeof cur === 'object' ? (cur.comment || '') : '' };
            saveDraft();
        });
        
        const label = document.createElement('label');
        label.htmlFor = `check-${item.id}`;
        label.className = 'checklist-text';
        label.textContent = item.text;

        const comment = document.createElement('textarea');
        comment.className = 'checklist-comment';
        comment.placeholder = 'Note...';
        comment.value = commentVal;
        comment.rows = 1;
        comment.addEventListener('input', (e) => {
            const cur = AppState.checklist[item.id] || {};
            AppState.checklist[item.id] = { checked: typeof cur === 'object' ? !!cur.checked : !!cur, comment: e.target.value };
            saveDraft();
        });

        div.appendChild(checkbox);
        div.appendChild(label);
        div.appendChild(comment);
        elements.checklistContainer.appendChild(div);
    });
}

function saveDraft() {
    localStorage.setItem(DQM_DPIP_STORAGE_KEY, JSON.stringify(AppState));
}

function loadDraft() {
    const saved = localStorage.getItem(DQM_DPIP_STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            
            Object.assign(AppState.metadata, parsed.metadata);
            // Migrate old checklist: boolean values -> {checked, comment}
            if (parsed.checklist) {
                for (const [k, v] of Object.entries(parsed.checklist)) {
                    if (typeof v === 'boolean') {
                        AppState.checklist[k] = { checked: v, comment: '' };
                    } else {
                        AppState.checklist[k] = v;
                    }
                }
            }
            
            elements.reviewerName.value = AppState.metadata.reviewerName;
            elements.reviewDate.value = AppState.metadata.reviewDate;
            elements.plantName.value = AppState.metadata.plantName;
            elements.plantType.value = AppState.metadata.plantType;
            elements.generalComments.value = AppState.metadata.generalComments;
        } catch (e) {
            console.error('Error loading draft', e);
        }
    }
}

function clearAll() {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
        localStorage.removeItem(DQM_DPIP_STORAGE_KEY);
        location.reload();
    }
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    elements.themeToggle.querySelector('span').textContent = isLight ? '☀️' : '🌙';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

function exportJson() {
    // Use Blob + createObjectURL instead of data: URI — required for iOS Safari compatibility
    // (iOS Safari does not honor the `download` attribute on data: URIs; it opens inline instead)
    const blob = new Blob([JSON.stringify(AppState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Standardized filename: app name + plant name + live timestamp (HH-MM, colon-safe)
    const plantName = (AppState.metadata.plantName || 'Unnamed-Plant').trim().replace(/\s+/g, '_');
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;

    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', url);
    dlAnchorElem.setAttribute('download', `DPIP-Review_${plantName}_${ts}.json`);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    document.body.removeChild(dlAnchorElem);
    URL.revokeObjectURL(url);
}

function importJson(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const parsed = JSON.parse(evt.target.result);
                // Simple wipe and load
                localStorage.setItem(DQM_DPIP_STORAGE_KEY, JSON.stringify(parsed));
                location.reload();
            } catch (err) {
                alert('Invalid JSON file');
            }
        };
        reader.readAsText(file);
    }
}

function generatePdf() {
    const pContainer = document.getElementById('print-container');
    pContainer.innerHTML = buildReportHtml();
    window.print();
    setTimeout(() => { pContainer.innerHTML = ''; }, 1000);
}

function updateReportPreview() {
    const previewContainer = document.getElementById('report-preview-container');
    if (previewContainer) {
        previewContainer.innerHTML = buildReportHtml();
    }
}

function buildReportHtml() {
    const md = AppState.metadata;
    const items = CHECKLISTS[md.plantType] || [];
    
    let checklistHtml = items.map(item => {
        if (item.section) {
            return `<tr><td colspan="3" style="background:#1a6aad;color:#fff;font-weight:700;font-size:0.8rem;letter-spacing:0.05em;text-transform:uppercase;padding:5px 8px;print-color-adjust:exact;-webkit-print-color-adjust:exact;">${item.section}</td></tr>`;
        }
        // Group label row (sensor name) — renders label AND the item's checkbox row
        if (item.group && !item.sub) {
            const groupLabelRow = `<tr><td colspan="3" style="font-weight:600;font-size:0.82rem;background:#dce8f5;border-left:3px solid #1a6aad;color:#0d2a45;padding:4px 8px 4px 10px;print-color-adjust:exact;-webkit-print-color-adjust:exact;">${item.group}</td></tr>`;
            const stateEntry = AppState.checklist[item.id] || {};
            const isChecked = typeof stateEntry === 'boolean' ? stateEntry : !!stateEntry.checked;
            const comment = typeof stateEntry === 'object' && stateEntry !== null ? (stateEntry.comment || '') : '';
            const itemRow = `<tr>
                <td style="width:4%; text-align:center; font-size:15px; vertical-align:top;">${isChecked ? '☑' : '☐'}</td>
                <td style="vertical-align:top;">${item.text}</td>
                <td style="color:#555; font-size:0.82rem; vertical-align:top;">${comment ? comment.replace(/\n/g,'<br>') : '<span style="color:#bbb;">—</span>'}</td>
            </tr>`;
            return groupLabelRow + itemRow;
        }
        const stateEntry = AppState.checklist[item.id] || {};
        const isChecked = typeof stateEntry === 'boolean' ? stateEntry : !!stateEntry.checked;
        const comment = typeof stateEntry === 'object' && stateEntry !== null ? (stateEntry.comment || '') : '';
        return `<tr>
            <td style="width:4%; text-align:center; font-size:15px; vertical-align:top;">${isChecked ? '☑' : '☐'}</td>
            <td style="vertical-align:top;">${item.text}</td>
            <td style="color:#555; font-size:0.82rem; vertical-align:top;">${comment ? comment.replace(/\n/g,'<br>') : '<span style="color:#bbb;">—</span>'}</td>
        </tr>`;
    }).join('');

    return `
    <style>
        /* Force background colors in preview and print (fixes blacked-out section headers) */
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        .report-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; color: black; }
        .report-table th, .report-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .report-table th { background-color: #f2f2f2; font-weight: bold; }
        .preview-wrapper { color: black; font-family: sans-serif; background: white; padding: 20px; border-radius: 8px; }
        .preview-wrapper h2, .preview-wrapper h3, .preview-wrapper h4 { color: black; }
        .preview-wrapper h2 { border-bottom: 2px solid black; padding-bottom: 5px; margin-top: 0; }
        .preview-wrapper h3 { border-bottom: 2px solid black; padding-bottom: 5px; margin-top: 20px; }
        @media print {
            body * { visibility: hidden; }
            .container { display: none !important; }
            #print-container, #print-container * { visibility: visible; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            #print-container { position: absolute; left: 0; top: 0; width: 100%; display: block !important; padding: 20px; font-family: sans-serif; color: black; background: white; }
        }
    </style>
    <div class="preview-wrapper">
        <div style="text-align:center; margin-bottom:20px;">
            <h2 style="border:none;">DQM DPIP Review Report</h2>
        </div>
        
        <h3>Review Information</h3>
        <table class="report-table">
            <tr><th>Plant Name</th><td>${md.plantName || 'N/A'}</td><th>Plant Type</th><td><span style="text-transform: capitalize;">${md.plantType || 'N/A'}</span></td></tr>
            <tr><th>Review Date</th><td>${md.reviewDate || 'N/A'}</td><th>Reviewer</th><td>${md.reviewerName || 'N/A'}</td></tr>
            <tr><th>General Comments</th><td colspan="3">${md.generalComments || 'None'}</td></tr>
        </table>

        <h3>Document Checklist</h3>
        <table class="report-table">
            <tr><th style="width:4%;"></th><th>Item</th><th style="width:28%;">Notes / Comments</th></tr>
            ${checklistHtml || '<tr><td colspan="3">No checklist items available.</td></tr>'}
        </table>

    </div>
    `;
}

document.addEventListener('DOMContentLoaded', init);
