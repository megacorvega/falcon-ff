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
    
    function getColorForValue(value, min, max) {
        if (min === max) return 'hsl(0, 0%, 100%)';
        const percentage = (value - min) / (max - min);
        const hue = percentage * 120; 
        return `hsl(${hue}, 70%, 88%)`;
    }

    /**
     * Conditionally generates the Analysis panel HTML based on available data.
     */
    function createAnalysisPanelHTML(analysisType) {
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

    function createAnalysisTable(data, week, year, analysisType) {
        if (!data || data.length === 0) return "<p>Analysis data not available.</p>";
        
        let title = '';
        let subtitle = '';

        if (analysisType === 'averages') {
            title = `${year} Season Averages`;
            subtitle = 'Season-long average points per week by position group.';
        } else if (analysisType === 'scores') {
            title = `Week ${week - 1} Positional Scores`;
            subtitle = 'Actual points scored by position group for the last completed week.';
        } else {
            title = `Week ${week} Positional Projections`;
            subtitle = 'Projected points by position group.';
        }

        const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
        const displayCols = ['Team', ...positions, 'Total'];

        const minMax = {};
        positions.forEach(pos => {
            const values = data.map(row => row[pos] || 0);
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

    function renderPlotlyChart(rostersData, weeklyScoresData, week, year, analysisType) {
        const chartDiv = document.getElementById('plotly-chart');
        if (!chartDiv || !rostersData || rostersData.length === 0) return;

        let chartTitle = '';
        const teams = rostersData.map(d => d.Team);
        const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
        let traces;
        
        // **FIX**: Logic to correctly calculate and scale positional averages for past seasons.
        if (analysisType === 'averages') {
            chartTitle = `${year} Season Average Positional Scores`;
            traces = positions.map(pos => {
                const yValues = rostersData.map(teamData => {
                    const teamName = teamData.Team;
                    const weeklyScores = weeklyScoresData[teamName];
                    if (!weeklyScores || weeklyScores.length === 0) return 0;

                    // Calculate the true average total score from the weekly data
                    const trueAverageTotal = weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length;
                    
                    // Calculate the sum of the (incorrect) positional averages from the table data
                    const sumOfPositionalAverages = positions.reduce((sum, p) => sum + (teamData[p] || 0), 0);
                    if (sumOfPositionalAverages === 0) return 0;

                    // Calculate the proportion for the current position
                    const proportion = (teamData[pos] || 0) / sumOfPositionalAverages;
                    
                    // Return the correctly scaled positional average
                    return trueAverageTotal * proportion;
                });
                return { x: teams, y: yValues, name: pos, type: 'bar' };
            });
        } else { // For 'scores' and 'projections', the logic remains the same
            chartTitle = (analysisType === 'scores') ? `Week ${week - 1} Positional Scores` : `Week ${week} Projections`;
            traces = positions.map(pos => ({
                x: teams,
                y: rostersData.map(d => d[pos]),
                name: pos,
                type: 'bar'
            }));
        }
        
        const layout = {
            barmode: 'stack',
            title: chartTitle,
            xaxis: { title: 'Team', automargin: true },
            yaxis: { title: 'Points' },
            legend: { orientation: 'h', y: -0.3 },
            margin: { t: 40, b: 100, l: 50, r: 20 }
        };
        
        Plotly.newPlot(chartDiv, traces, layout, {responsive: true});
    }

    /**
     * New function to render the box and whisker plot for past seasons.
     */
    function renderBoxPlot(weeklyScores, year) {
        const chartDiv = document.getElementById('plotly-boxplot');
        if (!chartDiv || !weeklyScores || Object.keys(weeklyScores).length === 0) return;

        // Calculate median for each team and sort by it.
        const getMedian = arr => {
            const mid = Math.floor(arr.length / 2);
            const nums = [...arr].sort((a, b) => a - b);
            return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
        };

        const sortedTeams = Object.keys(weeklyScores)
            .map(teamName => ({
                name: teamName,
                median: getMedian(weeklyScores[teamName])
            }))
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
            margin: { t: 40, b: 100, l: 50, r: 20 }
        };

        Plotly.newPlot(chartDiv, traces, layout, {responsive: true});
    }

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
            analysisPanel.innerHTML = createAnalysisPanelHTML(data.analysis_type);
            
            const tableContainer = document.getElementById('analysis-table-container');
            if (tableContainer) {
                tableContainer.innerHTML = createAnalysisTable(data.rosters, data.projection_week, selectedYear, data.analysis_type);
            }
            
            // **FIX**: Pass both rosters and weekly_scores data to the chart renderer.
            renderPlotlyChart(data.rosters, data.weekly_scores, data.projection_week, selectedYear, data.analysis_type);
            
            if (data.analysis_type === 'averages') {
                renderBoxPlot(data.weekly_scores, selectedYear);
            }
        }
    }

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
