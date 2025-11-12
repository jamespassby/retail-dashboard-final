// --- Global Variables & Config ---
let allBrandData = [];
let chartInstances = {}; // Store chart instances to destroy them later
const chartColors = {
    textColor: '#888888', gridColor: '#333333',
    visitColor: 'rgb(54, 162, 235)', spendColor: 'rgb(255, 205, 86)',
    txnsColor: 'rgb(255, 99, 132)', growthColor: 'rgb(75, 192, 192)',
    heatColor: 'rgb(255, 159, 64)'
};
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TRENDING_BRANDS = ["7-Eleven", "Shell Oil", "Dollar General"]; // Use brands from your data

// --- Homepage Table State Variables ---
let processedHomepageData = [];
let currentSortKey = 'currentRank';
let currentSortDir = 'asc';
let allCategories = [];
let selectedCategories = [];


// --- Helper Functions ---
function getLastNNumbers(arr, n) {
    if (!Array.isArray(arr)) return [];
    const validStrings = arr.filter(val => val !== null && val !== undefined && String(val).trim() !== '' && !isNaN(val));
    const numbers = validStrings.map(parseFloat);
    return numbers.slice(-n);
}
function normalizeScore(value, minVal = -20, maxVal = 20) {
    if (value === null || isNaN(value)) return null;
    if (value <= minVal) return 0;
    if (value >= maxVal) return 100;
    return Math.round(((value - minVal) / (maxVal - minVal)) * 100);
}

// *** UPDATED formatChange function ***
const formatChange = (change, isPercentage = true, showPlus = true, precision = 0) => {
    if (change === null || isNaN(change)) return '--';
    const symbol = change > 0 ? (showPlus ? '+' : '') : (change < 0 ? '−' : '');
    const suffix = isPercentage ? '%' : '';
    const pointsSuffix = !isPercentage ? ' MoM' : ''; // Use "MoM"
    return `${symbol}${Math.abs(change).toFixed(precision)}${suffix}${pointsSuffix}`;
};

const getChangeClass = (change) => {
     if (change === null || isNaN(change) || change === 0) return 'neutral';
     return change > 0 ? 'positive' : 'negative';
 };
const getScoreColor = (score) => {
    if (score === null || isNaN(score)) return 'var(--border-color)';
    if (score >= 75) return 'var(--positive-color)';
    if (score >= 50) return 'rgb(255, 205, 86)';
    if (score >= 25) return 'rgb(255, 159, 64)';
    return 'var(--negative-color)';
}
function getMonthLabelForIndex(dataArrays, index) {
     const baseLength = Math.max(
         dataArrays.visits_yoy_array?.length || 0,
         dataArrays.spend_yoy_array?.length || 0,
         dataArrays.txns_yoy_array?.length || 0,
         dataArrays.visits_index_array?.length || 0,
         dataArrays.spend_index_array?.length || 0,
         dataArrays.txns_index_array?.length || 0
     );
     if (index < 0) index = baseLength + index;
     if (index >= baseLength || index < 0 || baseLength === 0) return "N/A";
     const currentMonth = new Date().getMonth();
     let monthIndex = (currentMonth - (baseLength - 1 - index)) % 12;
     if (monthIndex < 0) { monthIndex += 12; }
     const currentYear = new Date().getFullYear();
     const yearOffset = Math.floor((currentMonth - (baseLength - 1 - index)) / 12);
     const year = currentYear + yearOffset;
     return `${MONTH_NAMES[monthIndex]} '${String(year).slice(-2)}`;
}


// --- Score Calculation ---
function calculateScoreTimeSeries(brandData, scoreType = 'growth') {
    const timeSeriesLength = Math.max( brandData.visits_yoy_array?.length || 0, brandData.spend_yoy_array?.length || 0, brandData.txns_yoy_array?.length || 0, brandData.visits_index_array?.length || 0, brandData.spend_index_array?.length || 0, brandData.txns_index_array?.length || 0 );
    if (timeSeriesLength === 0) return { scores: [], changes: [] };
    const scores = []; const changes = [];

    let growthTS = null; let heatTS = null;
    if (scoreType === 'total') {
        growthTS = calculateScoreTimeSeries(brandData, 'growth');
        heatTS = calculateScoreTimeSeries(brandData, 'heat');
    }

    for (let i = 0; i < timeSeriesLength; i++) {
        let currentScore = null;
        try {
            if (scoreType === 'growth') {
                const visitYoY = parseFloat(brandData.visits_yoy_array?.[i] ?? NaN); const spendYoY = parseFloat(brandData.spend_yoy_array?.[i] ?? NaN); const txnsYoY = parseFloat(brandData.txns_yoy_array?.[i] ?? NaN);
                if (!isNaN(visitYoY) && !isNaN(spendYoY) && !isNaN(txnsYoY)) {
                    const normVisit = normalizeScore(visitYoY, -20, 20); const normSpend = normalizeScore(spendYoY, -20, 20); const normTxns = normalizeScore(txnsYoY, -20, 20);
                    if (normVisit !== null && normSpend !== null && normTxns !== null) { currentScore = Math.max(0, Math.min(100, Math.round((normVisit * 0.4) + (normSpend * 0.4) + (normTxns * 0.2)))); }
                }
            } else if (scoreType === 'heat' && i > 0) {
                 const visitIndexCurr = parseFloat(brandData.visits_index_array?.[i] ?? NaN); const visitIndexPrev = parseFloat(brandData.visits_index_array?.[i-1] ?? NaN);
                 const spendIndexCurr = parseFloat(brandData.spend_index_array?.[i] ?? NaN); const spendIndexPrev = parseFloat(brandData.spend_index_array?.[i-1] ?? NaN);
                 const txnsIndexCurr = parseFloat(brandData.txns_index_array?.[i] ?? NaN); const txnsIndexPrev = parseFloat(brandData.txns_index_array?.[i-1] ?? NaN);
                 if (!isNaN(visitIndexCurr) && !isNaN(visitIndexPrev) && !isNaN(spendIndexCurr) && !isNaN(spendIndexPrev) && !isNaN(txnsIndexCurr) && !isNaN(txnsIndexPrev) ) {
                     const visitMomChange = (visitIndexPrev !== 0) ? ((visitIndexCurr - visitIndexPrev) / visitIndexPrev) * 100 : (visitIndexCurr > 0 ? Infinity : 0);
                     const spendMomChange = (spendIndexPrev !== 0) ? ((spendIndexCurr - spendIndexPrev) / spendIndexPrev) * 100 : (spendIndexCurr > 0 ? Infinity : 0);
                     const txnsMomChange = (txnsIndexPrev !== 0) ? ((txnsIndexCurr - txnsIndexPrev) / txnsIndexPrev) * 100 : (txnsIndexCurr > 0 ? Infinity : 0);
                     const capValue = 200;
                     const safeVisitMom = isFinite(visitMomChange) ? visitMomChange : (visitMomChange > 0 ? capValue : -capValue);
                     const safeSpendMom = isFinite(spendMomChange) ? spendMomChange : (spendMomChange > 0 ? capValue : -capValue);
                     const safeTxnsMom = isFinite(txnsMomChange) ? txnsMomChange : (txnsMomChange > 0 ? capValue : -capValue);
                     const normVisitMom = normalizeScore(safeVisitMom, -15, 15); const normSpendMom = normalizeScore(safeSpendMom, -15, 15); const normTxnsMom = normalizeScore(safeTxnsMom, -15, 15);
                     if (normVisitMom !== null && normSpendMom !== null && normTxnsMom !== null) { currentScore = Math.max(0, Math.min(100, Math.round((normVisitMom * 0.35) + (normSpendMom * 0.40) + (normTxnsMom * 0.25)))); }
                 }
            }
             else if (scoreType === 'total') {
                 const growthScore = growthTS?.scores[i] ?? null; const heatScore = heatTS?.scores[i] ?? null;
                 if (growthScore !== null && heatScore !== null) { currentScore = Math.max(0, Math.min(100, Math.round((growthScore + heatScore) / 2))); }
            }
        } catch (loopError) { console.error(`Error calculating score in loop:`, loopError); currentScore = null; }
        scores.push(currentScore);
        if (i > 0 && scores[i] !== null && scores[i-1] !== null) { changes.push(scores[i] - scores[i-1]); } else { changes.push(null); }
    }
    return { scores, changes };
}

// --- Chart Drawing ---
function destroyChart(chartId) { if (chartInstances[chartId]) { chartInstances[chartId].destroy(); delete chartInstances[chartId]; } }

function createChartConfig(labels, datasets, yAxisLabel, isScoreChart = false) {
    if (typeof Chart === 'undefined') { console.error("Chart.js missing!"); return null; }
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = chartColors.textColor;

    return {
        type: 'line', data: { labels: labels, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: isScoreChart, max: isScoreChart ? 100 : undefined, title: { display: true, text: yAxisLabel, color: chartColors.textColor, font: { size: 12, family: "'Inter', sans-serif" } }, ticks: { color: chartColors.textColor, precision: 0, font: { size: 11, family: "'Inter', sans-serif" } }, grid: { color: chartColors.gridColor, drawBorder: false }, },
                x: { title: { display: false }, ticks: { color: chartColors.textColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 12, font: { size: 11, family: "'Inter', sans-serif" } }, grid: { display: false }, border: { color: chartColors.gridColor } }
            },
            plugins: {
                legend: { display: datasets.length > 1, position: 'top', align: 'end', labels: { color: chartColors.textColor, boxWidth: 10, padding: 15, font: { size: 12, family: "'Inter', sans-serif" } } },
                tooltip: { backgroundColor: 'rgba(30,30,30,0.9)', titleColor: '#fff', bodyColor: '#fff', borderColor: chartColors.gridColor, borderWidth: 1, mode: 'index', intersect: false, padding: 10, boxPadding: 4, titleFont: { weight: 'bold', family: "'Inter', sans-serif" }, bodyFont: { size: 12, family: "'Inter', sans-serif" }, }
            },
            interaction: { mode: 'index', intersect: false },
            elements: { point: { radius: 0, hoverRadius: 5, hitRadius: 10 } },
            animation: { duration: 500 }
        }
    };
}

// Simplified chart renderer
function renderChartOrPlaceholder(canvasId, label, drawFunc) {
     destroyChart(canvasId); const container = document.getElementById(canvasId + 'Container');
     if (!container) { console.error(`Container ${canvasId + 'Container'} missing!`); return; }
     
     container.innerHTML = ''; // Clear previous content
     let canvasElement;
     try {
         canvasElement = document.createElement('canvas'); 
         canvasElement.id = canvasId;
         container.appendChild(canvasElement); // Add canvas directly
         container.className = 'chart-container'; // Set base class

         if (typeof Chart === 'undefined') { throw new Error('Chart.js missing.'); }
         drawFunc(canvasElement);
         
     } catch(chartError) {
         console.error(`Error drawing ${canvasId}:`, chartError);
         container.innerHTML = `<div class="chart-placeholder-div">Error drawing chart: ${label}. (No data or error)</div>`;
     }
}

function renderHealthScoreChart(canvasId, label, drawFunc) {
     destroyChart(canvasId); const container = document.getElementById(canvasId + 'Container');
     if (!container) { console.error(`Container ${canvasId + 'Container'} missing!`); return; }
     container.innerHTML = '';
     let canvasElement;
     try {
         canvasElement = document.createElement('canvas'); canvasElement.id = canvasId;
         container.appendChild(canvasElement);
         container.className = 'chart-container unblurred'; // Always unblurred
         if (typeof Chart === 'undefined') { throw new Error('Chart.js missing.'); }
         drawFunc(canvasElement);
     } catch(chartError) {
         console.error(`Error drawing ${canvasId}:`, chartError);
         container.innerHTML = `<div class="chart-placeholder-div unblurred">Error drawing chart: ${label}. (No data or error)</div>`;
     }
}

function drawLineChart(canvasElement, label, dataArray, yAxisLabel = 'Index', color = chartColors.visitColor) {
    const canvasCtx = canvasElement.getContext('2d'); if (!canvasCtx) return;
    const numericData = dataArray?.map(parseFloat).map(val => isNaN(val) ? null : val) || [];
    if (numericData.length === 0 || numericData.every(d => d === null)) { throw new Error('No valid data'); }
    const labels = generateMonthLabels(numericData.length);
    const datasets = [{ label: label, data: numericData, borderColor: color, fill: true, backgroundColor: color.replace('rgb(', 'rgba(').replace(')', ', 0.1)'), tension: 0.3, pointRadius: 0, hoverRadius: 4, spanGaps: true }];
    const config = createChartConfig(labels, datasets, yAxisLabel); if (!config) return;
    chartInstances[canvasElement.id] = new Chart(canvasCtx, config); console.log(`Chart ${canvasElement.id} drawn.`);
}
function drawScoreChart(canvasElement, growthScores, heatScores) {
    const canvasCtx = canvasElement.getContext('2d'); if (!canvasCtx) return;
    const hasGrowth = Array.isArray(growthScores) && growthScores.some(s => s !== null);
    const hasHeat = Array.isArray(heatScores) && heatScores.some(s => s !== null);
    if (!hasGrowth && !hasHeat) { throw new Error('No data'); }
    const maxLength = Math.max(growthScores?.length || 0, heatScores?.length || 0);
    const labels = generateMonthLabels(maxLength);
    const datasets = [];
    const createScoreDataset = (label, data, color) => ({ label: label, data: data, borderColor: color, fill: true, backgroundColor: color.replace('rgb(', 'rgba(').replace(')', ', 0.1)'), tension: 0.3, pointRadius: 0, pointHoverRadius: 4, spanGaps: true });
    if (hasGrowth) datasets.push(createScoreDataset('Growth Score', growthScores, chartColors.growthColor));
    if (hasHeat) datasets.push(createScoreDataset('Heat Score', heatScores, chartColors.heatColor));
    const config = createChartConfig(labels, datasets, 'Score (0-100)', true); if (!config) return;
    chartInstances[canvasElement.id] = new Chart(canvasCtx, config); console.log(`Chart ${canvasElement.id} drawn.`);
}
function generateMonthLabels(count) {
    const labels = []; const currentMonth = new Date().getMonth(); // 0-11
    if (typeof MONTH_NAMES === 'undefined' || !Array.isArray(MONTH_NAMES)) { console.error("MONTH_NAMES not defined!"); return Array(count).fill('P'); }
    for (let i = 0; i < count; i++) {
        let monthIndex = (currentMonth - (count - 1 - i)) % 12;
        if (monthIndex < 0) { monthIndex += 12; }
        labels.push(MONTH_NAMES[monthIndex]);
    }
    return labels;
}

// --- Main Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing Retail Index...");
    const inlineData = loadInlineData();
    if (inlineData && inlineData.length) {
        allBrandData = inlineData;
        renderPage();
    } else {
        fetchDataAndInitialize();
    }
});

async function fetchDataAndInitialize() {
    try {
        const dataset = document.body?.dataset || {};
        const dataUrl = dataset.dataUrl || 'data.json';
        console.log(`Fetching ${dataUrl}...`);
        const response = await fetch(dataUrl, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        allBrandData = await response.json();
        if (!Array.isArray(allBrandData) || allBrandData.length === 0) {
            throw new Error('Invalid data format.');
        }
        console.log("Data loaded successfully.");
        renderPage();
    } catch (error) {
        console.error("Data Load Error:", error);
        const contentDiv = document.getElementById('content');
        if (contentDiv) {
            contentDiv.innerHTML = `<p style="color:red; text-align:center;">Error loading data. Check console.</p>`;
        }
    }
}

function loadInlineData() {
    try {
        const inlineDataTag = document.getElementById('retail-data');
        if (!inlineDataTag) {
            return null;
        }
        const rawData = inlineDataTag.textContent || inlineDataTag.innerText || '';
        if (!rawData.trim()) {
            throw new Error('Inline data script tag is empty.');
        }
        return JSON.parse(rawData);
    } catch (error) {
        console.error("Inline Data Error:", error);
        return null;
    }
}

// --- Page Routing & Rendering ---
function renderPage() {
    console.log("renderPage called.");
    const contentDiv = document.getElementById('content');
    if (!contentDiv) { console.error("CRITICAL ERROR: 'content' div not found!"); return; }
    contentDiv.innerHTML = ''; // Clear loading message

    const params = new URLSearchParams(window.location.search);
    const dataset = document.body?.dataset || {};
    const brandNameParam = params.get('name');
    const brandSource = brandNameParam
        ? decodeURIComponent(brandNameParam)
        : (dataset.brandName || window.__BRAND_NAME__ || null);

    try {
        if (brandSource) {
            renderBrandPage(brandSource);
        } else {
            renderHomepage(allBrandData);
        }
        console.log("renderPage finished.");
    } catch (error) {
         console.error("Error in renderPage:", error);
         if (contentDiv) contentDiv.innerHTML = `<p style="color:red; text-align:center;">Error displaying page.</p>`;
    }
}

// --- Homepage Rendering (Refactored for Sorting/Filtering) ---

// Homepage main render function
function renderHomepage(data) {
    console.log("renderHomepage started.");
    const contentDiv = document.getElementById('content');
    if (!contentDiv) return;

    // --- Create static card data ---
    let hottestBrand = null, mostConsistentBrand = null;
    let highestHeatScore = -Infinity, lowestVariance = Infinity;
    
    data.forEach(brand => {
        if (!brand || !brand.brand_name) return;
        const heatTimeSeries = calculateScoreTimeSeries(brand, 'heat');
        const growthTimeSeries = calculateScoreTimeSeries(brand, 'growth');
        const latestHeat = heatTimeSeries.scores[heatTimeSeries.scores.length - 1];
        if (latestHeat !== null && latestHeat > highestHeatScore) { highestHeatScore = latestHeat; hottestBrand = brand; }
        const recentGrowthScores = growthTimeSeries.scores.slice(-6).filter(s => s !== null);
        if (recentGrowthScores.length >= 3) {
             const mean = recentGrowthScores.reduce((a, b) => a + b, 0) / recentGrowthScores.length;
             const variance = recentGrowthScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / recentGrowthScores.length;
             if (variance < lowestVariance && variance > 0) {
                 lowestVariance = variance;
                 mostConsistentBrand = brand;
             }
        }
    });
    if (!mostConsistentBrand && data.length > 1) mostConsistentBrand = data[1]; // Fallback

    // --- Set Homepage HTML ---
    contentDiv.innerHTML = `
        <div class="home-cards-container">
            ${createHomeCard(hottestBrand, '🔥 Hottest Brand (Recent Heat)')}
            ${createHomeCard(mostConsistentBrand, '📊 Most Consistent Brand (Growth Stability)')}
        </div>
        <h2 class="table-title">All Brands</h2>
        <table id="brandsTable">
            <thead>
                <tr>
                    <th class="sortable" data-sort="currentRank">Rank <span class="sort-arrow"></span></th>
                    <th>Brand</th>
                    <th id="category-filter-header">Category <i class="fas fa-filter" style="font-size: 0.8em; margin-left: 4px; opacity: 0.7;"></i></th>
                    <th class="sortable" data-sort="rankChange">Change <span class="sort-arrow"></span></th>
                    <th class="sortable" data-sort="currentGrowth">Growth <span class="sort-arrow"></span></th>
                    <th class="sortable" data-sort="currentHeat">Heat <span class="sort-arrow"></span></th>
                    <th class="sortable" data-sort="currentTotal">Total <span class="sort-arrow"></span></th>
                </tr>
            </thead>
            <tbody id="brandsTableBody"></tbody>
        </table>`;

    // --- Process data and set up interactive table ---
    processHomepageData(data); // Process and store in processedHomepageData
    addTableSorting();
    setupCategoryFilter();
    updateHomepageTable(); // Initial render
}

function createHomeCard(brandData, title) {
    if (!brandData) return `<div class="home-card"><h3>${title}</h3><p>Not enough data.</p></div>`;
    const growthTimeSeries = calculateScoreTimeSeries(brandData, 'growth');
    const heatTimeSeries = calculateScoreTimeSeries(brandData, 'heat');
    const currentGrowth = growthTimeSeries.scores[growthTimeSeries.scores.length - 1];
    const currentHeat = heatTimeSeries.scores[heatTimeSeries.scores.length - 1];
    const currentTotal = (currentGrowth !== null && currentHeat !== null) ? Math.round((currentGrowth + currentHeat) / 2) : null;
    const brandSlug = encodeURIComponent(brandData.brand_name); const pageUrl = window.location.pathname;
    const logoHtml = brandData.logo ? `<img src="${brandData.logo}" alt="${brandData.brand_name}" onerror="this.parentElement.innerHTML = '<span class=\'logo-placeholder\'><i class=\'fas fa-store\'></i></span>'">` : `<span class="logo-placeholder"><i class="fas fa-store"></i></span>`;
    return `<div class="home-card"><h3>${title}</h3><a href="${pageUrl}?name=${brandSlug}" class="brand-link">${logoHtml}${brandData.brand_name}</a>${currentGrowth !== null ? `<p class="metric"><span class="metric-label">Growth:</span><span class="metric-value">${currentGrowth}</span></p>` : ''}${currentHeat !== null ? `<p class="metric"><span class="metric-label">Heat:</span><span class="metric-value">${currentHeat}</span></p>` : ''}${currentTotal !== null ? `<p class="metric"><span class="metric-label">Total Score:</span><span class="metric-value">${currentTotal}</span></p>` : ''}</div>`;
}

// Processes data once
function processHomepageData(data) {
    console.log("processHomepageData started.");
    
    // Calculate scores for ALL brands
    const dataWithScores = data
        .filter(brand => brand && brand.brand_name)
        .map(brand => {
            const totalTS = calculateScoreTimeSeries(brand, 'total');
            const growthTS = calculateScoreTimeSeries(brand, 'growth');
            const heatTS = calculateScoreTimeSeries(brand, 'heat');
            return {
                ...brand,
                currentTotal: totalTS.scores[totalTS.scores.length - 1] ?? null,
                previousTotal: totalTS.scores[totalTS.scores.length - 2] ?? null,
                currentGrowth: growthTS.scores[growthTS.scores.length - 1] ?? null,
                currentHeat: heatTS.scores[heatTS.scores.length - 1] ?? null,
            };
        });

    // Create rank maps
    const createRankMap = (list, scoreKey) => {
        const sorted = [...list]
            .filter(b => b[scoreKey] !== null)
            .sort((a, b) => (b[scoreKey] ?? -Infinity) - (a[scoreKey] ?? -Infinity));
        const map = new Map();
        sorted.forEach((brand, index) => {
            map.set(brand.brand_name, index + 1);
        });
        return map;
    };
    const currentRankMap = createRankMap(dataWithScores, 'currentTotal');
    const previousRankMap = createRankMap(dataWithScores, 'previousTotal');

    // Combine data and calculate rank change
    processedHomepageData = dataWithScores.map(brand => {
        const currentRank = currentRankMap.get(brand.brand_name) ?? null;
        const previousRank = previousRankMap.get(brand.brand_name) ?? null;
        let rankChange = null;
        if (currentRank !== null && previousRank !== null) {
            rankChange = previousRank - currentRank;
        }
        return { ...brand, currentRank, rankChange };
    });

    // Get all unique categories for filter
    const categorySet = new Set();
    data.forEach(brand => {
        if(brand.top_category) categorySet.add(brand.top_category);
    });
    allCategories = [...categorySet].sort();
    console.log("processHomepageData finished.");
}

// Master function to filter, sort, and render table
function updateHomepageTable() {
    console.log("updateHomepageTable called.");
    
    // 1. Filter
    let dataToShow = processedHomepageData;
    if (selectedCategories.length > 0) {
        dataToShow = processedHomepageData.filter(brand => 
            selectedCategories.includes(brand.top_category)
        );
    }

    // 2. Sort
    dataToShow.sort((a, b) => {
        let valA = a[currentSortKey];
        let valB = b[currentSortKey];
        
        // Handle nulls: nulls go to the bottom
        if (valA === null) return 1;
        if (valB === null) return -1;
        
        let result = 0;
        if (valA < valB) {
            result = -1;
        } else if (valA > valB) {
            result = 1;
        }
        
        return currentSortDir === 'asc' ? result : -result;
    });

    // 3. Update Sort Indicators
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === currentSortKey) {
            th.classList.add(currentSortDir === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });

    // 4. Re-populate table
    populateHomepageTable(dataToShow);
}

// Now only renders rows
function populateHomepageTable(data) {
    console.log("populateHomepageTable started.");
    const tableBody = document.getElementById('brandsTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (data.length === 0) {
         const row = tableBody.insertRow();
         const cell = row.insertCell();
         cell.colSpan = 7;
         cell.textContent = "No brands match your filter.";
         cell.style.textAlign = 'center';
         return;
    }
    
    data.forEach((brand) => {
        // Don't show brands without a rank unless they are filtered
        if (brand.currentRank === null && selectedCategories.length === 0) return;

        const row = tableBody.insertRow();
        row.insertCell().textContent = brand.currentRank ?? '--';
        
        const brandCell = row.insertCell();
        const brandSlug = encodeURIComponent(brand.brand_name);
        const pageUrl = window.location.pathname;
        const logoHtml = brand.logo ? `<img class="table-logo" src="${brand.logo}" alt="${brand.brand_name}" onerror="this.parentElement.innerHTML = '<span class=\'logo-placeholder\'><i class=\'fas fa-store\'></i></span>'">` : `<span class="logo-placeholder"><i class="fas fa-store"></i></span>`;
        brandCell.innerHTML = `<a class="brand-table-link" href="${pageUrl}?name=${brandSlug}">${logoHtml}${brand.brand_name}</a>`;
        
        const categoryCell = row.insertCell();
        if (brand.top_category) {
            categoryCell.innerHTML = `<span class="category-pill">${brand.top_category}</span>`;
        } else {
            categoryCell.textContent = 'N/A';
        }
        
        const changeCell = row.insertCell();
        if (brand.rankChange !== null && brand.rankChange !== 0) {
            const direction = brand.rankChange > 0 ? 'positive' : 'negative';
            const arrow = brand.rankChange > 0 ? '▲' : '▼';
            changeCell.innerHTML = `<span class="rank-change ${direction}">${arrow} ${Math.abs(brand.rankChange)}</span>`;
        } else if (brand.rankChange === 0) {
            changeCell.innerHTML = `<span class="rank-change neutral">–</span>`;
        } else {
            changeCell.innerHTML = `<span class="rank-change neutral">New</span>`;
        }

        row.insertCell().textContent = brand.currentGrowth ?? '--';
        row.insertCell().textContent = brand.currentHeat ?? '--';
        row.insertCell().textContent = brand.currentTotal ?? '--';
    });
    console.log("Finished adding rows.");
}

// Adds click listeners to sortable headers
function addTableSorting() {
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const sortKey = th.dataset.sort;
            if (currentSortKey === sortKey) {
                currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortKey = sortKey;
                currentSortDir = (sortKey === 'currentRank' || sortKey === 'brand_name') ? 'asc' : 'desc'; // Default sort for keys
            }
            updateHomepageTable();
        });
    });
}

// Creates and manages the category filter dropdown
function setupCategoryFilter() {
    const header = document.getElementById('category-filter-header');
    if (!header) return;

    // Prevent duplicate dropdowns
    if (document.getElementById('categoryFilterDropdown')) return;

    const dropdown = document.createElement('div');
    dropdown.id = 'categoryFilterDropdown';
    dropdown.className = 'category-filter-dropdown';

    let itemsHtml = allCategories.map(category => `
        <div class="category-filter-item">
            <label>
                <input type="checkbox" data-category="${category}">
                ${category}
            </label>
        </div>
    `).join('');

    itemsHtml += `
        <div class="category-filter-actions">
            <button id="applyFilterBtn" class="filter-action-btn">Apply</button>
            <button id="clearFilterBtn" class="filter-action-btn">Clear</button>
        </div>
    `;
    dropdown.innerHTML = itemsHtml;
    header.appendChild(dropdown);

    // Toggle dropdown
    header.addEventListener('click', (e) => {
        if (e.target.id === 'category-filter-header' || e.target.parentElement.id === 'category-filter-header') {
            dropdown.classList.toggle('show');
        }
    });

    // Close dropdown if clicking outside
    document.addEventListener('click', (e) => {
        if (!header.contains(e.target) && dropdown.classList.contains('show')) {
            dropdown.classList.remove('show');
        }
    });

    // Stop propagation on dropdown clicks
    dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Apply button
    document.getElementById('applyFilterBtn').addEventListener('click', () => {
        selectedCategories = [];
        dropdown.querySelectorAll('input[type="checkbox"]:checked').forEach(input => {
            selectedCategories.push(input.dataset.category);
        });
        updateHomepageTable();
        dropdown.classList.remove('show');
    });

    // Clear button
    document.getElementById('clearFilterBtn').addEventListener('click', () => {
        selectedCategories = [];
        dropdown.querySelectorAll('input[type="checkbox"]').forEach(input => {
            input.checked = false;
        });
        updateHomepageTable();
        dropdown.classList.remove('show');
    });
}


// --- Search / Trending ---
function showSuggestions() {
    const input = document.getElementById('mainSearchInput'); const dropdown = document.getElementById('suggestionsDropdown'); const searchTerm = input.value.toLowerCase();
    if (!dropdown || !allBrandData) return; dropdown.innerHTML = ''; let suggestions = [];
    if (searchTerm.length === 0) {
        dropdown.innerHTML = '<div class="suggestion-title">Trending Brands</div>';
        suggestions = TRENDING_BRANDS.map(name => allBrandData.find(b => b.brand_name === name)).filter(b => b);
    } else {
        suggestions = allBrandData.filter(brand => brand?.brand_name?.toLowerCase().includes(searchTerm)).slice(0, 7);
    }
    if (suggestions.length > 0) {
        suggestions.forEach(brand => {
            const item = document.createElement('div'); item.className = 'suggestion-item';
             const logoHtml = brand.logo ? `<img src="${brand.logo}" alt="" onerror="this.style.display='none'">` : `<span class="logo-placeholder" style="font-size: 0.8em; padding: 2px;"><i class="fas fa-store"></i></span>`;
            item.innerHTML = `${logoHtml} ${brand.brand_name}`;
            item.onmousedown = () => { window.location.href = `${window.location.pathname}?name=${encodeURIComponent(brand.brand_name)}`; }; dropdown.appendChild(item);
        }); dropdown.style.display = 'block';
    } else { dropdown.style.display = 'none'; }
}
function hideSuggestions() { setTimeout(() => { const dropdown = document.getElementById('suggestionsDropdown'); if (dropdown) dropdown.style.display = 'none'; }, 150); }

// --- *** UPDATED Brand Page Rendering *** ---
function renderBrandPage(brandName) {
    console.log(`renderBrandPage started for: "${brandName}"`);
    if (!allBrandData || allBrandData.length === 0) return;
    const brandData = allBrandData.find(b => b.brand_name === brandName);
    const contentDiv = document.getElementById('content');
    const bodyDataset = document.body?.dataset || {};
    const defaultHome = window.location.pathname.split('?')[0] || '/';
    const homeUrl = bodyDataset.homeUrl || bodyDataset.defaultHome || defaultHome;
    if (!brandData) { contentDiv.innerHTML = `<h1>Brand Not Found</h1><p><a href="${homeUrl}" class="back-link">Back to list</a></p>`; return; }
    console.log("Brand found. Calculating scores...");
    document.title = `${brandData.brand_name} - Retail Health Index`;

    const growthTimeSeries = calculateScoreTimeSeries(brandData, 'growth');
    const heatTimeSeries = calculateScoreTimeSeries(brandData, 'heat');
    const totalTimeSeries = calculateScoreTimeSeries(brandData, 'total');
    const currentGrowthScore = growthTimeSeries.scores[growthTimeSeries.scores.length - 1] ?? null;
    const growthScoreChange = growthTimeSeries.changes[growthTimeSeries.changes.length - 1] ?? null;
    const currentHeatScore = heatTimeSeries.scores[heatTimeSeries.scores.length - 1] ?? null;
    const heatScoreChange = heatTimeSeries.changes[heatTimeSeries.changes.length - 1] ?? null;
    const currentTotalScore = totalTimeSeries.scores[totalTimeSeries.scores.length - 1] ?? null;
    const totalScoreChange = totalTimeSeries.changes[totalTimeSeries.changes.length - 1] ?? null;

    const latestVisitYoY = getLastNNumbers(brandData.visits_yoy_array, 1)[0] ?? null;
    const latestVisitIndex = getLastNNumbers(brandData.visits_index_array, 1)[0] ?? null;
    const latestSpendYoY = getLastNNumbers(brandData.spend_yoy_array, 1)[0] ?? null;
    const latestSpendIndex = getLastNNumbers(brandData.spend_index_array, 1)[0] ?? null;
    const latestTxnsYoY = getLastNNumbers(brandData.txns_yoy_array, 1)[0] ?? null;
    const latestTxnsIndex = getLastNNumbers(brandData.txns_index_array, 1)[0] ?? null;
    const latestMonth = getMonthLabelForIndex(brandData, -1);

    const growthScoreColor = getScoreColor(currentGrowthScore);
    const heatScoreColor = getScoreColor(currentHeatScore);
    const totalScoreColor = getScoreColor(currentTotalScore);
    const growthScoreDeg = (currentGrowthScore ?? 0) * 3.6;
    const heatScoreDeg = (currentHeatScore ?? 0) * 3.6;
    const totalScoreDeg = (currentTotalScore ?? 0) * 3.6;

    const lastVisitIndexArr=getLastNNumbers(brandData.visits_index_array,2);
    const lastSpendIndexArr=getLastNNumbers(brandData.spend_index_array,2);
    const lastTxnsIndexArr=getLastNNumbers(brandData.txns_index_array,2);
    const prevVisitIndex=lastVisitIndexArr.length>1?lastVisitIndexArr[0]:null;
    const visitIndexChange=(prevVisitIndex!==null&&latestVisitIndex!==null&&prevVisitIndex!==0)?((latestVisitIndex-prevVisitIndex)/prevVisitIndex)*100:null;
    const prevSpendIndex=lastSpendIndexArr.length>1?lastSpendIndexArr[0]:null;
    const spendIndexChange=(prevSpendIndex!==null&&latestSpendIndex!==null&&prevSpendIndex!==0)?((latestSpendIndex-prevSpendIndex)/prevSpendIndex)*100:null;
    const prevTxnsIndex=lastTxnsIndexArr.length>1?lastTxnsIndexArr[0]:null;
    const txnsIndexChange=(prevTxnsIndex!==null&&latestTxnsIndex!==null&&prevTxnsIndex!==0)?((latestTxnsIndex-prevTxnsIndex)/prevTxnsIndex)*100:null;

    const logoHtml = brandData.logo
            ? `<img src="${brandData.logo}" alt="${brandData.brand_name}" class="logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';">
               <span class="logo-placeholder" style="display: none;"><i class="fas fa-store"></i></span>`
            : `<span class="logo-placeholder"><i class="fas fa-store"></i></span>`;

    // *** UPDATED: New Form HTML is now included here ***
    const customFormHTML = `
        <div class="main-container">
            <div class="stepper-nav">
                <div class="step active" data-step="1"><span class="step-number">1</span> your brand</div>
                <div class="step" data-step="2"><span class="step-number">2</span> provide context</div>
                <div class="step" data-step="3"><span class="step-number">3</span> goals</div>
                <div class="step" data-step="4"><span class="step-number">4</span> get access</div>
            </div>

            <div class="form-content">
                <form id="multiStepForm">
                    <div class="form-step active" id="step-1">
                        <h2>Get your causal analysis</h2><p>Let's start by getting to know you and your brand.</p>
                        <div class="form-row">
                            <div class="form-group"><label for="first-name">First Name</label><input type="text" id="first-name" name="first-name" required></div>
                            <div class="form-group"><label for="last-name">Last Name</label><input type="text" id="last-name" name="last-name" required></div>
                        </div>
                        <div class="form-group"><label for="email">Work Email</label><input type="email" id="email" name="email" required></div>
                        <div class="form-group">
                            <label for="brand-search-trigger">Find Your Brand</label>
                            <input type="text" id="brand-search-trigger" class="brand-search-trigger" placeholder="Click to search for a brand..." readonly>
                            <input type="hidden" id="selected-brand-name">
                            <div id="brand-select-error" class="error-message"></div>
                        </div>
                        <div class="brand-metadata" id="brand-metadata-display">
                            <img id="brand-logo-img" src="" alt="Brand Logo" class="brand-logo">
                            <div class="brand-info"><h4 id="brand-name-display"></h4><p id="brand-category-display"></p></div>
                            <div class="brand-stats"><div id="brand-stores-display"></div><div id="brand-growth-display"></div></div>
                        </div>
                    </div>

                    <div class="form-step" id="step-2">
                        <h2>Brand Context</h2><p>Here's a look at your brand's footprint across the US.</p>
                         <div class="map-container">
                            <div class="map-overlay"><h4 id="map-overlay-brand"></h4><p id="map-overlay-category"></p><p id="map-overlay-stores"></p><p id="map-overlay-growth"></p></div>
                         </div>
                         <div class="form-group" style="margin-top: 2rem;"><label for="department">What is your department?</label><select id="department" name="department"><option>Real Estate & Development</option><option>Marketing & Brand Strategy</option><option>Operations & Performance</option><option>Analytics & Research</option><option>Executive Leadership</option></select></div>
                    </div>

                    <div class="form-step" id="step-3">
                        <h2>What are your goals?</h2><p>Help us understand your needs by selecting your team's top challenges.</p>
                        <div class="form-group"><label>Generations</label><div class="tag-group generation-tags"><div class="tag">Gen Z</div><div class="tag">Millennials</div><div class="tag">Gen X</div><div class="tag">Baby Boomers</div><div class="tag">Silent Gen</div></div></div>
                        <div class="form-group"><label>Segments</label><div class="tag-group segment-tags"><div class="tag">Affluent</div><div class="tag">Families</div><div class="tag">Students</div><div class="tag">Urbanites</div><div class="tag">Suburban</div><div class="tag">Rural</div><div class="tag">Tourists</div></div></div>
                        <div class="form-group"><label for="challenges-container">What are your team's challenges?</label><div class="tag-group" id="challenges-container"></div></div>
                        <div id="challenges-error" class="error-message"></div>
                    </div>

                    <div class="form-step" id="step-4">
                        <h2>Review and Get Your Report</h2><p>You're all set! Review your details below and we'll follow up with your report.</p>
                        <div class="review-panel">
                            <div class="review-summary">
                                <h3>Your Summary</h3>
                                <div class="summary-item"><strong>Brand</strong><span id="summary-brand"></span></div>
                                <div class="summary-item"><strong>Category</strong><span id="summary-category"></span></div>
                                <div class="summary-item"><strong>YoY Growth</strong><span id="summary-growth"></span></div>
                                <div class="summary-item"><strong>Department</strong><span id="summary-department"></span></div>
                                <div class="summary-item"><strong>Top Challenges</strong><span id="summary-challenges"></span></div>
                            </div>
                            <div class="map-container">
                               <div class="map-overlay"><h4 id="review-map-brand"></h4><p id="review-map-category"></p><p id="review-map-stores"></p><p id="review-map-growth"></p></div>
                            </div>
                        </div>
                    </div>

                    <div class="form-step" id="step-5">
                        <div class="thank-you-message">
                            <div class="icon">✓</div>
                            <h2>Submission Complete</h2>
                            <p>Thank you. We've received your information and will send a confirmation to your email shortly.</p>
                        </div>
                    </div>

                    <div class="nav-buttons">
                        <div class="btn-container">
                            <button type="button" id="prevBtn" class="btn">Back</button>
                            <button type="button" id="nextBtn" class="btn btn-primary">Next</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
        
        <div class="modal-container" id="brand-search-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Find Your Brand</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <input type="text" id="modal-search-input" placeholder="Search by brand name...">
                    <div class="modal-results" id="modal-results-list"></div>
                </div>
            </div>
        </div>
    `;

    console.log("Building Brand Page HTML...");
    try {
        contentDiv.innerHTML = `
            <a href="${homeUrl}" class="back-link">&larr; Back to Brand List</a>
            
            <div class="brand-header-fullwidth">
                <div class="brand-header">
                     <div class="logo-container">
                         ${logoHtml}
                     </div>
                     <div class="brand-details">
                         <h1>${brandData.brand_name}</h1>
                         <div class="meta-data">
                             <span><i><i class="fas fa-dollar-sign"></i></i> ${brandData.stock_symbol ? `${brandData.stock_exchange}:${brandData.stock_symbol}` : 'N/A'}</span>
                             <span><i><i class="fas fa-store"></i></i> ${brandData.place_count || 'N/A'} Stores</span>
                             <span><i><i class="fas fa-link"></i></i> <a class="website-link" href="${brandData.url ? `http://${brandData.url}` : '#'}" target="_blank">${brandData.url || 'N/A'}</a></span>
                         </div>
                          <p class="categories">
                              ${brandData.top_category ? `<span class="category-pill">${brandData.top_category}</span>` : ''}
                              ${brandData.sub_category ? `<span class="category-pill">${brandData.sub_category}</span>` : ''}
                          </p>
                     </div>
                </div>
                <div class="score-header">
                     <div class="score-block">
                         <div class="score-widget-circle" style="background: conic-gradient(${growthScoreColor} ${growthScoreDeg}deg, var(--border-color) ${growthScoreDeg}deg 360deg);"><span>${currentGrowthScore ?? '--'}</span></div>
                         <div class="score-details"><span class="score-label">Growth Score</span><span class="score-value">${currentGrowthScore ?? '--'}</span><span class="score-change ${getChangeClass(growthScoreChange)}">${formatChange(growthScoreChange, false, true, 0)}</span></div>
                         <span class="tooltip-container"><i class="tooltip-icon">?</i><span class="tooltip-text">Long-term growth momentum (YoY trends).</span></span>
                     </div>
                     <div class="score-block">
                          <div class="score-widget-circle" style="background: conic-gradient(${heatScoreColor} ${heatScoreDeg}deg, var(--border-color) ${heatScoreDeg}deg 360deg);"><span>${currentHeatScore ?? '--'}</span></div>
                          <div class="score-details"><span class="score-label">Heat Score</span><span class="score-value">${currentHeatScore ?? '--'}</span><span class="score-change ${getChangeClass(heatScoreChange)}">${formatChange(heatScoreChange, false, true, 0)}</span></div>
                         <span class="tooltip-container"><i class="tooltip-icon">?</i><span class="tooltip-text">Short-term 'hotness' (Index MoM changes).</span></span>
                     </div>
                     <div class="score-block">
                          <div class="score-widget-circle" style="background: conic-gradient(${totalScoreColor} ${totalScoreDeg}deg, var(--border-color) ${totalScoreDeg}deg 360deg);"><span>${currentTotalScore ?? '--'}</span></div>
                          <div class="score-details"><span class="score-label">Total Score</span><span class="score-value">${currentTotalScore ?? '--'}</span><span class="score-change ${getChangeClass(totalScoreChange)}">${formatChange(totalScoreChange, false, true, 0)}</span></div>
                         <span class="tooltip-container"><i class="tooltip-icon">?</i><span class="tooltip-text">Combined Growth & Heat score average.</span></span>
                     </div>
                </div>
            </div>

            <div class="brand-page-layout">
                <div class="brand-main-content-wrapper">
                    <div class="promo-banner" style="background-image: url('https://passby.com/wp-content/uploads/2025/10/Artboard-scaled.jpg');" onclick="document.getElementById('custom-html-card').scrollIntoView({ behavior: 'smooth' });">
                         <p>Unlock the full story behind ${brandData.brand_name}'s performance with <a href="https://passby.com" target="_blank">Pass_by Pro</a>. See causal drivers, competitor benchmarks, and more.</p>
                    </div>

                     <section id="section-health-scores" class="section-widget">
                         <h3>Health Score Trends</h3>
                         <div id="healthScoreTrendChartContainer" class="chart-container"></div>
                     </section>

                     <section id="section-top-stores" class="section-widget">
                         <h3>Top Stores</h3>
                         <table class="data-table-header-only">
                            <thead>
                                <tr>
                                    <th>Store Name</th>
                                    <th>Address</th>
                                    <th>YoY Visits</th>
                                    <th>YoY Spend</th>
                                    <th>YoY Transactions</th>
                                </tr>
                            </thead>
                         </table>
                         <div class="blurred-section" data-scroll-target="custom-html-card" style="margin-top: -1px; border-top-left-radius: 0; border-top-right-radius: 0;">
                            <div class="blurred-section-content" style="filter: blur(5px);">
                                <table class="data-table-body-only">
                                    <tbody>
                                        <tr><td>Store #123</td><td>123 Main St, New York, NY</td><td>+10.5%</td><td>+8.2%</td><td>+12.1%</td></tr>
                                        <tr><td>Store #456</td><td>456 Oak Ave, Los Angeles, CA</td><td>+9.8%</td><td>+7.1%</td><td>+11.5%</td></tr>
                                        <tr><td>Store #789</td><td>789 Pine Ln, Chicago, IL</td><td>+8.1%</td><td>+6.5%</td><td>+9.9%</td></tr>
                                        <tr><td>Store #101</td><td>101 Maple Rd, Houston, TX</td><td>+7.5%</td><td>+5.0%</td><td>+8.3%</td></tr>
                                        <tr><td>Store #202</td><td>202 Birch Pl, Miami, FL</td><td>+6.9%</td><td>+4.8%</td><td>+7.7%</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            <div class="blur-overlay" style="border-top-left-radius: 0; border-top-right-radius: 0;"><i class="fas fa-lock"></i> Get full historical data with pass_by pro</div>
                         </div>
                     </section>

                     <section id="section-demographics" class="section-widget">
                         <h3>Demographics</h3>
                         <div class="blurred-section" data-scroll-target="custom-html-card">
                            <div class="blurred-section-content" style="filter: blur(5px);">
                                <div class="chart-grid-three">
                                    <div class="chart-placeholder-div">Mock Pie Chart 1<br>(e.g., Age)</div>
                                    <div class="chart-placeholder-div">Mock Pie Chart 2<br>(e.g., Income)</div>
                                    <div class="chart-placeholder-div">Mock Pie Chart 3<br>(e.g., Gender)</div>
                                </div>
                            </div>
                            <div class="blur-overlay"><i class="fas fa-lock"></i> Get full historical data with pass_by pro</div>
                         </div>
                     </section>

                     <section id="section-causal-factors" class="section-widget">
                         <h3>Causal Factors</h3>
                         <div class="blurred-section" data-scroll-target="custom-html-card">
                            <div class="blurred-section-content" style="filter: blur(5px);">
                                <div class="causal-factor-chart">
                                    <div class="factor-center-line"></div>
                                    <div class="factor-bar positive" style="width: 38%;"><span class="factor-label">ZIP: population density</span><span class="factor-value">0.38</span></div>
                                    <div class="factor-bar positive" style="width: 20%;"><span class="factor-label">Number of stores from the same category...</span><span class="factor-value">0.20</span></div>
                                    <div class="factor-bar positive" style="width: 13%;"><span class="factor-label">Visitors: % families with young children</span><span class="factor-value">0.13</span></div>
                                    <div class="factor-bar positive" style="width: 11%;"><span class="factor-label">Total places of interest within 500m...</span><span class="factor-value">0.11</span></div>
                                    <div class="factor-bar positive" style="width: 9%;"><span class="factor-label">Transport hubs within 5m</span><span class="factor-value">0.09</span></div>
                                    <div class="factor-bar positive" style="width: 9%;"><span class="factor-label">ZIP: % aged 20-29</span><span class="factor-value">0.09</span></div>
                                    <div class="factor-bar positive" style="width: 7%;"><span class="factor-label">Grocery stores within 500m</span><span class="factor-value">0.07</span></div>
                                    <div class="factor-bar positive" style="width: 7%;"><span class="factor-label">Foot traffic within 500m radius</span><span class="factor-value">0.07</span></div>
                                    <div class="factor-bar negative" style="width: 3%;"><span class="factor-label">ZIP: % aged 40-49</span><span class="factor-value">-0.03</span></div>
                                    <div class="factor-bar negative" style="width: 9%;"><span class="factor-label">Size of trade area (70% of store visitors)</span><span class="factor-value">-0.09</span></div>
                                    <div class="factor-bar negative" style="width: 18%;"><span class="factor-label">Retail sales within 500m</span><span class="factor-value">-0.18</span></div>
                                    <div class="factor-bar negative" style="width: 21%;"><span class="factor-label">Visitors: % in professional services</span><span class="factor-value">-0.21</span></div>
                                </div>
                            </div>
                            <div class="blur-overlay"><i class="fas fa-lock"></i> Get full historical data with pass_by pro</div>
                         </div>
                     </section>

                     <section id="section-foot-traffic" class="section-widget">
                         <h3>Foot Traffic</h3>
                         <div class="data-snippet-header">
                            <div class="snippet"><span class="snippet-label">Latest Visit Index (${latestMonth})</span><span class="snippet-value">${latestVisitIndex !== null ? Math.round(latestVisitIndex) : '--'}</span></div>
                            <div class="snippet"><span class="snippet-label">Visit Index Change (MoM)</span><span class="snippet-value ${getChangeClass(visitIndexChange)}">${formatChange(visitIndexChange, true, true, 2)}</span></div>
                            <div class="snippet"><span class="snippet-label">Latest Visit YoY (${latestMonth})</span><span class="snippet-value ${getChangeClass(latestVisitYoY)}">${formatChange(latestVisitYoY, true, true, 2)}</span></div>
                         </div>
                         <div class="blurred-section" data-scroll-target="custom-html-card">
                             <div class="blurred-section-content">
                                 <div class="chart-pair">
                                     <div id="visitYoYChartContainer" class="chart-container"></div>
                                     <div id="visitIndexChartContainer" class="chart-container"></div>
                                 </div>
                             </div>
                             <div class="blur-overlay"><i class="fas fa-lock"></i> Get full historical data with pass_by pro</div>
                         </div>
                     </section>

                     <section id="section-spend" class="section-widget">
                         <h3>Spend</h3>
                          <div class="data-snippet-header">
                             <div class="snippet"><span class="snippet-label">Latest Spend Index (${latestMonth})</span><span class="snippet-value">${latestSpendIndex !== null ? Math.round(latestSpendIndex) : '--'}</span></div>
                             <div class="snippet"><span class="snippet-label">Spend Index Change (MoM)</span><span class="snippet-value ${getChangeClass(spendIndexChange)}">${formatChange(spendIndexChange, true, true, 2)}</span></div>
                             <div class="snippet"><span class="snippet-label">Latest Spend YoY (${latestMonth})</span><span class="snippet-value ${getChangeClass(latestSpendYoY)}">${formatChange(latestSpendYoY, true, true, 2)}</span></div>
                          </div>
                          <div class="blurred-section" data-scroll-target="custom-html-card">
                             <div class="blurred-section-content">
                               <div class="chart-pair">
                                  <div id="spendYoYChartContainer" class="chart-container"></div>
                                  <div id="spendIndexChartContainer" class="chart-container"></div>
                               </div>
                             </div>
                             <div class="blur-overlay"><i class="fas fa-lock"></i> Get full historical data with pass_by pro</div>
                          </div>
                     </section>

                     <section id="section-transactions" class="section-widget">
                          <h3>Transactions</h3>
                           <div class="data-snippet-header">
                             <div class="snippet"><span class="snippet-label">Latest Txn Index (${latestMonth})</span><span class="snippet-value">${latestTxnsIndex !== null ? Math.round(latestTxnsIndex) : '--'}</span></div>
                             <div class="snippet"><span class="snippet-label">Txn Index Change (MoM)</span><span class="snippet-value ${getChangeClass(txnsIndexChange)}">${formatChange(txnsIndexChange, true, true, 2)}</span></div>
                             <div class="snippet"><span class="snippet-label">Latest Txn YoY (${latestMonth})</span><span class="snippet-value ${getChangeClass(latestTxnsYoY)}">${formatChange(latestTxnsYoY, true, true, 2)}</span></div>
                           </div>
                           <div class="blurred-section" data-scroll-target="custom-html-card">
                             <div class="blurred-section-content">
                               <div class="chart-pair">
                                  <div id="txnsYoYChartContainer" class="chart-container"></div>
                                  <div id="txnsIndexChartContainer" class="chart-container"></div>
                               </div>
                             </div>
                             <div class="blur-overlay"><i class="fas fa-lock"></i> Get full historical data with pass_by pro</div>
                           </div>
                     </section>

                     <section id="custom-html-card" class="section-widget">
                         ${customFormHTML}
                     </section>
                </div>
                <aside class="brand-toc-sidebar">
                    <h3>On this page</h3>
                    <ul id="tocList"></ul>
                </aside>
            </div>
        `;
        console.log("Brand Page HTML rendered.");

        setTimeout(() => {
             generateTOC();
             setupScrollSpy();
             drawAllCharts(brandData, growthTimeSeries, heatTimeSeries);
             addBlurOverlayListeners(); // Add listeners for ALL blur overlays
             initializeCustomForm(); // *** NEW: Run the form's JavaScript ***
        }, 50);

    } catch (renderError) { console.error("Error rendering Brand Page HTML:", renderError); if(contentDiv) contentDiv.innerHTML = `<p style="color:red;">Error displaying details.</p>`; }
}

function drawAllCharts(brandData, growthTS, heatTS) {
     console.log("drawAllCharts called.");
     Object.keys(chartInstances).forEach(key => destroyChart(key));
     
     // Health Score Chart (Not Blurred)
     renderHealthScoreChart('healthScoreTrendChart', 'Health Score Trends', (el) => drawScoreChart(el, growthTS.scores, heatTS.scores));
     
     // --- Blurred Charts ---
     renderChartOrPlaceholder('visitYoYChart', 'Foot Traffic YoY %', (el) => drawLineChart(el, 'Visits YoY %', brandData.visits_yoy_array, 'YoY %', chartColors.visitColor));
     renderChartOrPlaceholder('visitIndexChart', 'Visit Index', (el) => drawLineChart(el, 'Visit Index', brandData.visits_index_array, 'Index', chartColors.visitColor));
     renderChartOrPlaceholder('spendYoYChart', 'Spend YoY %', (el) => drawLineChart(el, 'Spend YoY %', brandData.spend_yoy_array, 'YoY %', chartColors.spendColor));
     renderChartOrPlaceholder('spendIndexChart', 'Spend Index', (el) => drawLineChart(el, 'Spend Index', brandData.spend_index_array, 'Index', chartColors.spendColor));
     renderChartOrPlaceholder('txnsYoYChart', 'Transaction YoY %', (el) => drawLineChart(el, 'Txns YoY %', brandData.txns_yoy_array, 'YoY %', chartColors.txnsColor));
     renderChartOrPlaceholder('txnsIndexChart', 'Transaction Index', (el) => drawLineChart(el, 'Transaction Index', brandData.txns_index_array, 'Index', chartColors.txnsColor));

     console.log("Finished attempting chart draws.");
}

// --- TOC & ScrollSpy ---
let scrollTimeout; let activeTOCLink = null;
function generateTOC() {
    const tocList = document.getElementById('tocList');
    const sections = document.querySelectorAll('.brand-main-content-wrapper section[id]');
    if (!tocList || sections.length === 0) return; tocList.innerHTML = '';
    
    // *** UPDATED: Get title from inside the form ***
    const formSection = document.getElementById('custom-html-card');
    let formTitleText = 'Request Data';
    if (formSection) {
        const formTitleEl = formSection.querySelector('h2');
        if (formTitleEl) formTitleText = formTitleEl.textContent;
    }

    sections.forEach(section => {
        let titleText;
        let sectionId = section.id;

        if (section.id === 'custom-html-card') {
            titleText = formTitleText; // Use the title from inside the form
        } else {
            const titleElement = section.querySelector('h3'); 
            titleText = titleElement ? titleElement.textContent : 'Section';
        }

        const listItem = document.createElement('li'); const link = document.createElement('a'); link.href = `#${sectionId}`; link.textContent = titleText; listItem.appendChild(link); tocList.appendChild(listItem);
        link.addEventListener('click', (e) => { e.preventDefault();
            const targetSection = document.getElementById(sectionId);
            if (targetSection) {
                 targetSection.scrollIntoView({ behavior: 'smooth' });
                 updateTOCActiveState(sectionId);
            }
        });
    });
}
function setupScrollSpy() {
    const sections = document.querySelectorAll('.brand-main-content-wrapper section[id]');
    if (sections.length === 0) return;
    const observerOptions = { root: null, rootMargin: '-20% 0px -70% 0px', threshold: 0 };
    const observerCallback = (entries) => {
        entries.forEach(entry => {
            const id = entry.target.getAttribute('id');
            if (entry.isIntersecting) {
                 clearTimeout(scrollTimeout);
                 scrollTimeout = setTimeout(() => { updateTOCActiveState(id); }, 50);
            }
        });
    };
    const observer = new IntersectionObserver(observerCallback, observerOptions);
    sections.forEach(section => {
         observer.observe(section);
    });
    setTimeout(() => { const visibleSection = findVisibleSection(sections); if (visibleSection) updateTOCActiveState(visibleSection.id); }, 100);
}
function updateTOCActiveState(activeId) {
     const tocLinks = document.querySelectorAll('.brand-toc-sidebar #tocList li a');
     tocLinks.forEach(link => { link.classList.remove('active'); });
     const activeLink = document.querySelector(`.brand-toc-sidebar #tocList li a[href="#${activeId}"]`);
     if (activeLink) { activeLink.classList.add('active'); activeTOCLink = activeLink; }
}
function findVisibleSection(sections) {
    let bestMatch = null; let smallestTop = Infinity;
    sections.forEach(section => {
        const rect = section.getBoundingClientRect(); 
        if (rect.top >= 0 && rect.top < window.innerHeight * 0.4) { 
            if (rect.top < smallestTop) { smallestTop = rect.top; bestMatch = section; } 
        } 
    });
    return bestMatch || sections[0] || null;
}


// --- *** UPDATED Click listener for ALL blurred sections *** ---
function addBlurOverlayListeners() {
    const blurredOverlays = document.querySelectorAll('.blur-overlay'); // Find all overlays
    console.log(`Found ${blurredOverlays.length} blur overlays.`);
    blurredOverlays.forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const targetId = overlay.parentElement.dataset.scrollTarget; // Get target from parent
            console.log(`Blur overlay clicked, scrolling to: ${targetId}`);
            if (targetId) {
                document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

// --- --- --- --- --- --- --- --- --- --- --- --- --- ---
// --- *** NEW: Custom Form Initialization Logic *** ---
// --- This is your script, wrapped in a function ---
// --- --- --- --- --- --- --- --- --- --- --- --- --- ---
function initializeCustomForm() {
    // We run this *after* the DOM is ready, so $(document).ready() is redundant,
    // but we wrap in a simple $() to ensure jQuery is loaded.
    $(function() {
        // Scoping all jQuery selectors to the card to prevent conflicts
        const $formContainer = $('#custom-html-card'); 
        if ($formContainer.length === 0) {
            console.error("Custom form container #custom-html-card not found.");
            return;
        }

        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4_7uFw_cLk1X8Nars-rEIoKIZrgCiqo3JvAGvqk8GVjwVw3PHx-GtTvxwa6MuxnerVQ/exec';
        let currentStep = 1; const totalSteps = 5; let brandData = [];
        const dataUrl = 'https://passby.com/docs/data/script_job_e4005717792935135463cbeab1a5fd52_0.csv';
        const genericIconUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzEyMTIxMiI+PHBhdGggZD0iTTE4IDZWNkgxNVY0SDlWNkg2VjRoLTJ2M0g0VjRoLTJ2M0gydjE1aDIwdjRIMjJWM2gtMnYxek0xMCAxNUgxNlY4SDEwVjE1Wk00IDE5VjExSDhWMTlINFpNMTAgMTlWMTdIMTZWMTlIMTBaTTE4IDE5VjExSDIyVjE1SDE4WiIvPjwvc3ZnPg==';

        const challenges = {
            real_estate: ["Find new store locations", "Cannibalization analysis", "Portfolio optimization", "Market entry strategy", "Competitor footprint analysis", "Site scoring & ranking", "Lease renewal decisions", "Understand trade area demographics", "Analyze foot traffic patterns", "Validate broker recommendations"],
            marketing: ["Measure campaign effectiveness", "Audience segmentation", "Geofenced advertising", "Understand customer journey", "Analyze brand affinity", "OOH advertising placement", "Sponsorship impact analysis", "Identify co-tenancy opportunities", "Define target personas", "Optimize media spend"],
            operations: ["Benchmark against competitors", "Understand regional performance", "Staffing optimization", "Analyze impact of store hours", "Identify underperforming stores", "Diagnose visit spikes/dips", "Impact of local events", "Weather impact analysis", "Loyalty program effectiveness", "Real-time performance alerts"],
            analytics: ["Build predictive models", "Data visualization & BI", "Create custom reports", "ETL & Data pipeline management", "Customer Lifetime Value (CLV)", "Market basket analysis", "A/B testing framework", "Attribution modeling", "API integration", "Data quality assurance"],
            executive: ["Strategic growth planning", "Market share analysis", "SWOT analysis", "Mergers & acquisitions (M&A)", "Investor relations reporting", "Quarterly business review (QBR)", "Long-range forecasting", "Crisis management insights", "Sustainability (ESG) metrics", "New market evaluation"]
        };

        const departmentToChallengeKey = {
            "Real Estate & Development": "real_estate", "Marketing & Brand Strategy": "marketing",
            "Operations & Performance": "operations", "Analytics & Research": "analytics", "Executive Leadership": "executive"
        };
        
        function escapeHtml(str) {
            if (str === null || str === undefined) return '';
            return String(str).replace(/[&<>"']/g, s => ({'&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'": '&#39;'})[s]);
        }

        function fetchData() {
            Papa.parse(dataUrl, {
                download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
                complete: function(results) { brandData = results.data; renderModalResults(brandData); },
                error: function(error) { console.error('Papa Parse Error:', error); $formContainer.find('#brand-select-error').text('Could not load brand data.').show(); }
            });
        }

        function renderModalResults(data) {
            const list = $formContainer.find('#modal-results-list');
            list.empty();
            data.forEach(item => {
                if (!item.name) return;
                const growth = parseFloat(item.yoy_visit_change_pct);
                const growthFormatted = !isNaN(growth) ? growth.toFixed(2) + '%' : 'N/A';
                const growthClass = isNaN(growth) ? '' : (growth >= 0 ? 'growth-positive' : 'growth-negative');
                const arrow = isNaN(growth) ? '' : (growth >= 0 ? '▲' : '▼');
                const logoUrl = (item.logo && typeof item.logo === 'string' && item.logo.trim().startsWith('http')) ? item.logo.trim() : genericIconUrl;

                const resultHtml = `<div class="option-layout" data-brand-name="${escapeHtml(item.name)}"><img class="option-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(item.name)} logo"><div class="option-details"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.top_category) || 'Uncategorized'}</span></div><div class="option-stats"><div>~${item.place_count || 0} stores</div><div class="${growthClass}">YoY%: ${arrow} ${growthFormatted}</div></div></div>`;
                list.append(resultHtml);
            });
        }
        
        function selectBrand(brandName) {
            const selectedBrand = brandData.find(b => b.name === brandName);
            if (selectedBrand) {
                $formContainer.find('#brand-search-trigger').val(selectedBrand.name).removeClass('has-error');
                $formContainer.find('#selected-brand-name').val(selectedBrand.name);
                $formContainer.find('#brand-select-error').hide();
                
                const growth = parseFloat(selectedBrand.yoy_visit_change_pct);
                const growthFormatted = !isNaN(growth) ? growth.toFixed(2) + '%' : 'N/A';
                const growthClass = isNaN(growth) ? '' : (growth >= 0 ? 'growth-positive' : 'growth-negative');
                const arrow = isNaN(growth) ? '' : (growth >= 0 ? '▲' : '▼');
                const logoUrl = (selectedBrand.logo && typeof selectedBrand.logo === 'string' && selectedBrand.logo.trim().startsWith('http')) ? selectedBrand.logo.trim() : genericIconUrl;

                $formContainer.find('#brand-metadata-display').fadeIn();
                $formContainer.find('#brand-logo-img').attr('src', logoUrl);
                $formContainer.find('#brand-name-display').text(selectedBrand.name);
                $formContainer.find('#brand-category-display').text(selectedBrand.top_category || 'Uncategorized');
                $formContainer.find('#brand-stores-display').text(`~${selectedBrand.place_count || 0} stores`);
                $formContainer.find('#brand-growth-display').text(`YoY%: ${arrow} ${growthFormatted}`).removeClass('growth-positive growth-negative').addClass(growthClass);
                
                closeModal();
            }
        }

        function openModal() { $formContainer.find('#brand-search-modal').css('display', 'flex').hide().fadeIn(200); $formContainer.find('#modal-search-input').focus(); }
        function closeModal() { $formContainer.find('#brand-search-modal').fadeOut(200); }

        function updateChallenges(jobTitleKey) {
            const container = $formContainer.find('#challenges-container'); container.empty();
            const challengeList = challenges[jobTitleKey] || [];
            challengeList.forEach(challenge => { container.append(`<div class="tag">${challenge}</div>`); });
        }

        function validateStep(step) {
            let isValid = true;
            $formContainer.find('.has-error').removeClass('has-error');
            $formContainer.find('.error-message').hide();

            if (step === 1) {
                if (!$formContainer.find('#first-name').val()) { $formContainer.find('#first-name').addClass('has-error'); isValid = false; }
                if (!$formContainer.find('#last-name').val()) { $formContainer.find('#last-name').addClass('has-error'); isValid = false; }
                if (!$formContainer.find('#email').val()) { $formContainer.find('#email').addClass('has-error'); isValid = false; }
                if (!$formContainer.find('#selected-brand-name').val()) {
                    $formContainer.find('#brand-search-trigger').addClass('has-error');
                    $formContainer.find('#brand-select-error').text('Please select your brand.').show();
                    isValid = false;
                }
            }
            if (step === 3) {
                let hasError = false;
                if ($formContainer.find('.generation-tags .tag.selected').length === 0) {
                    $formContainer.find('.generation-tags').addClass('has-error'); hasError = true;
                }
                if ($formContainer.find('.segment-tags .tag.selected').length === 0) {
                    $formContainer.find('.segment-tags').addClass('has-error'); hasError = true;
                }
                 if ($formContainer.find('#challenges-container .tag.selected').length === 0) {
                    $formContainer.find('#challenges-container').addClass('has-error'); hasError = true;
                }
                if (hasError) {
                     $formContainer.find('#challenges-error').text('Please make at least one selection for each category.').show();
                     isValid = false;
                }
            }
            return isValid;
        }

        function updateStepView() {
            $formContainer.find('.form-step').removeClass('active'); 
            $formContainer.find(`#step-${currentStep}`).addClass('active');
            
            $formContainer.find('.step').removeClass('active completed');
            $formContainer.find('.step').each(function(index) {
                const stepNumberEl = $(this).find('.step-number');
                const stepNumber = index + 1;
                if (stepNumber < currentStep) {
                    $(this).addClass('completed');
                    stepNumberEl.html('✓');
                } else if (stepNumber === currentStep) {
                    $(this).addClass('active');
                    stepNumberEl.text(stepNumber);
                } else {
                    stepNumberEl.text(stepNumber);
                }
            });

            $formContainer.find('#prevBtn').css('visibility', currentStep > 1 && currentStep < 5 ? 'visible' : 'hidden');
            
            if (currentStep === 4) {
                $formContainer.find('#nextBtn').text('Confirm & Submit');
            } else {
                $formContainer.find('#nextBtn').text('Next');
            }
            
            if (currentStep >= 5) {
                $formContainer.find('.nav-buttons, .stepper-nav').hide();
            } else {
                $formContainer.find('.nav-buttons, .stepper-nav').show();
            }
        }
        
        function collectFormData() {
            const selectedBrandName = $formContainer.find('#selected-brand-name').val();
            const selectedBrand = brandData.find(b => b.name === selectedBrandName) || {};
            const generations = [];
            $formContainer.find('.generation-tags .tag.selected').each(function() { generations.push($(this).text()); });
            const segments = [];
            $formContainer.find('.segment-tags .tag.selected').each(function() { segments.push($(this).text()); });
            const challenges = [];
            $formContainer.find('#challenges-container .tag.selected').each(function() { challenges.push($(this).text()); });
            
            return {
                firstName: $formContainer.find('#first-name').val(),
                lastName: $formContainer.find('#last-name').val(),
                email: $formContainer.find('#email').val(),
                brandName: selectedBrand.name,
                brandId: selectedBrand.pid,
                department: $formContainer.find('#department').val(),
                targetGen: generations.join(', '),
                segments: segments.join(', '),
                challenges: challenges.join(', ')
            };
        }

        function populateSummary() {
            const formData = collectFormData();
            const selectedBrand = brandData.find(b => b.name === formData.brandName) || {};
            const growth = parseFloat(selectedBrand.yoy_visit_change_pct);
            const growthFormatted = !isNaN(growth) ? growth.toFixed(2) + '%' : 'N/A';
            const growthClass = isNaN(growth) ? '' : (growth >= 0 ? 'growth-positive' : 'growth-negative');
            const arrow = isNaN(growth) ? '' : (growth >= 0 ? '▲' : '▼');

            $formContainer.find('#summary-brand').text(formData.brandName || 'Not selected');
            $formContainer.find('#summary-category').text(selectedBrand.top_category || 'Uncategorized');
            $formContainer.find('#summary-growth').text(`${arrow} ${growthFormatted}`).removeClass('growth-positive growth-negative').addClass(growthClass);
            $formContainer.find('#summary-department').text(formData.department || 'Not selected');
            $formContainer.find('#summary-challenges').text(formData.challenges || 'None selected');
            
            $formContainer.find('#map-overlay-brand, #review-map-brand').text(formData.brandName || '');
            $formContainer.find('#map-overlay-category, #review-map-category').text(selectedBrand.top_category || '');
            $formContainer.find('#map-overlay-stores, #review-map-stores').text(`~${selectedBrand.place_count || 0} stores`);
            $formContainer.find('#map-overlay-growth, #review-map-growth').text(`YoY%: ${arrow} ${growthFormatted}`).removeClass('growth-positive growth-negative').addClass(growthClass);
        }

        function submitDataToGoogle(formData) {
            if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL === 'PASTE_YOUR_WEB_APP_URL_HERE') {
                console.error("Google Script URL is not set. Advancing for demo purposes.");
                currentStep++;
                updateStepView();
                return; 
            }

            const submitButton = $formContainer.find('#nextBtn');
            submitButton.text('Submitting...').prop('disabled', true);

            fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(formData)
            })
            .then(response => response.json())
            .then(data => {
                 console.log('Success:', data);
                 currentStep++;
                 updateStepView();
            })
            .catch(error => {
                console.error('Error submitting data:', error);
                alert('There was an error submitting your form. The server may be configured incorrectly. Please check the console for details.');
                submitButton.text('Confirm & Submit').prop('disabled', false); 
            });
        }

        // REFACTORED NAVIGATION LOGIC
        $formContainer.find('#nextBtn').on('click', function(e) {
            if (!validateStep(currentStep)) {
                return;
            }
            
            if (currentStep === 4) { // This is the submit action
                const formData = collectFormData();
                submitDataToGoogle(formData);
            } else { // Action for all other 'Next' buttons
                currentStep++;
                if (currentStep === 3) {
                    const selectedDepartment = $formContainer.find('#department').val();
                    const challengeKey = departmentToChallengeKey[selectedDepartment] || 'operations';
                    updateChallenges(challengeKey);
                }
                if (currentStep === 2 || currentStep === 4) { 
                    populateSummary(); 
                }
                updateStepView();
            }
        });
        
        $formContainer.find('#brand-search-trigger').on('click', openModal);
        // Use event delegation for modal close
        $formContainer.on('click', '.modal-container .close-btn, .modal-container', function(e) {
            if ($(e.target).is('.modal-container, .close-btn')) closeModal();
        });

        $formContainer.find('#modal-search-input').on('input', function() {
            const searchTerm = $(this).val().toLowerCase();
            const filteredData = brandData.filter(b => b.name && String(b.name).toLowerCase().includes(searchTerm));
            renderModalResults(filteredData);
        });
        $formContainer.find('#modal-results-list').on('click', '.option-layout', function() {
            selectBrand($(this).data('brand-name'));
        });

        $formContainer.find('#prevBtn').on('click', function() { if (currentStep > 1) { currentStep--; updateStepView(); } });
        // Use event delegation for tags
        $formContainer.on('click', '.tag', function() { $(this).toggleClass('selected'); });
    
        fetchData();
        updateStepView();
    });
}
// --- --- --- End of Custom Form Logic --- --- ---


// --- Global Handlers ---
window.showTrending = function() {
    const dropdown = document.getElementById('suggestionsDropdown'); if (dropdown) { dropdown.innerHTML = '<div class="suggestion-title">Trending Brands</div>'; TRENDING_BRANDS.forEach(brandName => { const item = document.createElement('div'); item.className = 'suggestion-item'; const brand = allBrandData.find(b=>b.brand_name === brandName); const logo = brand?.logo; const logoHtml = logo ? `<img src="${brand.logo}" alt="" onerror="this.style.display='none'">` : `<span class="logo-placeholder"><i class="fas fa-store"></i></span>`; item.innerHTML = `${logoHtml} ${brandName}`; item.onmousedown = () => { window.location.href = `${window.location.pathname}?name=${encodeURIComponent(brandName)}`; }; dropdown.appendChild(item); }); dropdown.style.display = 'block'; }
};
window.hideTrending = function() {
    setTimeout(() => { const dropdown = document.getElementById('suggestionsDropdown'); if (dropdown) dropdown.style.display = 'none'; }, 150); // Delay to allow click
};
window.handleSearchInput = function(searchTerm) {
    showSuggestions(); // Show suggestions based on input
}
