const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const baseHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const brandData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data.json'), 'utf8'));

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'brands'), { recursive: true });

copyStatic('style.css');
copyStatic('script.js');
copyStatic('data.json');
if (fs.existsSync(path.join(ROOT, 'Artboard.jpg'))) {
    copyStatic('Artboard.jpg');
}
fs.writeFileSync(path.join(DIST, 'index.html'), baseHtml);

brandData.forEach(brand => {
    const slug = slugify(brand.brand_name);
    const brandDir = path.join(DIST, 'brands', slug);
    fs.mkdirSync(brandDir, { recursive: true });
    const homeRelative = path.relative(brandDir, path.join(DIST, 'index.html')).split(path.sep).join('/');
    const brandHtml = buildBrandHtml(brand, homeRelative);
    fs.writeFileSync(path.join(brandDir, 'index.html'), brandHtml);
});

console.log(`Generated ${brandData.length} brand pages in dist/brands`);

function copyStatic(fileName) {
    fs.copyFileSync(path.join(ROOT, fileName), path.join(DIST, fileName));
}

function buildBrandHtml(brand, homeUrl) {
    const brandMarkup = buildBrandMarkup(brand, homeUrl);
    const assetPrefix = homeUrl.endsWith('index.html') ? homeUrl.replace(/index\.html$/, '') : homeUrl;
    const stylePath = `${assetPrefix}style.css`;
    const scriptPath = `${assetPrefix}script.js`;
    const dataPath = `${assetPrefix}data.json`;
    let html = baseHtml;
    html = html.replace('<body data-page-type="home" data-home-url="index.html" data-data-url="data.json">', `<body data-page-type="brand" data-home-url="${escapeAttr(homeUrl)}" data-data-url="${escapeAttr(dataPath)}" data-brand-name="${escapeAttr(brand.brand_name)}">`);
    html = html.replace('href="./index.html"', `href="${homeUrl}"`);
    html = html.replace('href="style.css"', `href="${stylePath}"`);
    html = html.replace('src="script.js"></script>', `src="${scriptPath}"></script>`);
    html = html.replace('<div class="loading">Loading Retail Data...</div>', brandMarkup);
    return html;
}

function buildBrandMarkup(brandData, homeUrl) {
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

    const lastVisitIndexArr = getLastNNumbers(brandData.visits_index_array, 2);
    const lastSpendIndexArr = getLastNNumbers(brandData.spend_index_array, 2);
    const lastTxnsIndexArr = getLastNNumbers(brandData.txns_index_array, 2);
    const prevVisitIndex = lastVisitIndexArr.length > 1 ? lastVisitIndexArr[0] : null;
    const visitIndexChange = (prevVisitIndex !== null && latestVisitIndex !== null && prevVisitIndex !== 0) ? ((latestVisitIndex - prevVisitIndex) / prevVisitIndex) * 100 : null;
    const prevSpendIndex = lastSpendIndexArr.length > 1 ? lastSpendIndexArr[0] : null;
    const spendIndexChange = (prevSpendIndex !== null && latestSpendIndex !== null && prevSpendIndex !== 0) ? ((latestSpendIndex - prevSpendIndex) / prevSpendIndex) * 100 : null;
    const prevTxnsIndex = lastTxnsIndexArr.length > 1 ? lastTxnsIndexArr[0] : null;
    const txnsIndexChange = (prevTxnsIndex !== null && latestTxnsIndex !== null && prevTxnsIndex !== 0) ? ((latestTxnsIndex - prevTxnsIndex) / prevTxnsIndex) * 100 : null;

    const logoHtml = brandData.logo
        ? `<img src="${brandData.logo}" alt="${brandData.brand_name}" class="logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';">
               <span class="logo-placeholder" style="display: none;"><i class="fas fa-store"></i></span>`
        : `<span class="logo-placeholder"><i class="fas fa-store"></i></span>`;

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
                        <div class="form-group brand-search-trigger"><label for="brand">Brand</label><input type="text" id="brand" name="brand" readonly placeholder="Search brand" value="${brandData.brand_name}"></div>
                        <div class="form-group"><label for="department">Department</label><select id="department" name="department"><option value="" disabled selected>Select your department</option><option>Real Estate & Development</option><option>Marketing & Brand Strategy</option><option>Operations & Performance</option><option>Analytics & Research</option><option>Executive Leadership</option></select></div>
                        <div id="brand-select-error" class="error-message"></div>
                    </div>

                    <div class="form-step" id="step-2">
                        <h2>Provide Context</h2><p>Tell us more about ${brandData.brand_name}. Good context gives you better recommendations.</p>
                        <div class="form-row">
                            <div class="form-group"><label for="title">Your Title</label><input type="text" id="title" name="title"></div>
                            <div class="form-group"><label for="phone">Phone (optional)</label><input type="text" id="phone" name="phone"></div>
                        </div>
                        <div class="form-group"><label for="location">Primary Region of Focus</label><input type="text" id="location" name="location" placeholder="e.g., Southeast, Southern California"></div>
                        <div class="form-group"><label for="timeline">Desired Timeline</label><select id="timeline" name="timeline"><option value="" disabled selected>Select timeline</option><option>ASAP</option><option>2-4 Weeks</option><option>1-3 Months</option><option>3-6 Months</option><option>6+ Months</option></select></div>
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

    return `
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
                                <p>Full store-level insights available with pass_by pro.</p>
                            </div>
                            <div class="blur-overlay"><i class="fas fa-lock"></i> Unlock store rankings</div>
                         </div>
                     </section>

                     <section id="section-visits" class="section-widget">
                         <h3>Visits</h3>
                         <div class="data-snippet-header">
                             <div class="snippet"><span class="snippet-label">Latest Visit Index (${latestMonth})</span><span class="snippet-value">${latestVisitIndex !== null ? Math.round(latestVisitIndex) : '--'}</span></div>
                             <div class="snippet"><span class="snippet-label">Visit Index Change (MoM)</span><span class="snippet-value ${getChangeClass(visitIndexChange)}">${formatChange(visitIndexChange, true, true, 2)}</span></div>
                             <div class="snippet"><span class="snippet-label">Latest Visit YoY (${latestMonth})</span><span class="snippet-value ${getChangeClass(latestVisitYoY)}">${formatChange(latestVisitYoY, true, true, 2)}</span></div>
                         </div>
                         <div class="blurred-section" data-scroll-target="custom-html-card">
                             <div class="blurred-section-content">
                               <div class="chart-pair">
                                  <div id="visitsYoYChartContainer" class="chart-container"></div>
                                  <div id="visitsIndexChartContainer" class="chart-container"></div>
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
}

function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function escapeAttr(value) {
    return String(value ?? '').replace(/"/g, '&quot;');
}

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

function calculateScoreTimeSeries(brandData, scoreType = 'growth') {
    const timeSeriesLength = Math.max(
        brandData.visits_yoy_array?.length || 0,
        brandData.spend_yoy_array?.length || 0,
        brandData.txns_yoy_array?.length || 0,
        brandData.visits_index_array?.length || 0,
        brandData.spend_index_array?.length || 0,
        brandData.txns_index_array?.length || 0
    );
    if (timeSeriesLength === 0) return { scores: [], changes: [] };
    const scores = [];
    const changes = [];

    let growthTS = null;
    let heatTS = null;
    if (scoreType === 'total') {
        growthTS = calculateScoreTimeSeries(brandData, 'growth');
        heatTS = calculateScoreTimeSeries(brandData, 'heat');
    }

    for (let i = 0; i < timeSeriesLength; i++) {
        let currentScore = null;
        try {
            if (scoreType === 'growth') {
                const visitYoY = parseFloat(brandData.visits_yoy_array?.[i] ?? NaN);
                const spendYoY = parseFloat(brandData.spend_yoy_array?.[i] ?? NaN);
                const txnsYoY = parseFloat(brandData.txns_yoy_array?.[i] ?? NaN);
                if (!isNaN(visitYoY) && !isNaN(spendYoY) && !isNaN(txnsYoY)) {
                    const normVisit = normalizeScore(visitYoY, -20, 20);
                    const normSpend = normalizeScore(spendYoY, -20, 20);
                    const normTxns = normalizeScore(txnsYoY, -20, 20);
                    if (normVisit !== null && normSpend !== null && normTxns !== null) {
                        currentScore = Math.max(0, Math.min(100, Math.round((normVisit * 0.4) + (normSpend * 0.4) + (normTxns * 0.2))));
                    }
                }
            } else if (scoreType === 'heat' && i > 0) {
                const visitIndexCurr = parseFloat(brandData.visits_index_array?.[i] ?? NaN);
                const visitIndexPrev = parseFloat(brandData.visits_index_array?.[i - 1] ?? NaN);
                const spendIndexCurr = parseFloat(brandData.spend_index_array?.[i] ?? NaN);
                const spendIndexPrev = parseFloat(brandData.spend_index_array?.[i - 1] ?? NaN);
                const txnsIndexCurr = parseFloat(brandData.txns_index_array?.[i] ?? NaN);
                const txnsIndexPrev = parseFloat(brandData.txns_index_array?.[i - 1] ?? NaN);
                const visitChange = (visitIndexCurr - visitIndexPrev) || 0;
                const spendChange = (spendIndexCurr - spendIndexPrev) || 0;
                const txnsChange = (txnsIndexCurr - txnsIndexPrev) || 0;
                currentScore = Math.max(0, Math.min(100, Math.round(normalizeScore(visitChange, -10, 10) * 0.4 + normalizeScore(spendChange, -10, 10) * 0.4 + normalizeScore(txnsChange, -10, 10) * 0.2)));
            } else if (scoreType === 'total') {
                const growthScore = growthTS.scores[i] ?? null;
                const heatScore = heatTS.scores[i] ?? null;
                if (growthScore !== null && heatScore !== null) {
                    currentScore = Math.round((growthScore * 0.6) + (heatScore * 0.4));
                }
            }
        } catch (error) {
            console.error('Score calc error:', error);
        }

        scores.push(currentScore);
        if (scores.length > 1) {
            const prevScore = scores[scores.length - 2];
            if (prevScore !== null && currentScore !== null) {
                changes.push(currentScore - prevScore);
            } else {
                changes.push(null);
            }
        } else {
            changes.push(null);
        }
    }

    return { scores, changes };
}

function formatChange(change, isPercentage = true, showPlus = true, precision = 0) {
    if (change === null || isNaN(change)) return '--';
    const symbol = change > 0 ? (showPlus ? '+' : '') : (change < 0 ? '−' : '');
    const suffix = isPercentage ? '%' : '';
    const pointsSuffix = !isPercentage ? ' MoM' : '';
    return `${symbol}${Math.abs(change).toFixed(precision)}${suffix}${pointsSuffix}`;
}

function getChangeClass(change) {
    if (change === null || isNaN(change) || change === 0) return 'neutral';
    return change > 0 ? 'positive' : 'negative';
}

function getScoreColor(score) {
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
    if (index >= baseLength || index < 0 || baseLength === 0) return 'N/A';
    const currentMonth = new Date().getMonth();
    let monthIndex = (currentMonth - (baseLength - 1 - index)) % 12;
    if (monthIndex < 0) { monthIndex += 12; }
    const currentYear = new Date().getFullYear();
    const yearOffset = Math.floor((currentMonth - (baseLength - 1 - index)) / 12);
    const year = currentYear + yearOffset;
    return `${MONTH_NAMES[monthIndex]} '${String(year).slice(-2)}`;
}
