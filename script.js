document.addEventListener('DOMContentLoaded', () => {
    const seasonSelect = document.getElementById('season-select');
    const tabButtons = document.querySelectorAll('.tab-button');
    let activeTab = 'power-rankings';
    let allData = {};

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

    function createProjectionsTable(data, week) {
        if (!data || data.length === 0) return "<p>Weekly projection data not available.</p>";
        const canonicalOrder = ['Team', 'QB', 'RB1', 'RB2', 'RB3', 'WR1', 'WR2', 'WR3', 'TE', 'FLEX1', 'FLEX2', 'FLEX3', 'K', 'DEF', 'Total'];
        const displayCols = canonicalOrder.filter(col => col in data[0]);
        
        let tableHead = `<tr>${displayCols.map(col => `<th scope="col" class="px-6 py-3">${col}</th>`).join('')}</tr>`;
        let tableBody = data.map(row => {
            let rowHtml = '<tr>';
            for (const col of displayCols) {
                if (col === 'Team') {
                    rowHtml += `<td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap"><div class="flex items-center"><img src="${row.Avatar}" alt="Logo" class="w-6 h-6 rounded-full mr-3">${row.Team}</div></td>`;
                } else if (col === 'Total') {
                    rowHtml += `<td class="px-6 py-4 font-bold">${row.Total.toFixed(2)}</td>`;
                } else {
                    rowHtml += `<td class="px-6 py-4">${row[col] || ''}</td>`;
                }
            }
            return rowHtml + '</tr>';
        }).join('');

        return `<h2 class="text-2xl font-bold text-gray-800 mb-4">Week ${week} Projected Starters</h2>
                <div class="relative overflow-x-auto shadow-md sm:rounded-lg">
                    <table class="w-full text-sm text-left text-gray-500">
                        <thead class="text-xs text-gray-700 uppercase bg-gray-50">${tableHead}</thead>
                        <tbody>${tableBody}</tbody>
                    </table>
                </div>`;
    }

    function createPositionalChart(data, elementId) {
        const container = document.getElementById(elementId);
        if (!data || data.length === 0) {
            container.innerHTML = "<p>Positional average data not available.</p>";
            return;
        }
        const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].filter(p => p in data[0]);
        const plotData = positions.map(pos => ({
            x: data.map(t => t.Team),
            y: data.map(t => t[pos]),
            name: pos,
            type: 'bar'
        }));
        const layout = {
            barmode: 'stack', title: 'Positional Scoring Averages',
            xaxis: {title: 'Team'}, yaxis: {title: 'Average Weekly Points'},
            font: {family: 'Cascadia Code, monospace', size: 12, color: '#333'},
            plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)',
            legend: {traceorder: 'normal'}
        };
        Plotly.newPlot(elementId, plotData, layout, {responsive: true});
    }

    function updateView() {
        const selectedYear = seasonSelect.value;
        const data = allData[selectedYear];
        if (!data) {
            console.error(`No data loaded for year ${selectedYear}`);
            // Display error messages in all panels
            document.getElementById('power-rankings-panel').innerHTML = "<p class='text-red-500 text-center'>Data could not be loaded for this season.</p>";
            document.getElementById('fdvoa-panel').innerHTML = "<p class='text-red-500 text-center'>Data could not be loaded for this season.</p>";
            document.getElementById('projections-view').innerHTML = "<p class='text-red-500 text-center'>Data could not be loaded for this season.</p>";
            document.getElementById('averages-view').innerHTML = "<p class='text-red-500 text-center'>Data could not be loaded for this season.</p>";
            return;
        }

        document.getElementById('power-rankings-panel').innerHTML = createPowerRankingsTable(data.power_rankings);
        document.getElementById('fdvoa-panel').innerHTML = createFdvoaTable(data.fdvoa);
        document.getElementById('projections-view').innerHTML = createProjectionsTable(data.rosters, data.projection_week);
        createPositionalChart(data.positional_chart, 'averages-view');
    }

    async function loadAllData(config) {
        for (const year of config.years) {
            try {
                const response = await fetch(`data_${year}.json`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                allData[year] = await response.json();
            } catch (e) {
                console.error(`Failed to load data for ${year}:`, e);
            }
        }
        updateView();
    }

    fetch('config.json')
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(config => {
            document.getElementById('league-logo').src = config.logoUrl;
            document.getElementById('last-updated').textContent = `Last updated: ${config.lastUpdated} UTC`;
            seasonSelect.innerHTML = config.years.map(y => `<option value="${y}">${y}</option>`).join('');
            loadAllData(config);
        })
        .catch(error => {
            console.error("Failed to load config.json:", error);
            document.querySelector('main').innerHTML = "<p class='text-red-500 text-center'>Could not load league configuration. Please run the Python script.</p>";
        });

    seasonSelect.addEventListener('change', updateView);
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            activeTab = button.dataset.tab;
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.toggle('hidden', !panel.id.startsWith(activeTab));
            });
        });
    });

    document.querySelectorAll('.nested-tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const parent = e.target.closest('.tab-panel');
            parent.querySelectorAll('.nested-tab-button').forEach(btn => btn.classList.remove('active-tab', 'text-blue-600', 'bg-gray-100'));
            e.target.classList.add('active-tab', 'text-blue-600', 'bg-gray-100');
            const view = e.target.dataset.view;
            parent.querySelectorAll('.nested-tab-panel').forEach(panel => {
                panel.classList.toggle('hidden', !panel.id.startsWith(view));
            });
        });
    });
});
