document.addEventListener('DOMContentLoaded', () => {
    const seasonSelect = document.getElementById('season-select');
    const tabButtons = document.querySelectorAll('.tab-button');
    const mainContent = document.querySelector('main');
    let allData = {}; // Cache for holding data for all seasons

    /**
     * Creates the HTML table for Power Rankings.
     */
    function createPowerRankingsTable(data) {
        if (!data || data.length === 0) return "<p>Power Rankings data not available.</p>";
        let tableRows = data.map(row => `
            <tr class="bg-white border-b hover:bg-gray-50">
                <td class="px-6 py-4 font-bold text-gray-900">${row.Rank}</td>
                <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                    <div class="flex items-center"><img src="${row.Avatar}" alt="Logo" class="w-6 h-6 rounded-full mr-3">${row.Team}</div>
                </td>
                <td class="px-6 py-4">${row['Power Score'].toFixed(3)}</td>
            </tr>`).join('');
        return `<h2 class="text-2xl font-bold text-gray-800 mb-4">League Power Rankings</h2>
                <p class="mb-4 text-gray-600">A weighted ranking combining season-long scoring expectation and performance (F-DVOA).</p>
                <div class="relative overflow-x-auto shadow-md sm:rounded-lg">
                    <table class="w-full text-sm text-left text-gray-500">
                        <thead class="text-xs text-gray-700 uppercase bg-gray-50"><tr><th scope="col" class="px-6 py-3">Rank</th><th scope="col" class="px-6 py-3">Team</th><th scope="col" class="px-6 py-3">Power Score</th></tr></thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>`;
    }

    /**
     * Creates the HTML table for F-DVOA Ratings.
     */
    function createFdvoaTable(data) {
        if (!data || data.length === 0) return "<p>F-DVOA data is not yet available for this season.</p>";
        let tableRows = data.map(row => `
            <tr class="bg-white border-b hover:bg-gray-50">
                <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                    <div class="flex items-center"><img src="${row.Avatar}" alt="Logo" class="w-6 h-6 rounded-full mr-3">${row.Team}</div>
                </td>
                <td class="px-6 py-4">${row['F-DVOA (%)'].toFixed(2)}</td>
            </tr>`).join('');
        return `<h2 class="text-2xl font-bold text-gray-800 mb-4">F-DVOA Ratings</h2>
                <p class="mb-4 text-gray-600">Performance relative to league average, adjusted for opponent strength.</p>
                <div class="relative overflow-x-auto shadow-md sm:rounded-lg">
                    <table class="w-full text-sm text-left text-gray-500">
                        <thead class="text-xs text-gray-700 uppercase bg-gray-50"><tr><th scope="col" class="px-6 py-3">Team</th><th scope="col" class="px-6 py-3">F-DVOA (%)</th></tr></thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>`;
    }
    
    /**
     * Calculates a background color for a cell based on its value within a range.
     */
    function getColorForValue(value, min, max) {
        if (min === max) return 'hsl(0, 0%, 100%)';
        const percentage = (value - min) / (max - min);
        const hue = percentage * 120; 
        return `hsl(${hue}, 70%, 88%)`;
    }

    /**
     * **FIX**: Renamed and enhanced to generate the entire Analysis panel, including sub-tabs and containers.
     * @returns {string} - The HTML string for the entire analysis panel structure.
     */
    function createAnalysisPanelHTML() {
        return `
            <div class="border-b border-gray-200">
                <ul class="flex flex-wrap -mb-px">
                    <li class="mr-2"><button class="nested-tab-button active-tab" data-view="table">Table</button></li>
                    <li class="mr-2"><button class="nested-tab-button" data-view="chart">Chart</button></li>
                </ul>
            </div>
            <div class="pt-4">
                <div id="analysis-table-container" class="nested-tab-panel"></div>
                <div id="analysis-chart-container" class="nested-tab-panel hidden"><div id="plotly-chart"></div></div>
            </div>
        `;
    }

    /**
     * Creates the HTML table for the Analysis tab's table view.
     */
    function createAnalysisTable(data, week, isCurrentSeason, year) {
        if (!data || data.length === 0) return "<p>Analysis data not available.</p>";
        
        // **FIX**: Title now changes based on the season.
        const title = isCurrentSeason ? `Week ${week} Positional Projections` : `${year} Season Averages`;
        const subtitle = isCurrentSeason 
            ? 'Projected points by position group. The color scale highlights strengths (green) and weaknesses (red) for each position relative to the league.'
            : 'Season-long average points per week by position group. The color scale highlights strengths (green) and weaknesses (red).';

        const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
        const displayCols = ['Team', ...positions, 'Total'];

        const minMax = {};
        positions.forEach(pos => {
            const values = data.map(row => row[pos]);
            minMax[pos] = { min: Math.min(...values), max: Math.max(...values) };
        });

        let tableHead = `<tr>${displayCols.map(col => `<th scope="col" class="px-6 py-3">${col}</th>`).join('')}</tr>`;
        let tableBody = data.map(row => {
            let rowHtml = '<tr class="border-b">';
            displayCols.forEach(col => {
                const value = row[col] || 0;
                if (col === 'Team') {
                    rowHtml += `<td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap"><div class="flex items-center"><img src="${row.Avatar}" alt="Logo" class="w-6 h-6 rounded-full mr-3">${row.Team}</div></td>`;
                } else if (col === 'Total') {
                    rowHtml += `<td class="px-6 py-4 font-bold text-center">${value.toFixed(2)}</td>`;
                } else {
                    const { min, max } = minMax[col];
                    const bgColor = getColorForValue(value, min, max);
                    rowHtml += `<td class="px-6 py-4 text-center font-medium" style="background-color: ${bgColor};">${value.toFixed(2)}</td>`;
                }
            });
            return rowHtml + '</tr>';
        }).join('');

        return `<h2 class="text-2xl font-bold text-gray-800 mb-4">${title}</h2>
                <p class="mb-4 text-gray-600">${subtitle}</p>
                <div class="relative overflow-x-auto shadow-md sm:rounded-lg">
                    <table class="w-full text-sm text-left text-gray-500">
                        <thead class="text-xs text-gray-700 uppercase bg-gray-50">${tableHead}</thead>
                        <tbody>${tableBody}</tbody>
                    </table>
                </div>`;
    }

    /**
     * **FIX**: New function to render the Plotly stacked bar chart.
     */
    function renderPlotlyChart(data, week, isCurrentSeason, year) {
        const chartDiv = document.getElementById('plotly-chart');
        if (!chartDiv || !data || data.length === 0) return;

        const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
        const teams = data.map(d => d.Team);

        const traces = positions.map(pos => ({
            x: teams,
            y: data.map(d => d[pos]),
            name: pos,
            type: 'bar',
        }));

        const layout = {
            barmode: 'stack',
            title: isCurrentSeason ? `Week ${week} Projections` : `${year} Season Averages`,
            xaxis: { title: 'Team', automargin: true },
            yaxis: { title: 'Points' },
            legend: { orientation: 'h', y: -0.3 },
            margin: { t: 40, b: 100, l: 50, r: 20 }
        };
        
        Plotly.newPlot(chartDiv, traces, layout, {responsive: true});
    }

    /**
     * Updates the content of all tabs based on the selected season.
     */
    function updateView() {
        const selectedYear = seasonSelect.value;
        const data = allData[selectedYear];
        
        const powerRankingsPanel = document.getElementById('power-rankings-panel');
        const fdvoaPanel = document.getElementById('fdvoa-panel');
        const analysisPanel = document.getElementById('analysis-panel');

        if (!data) {
            const errorMsg = "<p class='text-red-500 text-center'>Data could not be loaded for this season.</p>";
            if (powerRankingsPanel) powerRankingsPanel.innerHTML = errorMsg;
            if (fdvoaPanel) fdvoaPanel.innerHTML = errorMsg;
            if (analysisPanel) analysisPanel.innerHTML = errorMsg;
            return;
        }

        if (powerRankingsPanel) powerRankingsPanel.innerHTML = createPowerRankingsTable(data.power_rankings);
        if (fdvoaPanel) fdvoaPanel.innerHTML = createFdvoaTable(data.fdvoa);
        
        if (analysisPanel) {
            // **FIX**: Populate the analysis panel with the new sub-tab structure.
            analysisPanel.innerHTML = createAnalysisPanelHTML();
            
            // **FIX**: Populate the table container within the new structure.
            const tableContainer = document.getElementById('analysis-table-container');
            if (tableContainer) {
                tableContainer.innerHTML = createAnalysisTable(data.rosters, data.projection_week, data.is_current_season, selectedYear);
            }
            
            // **FIX**: Render the chart into its container.
            renderPlotlyChart(data.rosters, data.projection_week, data.is_current_season, selectedYear);
        }
    }

    /**
     * Fetches and caches the data for all available seasons.
     */
    async function loadAllData(config) {
        for (const year of config.years) {
            try {
                const response = await fetch(`data_${year}.json?t=${new Date().getTime()}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                allData[year] = await response.json();
            } catch (e) {
                console.error(`Failed to load data for ${year}:`, e);
            }
        }
        updateView(); 
    }

    // Initial fetch of the configuration file
    fetch('config.json')
        .then(res => res.json())
        .then(config => {
            document.getElementById('league-logo').src = config.logoUrl;
            document.getElementById('last-updated').textContent = `Last updated: ${config.lastUpdated} UTC`;
            seasonSelect.innerHTML = config.years.map(y => `<option value="${y}">${y}</option>`).join('');
            loadAllData(config);
        })
        .catch(error => {
            console.error("Failed to load config.json:", error);
            if (mainContent) mainContent.innerHTML = "<p class='text-red-500 text-center'>Could not load league configuration.</p>";
        });

    // Event Listeners
    seasonSelect.addEventListener('change', updateView);
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const activeTab = button.dataset.tab;
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.toggle('hidden', panel.id !== `${activeTab}-panel`);
            });
        });
    });

    // **FIX**: Event delegation for nested tabs in the Analysis panel.
    if (mainContent) {
        mainContent.addEventListener('click', (e) => {
            if (e.target.matches('.nested-tab-button')) {
                const panel = e.target.closest('.tab-panel');
                if (!panel) return;

                panel.querySelectorAll('.nested-tab-button').forEach(btn => btn.classList.remove('active-tab'));
                e.target.classList.add('active-tab');

                const targetViewId = `analysis-${e.target.dataset.view}-container`;
                panel.querySelectorAll('.nested-tab-panel').forEach(view => {
                    view.classList.toggle('hidden', view.id !== targetViewId);
                });
            }
        });
    }
});
