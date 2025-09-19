// Productivity Parallel Coordinates Visualization
// Implements S = w_e·E + w_d·D + w_q·Q + w_g·G with dynamic optimization

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
    productivityData = lines;
    taskMeta = details.map((d,i)=>({
        title: d.title || `Task ${i+1}`,
        category: d.category || 'personal',
        priority: d.priority || 'medium'
    }));
}

// Generate realistic productivity data with patterns
function generateProductivityData() {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const numTasks = 100;
    
    productivityData = [];
    taskMeta = [];
    
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
        
        productivityData.push(taskData);
        // mock metadata
        const priorities = ['high','medium','low'];
        const categories = ['work','learning','fitness','personal','wellness'];
        taskMeta.push({
            title: `Task #${i+1}`,
            category: categories[Math.floor(Math.random()*categories.length)],
            priority: priorities[Math.floor(Math.random()*priorities.length)]
        });
    }
    
    // Add some outliers for anomaly detection
    for (let i = 0; i < 5; i++) {
        let anomalyTask = [];
        for (let day = 0; day < 7; day++) {
            anomalyTask.push(Math.random() * 100);
        }
        anomalyTask.push(Math.random() * 100);
        productivityData.push(anomalyTask);
        anomalyIndices.push(numTasks + i);
    }
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
    const opacity = document.getElementById('opacity').value / 100;
    const pf = document.getElementById('priorityFilter');
    const priorityFilter = pf ? pf.value : 'all';
    const optimizer = document.getElementById('optimizer')?.value || 'adam';
    const anomalyMethod = document.getElementById('anomalyMethod')?.value || 'cusum';
    
    // Prepare parallel axis configuration
    const parallelAxis = [
        {dim: 0, name: 'Sun', nameLocation: 'end', min: 0, max: 100},
        {dim: 1, name: 'Mon', nameLocation: 'end', min: 0, max: 100},
        {dim: 2, name: 'Tue', nameLocation: 'end', min: 0, max: 100},
        {dim: 3, name: 'Wed', nameLocation: 'end', min: 0, max: 100},
        {dim: 4, name: 'Thu', nameLocation: 'end', min: 0, max: 100},
        {dim: 5, name: 'Fri', nameLocation: 'end', min: 0, max: 100},
        {dim: 6, name: 'Sat', nameLocation: 'end', min: 0, max: 100}
    ];
    
    // Filter by priority if requested
    let filteredData = productivityData;
    let filteredMeta = taskMeta;
    if (priorityFilter !== 'all'){
        const outData = [];
        const outMeta = [];
        productivityData.forEach((line, idx)=>{
            const meta = taskMeta[idx] || {priority:'medium'};
            if (meta.priority === priorityFilter){
                outData.push(line);
                outMeta.push(meta);
            }
        });
        filteredData = outData;
        filteredMeta = outMeta;
    }

    // Apply optimizer to compute the value/color dimension (index 7)
    const optimizedData = applyOptimizer(filteredData, optimizer);

    // Compute anomalies per method; use simple intersection for ensemble
    const anomalies = computeAnomalies(optimizedData, anomalyMethod);
    const anomalyLines = anomalies.map(i => optimizedData[i]);

    currentChartData = optimizedData;
    currentMeta = filteredMeta;
    currentAnomalyIndices = anomalies;

    const option = {
        backgroundColor: '#333',
        title: {
            text: 'Productivity Score',
            bottom: 30,
            left: 'center',
            textStyle: {
                color: '#fff',
                fontSize: 18,
                fontWeight: 'normal',
                fontStyle: 'italic'
            }
        },
        tooltip: {
            padding: 10,
            backgroundColor: 'rgba(0,0,0,0.8)',
            borderColor: '#777',
            borderWidth: 1,
            formatter: function(params) {
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const meta = filteredMeta[params.dataIndex] || {title:'Task', category:'personal', priority:'medium'};
                let taskInfo = `<strong style="color: #667eea; font-size: 14px;">📋 ${meta.title}</strong><br/><br/>`;
                const categoryIcons = {work:'💼', learning:'📚', fitness:'💪', personal:'🏠', wellness:'🧘'};
                const categoryIcon = categoryIcons[meta.category] || '📌';
                taskInfo += `<strong>Category:</strong> ${categoryIcon} ${meta.category}<br/>`;
                const priorityColors = {high:'#ef4444', medium:'#f59e0b', low:'#10b981'};
                taskInfo += `<strong>Priority:</strong> <span style="color: ${priorityColors[meta.priority]}">${meta.priority.toUpperCase()}</span><br/><br/>`;
                
                let tooltip = taskInfo;
                tooltip += '<strong>Daily Performance:</strong><br/>';
                
                for (let i = 0; i < 7; i++) {
                    const score = params.value[i];
                    const dayName = days[i];
                    const isLow = meta.priority === 'low';
                    const color = score > 75 ? (isLow ? '#f59e0b' : '#10b981') : score > 50 ? '#f59e0b' : '#ef4444';
                    const icon = score > 75 ? (isLow ? '⚡' : '✅') : score > 50 ? '⚡' : '⚠️';
                    tooltip += `${icon} <span style="color: ${color}">${dayName}: ${score.toFixed(1)}</span><br/>`;
                }
                
                const avgScore = params.value.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
                tooltip += `<br/><strong>Weekly Average:</strong> ${avgScore.toFixed(1)}`;
                
                // Add performance indicator
                if (avgScore > 75) {
                    tooltip += meta.priority === 'low' ? ' ⚡ High output on low-priority' : ' 🌟 Excellent!';
                } else if (avgScore > 50) {
                    tooltip += ' 👍 Good';
                } else {
                    tooltip += ' 💪 Keep pushing!';
                }
                
                return tooltip;
            }
        },
        visualMap: {
            show: true,
            type: 'continuous',
            min: 0,
            max: 100,
            dimension: 7, // Use the 8th dimension (task value) for color
            inRange: {
                color: [
                    '#8B008B', // Dark Magenta (Low)
                    '#9932CC', // Dark Orchid
                    '#BA55D3', // Medium Orchid
                    '#DA70D6', // Orchid
                    '#EE82EE', // Violet
                    '#DDA0DD', // Plum
                    '#87CEEB', // Sky Blue
                    '#00CED1', // Dark Turquoise
                    '#40E0D0', // Turquoise
                    '#48D1CC', // Medium Turquoise
                    '#00FA9A', // Medium Spring Green
                    '#90EE90', // Light Green
                    '#ADFF2F', // Green Yellow
                    '#FFFF00', // Yellow
                    '#FFD700', // Gold
                    '#FFA500', // Orange
                    '#FF8C00', // Dark Orange
                    '#FF6347', // Tomato
                    '#FF4500', // Orange Red
                    '#DC143C'  // Crimson (High)
                ]
            },
            calculable: true,
            realtime: false,
            left: 20,
            top: 120,
            textStyle: {
                color: '#fff'
            },
            formatter: function(value) {
                if (value < 33) return 'Low Value Task';
                if (value < 66) return 'Regular Task';
                return 'High Value Task';
            }
        },
        parallelAxis: parallelAxis,
        parallel: {
            left: 200,
            right: 100,
            top: 100,
            bottom: 100,
            parallelAxisDefault: {
                type: 'value',
                nameLocation: 'end',
                nameGap: 20,
                nameTextStyle: {
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 'bold'
                },
                axisLine: {
                    lineStyle: {
                        color: 'rgba(255,255,255,0.3)',
                        width: 2
                    }
                },
                axisTick: {
                    lineStyle: {
                        color: 'rgba(255,255,255,0.2)'
                    }
                },
                splitLine: {
                    show: true,
                    lineStyle: {
                        color: 'rgba(255,255,255,0.05)'
                    }
                },
                axisLabel: {
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 10,
                    formatter: function(value) {
                        return value.toFixed(0);
                    }
                }
            }
        },
        series: [
            {
                name: 'Productivity',
                type: 'parallel',
                lineStyle: {
                    width: 2,
                    opacity: opacity
                },
                smooth: true,
                emphasis: {
                    lineStyle: {
                        width: 3,
                        opacity: 1
                    }
                },
                data: optimizedData
            },
            {
                name: 'Anomalies',
                type: 'parallel',
                lineStyle: { width: 2.5, opacity: 0.9, color: '#ff6b6b' },
                silent: false,
                data: anomalyLines
            }
        ]
    };
    
    // Axis title cues
    option.graphic = [
        // Horizontal time direction (left → right)
        {
            type: 'text',
            left: 'center',
            top: 60,
            style: {
                text: 'Time →',
                fill: '#fff',
                fontSize: 16,
                fontStyle: 'italic'
            }
        },
        // Bottom axis title for value scale
        {
            type: 'text',
            left: 'center',
            bottom: 60,
            style: {
                text: 'Productivity score',
                fill: '#fff',
                fontSize: 16,
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
    // Calculate mean scores per day from the currently rendered dataset
    const dataset = (currentChartData && currentChartData.length) ? currentChartData : productivityData;
    const dayMeans = [];
    for (let day = 0; day < 7; day++) {
        const dayScores = dataset.map(task => task[day]);
        const mean = dayScores.reduce((a, b) => a + b, 0) / dayScores.length;
        dayMeans.push(mean);
    }
    
    // Overall statistics
    const allScores = dataset.flatMap(task => task.slice(0, 7));
    const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    const variance = allScores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / allScores.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate Cronbach's alpha (simplified) on the same dataset being viewed
    const cronbachAlpha = calculateCronbachAlpha(dataset);
    
    // Detect trend
    const ewma = calculateEWMA(dayMeans);
    const trend = ewma[6] > ewma[0] ? 'Upward ↑' : ewma[6] < ewma[0] ? 'Downward ↓' : 'Stable →';
    const trendColor = ewma[6] > ewma[0] ? '#6bcf7f' : ewma[6] < ewma[0] ? '#ff6b6b' : '#ffd93d';
    
    // Determine current state (simplified HMM state)
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
    
    // Update display
    document.getElementById('cronbach').innerHTML = cronbachAlpha.toFixed(3);
    document.getElementById('meanScore').innerHTML = mean.toFixed(1);
    document.getElementById('stdDev').innerHTML = stdDev.toFixed(1);
    document.getElementById('trend').innerHTML = `<span style="color: ${trendColor}">${trend}</span>`;
    const anomalyCount = (currentAnomalyIndices && currentAnomalyIndices.length) ? currentAnomalyIndices.length : anomalyIndices.length;
    document.getElementById('anomalies').innerHTML = anomalyCount;
    document.getElementById('state').innerHTML = `${state} <span class="performance-indicator ${stateClass}"></span>`;
}

// Simplified Cronbach's alpha calculation for the provided dataset
function calculateCronbachAlpha(dataset) {
    const data = (dataset && dataset.length) ? dataset : productivityData;
    const k = 7; // Number of days
    if (!data || !data.length) return 0;
    const itemVariances = [];
    for (let day = 0; day < k; day++) {
        const dayScores = data.map(task => task[day]);
        const variance = calculateVariance(dayScores);
        itemVariances.push(variance);
    }
    const totalScores = data.map(task => task.slice(0, 7).reduce((a, b) => a + b, 0));
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
        for (let day = 0; day < 6; day++) {
            const fromState = getState(task[day], stateThresholds);
            const toState = getState(task[day + 1], stateThresholds);
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
            if (p > 0.1) bullets.push(`${from} → ${to}: ${(p*100).toFixed(1)}%`);
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
    return data.map(line=>{
        const vals = line.slice(0,7);
        const m = vals.reduce((a,b)=>a+b,0)/vals.length;
        const v = vals.reduce((a,b)=>a+(b-m)*(b-m),0)/vals.length;
        const s = Math.sqrt(v);
        let value;
        if(method==='adam') value = m;
        else if(method==='pso') value = 0.7*m + 0.3*(s*2);
        else { // bayesian
            const prior = 60, tau2 = 400; // simple prior
            const sigma2 = v || 1;
            const w = tau2/(tau2+sigma2);
            value = w*m + (1-w)*prior;
        }
        const out = line.slice();
        out[7] = Math.max(0, Math.min(100, value));
        return out;
    });
}

// ------- Anomaly detection -------
function computeAnomalies(dataset, method){
    const anomalies = new Set();
    if(method==='cusum'){
        const flat = dataset.flatMap(line=>line.slice(0,7));
        const [idxs] = cusumEwmaAnomalies(flat);
        idxs.forEach(i=> anomalies.add(Math.floor(i/7)));
    } else if(method==='isolation'){
        const means = dataset.map(line=> line.slice(0,7).reduce((a,b)=>a+b,0)/7);
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
        const meta = currentMeta[i] || {title:`Line ${i+1}`};
        return `<li>${meta.title}</li>`;
    }).join('');
    renderInsights(`<div><b>Anomaly method:</b> ${method}</div><div><b>Detected anomalies:</b> ${count}</div>${count?`<ul>${items}</ul>`:''}`);
}