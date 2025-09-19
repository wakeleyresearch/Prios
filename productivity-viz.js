// Productivity Parallel Coordinates Visualization
// Implements S = w_e*E + w_d*D + w_q*Q + w_g*G with dynamic optimization

let myChart = null;
// Raw lines: each is [Sun..Sat, Value]
let productivityData = [];
// Metadata aligned with productivityData indices (title, category, priority)
let taskMeta = [];
// The data currently rendered (respects filters/optimizer)
let currentChartData = [];
let currentMeta = [];
let currentAnomalyIndices = [];
let currentWeights = { effort: 0.25, duration: 0.25, quality: 0.25, goal: 0.25 };
let anomalyIndices = [];
let productivityStates = [];

function createMetaFromDetail(detail = {}, idx = 0) {
    return {
        title: detail.title || `Task ${idx + 1}`,
        category: detail.category || 'personal',
        priority: detail.priority || 'medium',
        weekIndex: detail.weekIndex ?? null,
        date: detail.date || detail.scheduledDate || null,
        time: detail.time || null,
        endTime: detail.endTime || null,
        timeOfDay: detail.timeOfDay || null,
        description: detail.description || '',
        duration: detail.duration,
        completed: detail.completed ?? false,
        goalId: detail.goalId ?? null,
        energyLevel: detail.energyLevel || 'medium',
        focusMode: detail.focusMode || 'balanced',
        location: detail.location || null,
        collaborators: Array.isArray(detail.collaborators) ? detail.collaborators.slice() : [],
        contextTags: Array.isArray(detail.contextTags) ? detail.contextTags.slice() : [],
        contextSwitches: detail.contextSwitches || 0,
        flowState: detail.flowState || null,
        confidence: typeof detail.confidence === 'number' ? detail.confidence : 0.8,
        source: detail.source || 'planner',
        baseline: detail.baseline ?? 0,
        lift: detail.lift ?? 0,
        composite: detail.composite ?? null,
        metrics: detail.metrics ? { ...detail.metrics } : {}
    };
}

function normalizeLineEntry(entry, detail, idx) {
    const meta = createMetaFromDetail(detail, idx);
    let values = [];
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        values = Array.isArray(entry.value) ? entry.value.slice() : [];
    } else if (Array.isArray(entry)) {
        values = entry.slice();
    }
    while (values.length < 8) values.push(0);
    if (values.length > 8) values = values.slice(0, 8);

    const metrics = { ...(meta.metrics || {}), ...(entry?.metrics || {}) };
    if (metrics.composite === undefined) {
        metrics.composite = values[7] ?? 0;
    }
    meta.metrics = metrics;
    if (meta.composite == null) {
        meta.composite = metrics.composite;
    }
    if (entry?.lift !== undefined) {
        meta.lift = entry.lift;
    }
    if (entry?.baseline !== undefined) {
        meta.baseline = entry.baseline;
    }
    if (entry?.energyLevel) {
        meta.energyLevel = entry.energyLevel;
    }
    if (entry?.focusMode) {
        meta.focusMode = entry.focusMode;
    }
    if (entry?.timeOfDay) {
        meta.timeOfDay = entry.timeOfDay;
    }
    if (entry?.location) {
        meta.location = entry.location;
    }
    if (Array.isArray(entry?.collaborators)) {
        meta.collaborators = entry.collaborators.slice();
    }
    if (Array.isArray(entry?.contextTags)) {
        meta.contextTags = entry.contextTags.slice();
    }
    if (typeof entry?.confidence === 'number') {
        meta.confidence = entry.confidence;
    }
    if (entry?.flowState) {
        meta.flowState = entry.flowState;
    }

    const intensity = Number.isFinite(entry?.intensity) ? Number(entry.intensity) : (values[7] ?? metrics.composite ?? 0);
    const firstSeven = values.slice(0, 7);
    const maxVal = firstSeven.length ? Math.max(...firstSeven) : 0;
    const highlightDay = entry?.highlightDay ?? (maxVal === -Infinity ? 0 : firstSeven.indexOf(maxVal));

    const lineStyle = entry?.lineStyle ? { ...entry.lineStyle } : {};
    if (!Number.isFinite(lineStyle.opacity)) {
        lineStyle.opacity = 0.75;
    }

    const emphasis = entry?.emphasis ? { ...entry.emphasis } : undefined;

    return {
        value: values,
        meta,
        metrics,
        intensity,
        lineStyle,
        emphasis,
        energyLevel: meta.energyLevel,
        focusMode: meta.focusMode,
        timeOfDay: meta.timeOfDay,
        confidence: meta.confidence,
        location: meta.location,
        collaborators: meta.collaborators,
        contextTags: meta.contextTags,
        flowState: meta.flowState,
        lift: entry?.lift ?? meta.lift ?? 0,
        peak: entry?.peak ?? maxVal,
        highlightDay,
        metaIndex: typeof entry?.metaIndex === 'number' ? entry.metaIndex : idx
    };
}

// Initialize chart on page load
document.addEventListener('DOMContentLoaded', async function() {
    myChart = echarts.init(document.getElementById('main'));
    // Try Integration first, then fallback to mock
    try {
        await loadFromIntegration();
    } catch (e) {
        console.warn('Falling back to mock data:', e);
        generateProductivityData();
    }
    bindControls();
    updateVisualization();
});

// Keep in sync with integration updates across tabs/pages
window.addEventListener('storage', (e) => {
    if (e.key === 'productivityVisualizationData') {
        loadFromIntegration().then(updateVisualization).catch(err=>console.warn('Reload failed', err));
    }
});

function bindControls(){
    const pf = document.getElementById('priorityFilter');
    if(pf){ pf.addEventListener('change', updateVisualization); }
    const om = document.getElementById('optimizer');
    if(om){ om.addEventListener('change', updateVisualization); }
    const am = document.getElementById('anomalyMethod');
    if(am){ am.addEventListener('change', updateVisualization); }
}

async function loadFromIntegration(){
    // Use localStorage prepared by integration.js (compat: accept legacy key)
    let saved = localStorage.getItem('productivityVisualizationData');
    if (!saved) saved = localStorage.getItem('productivityData');
    if (!saved) throw new Error('No integration data found');
    const parsed = JSON.parse(saved);
    const lines = parsed.data || [];
    const details = parsed.taskDetails || [];
    const normalized = lines.map((line, idx) => {
        const detail = details[idx] || (typeof line?.metaIndex === 'number' ? details[line.metaIndex] : null);
        const entry = normalizeLineEntry(line, detail || {}, idx);
        return entry;
    });
    productivityData = normalized;
    taskMeta = normalized.map(entry => entry.meta);
}

// Generate realistic productivity data with patterns
function generateProductivityData() {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const numTasks = 100;

    const generated = [];
    const metaList = [];
    anomalyIndices = [];

    for (let i = 0; i < numTasks; i++) {
        let taskData = [];
        let baseProductivity = Math.random() * 40 + 30; // Base between 30-70
        let taskValue = Math.random(); // 0-1, determines color
        
        // Create realistic patterns
        for (let day = 0; day < 7; day++) {
            let dayScore = baseProductivity;
            
            // Monday-Tuesday boost
            if (day === 1 || day === 2) {
                dayScore += Math.random() * 20;
            }
            
            // Mid-week maintenance
            if (day === 3) {
                dayScore += Math.random() * 10;
            }
            
            // Thursday productivity dip
            if (day === 4) {
                dayScore -= Math.random() * 15;
            }
            
            // Friday recovery
            if (day === 5) {
                dayScore += Math.random() * 5;
            }
            
            // Weekend variability
            if (day === 0 || day === 6) {
                dayScore += (Math.random() - 0.5) * 30;
            }
            
            // Add noise and ensure bounds
            dayScore += (Math.random() - 0.5) * 10;
            dayScore = Math.max(0, Math.min(100, dayScore));
            
            taskData.push(dayScore);
        }
        
        // Add task value for color mapping
        taskData.push(taskValue * 100); // Scale to 0-100
        
        const avgScore = taskData.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
        const priorities = ['high','medium','low'];
        const categories = ['work','learning','fitness','personal','wellness'];
        const detail = {
            title: `Task #${i+1}`,
            category: categories[Math.floor(Math.random()*categories.length)],
            priority: priorities[Math.floor(Math.random()*priorities.length)],
            metrics: {
                effort: baseProductivity + Math.random() * 10,
                duration: baseProductivity + Math.random() * 8,
                quality: baseProductivity + Math.random() * 12,
                goal: baseProductivity + Math.random() * 6,
                composite: avgScore
            }
        };
        const entry = normalizeLineEntry({
            value: taskData,
            intensity: taskData[7],
            lineStyle: {
                width: Number((1.2 + (taskData[7] / 40)).toFixed(2)),
                shadowBlur: taskData[7] > 70 ? 6 : 0,
                shadowColor: taskData[7] > 70 ? 'rgba(255,255,255,0.2)' : 'transparent'
            },
            lift: Math.max(0, taskData[7] - baseProductivity)
        }, detail, i);
        generated.push(entry);
        metaList.push(entry.meta);
    }

    // Add some outliers for anomaly detection
    for (let i = 0; i < 5; i++) {
        const anomalyValues = [];
        for (let day = 0; day < 7; day++) {
            anomalyValues.push(Math.random() * 100);
        }
        anomalyValues.push(Math.random() * 100);
        const detail = {
            title: `Anomaly ${i + 1}`,
            category: 'work',
            priority: 'high'
        };
        const entry = normalizeLineEntry({
            value: anomalyValues,
            intensity: anomalyValues[7],
            lineStyle: { width: 2.8, opacity: 0.9 },
            lift: Math.random() * 30
        }, detail, numTasks + i);
        generated.push(entry);
        metaList.push(entry.meta);
        anomalyIndices.push(numTasks + i);
    }

    productivityData = generated;
    taskMeta = metaList;
}

// Calculate composite score using the mathematical framework
function calculateCompositeScore(effort, duration, quality, goal) {
    const w = currentWeights;
    return w.effort * effort + w.duration * duration + w.quality * quality + w.goal * goal;
}

// Sigmoid normalization from the framework
function sigmoidNormalize(x, k = 0.5, x0 = 50) {
    return 100 / (1 + Math.exp(-k * (x - x0)));
}

// EWMA calculation for trend detection
function calculateEWMA(data, alpha = 0.2) {
    let ewma = [data[0]];
    for (let i = 1; i < data.length; i++) {
        ewma.push(alpha * data[i] + (1 - alpha) * ewma[i - 1]);
    }
    return ewma;
}

// Main visualization update function
function updateVisualization() {
    const opacityControl = document.getElementById('opacity');
    const opacity = opacityControl ? opacityControl.value / 100 : 0.4;
    const priorityFilter = document.getElementById('priorityFilter')?.value || 'all';
    const optimizer = document.getElementById('optimizer')?.value || 'adam';
    const anomalyMethod = document.getElementById('anomalyMethod')?.value || 'cusum';

    const parallelAxis = [
        { dim: 0, name: 'Sun', nameLocation: 'end', min: 0, max: 100 },
        { dim: 1, name: 'Mon', nameLocation: 'end', min: 0, max: 100 },
        { dim: 2, name: 'Tue', nameLocation: 'end', min: 0, max: 100 },
        { dim: 3, name: 'Wed', nameLocation: 'end', min: 0, max: 100 },
        { dim: 4, name: 'Thu', nameLocation: 'end', min: 0, max: 100 },
        { dim: 5, name: 'Fri', nameLocation: 'end', min: 0, max: 100 },
        { dim: 6, name: 'Sat', nameLocation: 'end', min: 0, max: 100 }
    ];

    let filteredData = productivityData;
    if (priorityFilter !== 'all') {
        filteredData = productivityData.filter(entry => (entry.meta?.priority || 'medium') === priorityFilter);
    }

    const optimizedData = applyOptimizer(filteredData, optimizer);
    const anomalies = computeAnomalies(optimizedData, anomalyMethod);
    const anomalyLines = anomalies.map(idx => {
        const entry = optimizedData[idx];
        if (!entry) return null;
        return {
            value: entry.value,
            lineStyle: {
                width: (entry.lineStyle?.width || 2.4) + 1.2,
                opacity: 0.96,
                color: '#f87171'
            }
        };
    }).filter(Boolean);

    currentChartData = optimizedData;
    currentMeta = optimizedData.map((entry, idx) => entry.meta || createMetaFromDetail({}, idx));
    currentAnomalyIndices = anomalies;

    const seriesData = optimizedData.map(entry => {
        const baseLineStyle = { ...(entry.lineStyle || {}) };
        const baseOpacity = Number.isFinite(baseLineStyle.opacity) ? baseLineStyle.opacity : 0.78;
        const confidence = typeof entry.confidence === 'number' ? entry.confidence : (entry.meta?.confidence ?? 0.8);
        baseLineStyle.opacity = Math.min(1, Math.max(0.05, baseOpacity * opacity * (0.6 + 0.4 * confidence)));
        if (entry.intensity >= 85) {
            baseLineStyle.shadowBlur = Math.max(baseLineStyle.shadowBlur || 0, 12);
            baseLineStyle.shadowColor = 'rgba(250,204,21,0.45)';
        } else if (entry.intensity >= 65) {
            baseLineStyle.shadowBlur = Math.max(baseLineStyle.shadowBlur || 0, 6);
            baseLineStyle.shadowColor = 'rgba(56,189,248,0.35)';
        }
        return {
            value: entry.value,
            lineStyle: baseLineStyle,
            emphasis: entry.emphasis || {
                lineStyle: {
                    width: (baseLineStyle.width || 2.6) + 1.4,
                    opacity: 1
                }
            }
        };
    });

    const peakPoints = optimizedData.filter(entry => (entry.intensity ?? 0) >= 85 || (entry.lift ?? 0) >= 25).map(entry => ({
        value: entry.value,
        symbolSize: 8 + Math.min(8, Math.max(0, (entry.intensity - 70) / 4)),
        itemStyle: {
            color: '#facc15',
            borderColor: '#fde68a',
            borderWidth: 2,
            shadowBlur: 14,
            shadowColor: 'rgba(250,204,21,0.5)'
        }
    }));

    const option = {
        backgroundColor: '#1f2933',
        title: {
            text: 'Productivity Intensity Streams',
            subtext: 'Task-level bursts mapped across the weekly rhythm',
            left: 'center',
            top: 20,
            textStyle: {
                color: '#e2e8f0',
                fontSize: 20,
                fontWeight: '600'
            },
            subtextStyle: {
                color: 'rgba(226,232,240,0.65)',
                fontSize: 12
            }
        },
        legend: {
            top: 60,
            left: 'center',
            textStyle: { color: '#e2e8f0' },
            data: ['Productivity streams', 'Anomalies', 'Peak bursts']
        },
        tooltip: {
            padding: 14,
            backgroundColor: 'rgba(17,24,39,0.92)',
            borderColor: 'rgba(148,163,184,0.4)',
            borderWidth: 1,
            extraCssText: 'backdrop-filter: blur(6px);',
            formatter: function(params) {
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const entry = optimizedData[params.dataIndex] || {};
                const meta = currentMeta[params.dataIndex] || entry.meta || createMetaFromDetail({}, params.dataIndex);
                const values = Array.isArray(params.value) ? params.value : entry.value || [];
                const metrics = entry.metrics || meta.metrics || {};
                const firstSeven = values.slice(0, 7);
                const peakValue = firstSeven.length ? Math.max(...firstSeven) : 0;
                const highlightDay = entry.highlightDay ?? (firstSeven.indexOf(peakValue));
                const intensity = entry.intensity ?? values[7] ?? metrics.composite ?? 0;
                const lift = entry.lift ?? meta.lift ?? Math.max(0, intensity - (meta.baseline || 0));
                const avgScore = firstSeven.length ? firstSeven.reduce((a, b) => a + b, 0) / firstSeven.length : 0;
                const priorityColors = { high: '#f87171', medium: '#fbbf24', low: '#34d399' };
                const categoryIcons = { work: '[work]', learning: '[learn]', fitness: '[fit]', personal: '[home]', wellness: '[calm]' };
                const burstLabel = intensity >= 85 ? '[breakthrough]' : intensity >= 65 ? '[momentum]' : intensity >= 45 ? '[groove]' : '[ambient]';

                let tooltip = `<div style="font-size:14px; margin-bottom:6px;"><strong style="color:#a5b4fc;">TASK ${meta.title}</strong></div>`;
                tooltip += `<div style="font-size:12px; opacity:0.8;">${categoryIcons[meta.category] || '[cat]'} ${meta.category || 'uncategorized'} | <span style="color:${priorityColors[meta.priority] || '#fbbf24'}; text-transform:uppercase;">${meta.priority || 'medium'}</span>${meta.date ? ` | ${meta.date}` : ''}</div>`;
                tooltip += `<div style="font-size:12px; margin-top:6px;"><strong>Peak day:</strong> ${days[Math.max(0, highlightDay)]} (${(firstSeven[Math.max(0, highlightDay)] || 0).toFixed(1)})</div>`;
                tooltip += `<div style="font-size:12px;"><strong>Composite intensity:</strong> ${intensity.toFixed(1)} ${burstLabel}</div>`;
                if (meta.energyLevel) {
                    tooltip += `<div style="font-size:12px;"><strong>Energy:</strong> ${meta.energyLevel}</div>`;
                }
                if (meta.focusMode) {
                    tooltip += `<div style="font-size:12px;"><strong>Focus:</strong> ${meta.focusMode}</div>`;
                }
                if (meta.location) {
                    tooltip += `<div style="font-size:12px;"><strong>Location:</strong> ${meta.location}</div>`;
                }
                if (Array.isArray(meta.collaborators) && meta.collaborators.length) {
                    tooltip += `<div style="font-size:12px;"><strong>With:</strong> ${meta.collaborators.join(', ')}</div>`;
                }
                if (Array.isArray(meta.contextTags) && meta.contextTags.length) {
                    tooltip += `<div style="font-size:12px;"><strong>Context:</strong> ${meta.contextTags.join(', ')}</div>`;
                }
                tooltip += `<div style="font-size:12px;"><strong>Weekly average:</strong> ${avgScore.toFixed(1)}</div>`;
                tooltip += '<hr style="border:none; border-top:1px solid rgba(148,163,184,0.2); margin:8px 0;" />';
                tooltip += '<div style="font-size:12px; margin-bottom:4px;"><strong>Daily profile</strong></div>';
                tooltip += firstSeven.map((score, idx) => {
                    const color = score >= 75 ? '#facc15' : score >= 55 ? '#38bdf8' : '#94a3b8';
                    return `<div style="display:flex; align-items:center; gap:6px; font-size:11px;">
                        <span style="width:28px; opacity:0.7;">${days[idx]}</span>
                        <span style="flex:1; height:6px; background:rgba(148,163,184,0.25); border-radius:4px; overflow:hidden;">
                            <span style="display:block; height:100%; width:${Math.min(100, score)}%; background:${color};"></span>
                        </span>
                        <span style="width:34px; text-align:right;">${score.toFixed(0)}</span>
                    </div>`;
                }).join('');
                tooltip += '<div style="font-size:12px; margin:8px 0 4px;"><strong>Component mix</strong></div>';
                tooltip += `<div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:4px; font-size:11px;">
                    <span>Effort: ${Math.round(metrics.effort ?? intensity)}</span>
                    <span>Duration: ${Math.round(metrics.duration ?? intensity)}</span>
                    <span>Quality: ${Math.round(metrics.quality ?? intensity)}</span>
                    <span>Goal: ${Math.round(metrics.goal ?? intensity)}</span>
                </div>`;
                return tooltip;
            }
        },
        visualMap: {
            show: true,
            type: 'continuous',
            min: 0,
            max: 100,
            dimension: 7,
            inRange: {
                color: [
                    '#312e81',
                    '#1d4ed8',
                    '#0ea5e9',
                    '#14b8a6',
                    '#22c55e',
                    '#84cc16',
                    '#facc15',
                    '#f97316',
                    '#ef4444'
                ]
            },
            calculable: true,
            realtime: false,
            left: 20,
            top: 150,
            textStyle: {
                color: '#e2e8f0'
            },
            formatter: function(value) {
                if (value >= 85) return 'Breakthrough burst';
                if (value >= 65) return 'High momentum';
                if (value >= 40) return 'Productive groove';
                return 'Ambient work';
            }
        },
        parallelAxis,
        parallel: {
            left: 160,
            right: 110,
            top: 120,
            bottom: 90,
            parallelAxisDefault: {
                type: 'value',
                nameLocation: 'end',
                nameGap: 20,
                nameTextStyle: {
                    color: '#cbd5f5',
                    fontSize: 13,
                    fontWeight: 'bold'
                },
                axisLine: {
                    lineStyle: {
                        color: 'rgba(148,163,184,0.45)',
                        width: 1.8
                    }
                },
                axisTick: {
                    lineStyle: {
                        color: 'rgba(148,163,184,0.25)'
                    }
                },
                splitLine: {
                    show: true,
                    lineStyle: {
                        color: 'rgba(148,163,184,0.12)'
                    }
                },
                axisLabel: {
                    color: 'rgba(226,232,240,0.7)',
                    fontSize: 10,
                    formatter: value => value.toFixed(0)
                }
            }
        },
        series: [
            {
                name: 'Productivity streams',
                type: 'parallel',
                smooth: true,
                data: seriesData
            },
            {
                name: 'Anomalies',
                type: 'parallel',
                silent: false,
                lineStyle: { width: 3.2, opacity: 0.92, color: '#f87171' },
                data: anomalyLines
            },
            {
                name: 'Peak bursts',
                type: 'effectScatter',
                coordinateSystem: 'parallel',
                symbolSize: 10,
                rippleEffect: { brushType: 'stroke', scale: 2.5 },
                itemStyle: { color: '#facc15', opacity: 0.95 },
                data: peakPoints
            }
        ]
    };

    option.graphic = [
        {
            type: 'text',
            left: 'center',
            top: 95,
            style: {
                text: '<- Earlier in week      |      Later ->',
                fill: 'rgba(226,232,240,0.65)',
                fontSize: 13,
                fontStyle: 'italic'
            }
        },
        {
            type: 'text',
            left: 'center',
            bottom: 60,
            style: {
                text: 'Productivity score (0 - 100)',
                fill: 'rgba(226,232,240,0.65)',
                fontSize: 13,
                fontStyle: 'italic'
            }
        }
    ];

    myChart.setOption(option);
    updateStatistics();
    renderAnomalyInsights(anomalyMethod);
}

// Calculate and display statistics
function updateStatistics() {
    const dataset = (currentChartData && currentChartData.length) ? currentChartData : productivityData;
    if (!dataset || !dataset.length) {
        document.getElementById('cronbach').innerHTML = '--';
        document.getElementById('meanScore').innerHTML = '--';
        document.getElementById('stdDev').innerHTML = '--';
        document.getElementById('trend').innerHTML = '--';
        document.getElementById('anomalies').innerHTML = currentAnomalyIndices.length || 0;
        document.getElementById('state').innerHTML = 'No data';
        return;
    }

    const dayMeans = [];
    for (let day = 0; day < 7; day++) {
        const dayScores = dataset.map(entry => (entry.value?.[day] ?? 0));
        const mean = dayScores.reduce((a, b) => a + b, 0) / (dayScores.length || 1);
        dayMeans.push(mean);
    }

    const allScores = dataset.flatMap(entry => entry.value.slice(0, 7));
    const mean = allScores.reduce((a, b) => a + b, 0) / (allScores.length || 1);
    const variance = allScores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (allScores.length || 1);
    const stdDev = Math.sqrt(variance);

    const cronbachAlpha = calculateCronbachAlpha(dataset);

    const ewma = calculateEWMA(dayMeans);
    const trendDirection = ewma[6] > ewma[0] ? 'Upward UP' : ewma[6] < ewma[0] ? 'Downward DOWN' : 'Stable ->';
    const trendColor = ewma[6] > ewma[0] ? '#6bcf7f' : ewma[6] < ewma[0] ? '#ff6b6b' : '#facc15';

    const currentScore = dayMeans[dayMeans.length - 1];
    let state = 'Regular';
    let stateClass = 'medium';
    if (currentScore > mean + stdDev) {
        state = 'Peak Performance';
        stateClass = 'high';
    } else if (currentScore < mean - stdDev) {
        state = 'Low Performance';
        stateClass = 'low';
    }

    document.getElementById('cronbach').innerHTML = cronbachAlpha.toFixed(3);
    document.getElementById('meanScore').innerHTML = mean.toFixed(1);
    document.getElementById('stdDev').innerHTML = stdDev.toFixed(1);
    document.getElementById('trend').innerHTML = `<span style="color: ${trendColor}">${trendDirection}</span>`;
    const anomalyCount = currentAnomalyIndices.length;
    document.getElementById('anomalies').innerHTML = anomalyCount;
    document.getElementById('state').innerHTML = `${state} <span class="performance-indicator ${stateClass}"></span>`;
}

// Simplified Cronbach's alpha calculation for the provided dataset
function calculateCronbachAlpha(dataset) {
    const data = (dataset && dataset.length) ? dataset : productivityData;
    const k = 7;
    if (!data || !data.length) return 0;
    const itemVariances = [];
    for (let day = 0; day < k; day++) {
        const dayScores = data.map(entry => entry.value?.[day] ?? 0);
        const variance = calculateVariance(dayScores);
        itemVariances.push(variance);
    }
    const totalScores = data.map(entry => entry.value.slice(0, 7).reduce((a, b) => a + b, 0));
    const totalVariance = calculateVariance(totalScores);
    const sumItemVariances = itemVariances.reduce((a, b) => a + b, 0);
    const alpha = (k / (k - 1)) * (1 - sumItemVariances / (totalVariance || 1));
    return Math.max(0, Math.min(1, alpha));
}

// Helper function to calculate variance
function calculateVariance(data) {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    return data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
}

// Pattern detection using simplified HMM approach
function detectPatterns() {
    const dataset = (currentChartData && currentChartData.length) ? currentChartData : productivityData;
    const states = ['Low', 'Medium', 'High'];
    const stateThresholds = [33, 66];
    const transitions = {};
    for (const from of states){ transitions[from] = {Low:0, Medium:0, High:0}; }
    dataset.forEach(task => {
        const values = task.value || task;
        for (let day = 0; day < 6; day++) {
            const fromState = getState(values[day], stateThresholds);
            const toState = getState(values[day + 1], stateThresholds);
            transitions[fromState][toState]++;
        }
    });
    const probs = {};
    for (const from of states){
        const total = Object.values(transitions[from]).reduce((a,b)=>a+b,0) || 1;
        probs[from] = {
            Low: transitions[from].Low/total,
            Medium: transitions[from].Medium/total,
            High: transitions[from].High/total
        };
    }
    const bullets = [];
    bullets.push(`<b>State transition probabilities</b>`);
    for (const from of states){
        for (const to of states){
            const p = probs[from][to];
            if (p > 0.1) bullets.push(`${from} -> ${to}: ${(p*100).toFixed(1)}%`);
        }
    }
    if (probs.High.High > 0.5) bullets.push('Strong persistence in <b>High</b> state');
    if (probs.Low.Medium > probs.Low.Low) bullets.push('Recovery tendency from <b>Low</b> to <b>Medium</b>');
    if (probs.Medium.High > 0.3) bullets.push('Frequent progression from <b>Medium</b> to <b>High</b>');
    renderInsights(`<ul>${bullets.map(b=>`<li>${b}</li>`).join('')}</ul>`);
}

// Helper function to determine state
function getState(value, thresholds) {
    if (value < thresholds[0]) return 'Low';
    if (value < thresholds[1]) return 'Medium';
    return 'High';
}

// Dynamic weight optimization (simplified Adam optimizer)
function optimizeWeights() {
    const learningRate = 0.001;
    const beta1 = 0.9;
    const beta2 = 0.999;
    const epsilon = 1e-8;
    
    // This would normally use gradient descent on actual performance data
    // For demo, we'll simulate optimization
    const gradients = {
        effort: Math.random() - 0.5,
        duration: Math.random() - 0.5,
        quality: Math.random() - 0.5,
        goal: Math.random() - 0.5
    };
    
    // Update weights
    for (let key in currentWeights) {
        currentWeights[key] += learningRate * gradients[key];
    }
    
    // Normalize to ensure sum = 1
    const sum = Object.values(currentWeights).reduce((a, b) => a + b, 0);
    for (let key in currentWeights) {
        currentWeights[key] /= sum;
    }
    
    console.log('Updated weights:', currentWeights);
}

// Window resize handler
window.addEventListener('resize', function() {
    if (myChart) {
        myChart.resize();
    }
});

// ------- Optimizer/value computation -------
function applyOptimizer(data, method){
    return data.map((item, idx) => {
        const entry = Array.isArray(item)
            ? normalizeLineEntry({ value: item }, {}, idx)
            : {
                ...item,
                value: item.value ? item.value.slice() : []
            };

        const vals = entry.value.slice(0, 7);
        const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        const variance = vals.length ? vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length : 0;
        const std = Math.sqrt(variance);
        let value;
        if (method === 'adam') {
            value = mean;
        } else if (method === 'pso') {
            value = 0.7 * mean + 0.3 * (std * 2);
        } else {
            const prior = 60;
            const tau2 = 400;
            const sigma2 = variance || 1;
            const w = tau2 / (tau2 + sigma2);
            value = w * mean + (1 - w) * prior;
        }

        const clamped = Math.max(0, Math.min(100, value));
        const nextValues = entry.value.slice(0, 7);
        nextValues.push(clamped);

        const updatedLineStyle = { ...(entry.lineStyle || {}) };
        if (!Number.isFinite(updatedLineStyle.width)) {
            updatedLineStyle.width = Number((1.6 + clamped / 40).toFixed(2));
        }
        if (!Number.isFinite(updatedLineStyle.opacity)) {
            const confidence = typeof entry.confidence === 'number' ? entry.confidence : (entry.meta?.confidence ?? 0.8);
            updatedLineStyle.opacity = 0.55 + 0.45 * confidence;
        } else {
            const confidence = typeof entry.confidence === 'number' ? entry.confidence : (entry.meta?.confidence ?? 0.8);
            updatedLineStyle.opacity = Math.min(1, Math.max(0.05, updatedLineStyle.opacity * (0.6 + 0.4 * confidence)));
        }
        if (clamped >= 85) {
            updatedLineStyle.shadowBlur = Math.max(updatedLineStyle.shadowBlur || 0, 12);
            updatedLineStyle.shadowColor = 'rgba(250,204,21,0.45)';
        } else if (clamped >= 65) {
            updatedLineStyle.shadowBlur = Math.max(updatedLineStyle.shadowBlur || 0, 6);
            updatedLineStyle.shadowColor = 'rgba(56,189,248,0.35)';
        }

        const highlightDay = entry.highlightDay ?? (() => {
            const firstSeven = entry.value.slice(0, 7);
            const maxVal = firstSeven.length ? Math.max(...firstSeven) : 0;
            return firstSeven.indexOf(maxVal);
        })();

        const baseline = entry.meta?.baseline ?? 0;
        const lift = entry.lift ?? Math.max(0, clamped - baseline);
        const metrics = { ...(entry.metrics || {}), composite: clamped };
        const baseMeta = entry.meta ? { ...entry.meta } : createMetaFromDetail({}, idx);
        const meta = {
            ...baseMeta,
            metrics: { ...(baseMeta.metrics || {}), ...metrics },
            composite: clamped,
            lift
        };

        return {
            value: nextValues,
            meta,
            metrics,
            intensity: clamped,
            lineStyle: updatedLineStyle,
            emphasis: entry.emphasis,
            energyLevel: meta.energyLevel,
            focusMode: meta.focusMode,
            timeOfDay: meta.timeOfDay,
            confidence: meta.confidence,
            location: meta.location,
            collaborators: meta.collaborators,
            contextTags: meta.contextTags,
            flowState: meta.flowState,
            lift,
            peak: Math.max(...nextValues.slice(0, 7)),
            highlightDay,
            metaIndex: entry.metaIndex
        };
    });
}

// ------- Anomaly detection -------
function computeAnomalies(dataset, method){
    const anomalies = new Set();
    const values = dataset.map(item => Array.isArray(item) ? item : (item.value || []));
    if(method==='cusum'){
        const flat = values.flatMap(line => line.slice(0,7));
        const [idxs] = cusumEwmaAnomalies(flat);
        idxs.forEach(i=> anomalies.add(Math.floor(i/7)));
    } else if(method==='isolation'){
        const means = values.map(line => {
            const slice = line.slice(0,7);
            return slice.length ? slice.reduce((a,b)=>a+b,0)/slice.length : 0;
        });
        const sorted = [...means].sort((a,b)=>a-b);
        const q1 = sorted[Math.floor(sorted.length*0.25)] || 0;
        const q3 = sorted[Math.floor(sorted.length*0.75)] || 0;
        const iqr = q3-q1 || 1;
        means.forEach((m,idx)=>{ if(m<q1-1.5*iqr || m>q3+1.5*iqr) anomalies.add(idx); });
    } else { // ensemble
        const a = new Set(computeAnomalies(dataset,'cusum'));
        const b = new Set(computeAnomalies(dataset,'isolation'));
        a.forEach(i=>{ if(b.has(i)) anomalies.add(i); });
    }
    return Array.from(anomalies);
}

function cusumEwmaAnomalies(series){
    const n = series.length; if(n===0) return [[], []];
    const lambda = 0.2, k = 0.5;
    const ewma = new Array(n).fill(0); ewma[0] = series[0];
    const pos = new Array(n).fill(0), neg = new Array(n).fill(0);
    const med = series.slice().sort((a,b)=>a-b)[Math.floor(n/2)];
    const mad = series.reduce((acc,v)=> acc + Math.abs(v-med),0)/n;
    let h = mad>0? 5*mad : 10;
    const idxs = [];
    for(let t=1;t<n;t++){
        ewma[t] = lambda*series[t] + (1-lambda)*ewma[t-1];
        pos[t] = Math.max(0, pos[t-1] + (ewma[t]-med - k));
        neg[t] = Math.max(0, neg[t-1] - (ewma[t]-med + k));
        if(pos[t]>h || neg[t]>h){ idxs.push(t); pos[t]=0; neg[t]=0; }
    }
    return [idxs, ewma];
}

// ------- Insights panel -------
function renderInsights(html){
    const el = document.getElementById('insightsPanel');
    if(!el) return; el.innerHTML = html;
}

function renderAnomalyInsights(method){
    const count = currentAnomalyIndices.length;
    if(!document.getElementById('insightsPanel')) return;
    const items = currentAnomalyIndices.slice(0,5).map(i=>{
        const meta = currentMeta[i] || createMetaFromDetail({}, i);
        const entry = currentChartData[i];
        const intensity = entry?.intensity ?? entry?.value?.[7] ?? 0;
        const lift = entry?.lift ?? meta.lift ?? 0;
        const liftLabel = lift ? ` <span style="color:#facc15">(+${lift.toFixed(1)} lift)</span>` : '';
        return `<li>${meta.title} -- <span style="color:#f97316">${intensity.toFixed(1)}</span>${liftLabel}</li>`;
    }).join('');
    renderInsights(`<div><b>Anomaly method:</b> ${method}</div><div><b>Detected anomalies:</b> ${count}</div>${count?`<ul>${items}</ul>`:''}`);
}
