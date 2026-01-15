// Main Application Controller

let config;
let loadManager;
let batteryManager;
let solarManager;
let windManager;
let resultsManager;

// Initialize application
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
});

function initializeApp() {
    // Create new project configuration
    config = new ProjectConfig();
    config.projectName = 'Buoy Power Budget';

    // Add default battery
    config.batteries.push(new Battery('Lead-Acid', 12, 200, 2, 50));

    // Initialize UI managers
    loadManager = new LoadManager('loads-container', config);
    batteryManager = new BatteryManager('batteries-container', config);
    solarManager = new SolarManager('solar-container', config);
    windManager = new WindManager('wind-container', config);
    resultsManager = new ResultsManager('results-container', config);

    // Make managers globally accessible
    window.loadManager = loadManager;
    window.batteryManager = batteryManager;
    window.solarManager = solarManager;
    window.windManager = windManager;
    window.resultsManager = resultsManager;

    // Setup tab navigation
    setupTabs();

    console.log('Application initialized successfully');
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const targetId = this.getAttribute('data-tab');

            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            this.classList.add('active');
            document.getElementById(targetId).classList.add('active');
        });
    });
}

function calculateBudget() {
    // Validate minimum requirements
    if (config.loads.length === 0) {
        alert('Please add at least one equipment load before calculating.');
        return;
    }

    // Check for power sources
    const hasSolar = config.solarPanels.length > 0;
    const hasWind = config.windGenerators.length > 0;
    const hasOther = config.otherSources.length > 0;

    if (!hasSolar && !hasWind && !hasOther) {
        alert('Please add at least one power source (solar, wind, or other) before calculating.');
        return;
    }

    // Check if solar data is needed but missing
    if (hasSolar && !config.solarData) {
        const proceed = confirm('Solar panels are configured but solar radiation data has not been fetched. The calculation may be inaccurate. Do you want to continue?');
        if (!proceed) {
            // Switch to solar tab
            document.querySelector('[data-tab="solar"]').click();
            return;
        }
    }

    // Check if wind data is needed but missing
    if (hasWind && !config.windData) {
        const proceed = confirm('Wind generators are configured but wind speed data has not been entered. The calculation may be inaccurate. Do you want to continue?');
        if (!proceed) {
            // Switch to wind tab
            document.querySelector('[data-tab="wind"]').click();
            return;
        }
    }

    // Perform calculation
    resultsManager.calculate();

    // Switch to results tab
    document.querySelector('[data-tab="results"]').click();
}

function importProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = function (event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = JSON.parse(e.target.result);
                config = ProjectConfig.fromJSON(data);

                // Reinitialize all managers with new config
                loadManager.config = config;
                batteryManager.config = config;
                solarManager.config = config;
                windManager.config = config;
                resultsManager.config = config;

                // Re-render all managers
                loadManager.render();
                batteryManager.render();
                solarManager.render();
                windManager.render();
                resultsManager.calculate();

                alert('Project imported successfully!');
            } catch (error) {
                alert('Error importing project: ' + error.message);
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

function exportProject() {
    config.exportToFile();
}

function newProject() {
    if (confirm('Create a new project? This will clear all current data.')) {
        location.reload();
    }
}

function updateProjectName() {
    const name = document.getElementById('project-name').value;
    config.projectName = name || 'Buoy Power Budget';
}
