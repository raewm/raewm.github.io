// Results Dashboard Manager

class ResultsManager {
    constructor(containerId, config) {
        this.container = document.getElementById(containerId);
        this.config = config;
        this.budget = null;
        this.charts = {};
    }

    calculate() {
        try {
            this.budget = PowerCalculations.calculatePowerBudget(this.config);
            this.render();
        } catch (error) {
            console.error('Error calculating power budget:', error);
            this.container.innerHTML = `
                <div class="error-message">
                    <h3>Calculation Error</h3>
                    <p>${error.message}</p>
                    <p>Please ensure you have:</p>
                    <ul>
                        <li>Added at least one load or power source</li>
                        <li>Fetched solar data (if using solar panels)</li>
                        <li>Entered wind data (if using wind generators)</li>
                    </ul>
                </div>
            `;
        }
    }

    render() {
        if (!this.budget) {
            this.container.innerHTML = `
                <div class="info-message">
                    <h3>Power Budget Results</h3>
                    <p>Configure your system components and click "Calculate Power Budget" to see results.</p>
                </div>
            `;
            return;
        }

        this.container.innerHTML = `
            <div class="results-header">
                <h2>Power Budget Analysis</h2>
                <button class="btn btn-primary" onclick="resultsManager.exportResults()">
                    <span class="icon">💾</span> Export Project
                </button>
            </div>

            ${this.renderSystemStatus()}
            ${this.renderSummary()}
            ${this.renderMonthlyTable()}
            ${this.renderCharts()}
        `;

        // Initialize charts after DOM is updated
        setTimeout(() => this.initializeCharts(), 100);
    }

    renderSystemStatus() {
        const status = this.budget.summary.systemAdequate;
        const worstMonth = this.budget.summary.worstMonth;

        return `
            <div class="status-banner ${status ? 'status-good' : 'status-warning'}">
                <h3>${status ? '✅ System Adequate' : '⚠️ System Undersized'}</h3>
                <p>${status ?
                'Power generation meets or exceeds consumption in all months.' :
                `Power deficit in worst month (${this.getMonthName(worstMonth.month)}): ${Math.abs(worstMonth.netEnergy).toFixed(0)} Wh shortage`
            }</p>
            </div>
        `;
    }

    renderSummary() {
        const s = this.budget.summary;

        return `
            <div class="summary-grid-large">
                <div class="summary-card">
                    <h4>Annual Generation</h4>
                    <div class="summary-value-large">${(s.annualGeneration / 1000).toFixed(1)} kWh</div>
                    <div class="summary-breakdown">
                        <div>Solar: ${(s.solarContribution / 1000).toFixed(1)} kWh (${(s.solarContribution / s.annualGeneration * 100).toFixed(0)}%)</div>
                        <div>Wind: ${(s.windContribution / 1000).toFixed(1)} kWh (${(s.windContribution / s.annualGeneration * 100).toFixed(0)}%)</div>
                        ${s.otherContribution > 0 ? `<div>Other: ${(s.otherContribution / 1000).toFixed(1)} kWh (${(s.otherContribution / s.annualGeneration * 100).toFixed(0)}%)</div>` : ''}
                    </div>
                </div>

                <div class="summary-card">
                    <h4>Annual Consumption</h4>
                    <div class="summary-value-large">${(s.annualConsumption / 1000).toFixed(1)} kWh</div>
                    <div class="summary-breakdown">
                        <div>Daily Average: ${(s.annualConsumption / 365).toFixed(0)} Wh</div>
                        <div>Hourly Average: ${(s.annualConsumption / 365 / 24).toFixed(1)} W</div>
                    </div>
                </div>

                <div class="summary-card">
                    <h4>Net Energy Balance</h4>
                    <div class="summary-value-large ${s.netAnnual >= 0 ? 'positive' : 'negative'}">
                        ${s.netAnnual >= 0 ? '+' : ''}${(s.netAnnual / 1000).toFixed(1)} kWh
                    </div>
                    <div class="summary-breakdown">
                        <div>${s.netAnnual >= 0 ? 'Surplus' : 'Deficit'}</div>
                    </div>
                </div>

                <div class="summary-card">
                    <h4>Battery Autonomy</h4>
                    <div class="summary-value-large">${s.autonomyDays.toFixed(1)} days</div>
                    <div class="summary-breakdown">
                        <div>Usable Capacity: ${(s.batteryCapacity / 1000).toFixed(2)} kWh</div>
                        <div>Recommended: ≥ ${((s.annualConsumption / 365) * 3 / 1000).toFixed(2)} kWh (3 days)</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderMonthlyTable() {
        return `
            <div class="monthly-table-container">
                <h3>Monthly Power Budget</h3>
                <table class="monthly-table">
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th>Solar (kWh)</th>
                            <th>Wind (kWh)</th>
                            <th>Total Gen (kWh)</th>
                            <th>Consumption (kWh)</th>
                            <th>Net (kWh)</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.budget.monthlyData.map(m => `
                            <tr class="${m.surplus ? '' : 'deficit-row'}">
                                <td><strong>${this.getMonthName(m.month)}</strong></td>
                                <td>${(m.solarGeneration / 1000).toFixed(2)}</td>
                                <td>${(m.windGeneration / 1000).toFixed(2)}</td>
                                <td>${(m.totalGeneration / 1000).toFixed(2)}</td>
                                <td>${(m.consumption / 1000).toFixed(2)}</td>
                                <td class="${m.surplus ? 'positive' : 'negative'}">
                                    ${m.surplus ? '+' : ''}${(m.netEnergy / 1000).toFixed(2)}
                                </td>
                                <td>${m.surplus ? '✅' : '⚠️'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderCharts() {
        return `
            <div class="charts-container">
                <div class="chart-card">
                    <h3>Monthly Generation vs Consumption</h3>
                    <canvas id="monthly-chart"></canvas>
                </div>

                <div class="chart-card">
                    <h3>Net Energy Balance</h3>
                    <canvas id="balance-chart"></canvas>
                </div>

                <div class="chart-card">
                    <h3>Battery State of Charge (365 days)</h3>
                    <canvas id="soc-chart"></canvas>
                </div>

                <div class="chart-card">
                    <h3>Energy Mix</h3>
                    <canvas id="mix-chart"></canvas>
                </div>
            </div>
        `;
    }

    initializeCharts() {
        // Destroy existing charts
        Object.values(this.charts).forEach(chart => chart && chart.destroy());
        this.charts = {};

        const monthLabels = this.budget.monthlyData.map(m => this.getMonthName(m.month));

        // Monthly Generation vs Consumption
        const monthlyCtx = document.getElementById('monthly-chart');
        if (monthlyCtx) {
            this.charts.monthly = new Chart(monthlyCtx, {
                type: 'bar',
                data: {
                    labels: monthLabels,
                    datasets: [
                        {
                            label: 'Solar Generation',
                            data: this.budget.monthlyData.map(m => m.solarGeneration / 1000),
                            backgroundColor: 'rgba(255, 193, 7, 0.8)',
                            stack: 'generation'
                        },
                        {
                            label: 'Wind Generation',
                            data: this.budget.monthlyData.map(m => m.windGeneration / 1000),
                            backgroundColor: 'rgba(33, 150, 243, 0.8)',
                            stack: 'generation'
                        },
                        {
                            label: 'Consumption',
                            data: this.budget.monthlyData.map(m => m.consumption / 1000),
                            backgroundColor: 'rgba(244, 67, 54, 0.8)',
                            stack: 'consumption'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: 'Energy (kWh)' }
                        }
                    },
                    plugins: {
                        legend: { display: true, position: 'top' }
                    }
                }
            });
        }

        // Net Balance Chart
        const balanceCtx = document.getElementById('balance-chart');
        if (balanceCtx) {
            this.charts.balance = new Chart(balanceCtx, {
                type: 'bar',
                data: {
                    labels: monthLabels,
                    datasets: [{
                        label: 'Net Energy',
                        data: this.budget.monthlyData.map(m => m.netEnergy / 1000),
                        backgroundColor: this.budget.monthlyData.map(m =>
                            m.surplus ? 'rgba(76, 175, 80, 0.8)' : 'rgba(244, 67, 54, 0.8)'
                        )
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        y: {
                            title: { display: true, text: 'Net Energy (kWh)' },
                            grid: { color: 'rgba(255,255,255,0.1)' }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }

        // Battery SOC Chart
        const socCtx = document.getElementById('soc-chart');
        if (socCtx) {
            const batteryCapacity = this.budget.summary.batteryCapacity;
            const socData = PowerCalculations.simulateBatterySOC(this.budget, batteryCapacity, 100);

            this.charts.soc = new Chart(socCtx, {
                type: 'line',
                data: {
                    labels: socData.map((_, i) => i + 1),
                    datasets: [{
                        label: 'State of Charge (%)',
                        data: socData.map(d => d.soc),
                        borderColor: 'rgba(76, 175, 80, 1)',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        x: {
                            title: { display: true, text: 'Day of Year' },
                            ticks: { maxTicksLimit: 12 }
                        },
                        y: {
                            beginAtZero: true,
                            max: 100,
                            title: { display: true, text: 'SOC (%)' }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }

        // Energy Mix Pie Chart
        const mixCtx = document.getElementById('mix-chart');
        if (mixCtx) {
            const s = this.budget.summary;
            this.charts.mix = new Chart(mixCtx, {
                type: 'pie',
                data: {
                    labels: ['Solar', 'Wind', 'Other'],
                    datasets: [{
                        data: [s.solarContribution, s.windContribution, s.otherContribution],
                        backgroundColor: [
                            'rgba(255, 193, 7, 0.8)',
                            'rgba(33, 150, 243, 0.8)',
                            'rgba(156, 39, 176, 0.8)'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: true, position: 'bottom' }
                    }
                }
            });
        }
    }

    getMonthName(monthNum) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[monthNum - 1] || '';
    }

    exportResults() {
        this.config.exportToFile();
    }
}
