// Pilot Logbook Application - Enhanced Version
// Data structure and state management

let flights = [];
let editingFlightId = null;
let userProfile = {
  name: '',
  certificateNumber: '',
  medicalExpiration: null,
  lastBFRDate: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  setupEventListeners();
  loadFromSession();
  updateDashboard();
  renderFlightTable();
  updateUserDisplay();
  updateAircraftDatalist();
});

function initializeApp() {
  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('date').value = today;
}

function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Flight form submission
  document.getElementById('flightForm').addEventListener('submit', handleFlightSubmit);
  document.getElementById('cancelBtn').addEventListener('click', resetFlightForm);

  // Edit form submission
  document.getElementById('editFlightForm').addEventListener('submit', handleEditSubmit);

  // Settings
  document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
  document.getElementById('settingsForm').addEventListener('submit', handleSettingsSubmit);

  // CSV Template Download
  document.getElementById('downloadTemplateBtn').addEventListener('click', downloadCSVTemplate);

  // Aircraft autocomplete
  document.getElementById('aircraft').addEventListener('input', handleAircraftInput);
  document.getElementById('editAircraft').addEventListener('input', handleEditAircraftInput);

  // Save/Load buttons
  document.getElementById('saveBtn').addEventListener('click', saveToFile);
  document.getElementById('loadFile').addEventListener('change', loadFromFile);
  document.getElementById('importCSV').addEventListener('change', importFromCSV);

  // Table sorting
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => sortTable(th.dataset.sort));
  });

  // Modal close on background click
  document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') closeEditModal();
  });
  document.getElementById('settingsModal').addEventListener('click', (e) => {
    if (e.target.id === 'settingsModal') closeSettingsModal();
  });
}

// View Management
function switchView(viewName) {
  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Update views
  document.querySelectorAll('.view').forEach(view => {
    view.classList.toggle('active', view.id === viewName);
  });
}

// Settings Modal
function openSettingsModal() {
  // Populate form with current profile
  document.getElementById('pilotName').value = userProfile.name || '';
  document.getElementById('certificateNumber').value = userProfile.certificateNumber || '';
  document.getElementById('medicalExpiration').value = userProfile.medicalExpiration || '';
  document.getElementById('lastBFRDate').value = userProfile.lastBFRDate || '';

  document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('active');
}

function handleSettingsSubmit(e) {
  e.preventDefault();

  userProfile.name = document.getElementById('pilotName').value;
  userProfile.certificateNumber = document.getElementById('certificateNumber').value;
  userProfile.medicalExpiration = document.getElementById('medicalExpiration').value;
  userProfile.lastBFRDate = document.getElementById('lastBFRDate').value;

  saveToSession();
  updateUserDisplay();
  updateDashboard();
  closeSettingsModal();
}

function updateUserDisplay() {
  const display = document.getElementById('userNameDisplay');
  if (userProfile.name) {
    display.textContent = `- ${userProfile.name}`;
  } else {
    display.textContent = '';
  }
}

// Flight Form Handling
function handleFlightSubmit(e) {
  e.preventDefault();

  const flight = {
    id: Date.now().toString(),
    date: document.getElementById('date').value,
    aircraft: document.getElementById('aircraft').value,
    aircraftType: document.getElementById('aircraftType').value,
    from: document.getElementById('from').value.toUpperCase(),
    via: document.getElementById('via').value.toUpperCase(),
    to: document.getElementById('to').value.toUpperCase(),
    totalTime: parseFloat(document.getElementById('totalTime').value) || 0,
    picTime: parseFloat(document.getElementById('picTime').value) || 0,
    dualTime: parseFloat(document.getElementById('dualTime').value) || 0,
    crossCountryTime: parseFloat(document.getElementById('crossCountryTime').value) || 0,
    nightTime: parseFloat(document.getElementById('nightTime').value) || 0,
    actualInstrument: parseFloat(document.getElementById('actualInstrument').value) || 0,
    simulatedInstrument: parseFloat(document.getElementById('simulatedInstrument').value) || 0,
    simulatorTime: parseFloat(document.getElementById('simulatorTime').value) || 0,
    highPerformance: parseFloat(document.getElementById('highPerformance').value) || 0,
    complex: parseFloat(document.getElementById('complex').value) || 0,
    dayTakeoffs: parseInt(document.getElementById('dayTakeoffs').value) || 0,
    dayLandings: parseInt(document.getElementById('dayLandings').value) || 0,
    nightTakeoffs: parseInt(document.getElementById('nightTakeoffs').value) || 0,
    nightLandings: parseInt(document.getElementById('nightLandings').value) || 0,
    approaches: parseInt(document.getElementById('approaches').value) || 0,
    holds: parseInt(document.getElementById('holds').value) || 0,
    remarks: document.getElementById('remarks').value
  };

  flights.push(flight);
  saveToSession();
  resetFlightForm();
  updateDashboard();
  renderFlightTable();
  updateAircraftDatalist();
}

function resetFlightForm() {
  document.getElementById('flightForm').reset();
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('date').value = today;
}

// Edit Flight
function editFlight(id) {
  const flight = flights.find(f => f.id === id);
  if (!flight) return;

  editingFlightId = id;

  // Populate edit form
  document.getElementById('editFlightId').value = flight.id;
  document.getElementById('editDate').value = flight.date;
  document.getElementById('editAircraft').value = flight.aircraft;
  document.getElementById('editAircraftType').value = flight.aircraftType || '';
  document.getElementById('editFrom').value = flight.from;
  document.getElementById('editVia').value = flight.via || '';
  document.getElementById('editTo').value = flight.to;
  document.getElementById('editTotalTime').value = flight.totalTime;
  document.getElementById('editPicTime').value = flight.picTime || 0;
  document.getElementById('editDualTime').value = flight.dualTime || 0;
  document.getElementById('editCrossCountryTime').value = flight.crossCountryTime || 0;
  document.getElementById('editNightTime').value = flight.nightTime || 0;
  document.getElementById('editActualInstrument').value = flight.actualInstrument || 0;
  document.getElementById('editSimulatedInstrument').value = flight.simulatedInstrument || 0;
  document.getElementById('editSimulatorTime').value = flight.simulatorTime || 0;
  document.getElementById('editHighPerformance').value = flight.highPerformance || 0;
  document.getElementById('editComplex').value = flight.complex || 0;
  document.getElementById('editDayTakeoffs').value = flight.dayTakeoffs || 0;
  document.getElementById('editDayLandings').value = flight.dayLandings || 0;
  document.getElementById('editNightTakeoffs').value = flight.nightTakeoffs || 0;
  document.getElementById('editNightLandings').value = flight.nightLandings || 0;
  document.getElementById('editApproaches').value = flight.approaches || 0;
  document.getElementById('editHolds').value = flight.holds || 0;
  document.getElementById('editRemarks').value = flight.remarks || '';

  // Show modal
  document.getElementById('editModal').classList.add('active');
}

function handleEditSubmit(e) {
  e.preventDefault();

  const id = editingFlightId;
  const flightIndex = flights.findIndex(f => f.id === id);

  if (flightIndex === -1) return;

  flights[flightIndex] = {
    id: id,
    date: document.getElementById('editDate').value,
    aircraft: document.getElementById('editAircraft').value,
    aircraftType: document.getElementById('editAircraftType').value,
    from: document.getElementById('editFrom').value.toUpperCase(),
    via: document.getElementById('editVia').value.toUpperCase(),
    to: document.getElementById('editTo').value.toUpperCase(),
    totalTime: parseFloat(document.getElementById('editTotalTime').value) || 0,
    picTime: parseFloat(document.getElementById('editPicTime').value) || 0,
    dualTime: parseFloat(document.getElementById('editDualTime').value) || 0,
    crossCountryTime: parseFloat(document.getElementById('editCrossCountryTime').value) || 0,
    nightTime: parseFloat(document.getElementById('editNightTime').value) || 0,
    actualInstrument: parseFloat(document.getElementById('editActualInstrument').value) || 0,
    simulatedInstrument: parseFloat(document.getElementById('editSimulatedInstrument').value) || 0,
    simulatorTime: parseFloat(document.getElementById('editSimulatorTime').value) || 0,
    highPerformance: parseFloat(document.getElementById('editHighPerformance').value) || 0,
    complex: parseFloat(document.getElementById('editComplex').value) || 0,
    dayTakeoffs: parseInt(document.getElementById('editDayTakeoffs').value) || 0,
    dayLandings: parseInt(document.getElementById('editDayLandings').value) || 0,
    nightTakeoffs: parseInt(document.getElementById('editNightTakeoffs').value) || 0,
    nightLandings: parseInt(document.getElementById('editNightLandings').value) || 0,
    approaches: parseInt(document.getElementById('editApproaches').value) || 0,
    holds: parseInt(document.getElementById('editHolds').value) || 0,
    remarks: document.getElementById('editRemarks').value
  };

  saveToSession();
  closeEditModal();
  updateDashboard();
  renderFlightTable();
  updateAircraftDatalist();
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('active');
  editingFlightId = null;
}

// Aircraft Autocomplete
function handleAircraftInput(e) {
  const aircraft = e.target.value.trim();
  const flight = flights.find(f => f.aircraft === aircraft);

  if (flight && flight.aircraftType) {
    document.getElementById('aircraftType').value = flight.aircraftType;
  }
}

function handleEditAircraftInput(e) {
  const aircraft = e.target.value.trim();
  const flight = flights.find(f => f.aircraft === aircraft);

  if (flight && flight.aircraftType) {
    document.getElementById('editAircraftType').value = flight.aircraftType;
  }
}

function updateAircraftDatalist() {
  const datalist = document.getElementById('aircraftList');

  // Get unique aircraft with their types
  const aircraftMap = new Map();
  flights.forEach(flight => {
    if (!aircraftMap.has(flight.aircraft)) {
      aircraftMap.set(flight.aircraft, flight.aircraftType || '');
    }
  });

  // Populate datalist
  datalist.innerHTML = Array.from(aircraftMap.entries())
    .map(([aircraft, type]) => `<option value="${aircraft}">${type ? type : ''}</option>`)
    .join('');
}


// Delete Flight
function deleteFlight(id) {
  if (!confirm('Are you sure you want to delete this flight entry?')) return;

  flights = flights.filter(f => f.id !== id);
  saveToSession();
  updateDashboard();
  renderFlightTable();
}

// Table Rendering
function renderFlightTable() {
  const tbody = document.getElementById('flightTableBody');

  if (flights.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">No flights logged yet</div>
          <div style="color: var(--text-muted); font-size: 0.9rem;">Add your first flight above to get started</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = flights.map(flight => `
    <tr>
      <td>${formatDate(flight.date)}</td>
      <td>${flight.aircraft}</td>
      <td>${flight.from}</td>
      <td>${flight.to}</td>
      <td>${flight.totalTime.toFixed(1)}</td>
      <td>${flight.picTime.toFixed(1)}</td>
      <td>${flight.nightTime.toFixed(1)}</td>
      <td>${(flight.actualInstrument || 0).toFixed(1)}</td>
      <td>${flight.approaches}</td>
      <td class="table-actions">
        <button class="btn btn-secondary btn-small edit-flight-btn" data-flight-id="${flight.id}">Edit</button>
        <button class="btn btn-danger btn-small delete-flight-btn" data-flight-id="${flight.id}">Delete</button>
      </td>
    </tr>
  `).join('');

  // Add event listeners to buttons
  tbody.querySelectorAll('.edit-flight-btn').forEach(btn => {
    btn.addEventListener('click', () => editFlight(btn.dataset.flightId));
  });

  tbody.querySelectorAll('.delete-flight-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteFlight(btn.dataset.flightId));
  });
}

// Table Sorting
let sortColumn = 'date';
let sortDirection = 'desc';

function sortTable(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'desc';
  }

  flights.sort((a, b) => {
    let aVal = a[column];
    let bVal = b[column];

    // Handle date sorting
    if (column === 'date') {
      aVal = new Date(aVal);
      bVal = new Date(bVal);
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  renderFlightTable();
}

// Dashboard Updates
function updateDashboard() {
  updateStatistics();
  updateCurrency();
  updateMakeModelTable();
}

function updateStatistics() {
  const today = new Date();
  const twelveMonthsAgo = new Date(today);
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  const stats = {
    totalHours: 0,
    picHours: 0,
    nightHours: 0,
    actualInstrumentHours: 0,
    simulatedInstrumentHours: 0,
    simulatorHours: 0,
    crossCountryHours: 0,
    highPerformanceHours: 0,
    complexHours: 0,
    past12MonthsHours: 0,
    totalFlights: flights.length,
    uniqueAircraft: new Set()
  };

  flights.forEach(flight => {
    stats.totalHours += flight.totalTime;
    stats.picHours += flight.picTime;
    stats.nightHours += flight.nightTime;
    stats.actualInstrumentHours += flight.actualInstrument || 0;
    stats.simulatedInstrumentHours += flight.simulatedInstrument || 0;
    stats.simulatorHours += flight.simulatorTime || 0;
    stats.crossCountryHours += flight.crossCountryTime;
    stats.highPerformanceHours += flight.highPerformance || 0;
    stats.complexHours += flight.complex || 0;
    stats.uniqueAircraft.add(flight.aircraft);

    // Past 12 months
    const flightDate = new Date(flight.date);
    if (flightDate >= twelveMonthsAgo) {
      stats.past12MonthsHours += flight.totalTime;
    }
  });

  document.getElementById('totalHours').textContent = stats.totalHours.toFixed(1);
  document.getElementById('picHours').textContent = stats.picHours.toFixed(1);
  document.getElementById('nightHours').textContent = stats.nightHours.toFixed(1);
  document.getElementById('actualInstrumentHours').textContent = stats.actualInstrumentHours.toFixed(1);
  document.getElementById('simulatedInstrumentHours').textContent = stats.simulatedInstrumentHours.toFixed(1);
  document.getElementById('simulatorHours').textContent = stats.simulatorHours.toFixed(1);
  document.getElementById('crossCountryHours').textContent = stats.crossCountryHours.toFixed(1);
  document.getElementById('highPerformanceHours').textContent = stats.highPerformanceHours.toFixed(1);
  document.getElementById('complexHours').textContent = stats.complexHours.toFixed(1);
  document.getElementById('past12MonthsHours').textContent = stats.past12MonthsHours.toFixed(1);
  document.getElementById('totalFlights').textContent = stats.totalFlights;
  document.getElementById('uniqueAircraft').textContent = stats.uniqueAircraft.size;
}

function updateCurrency() {
  const today = new Date();

  // Passenger Currency: 3 takeoffs and 3 landings (day) in preceding 90 days
  const passengerCurrency = calculatePassengerCurrency(today);
  updatePassengerCurrencyDisplay(passengerCurrency);

  // Night Currency: 3 takeoffs and 3 full-stop landings in preceding 90 days
  const nightCurrency = calculateNightCurrency(today);
  updateNightCurrencyDisplay(nightCurrency);

  // Instrument Currency: 6 approaches in preceding 6 months (180 days)
  const instrumentCurrency = calculateInstrumentCurrency(today);
  updateInstrumentCurrencyDisplay(instrumentCurrency);

  // Medical Certificate
  updateMedicalDisplay(today);

  // BFR
  updateBFRDisplay(today);
}

function calculatePassengerCurrency(today) {
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const recentFlights = flights.filter(f => new Date(f.date) >= ninetyDaysAgo);

  let dayTakeoffs = 0;
  let dayLandings = 0;
  let oldestQualifyingDate = null;

  recentFlights.forEach(flight => {
    dayTakeoffs += flight.dayTakeoffs;
    dayLandings += flight.dayLandings;

    if (flight.dayTakeoffs > 0 || flight.dayLandings > 0) {
      const flightDate = new Date(flight.date);
      if (!oldestQualifyingDate || flightDate < oldestQualifyingDate) {
        oldestQualifyingDate = flightDate;
      }
    }
  });

  const count = Math.min(dayTakeoffs, dayLandings);
  const isCurrent = count >= 3;

  let expiryDate = null;
  let daysRemaining = null;

  if (oldestQualifyingDate && count >= 3) {
    expiryDate = new Date(oldestQualifyingDate);
    expiryDate.setDate(expiryDate.getDate() + 90);
    daysRemaining = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
  }

  return {
    count,
    required: 3,
    isCurrent,
    expiryDate,
    daysRemaining,
    dayTakeoffs,
    dayLandings
  };
}

function calculateNightCurrency(today) {
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const recentFlights = flights.filter(f => new Date(f.date) >= ninetyDaysAgo);

  let nightTakeoffs = 0;
  let nightLandings = 0;
  let oldestQualifyingDate = null;

  recentFlights.forEach(flight => {
    nightTakeoffs += flight.nightTakeoffs;
    nightLandings += flight.nightLandings;

    if (flight.nightTakeoffs > 0 || flight.nightLandings > 0) {
      const flightDate = new Date(flight.date);
      if (!oldestQualifyingDate || flightDate < oldestQualifyingDate) {
        oldestQualifyingDate = flightDate;
      }
    }
  });

  const count = Math.min(nightTakeoffs, nightLandings);
  const isCurrent = count >= 3;

  let expiryDate = null;
  let daysRemaining = null;

  if (oldestQualifyingDate && count >= 3) {
    expiryDate = new Date(oldestQualifyingDate);
    expiryDate.setDate(expiryDate.getDate() + 90);
    daysRemaining = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
  }

  return {
    count,
    required: 3,
    isCurrent,
    expiryDate,
    daysRemaining,
    nightTakeoffs,
    nightLandings
  };
}

function calculateInstrumentCurrency(today) {
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentFlights = flights.filter(f => new Date(f.date) >= sixMonthsAgo);

  let approaches = 0;
  let oldestQualifyingDate = null;

  recentFlights.forEach(flight => {
    approaches += flight.approaches;

    if (flight.approaches > 0) {
      const flightDate = new Date(flight.date);
      if (!oldestQualifyingDate || flightDate < oldestQualifyingDate) {
        oldestQualifyingDate = flightDate;
      }
    }
  });

  const isCurrent = approaches >= 6;

  let expiryDate = null;
  let daysRemaining = null;

  if (oldestQualifyingDate && approaches >= 6) {
    expiryDate = new Date(oldestQualifyingDate);
    expiryDate.setMonth(expiryDate.getMonth() + 6);
    daysRemaining = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
  }

  return {
    count: approaches,
    required: 6,
    isCurrent,
    expiryDate,
    daysRemaining
  };
}

function updatePassengerCurrencyDisplay(currency) {
  const card = document.getElementById('passengerCurrencyCard');
  const status = document.getElementById('passengerCurrencyStatus');
  const progress = document.getElementById('passengerCurrencyProgress');
  const progressText = document.getElementById('passengerCurrencyProgressText');
  const takeoffsLandings = document.getElementById('passengerTakeoffsLandings');
  const daysRemaining = document.getElementById('passengerDaysRemaining');
  const expiryDate = document.getElementById('passengerExpiryDate');

  // Remove all status classes
  card.classList.remove('current', 'warning', 'expired');
  status.classList.remove('current', 'warning', 'expired');
  progress.classList.remove('current', 'warning', 'expired');

  const percentage = Math.min((currency.count / currency.required) * 100, 100);
  progress.style.width = `${percentage}%`;
  progressText.textContent = `${currency.count} of ${currency.required} required`;
  takeoffsLandings.textContent = `${Math.min(currency.dayTakeoffs, currency.dayLandings)}`;

  if (currency.isCurrent) {
    const statusClass = currency.daysRemaining <= 30 ? 'warning' : 'current';
    card.classList.add(statusClass);
    status.classList.add(statusClass);
    progress.classList.add(statusClass);
    status.textContent = currency.daysRemaining <= 30 ? 'Expiring Soon' : 'Current';
    daysRemaining.textContent = currency.daysRemaining;
    expiryDate.textContent = formatDate(currency.expiryDate.toISOString().split('T')[0]);
  } else {
    card.classList.add('expired');
    status.classList.add('expired');
    progress.classList.add('expired');
    status.textContent = 'Not Current';
    daysRemaining.textContent = '-';
    expiryDate.textContent = '-';
  }
}

function updateNightCurrencyDisplay(currency) {
  const card = document.getElementById('nightCurrencyCard');
  const status = document.getElementById('nightCurrencyStatus');
  const progress = document.getElementById('nightCurrencyProgress');
  const progressText = document.getElementById('nightCurrencyProgressText');
  const takeoffsLandings = document.getElementById('nightTakeoffsLandings');
  const daysRemaining = document.getElementById('nightDaysRemaining');
  const expiryDate = document.getElementById('nightExpiryDate');

  // Remove all status classes
  card.classList.remove('current', 'warning', 'expired');
  status.classList.remove('current', 'warning', 'expired');
  progress.classList.remove('current', 'warning', 'expired');

  const percentage = Math.min((currency.count / currency.required) * 100, 100);
  progress.style.width = `${percentage}%`;
  progressText.textContent = `${currency.count} of ${currency.required} required`;
  takeoffsLandings.textContent = `${Math.min(currency.nightTakeoffs, currency.nightLandings)}`;

  if (currency.isCurrent) {
    const statusClass = currency.daysRemaining <= 30 ? 'warning' : 'current';
    card.classList.add(statusClass);
    status.classList.add(statusClass);
    progress.classList.add(statusClass);
    status.textContent = currency.daysRemaining <= 30 ? 'Expiring Soon' : 'Current';
    daysRemaining.textContent = currency.daysRemaining;
    expiryDate.textContent = formatDate(currency.expiryDate.toISOString().split('T')[0]);
  } else {
    card.classList.add('expired');
    status.classList.add('expired');
    progress.classList.add('expired');
    status.textContent = 'Not Current';
    daysRemaining.textContent = '-';
    expiryDate.textContent = '-';
  }
}

function updateInstrumentCurrencyDisplay(currency) {
  const card = document.getElementById('instrumentCurrencyCard');
  const status = document.getElementById('instrumentCurrencyStatus');
  const progress = document.getElementById('instrumentCurrencyProgress');
  const progressText = document.getElementById('instrumentCurrencyProgressText');
  const approaches = document.getElementById('instrumentApproaches');
  const daysRemaining = document.getElementById('instrumentDaysRemaining');
  const expiryDate = document.getElementById('instrumentExpiryDate');

  // Remove all status classes
  card.classList.remove('current', 'warning', 'expired');
  status.classList.remove('current', 'warning', 'expired');
  progress.classList.remove('current', 'warning', 'expired');

  const percentage = Math.min((currency.count / currency.required) * 100, 100);
  progress.style.width = `${percentage}%`;
  progressText.textContent = `${currency.count} of ${currency.required} required`;
  approaches.textContent = currency.count;

  if (currency.isCurrent) {
    const statusClass = currency.daysRemaining <= 30 ? 'warning' : 'current';
    card.classList.add(statusClass);
    status.classList.add(statusClass);
    progress.classList.add(statusClass);
    status.textContent = currency.daysRemaining <= 30 ? 'Expiring Soon' : 'Current';
    daysRemaining.textContent = currency.daysRemaining;
    expiryDate.textContent = formatDate(currency.expiryDate.toISOString().split('T')[0]);
  } else {
    card.classList.add('expired');
    status.classList.add('expired');
    progress.classList.add('expired');
    status.textContent = 'Not Current';
    daysRemaining.textContent = '-';
    expiryDate.textContent = '-';
  }
}

function updateMedicalDisplay(today) {
  const card = document.getElementById('medicalCard');
  const status = document.getElementById('medicalStatus');
  const expiry = document.getElementById('medicalExpiry');
  const daysRemaining = document.getElementById('medicalDaysRemaining');

  card.classList.remove('current', 'warning', 'expired');
  status.classList.remove('current', 'warning', 'expired');

  if (!userProfile.medicalExpiration) {
    status.textContent = 'Not Set';
    status.classList.add('expired');
    card.classList.add('expired');
    expiry.textContent = 'Not Set';
    daysRemaining.textContent = '-';
    return;
  }

  const expiryDate = new Date(userProfile.medicalExpiration);
  const days = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));

  expiry.textContent = formatDate(userProfile.medicalExpiration);
  daysRemaining.textContent = days;

  if (days < 0) {
    status.textContent = 'Expired';
    status.classList.add('expired');
    card.classList.add('expired');
  } else if (days <= 30) {
    status.textContent = 'Expiring Soon';
    status.classList.add('warning');
    card.classList.add('warning');
  } else {
    status.textContent = 'Current';
    status.classList.add('current');
    card.classList.add('current');
  }
}

function updateBFRDisplay(today) {
  const card = document.getElementById('bfrCard');
  const status = document.getElementById('bfrStatus');
  const lastBFR = document.getElementById('lastBFR');
  const expiry = document.getElementById('bfrExpiry');
  const daysRemaining = document.getElementById('bfrDaysRemaining');

  card.classList.remove('current', 'warning', 'expired');
  status.classList.remove('current', 'warning', 'expired');

  if (!userProfile.lastBFRDate) {
    status.textContent = 'Not Set';
    status.classList.add('expired');
    card.classList.add('expired');
    lastBFR.textContent = 'Not Set';
    expiry.textContent = '-';
    daysRemaining.textContent = '-';
    return;
  }

  const bfrDate = new Date(userProfile.lastBFRDate);
  const expiryDate = new Date(bfrDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + 2);

  const days = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));

  lastBFR.textContent = formatDate(userProfile.lastBFRDate);
  expiry.textContent = formatDate(expiryDate.toISOString().split('T')[0]);
  daysRemaining.textContent = days;

  if (days < 0) {
    status.textContent = 'Expired';
    status.classList.add('expired');
    card.classList.add('expired');
  } else if (days <= 60) {
    status.textContent = 'Expiring Soon';
    status.classList.add('warning');
    card.classList.add('warning');
  } else {
    status.textContent = 'Current';
    status.classList.add('current');
    card.classList.add('current');
  }
}

function updateMakeModelTable() {
  const tbody = document.getElementById('makeModelTableBody');

  // Group flights by aircraft type
  const makeModelHours = {};

  flights.forEach(flight => {
    const type = flight.aircraftType || 'Unknown';
    if (!makeModelHours[type]) {
      makeModelHours[type] = 0;
    }
    makeModelHours[type] += flight.totalTime;
  });

  // Sort by hours descending
  const sorted = Object.entries(makeModelHours).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="2" class="empty-state" style="padding: var(--spacing-lg);">
          <div style="color: var(--text-muted); font-size: 0.9rem;">No flights logged yet</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = sorted.map(([type, hours]) => `
    <tr>
      <td>${type}</td>
      <td>${hours.toFixed(1)}</td>
    </tr>
  `).join('');
}

// CSV Import
function importFromCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const csv = e.target.result;
      const lines = csv.split('\n');

      if (lines.length < 2) {
        throw new Error('CSV file is empty or has no data rows');
      }

      // Parse header
      const headers = lines[0].split(',').map(h => h.trim());

      // Parse data rows
      const importedFlights = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);
        const flight = {};

        headers.forEach((header, index) => {
          const value = values[index]?.trim() || '';

          // Map CSV fields to flight object
          switch (header) {
            case 'date':
              flight.date = value;
              break;
            case 'aircraft':
              flight.aircraft = value.toUpperCase();
              break;
            case 'aircraftType':
              flight.aircraftType = value;
              break;
            case 'from':
              flight.from = value.toUpperCase();
              break;
            case 'via':
              flight.via = value.toUpperCase();
              break;
            case 'to':
              flight.to = value.toUpperCase();
              break;
            case 'totalTime':
            case 'picTime':
            case 'dualTime':
            case 'crossCountryTime':
            case 'nightTime':
            case 'actualInstrument':
            case 'simulatedInstrument':
            case 'simulatorTime':
            case 'highPerformance':
            case 'complex':
              flight[header] = parseFloat(value) || 0;
              break;
            case 'dayTakeoffs':
            case 'dayLandings':
            case 'nightTakeoffs':
            case 'nightLandings':
            case 'approaches':
            case 'holds':
              flight[header] = parseInt(value) || 0;
              break;
            case 'remarks':
              flight.remarks = value;
              break;
          }
        });

        // Validate required fields
        if (flight.date && flight.aircraft && flight.from && flight.to && flight.totalTime) {
          flight.id = Date.now().toString() + '_' + i;
          importedFlights.push(flight);
        }
      }

      if (importedFlights.length === 0) {
        throw new Error('No valid flights found in CSV file');
      }

      // Add imported flights to existing flights
      flights = flights.concat(importedFlights);
      saveToSession();
      updateDashboard();
      renderFlightTable();

      alert(`Successfully imported ${importedFlights.length} flight(s) from CSV.`);
    } catch (error) {
      alert(`Error importing CSV: ${error.message}`);
    }
  };

  reader.readAsText(file);

  // Reset file input
  event.target.value = '';
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

// CSV Template Download
function downloadCSVTemplate() {
  const template = `date,aircraft,aircraftType,from,via,to,totalTime,picTime,dualTime,crossCountryTime,nightTime,actualInstrument,simulatedInstrument,simulatorTime,highPerformance,complex,dayTakeoffs,dayLandings,nightTakeoffs,nightLandings,approaches,holds,remarks
2026-01-15,N12345,C172,KJFK,,KBOS,2.5,2.5,0,2.5,0,0,0,0,0,0,1,1,0,0,0,0,Practice flight
2026-01-14,N67890,PA-28-180,KBOS,KPVD,KLGA,1.5,1.5,0,0,0.5,0.3,0,0,0,0,0,0,1,1,2,1,Night currency with stop at Providence`;

  const blob = new Blob([template], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'pilot-logbook-import-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Show instructions alert
  setTimeout(() => {
    alert('CSV Template downloaded!\n\nInstructions:\n1. Open the template in Excel or Google Sheets\n2. Replace the sample data with your flights\n3. Save as CSV\n4. Click "Import CSV" to upload\n\nRequired fields: date, aircraft, from, to, totalTime\nDate format: YYYY-MM-DD (e.g., 2026-01-15)');
  }, 100);
}

// File Save/Load
function saveToFile() {
  const data = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    userProfile: userProfile,
    flights: flights
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // Create filename with user name and timestamp
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
  const userName = userProfile.name ? userProfile.name.replace(/\s+/g, '') : 'Unknown';
  const filename = `PilotLogbook_${userName}_${dateStr}_${timeStr}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function loadFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      // Validate data structure
      if (!data.flights || !Array.isArray(data.flights)) {
        throw new Error('Invalid file format: missing flights array');
      }

      flights = data.flights;

      // Load user profile if present
      if (data.userProfile) {
        userProfile = data.userProfile;
        updateUserDisplay();
      }

      saveToSession();
      updateDashboard();
      renderFlightTable();

      alert(`Successfully loaded ${flights.length} flight(s) from file.`);
    } catch (error) {
      alert(`Error loading file: ${error.message}`);
    }
  };

  reader.readAsText(file);

  // Reset file input
  event.target.value = '';
}

// Session Storage
function saveToSession() {
  sessionStorage.setItem('pilotLogbookFlights', JSON.stringify(flights));
  sessionStorage.setItem('pilotLogbookProfile', JSON.stringify(userProfile));
}

function loadFromSession() {
  const storedFlights = sessionStorage.getItem('pilotLogbookFlights');
  if (storedFlights) {
    try {
      flights = JSON.parse(storedFlights);
    } catch (error) {
      console.error('Error loading flights from session storage:', error);
      flights = [];
    }
  }

  const storedProfile = sessionStorage.getItem('pilotLogbookProfile');
  if (storedProfile) {
    try {
      userProfile = JSON.parse(storedProfile);
    } catch (error) {
      console.error('Error loading profile from session storage:', error);
      userProfile = { name: '', certificateNumber: '', medicalExpiration: null, lastBFRDate: null };
    }
  }
}

// Utility Functions
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
