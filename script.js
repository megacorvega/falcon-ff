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
    
    // Used for coloring the season averages table
    function getColorForValue(value, min, max) {
        if (min === max) return 'hsl(0, 0%, 100%)';
        const percentage = (value - min) / (max - min);
        const hue = percentage * 120; 
        return `hsl(${hue}, 70%, 88%)`;
    }

    function createAnalysisPanelHTML() {
        // Always create the variance tab and container
        const varianceTab = `<li class="mr-2"><button class="nested-tab-button" data-view="variance">Variance</button></li>`;
        const varianceContainer = `<div id="analysis-variance-container" class="nested-tab-panel hidden"><div id="plotly-boxplot"></div></div>`;

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

    // Rewritten to handle both past season averages and current season scores/projections.
    function createAnalysisTable(data, week, year, analysisType) {
        if (!data || data.rosters.length === 0) return "<p>Analysis data not available.</p>";
        
        // **FIX**: Get the active positions for the season from the data file.
        // Fallback to a default list if not provided, ensuring backward compatibility.
        const positions = data.active_positions && data.active_positions.length > 0 
            ? data.active_positions 
            : ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

        // --- Part 1: Logic for Past Seasons (Averages) ---
        if (analysisType === 'averages') {
            const title = `${year} Season Averages`;
            const subtitle = 'Season-long average points per week by position group.';
            // Use the dynamic positions list
            const displayCols = ['Team', ...positions, 'Total'];

            const minMax = {};
            positions.forEach(pos => {
                const values = data.rosters.map(row => row[pos] || 0);
                minMax[pos] = { min: Math.min(...values), max: Math.max(...values) };
            });

            let tableHead = `<tr>${displayCols.map(col => `<th scope="col" class="px-6 py-3">${col}</th>`).join('')}</tr>`;
            let tableBody = data.rosters.map(row => {
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
                        <table class="w-full text-sm text-left text-gray-500"><thead class="text-xs text-gray-700 uppercase bg-gray-50">${tableHead}</thead><tbody>${tableBody}</tbody></table>
                    </div>`;
        } 
        
        // --- Part 2: Logic for Current Season (Live/Projected Scores) ---
        else {
            const title = `Week ${week} Positional Scores`;
            const subtitle = 'Live and projected points by position group.';
            // const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']; // This is now defined at the top of the function

            // **FIX**: Calculate min/max values for each position to be used in color scaling.
            // This mirrors the logic used for past season averages.
            const minMax = {};
            positions.forEach(pos => {
                const values = data.rosters.map(row => {
                    const live = row[`${pos}_live`] || 0;
                    const projected = row[`${pos}_projected`] || 0;
                    const status = row[`${pos}_status`] || 'projected';
                    const hasLiveScore = live > 0.001 || (status !== 'projected');
                    return hasLiveScore ? live : projected;
                });
                minMax[pos] = { min: Math.min(...values), max: Math.max(...values) };
            });
            
            let tableHead = `<tr><th scope="col" class="px-6 py-3">Team</th>${positions.map(p => `<th scope="col" class="px-6 py-3 text-center">${p}</th>`).join('')}<th scope="col" class="px-6 py-3 text-center">Total</th></tr>`;
            
            let tableBody = data.rosters.map(row => {
                let rowHtml = '<tr class="border-b">';
                rowHtml += `<td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap"><div class="flex items-center"><img src="${row.Avatar}" alt="Logo" class="w-6 h-6 rounded-full mr-3">${row.Team}</div></td>`;
                
                let totalLive = row.Total_live || 0;
                let totalProjected = row.Total_projected || 0;

                positions.forEach(pos => {
                    const projected = row[`${pos}_projected`] || 0;
                    const live = row[`${pos}_live`] || 0;
                    const status = row[`${pos}_status`] || 'projected';
                    
                    const hasLiveScore = live > 0.001 || (status !== 'projected');
                    let displayScore = hasLiveScore ? live : projected;

                    let scoreClass = 'score-projected'; // default grey
                    if (status === 'active') scoreClass = 'score-active';
                    else if (status === 'final') scoreClass = 'score-final';
                    
                    const { min, max } = minMax[pos];
                    const bgColor = getColorForValue(displayScore, min, max);
                    
                    rowHtml += `<td class="px-6 py-4 text-center font-medium" style="background-color: ${bgColor};">
                                    <div class="${scoreClass}">${displayScore.toFixed(2)}</div>
                                    ${hasLiveScore ? `<div class="text-xs score-projected">(${totalProjected.toFixed(2)})</div>` : ''}
                               </td>`;
                });

                const totalDisplay = totalLive > 0 ? totalLive : totalProjected;
                rowHtml += `<td class="px-6 py-4 text-center font-bold">
                                <div>${totalDisplay.toFixed(2)}</div>
                                ${totalLive > 0 ? `<div class="text-xs score-projected">(${totalProjected.toFixed(2)})</div>` : ''}
                            </td>`;

                return rowHtml + '</tr>';
            }).join('');

            return `<h2 class="text-2xl font-bold text-gray-800 mb-4">${title}</h2>
                    <p class="mb-4 text-gray-600">${subtitle}</p>
                    <div class="relative overflow-x-auto shadow-md sm:rounded-lg">
                        <table class="w-full text-sm text-left text-gray-500"><thead class="text-xs text-gray-700 uppercase bg-gray-50">${tableHead}</thead><tbody>${tableBody}</tbody></table>
                    </div>`;
        }
    }
    
    // Handles both data structures for chart rendering.
    function renderPlotlyChart(rostersData, week, year, analysisType) {
        const chartDiv = document.getElementById('plotly-chart');
        if (!chartDiv || !rostersData || rostersData.length === 0) return;

        // **FIX**: Get active positions dynamically from the full dataset for the selected year.
        const selectedYear = document.getElementById('season-select').value;
        const yearData = allData[selectedYear];
        const positions = yearData.active_positions && yearData.active_positions.length > 0 
            ? yearData.active_positions 
            : ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

        const teams = rostersData.map(d => d.Team);
        // const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']; // Replaced by dynamic list above
        let traces;
        let chartTitle;

        if (analysisType === 'averages') {
            chartTitle = `${year} Season Average Positional Scores`;
            traces = positions.map(pos => ({
                x: teams,
                y: rostersData.map(d => d[pos] || 0),
                name: pos,
                type: 'bar'
            }));
        } else { // 'scores' for current season
            chartTitle = `Week ${week} Positional Scores`;
            traces = positions.map(pos => ({
                x: teams,
                // Display live score if available, otherwise fall back to projected
                y: rostersData.map(d => (d[`${pos}_live`] > 0.001 ? d[`${pos}_live`] : d[`${pos}_projected`]) || 0),
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

    function renderBoxPlot(weeklyScores, year) {
        const chartDiv = document.getElementById('plotly-boxplot');
        if (!chartDiv || !weeklyScores || Object.keys(weeklyScores).length === 0) {
            if (chartDiv) chartDiv.innerHTML = '<p class="text-center text-gray-500">Weekly score data is not yet available.</p>';
            return;
        };

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
            analysisPanel.innerHTML = createAnalysisPanelHTML();
            
            const tableContainer = document.getElementById('analysis-table-container');
            if (tableContainer) {
                // Pass the whole data object to the function now
                tableContainer.innerHTML = createAnalysisTable(data, data.projection_week, selectedYear, data.analysis_type);
            }
            
            renderPlotlyChart(data.rosters, data.projection_week, selectedYear, data.analysis_type);
            
            // Render box plot for all seasons that have weekly score data
            renderBoxPlot(data.weekly_scores, selectedYear);
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
                allData[year] = null; // Ensure failed loads are handled
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

