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
     * Creates the HTML for the Analysis panel, including nested tabs.
     */
    function createAnalysisPanelHTML(analysisType) {
        // The variance tab is only shown for past seasons ('averages')
        const varianceTab = analysisType === 'averages' ? `<li class="mr-2"><button class="nested-tab-button" data-view="variance">Variance</button></li>` : '';
        const varianceContainer = analysisType === 'averages' ? `<div id="analysis-variance-container" class="nested-tab-panel hidden"><div id="plotly-boxplot"></div></div>` : '';

        return `
            <div class="border-b border-gray-200">
                <ul class="flex flex-wrap -mb-px">
                    <li class="mr-2"><button class="nested-tab-button active-tab" data-view="table">Table</button></li>
                    <li class="mr-2"><button class="nested-tab-button" data-view="chart">Chart</button></li>
                    ${varianceTab}
                </ul>
            </div>
            <div class="pt-4">
                <div id="analysis-table-container" class="nested-tab-panel"></div>
                <div id="analysis-chart-container" class="nested-tab-panel hidden"><div id="plotly-chart"></div></div>
                ${varianceContainer}
            </div>
        `;
    }

    /**
     * Creates the main analysis table for weekly scores/projections or season averages.
     */
    function createAnalysisTable(data, week, year, analysisType) {
        if (!data || data.length === 0) return "<p>Analysis data not available.</p>";
        
        const isCurrentSeason = analysisType !== 'averages';
        let title = isCurrentSeason ? `Week ${week} Positional Scores` : `${year} Season Averages`;
        let subtitle = isCurrentSeason ? 'Live and projected points by position group.' : 'Season-long average points per week by position group.';

        const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
        const headers = ['Team', ...positions, 'Total'];

        let tableHead = `<tr>${headers.map(h => `<th scope="col" class="px-6 py-3">${h}</th>`).join('')}</tr>`;
        
        let tableBody = data.map(row => {
            let rowHtml = '<tr class="border-b">';
            headers.forEach(col => {
                if (col === 'Team') {
                    rowHtml += `<td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap"><div class="flex items-center"><img src="${row.Avatar}" alt="Logo" class="w-6 h-6 rounded-full mr-3">${row.Team}</div></td>`;
                } else if (isCurrentSeason) {
                    // For current season, handle live, projected, and final scores
                    const live = row[`${col}_live`] || 0;
                    const projected = row[`${col}_projected`] || 0;
                    const status = row[`${col}_status`] || 'projected';
                    
                    let scoreClass = 'score-projected'; // default gray
                    if (status === 'active') scoreClass = 'score-active'; // blue
                    else if (status === 'final') scoreClass = 'score-final'; // green

                    // Display live score, with projected as a fallback/secondary info
                    const displayValue = live > 0 ? live.toFixed(2) : projected.toFixed(2);
                    const projectedValue = projected.toFixed(2);

                    if (col === 'Total') {
                        rowHtml += `<td class="px-6 py-4 font-bold text-center ${scoreClass}">${displayValue}<br><span class="text-xs font-normal">(${projectedValue})</span></td>`;
                    } else {
                        rowHtml += `<td class="px-6 py-4 text-center font-medium ${scoreClass}">${displayValue}</td>`;
                    }

                } else {
                    // For past seasons, display averages with color scaling
                    const value = row[col] || 0;
                     if (col === 'Total') {
                        rowHtml += `<td class="px-6 py-4 font-bold text-center">${value.toFixed(2)}</td>`;
                    } else {
                        const allValues = data.map(r => r[col] || 0);
                        const min = Math.min(...allValues);
                        const max = Math.max(...allValues);
                        const bgColor = getColorForValue(value, min, max);
                        rowHtml += `<td class="px-6 py-4 text-center font-medium" style="background-color: ${bgColor};">${value.toFixed(2)}</td>`;
                    }
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
     * Generates a background color for table cells based on value.
     */
    function getColorForValue(value, min, max) {
        if (min === max) return 'hsl(0, 0%, 100%)';
        const percentage = (value - min) / (max - min);
        const hue = percentage * 120; // Green (120) to Red (0)
        return `hsl(${hue}, 70%, 88%)`;
    }

    /**
     * Renders the Plotly stacked bar chart.
     */
    function renderPlotlyChart(rostersData, weeklyScoresData, week, year, analysisType) {
        const chartDiv = document.getElementById('plotly-chart');
        if (!chartDiv || !rostersData || rostersData.length === 0) return;

        const teams = rostersData.map(d => d.Team);
        const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
        let chartTitle, traces;
        
        if (analysisType === 'averages') {
            chartTitle = `${year} Season Average Positional Scores`;
            // Sorting teams by total average score for better visualization
            const sortedData = [...rostersData].sort((a, b) => b.Total - a.Total);
            const sortedTeams = sortedData.map(d => d.Team);
            traces = positions.map(pos => ({
                x: sortedTeams,
                y: sortedData.map(d => d[pos]),
                name: pos,
                type: 'bar'
            }));
        } else { // Current season: projections/live scores
            chartTitle = `Week ${week} Positional Scores`;
            // Sorting teams by total live score
            const sortedData = [...rostersData].sort((a, b) => b.Total_live - a.Total_live);
            const sortedTeams = sortedData.map(d => d.Team);
            traces = positions.map(pos => ({
                x: sortedTeams,
                y: sortedData.map(d => d[`${pos}_live`]),
                name: pos,
                type: 'bar'
            }));
        }
        
        const layout = {
            barmode: 'stack',
            title: chartTitle,
            xaxis: { title: 'Team', automargin: true },
            yaxis: { title: 'Points' },
            legend: { orientation: 'h', y: -0.3, yanchor: 'top' },
            margin: { t: 40, b: 150, l: 50, r: 20 }
        };
        
        Plotly.newPlot(chartDiv, traces, layout, {responsive: true});
    }

    /**
     * Renders the Plotly box and whisker plot for past seasons.
     */
    function renderBoxPlot(weeklyScores, year) {
        const chartDiv = document.getElementById('plotly-boxplot');
        if (!chartDiv || !weeklyScores || Object.keys(weeklyScores).length === 0) return;

        const getMedian = arr => {
            const mid = Math.floor(arr.length / 2);
            const nums = [...arr].sort((a, b) => a - b);
            return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
        };

        const sortedTeams = Object.keys(weeklyScores)
            .map(teamName => ({ name: teamName, median: getMedian(weeklyScores[teamName]) }))
            .sort((a, b) => b.median - a.median);

        const traces = sortedTeams.map(({ name }) => ({
            y: weeklyScores[name],
            name: name,
            type: 'box',
            boxpoints: 'all',
            jitter: 0.3,
            pointpos: -1.8
        }));

        const layout = {
            title: `${year} Weekly Score Distribution`,
            yaxis: { title: 'Points Scored' },
            xaxis: { automargin: true },
            margin: { t: 40, b: 150, l: 50, r: 20 }
        };

        Plotly.newPlot(chartDiv, traces, layout, {responsive: true});
    }

    /**
     * Main function to update the entire view when season changes or data loads.
     */
    function updateView() {
        const selectedYear = seasonSelect.value;
        const data = allData[selectedYear];
        
        if (!data) {
            document.querySelectorAll('.tab-panel').forEach(p => p.innerHTML = "<p class='text-red-500 text-center'>Data could not be loaded for this season.</p>");
            return;
        }

        document.getElementById('power-rankings-panel').innerHTML = createPowerRankingsTable(data.power_rankings);
        document.getElementById('fdvoa-panel').innerHTML = createFdvoaTable(data.fdvoa);
        
        const analysisPanel = document.getElementById('analysis-panel');
        analysisPanel.innerHTML = createAnalysisPanelHTML(data.analysis_type);
        document.getElementById('analysis-table-container').innerHTML = createAnalysisTable(data.rosters, data.projection_week, selectedYear, data.analysis_type);
        
        renderPlotlyChart(data.rosters, data.weekly_scores, data.projection_week, selectedYear, data.analysis_type);
        if (data.analysis_type === 'averages') {
            renderBoxPlot(data.weekly_scores, selectedYear);
        }
    }

    /**
     * Loads all necessary data from JSON files.
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

    // --- Initial Load and Event Listeners ---
    fetch('config.json')
        .then(res => res.json())
        .then(config => {
            document.getElementById('league-logo').src = config.logoUrl;
            document.getElementById('last-updated').textContent = `Last updated: ${config.lastUpdated} UTC`;
            seasonSelect.innerHTML = config.years.map(y => `<option value="${y}" ${y === new Date().getFullYear().toString() ? 'selected' : ''}>${y}</option>`).join('');
            loadAllData(config);
        })
        .catch(error => {
            console.error("Failed to load config.json:", error);
            mainContent.innerHTML = "<p class='text-red-500 text-center'>Could not load league configuration.</p>";
        });

    seasonSelect.addEventListener('change', updateView);
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.toggle('hidden', panel.id !== `${button.dataset.tab}-panel`);
            });
        });
    });

    mainContent.addEventListener('click', (e) => {
        if (e.target.matches('.nested-tab-button')) {
            const panel = e.target.closest('.tab-panel');
            if (!panel) return;
            panel.querySelectorAll('.nested-tab-button').forEach(btn => btn.classList.remove('active-tab'));
            e.target.classList.add('active-tab');
            panel.querySelectorAll('.nested-tab-panel').forEach(view => {
                view.classList.toggle('hidden', view.id !== `analysis-${e.target.dataset.view}-container`);
            });
        }
    });
});
