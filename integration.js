// Integration Layer - Connects Task Planner with Productivity Visualization
// This module bridges the gap between task management and analytics

class ProductivityIntegration {
    constructor() {
        this.db = null;
        this._dbReady = this.initDatabase();
    }
    
    async initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('ProductivityDB', 1);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                // Create stores if they don't exist yet
                if (!db.objectStoreNames.contains('tasks')) {
                    const taskStore = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
                    taskStore.createIndex('date', 'date', { unique: false });
                    taskStore.createIndex('category', 'category', { unique: false });
                    taskStore.createIndex('goalId', 'goalId', { unique: false });
                }
                if (!db.objectStoreNames.contains('goals')) {
                    const goalStore = db.createObjectStore('goals', { keyPath: 'id', autoIncrement: true });
                    goalStore.createIndex('category', 'category', { unique: false });
                }
                if (!db.objectStoreNames.contains('productivity_scores')) {
                    const scoreStore = db.createObjectStore('productivity_scores', { keyPath: 'date' });
                    scoreStore.createIndex('week', 'week', { unique: false });
                }
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        });
    }
    
    // Fetch all tasks within a date range
    async getTasksInRange(startDate, endDate) {
        // Ensure DB is initialized
        if (!this.db) await this._dbReady;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const index = store.index('date');
            
            const range = IDBKeyRange.bound(startDate, endDate);
            const request = index.getAll(range);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        });
    }
    
    // Calculate productivity scores for visualization
    async calculateWeeklyProductivity() {
        if (!this.db) await this._dbReady;
        const weeks = [];

        // Get last 4 weeks of data
        for (let weekOffset = -3; weekOffset <= 0; weekOffset++) {
            const weekData = await this.getWeekData(weekOffset);
            weeks.push(weekData);
        }

        return this.formatForParallelCoords(weeks);
    }
    
    async getWeekData(weekOffset) {
        if (!this.db) await this._dbReady;
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setHours(0, 0, 0, 0);
        startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffset * 7));

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const startKey = startOfWeek.toISOString().split('T')[0];
        const endKey = endOfWeek.toISOString().split('T')[0];

        const tasks = await this.getTasksInRange(startKey, endKey);

        const enrichedTasks = tasks.map(task => {
            const base = window.PriosScoring?.sanitizeTask ? window.PriosScoring.sanitizeTask(task) : { ...task };
            base.id = task.id;
            base.date = task.date;
            const metrics = this.calculateTaskScores(base);
            const composite = this.calculateCompositeFromComponents(metrics);
            return {
                ...base,
                metrics: { ...metrics, composite },
                composite,
                confidence: typeof base.confidence === 'number' ? base.confidence : 0.8,
                dayIndex: this.getDayIndex(base.date, startOfWeek)
            };
        });

        // Group tasks by day and calculate scores
        const dayScores = [];
        for (let day = 0; day < 7; day++) {
            const currentDate = new Date(startOfWeek);
            currentDate.setDate(startOfWeek.getDate() + day);
            const dateStr = currentDate.toISOString().split('T')[0];

            const dayTasks = enrichedTasks.filter(t => t.date === dateStr);
            const score = this.calculateDayScore(dayTasks);
            dayScores.push(score);
        }

        return {
            dayScores,
            tasks: enrichedTasks,
            startDate: startOfWeek.toISOString().split('T')[0]
        };
    }
    
    calculateDayScore(tasks) {
        if (tasks.length === 0) {
            return {
                effort: 0,
                duration: 0,
                quality: 0,
                goal: 0,
                composite: 0
            };
        }
        
        let totalEffort = 0;
        let totalDuration = 0;
        let totalQuality = 0;
        let totalGoal = 0;
        
        tasks.forEach(task => {
            const scores = this.calculateTaskScores(task);
            totalEffort += scores.effort;
            totalDuration += scores.duration;
            totalQuality += scores.quality;
            totalGoal += scores.goal;
        });
        
        const count = tasks.length;
        const avgEffort = totalEffort / count;
        const avgDuration = totalDuration / count;
        const avgQuality = totalQuality / count;
        const avgGoal = totalGoal / count;

        const composite = this.calculateCompositeFromComponents({
            effort: avgEffort,
            duration: avgDuration,
            quality: avgQuality,
            goal: avgGoal
        });
        
        return {
            effort: avgEffort,
            duration: avgDuration,
            quality: avgQuality,
            goal: avgGoal,
            composite: composite
        };
    }
    
    calculateTaskScores(task) {
        const scoring = window.PriosScoring;
        if (scoring?.scoreTask) {
            const sanitized = scoring.sanitizeTask ? scoring.sanitizeTask(task) : { ...task };
            const result = scoring.scoreTask(sanitized);
            return scoring.validateComponents(result.components);
        }

        // Fallback heuristic if scoring core is unavailable
        const priorityScores = { high: 90, medium: 60, low: 30 };
        const effort = priorityScores[task.priority] || 50;
        const optimalDuration = 60;
        const durationRatio = Math.min((task.duration || 0) / optimalDuration, 2);
        const duration = task.completed
            ? 100 * Math.exp(-0.5 * Math.abs(durationRatio - 1))
            : 30;
        const categoryScores = {
            work: 85,
            learning: 80,
            fitness: 70,
            personal: 60,
            wellness: 50
        };
        const quality = (categoryScores[task.category] || 50) * (task.completed ? 1.0 : 0.3);
        const goal = task.goalId ? 80 : 30;
        return { effort, duration, quality, goal };
    }

    calculateCompositeFromComponents(components) {
        const scoring = window.PriosScoring;
        if (scoring?.computeComposite) {
            return scoring.computeComposite(components, scoring.DEFAULT_WEIGHTS);
        }
        const weights = { effort: 0.25, duration: 0.25, quality: 0.25, goal: 0.25 };
        return weights.effort * (components.effort || 0) +
               weights.duration * (components.duration || 0) +
               weights.quality * (components.quality || 0) +
               weights.goal * (components.goal || 0);
    }

    _clampNumber(value, min = 0, max = 100) {
        if (!Number.isFinite(value)) return min;
        return Math.min(max, Math.max(min, value));
    }

    validateVisualizationPayload(payload) {
        if (!payload) return payload;
        if (Array.isArray(payload.data)) {
            payload.data = payload.data.map(entry => {
                const clone = { ...entry };
                clone.value = Array.isArray(entry.value)
                    ? entry.value.map(val => this._clampNumber(Number(val)))
                    : [];
                clone.intensity = this._clampNumber(entry.intensity ?? 0);
                if (clone.metrics) {
                    clone.metrics = {
                        effort: this._clampNumber(clone.metrics.effort ?? 0),
                        duration: this._clampNumber(clone.metrics.duration ?? 0),
                        quality: this._clampNumber(clone.metrics.quality ?? 0),
                        goal: this._clampNumber(clone.metrics.goal ?? 0),
                        composite: this._clampNumber(clone.metrics.composite ?? 0)
                    };
                }
                clone.confidence = this._clampNumber(clone.confidence ?? 0.8, 0, 1);
                return clone;
            });
        }

        if (Array.isArray(payload.taskDetails)) {
            payload.taskDetails = payload.taskDetails.map(detail => ({
                ...detail,
                duration: Number(detail.duration) || 0,
                confidence: this._clampNumber(detail.confidence ?? 0.8, 0, 1)
            }));
        }

        return payload;
    }

    getDayIndex(dateString, startOfWeek) {
        if (!dateString) return 0;
        try {
            const taskDate = new Date(dateString);
            taskDate.setHours(0, 0, 0, 0);
            const diff = (taskDate - startOfWeek.getTime()) / (1000 * 60 * 60 * 24);
            if (Number.isNaN(diff)) return 0;
            return Math.max(0, Math.min(6, Math.round(diff)));
        } catch (e) {
            return 0;
        }
    }

    // Format data for parallel coordinates visualization
    formatForParallelCoords(weeklyData) {
        const formattedData = [];
        const taskDetails = [];

        weeklyData.forEach((week, weekIndex) => {
            const baselineByDay = week.dayScores.map(day => day.composite || 0);
            const startOfWeek = new Date(week.startDate);

            week.tasks.forEach(task => {
                const values = new Array(7).fill(0);
                const metrics = task.metrics || {};
                const composite = task.composite || metrics.composite || 0;
                const avgComponent = ((metrics.effort || 0) + (metrics.duration || 0) + (metrics.quality || 0) + (metrics.goal || 0)) / 4 || composite;
                const dayIndex = typeof task.dayIndex === 'number' ? task.dayIndex : this.getDayIndex(task.date, startOfWeek);
                const baselineLift = Math.max(0, composite - (baselineByDay[dayIndex] || 0));

                for (let day = 0; day < 7; day++) {
                    const distance = Math.abs(day - dayIndex);
                    const gaussian = Math.exp(-(distance * distance) / 1.6);
                    const dayBaseline = baselineByDay[day] || 0;
                    const goalBoost = distance === 0 ? (metrics.goal || 0) * 0.15 : 0;
                    const contribution = gaussian * (0.65 * composite + 0.35 * avgComponent) + goalBoost;
                    const blended = 0.35 * dayBaseline + contribution;
                    values[day] = Math.max(0, Math.min(100, Number(blended.toFixed(2))));
                }

                const intensity = Math.max(0, Math.min(100, Number((composite).toFixed(2))));
                values.push(intensity);

                const metaIndex = taskDetails.length;
                const priority = task.priority || (composite > 70 ? 'high' : composite > 45 ? 'medium' : 'low');

                formattedData.push({
                    value: values,
                    metaIndex,
                    intensity,
                    peak: Math.max(...values.slice(0, 7)),
                    lift: Number(baselineLift.toFixed(2)),
                    metrics,
                    energyLevel: task.energyLevel || 'medium',
                    focusMode: task.focusMode || 'balanced',
                    timeOfDay: task.timeOfDay || null,
                    confidence: typeof task.confidence === 'number' ? task.confidence : 0.8,
                    lineStyle: {
                        width: Number((1.4 + (intensity / 33)).toFixed(2)),
                        shadowBlur: intensity > 75 ? 8 : intensity > 55 ? 4 : 0,
                        shadowColor: intensity > 55 ? 'rgba(255,214,102,0.45)' : 'transparent'
                    },
                    emphasis: {
                        lineStyle: {
                            width: 4,
                            opacity: 1
                        }
                    },
                    highlightDay: dayIndex
                });

                taskDetails.push({
                    id: task.id,
                    title: task.title || `Task ${task.id || metaIndex + 1}`,
                    category: task.category || 'personal',
                    priority,
                    weekIndex,
                    date: task.date,
                    time: task.time || null,
                    endTime: task.endTime || null,
                    timeOfDay: task.timeOfDay || null,
                    energyLevel: task.energyLevel || 'medium',
                    focusMode: task.focusMode || 'balanced',
                    location: task.location || null,
                    collaborators: task.collaborators || [],
                    contextTags: task.contextTags || [],
                    contextSwitches: task.contextSwitches || 0,
                    confidence: typeof task.confidence === 'number' ? task.confidence : 0.8,
                    flowState: task.flowState || null,
                    sentiment: task.sentiment || 'neutral',
                    source: task.source || 'planner',
                    metrics,
                    composite,
                    lift: Number(baselineLift.toFixed(2)),
                    baseline: baselineByDay[dayIndex] || 0,
                    description: task.description || task.notes || '',
                    duration: task.duration,
                    completed: task.completed,
                    goalId: task.goalId
                });
            });
        });

        return { data: formattedData, taskDetails: taskDetails };
    }
    
    // Export data for visualization page
    async exportForVisualization() {
        const result = await this.calculateWeeklyProductivity();
        
        // Add metadata
        const defaultWeights = window.PriosScoring?.normalizeWeights(window.PriosScoring.DEFAULT_WEIGHTS) || { effort: 0.25, duration: 0.25, quality: 0.25, goal: 0.25 };
        const exportData = {
            data: result.data,
            taskDetails: result.taskDetails,
            metadata: {
                generated: new Date().toISOString(),
                weeks: 4,
                metrics: ['effort', 'duration', 'quality', 'goal', 'composite']
            },
            weights: defaultWeights
        };

        const validated = this.validateVisualizationPayload(exportData);

        // Store in localStorage for cross-page access
        localStorage.setItem('productivityVisualizationData', JSON.stringify(validated));

        return validated;
    }
    
    // Get real-time statistics
    async getRealTimeStats() {
        const today = new Date().toISOString().split('T')[0];
        const tasks = await this.getTasksInRange(today, today);
        
        const completed = tasks.filter(t => t.completed).length;
        const total = tasks.length;
        const completionRate = total > 0 ? (completed / total) * 100 : 0;
        
        const scores = this.calculateDayScore(tasks);
        
        return {
            tasksToday: total,
            completed: completed,
            completionRate: completionRate,
            todayScore: scores.composite,
            components: scores
        };
    }
    
    // Analyze patterns for insights
    async analyzeProductivityPatterns() {
        const weeklyResult = await this.calculateWeeklyProductivity();
        const dataLines = weeklyResult.data || [];

        // Find best performing days based on line values
        const dayAverages = [];
        for (let day = 0; day < 7; day++) {
            let dayTotal = 0;
            let count = 0;

            dataLines.forEach(line => {
                const values = Array.isArray(line) ? line : line.value;
                if (values && values[day] !== undefined) {
                    dayTotal += values[day];
                    count++;
                }
            });

            dayAverages.push(count > 0 ? dayTotal / count : 0);
        }

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const bestDayIndex = dayAverages.indexOf(Math.max(...dayAverages));
        const worstDayIndex = dayAverages.indexOf(Math.min(...dayAverages));

        // Trend analysis using intensity dimension
        const recentScores = dataLines.slice(-Math.min(28, dataLines.length)).map(line => {
            const values = Array.isArray(line) ? line : line.value;
            return values ? (values[7] ?? 0) : 0;
        });
        const trend = this.calculateTrend(recentScores);

        return {
            bestDay: days[bestDayIndex],
            bestDayScore: dayAverages[bestDayIndex],
            worstDay: days[worstDayIndex],
            worstDayScore: dayAverages[worstDayIndex],
            trend: trend,
            dayAverages: dayAverages
        };
    }
    
    calculateTrend(scores) {
        if (scores.length < 2) return 'stable';
        
        // Simple linear regression
        const n = scores.length;
        const x = Array.from({length: n}, (_, i) => i);
        const y = scores;
        
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        
        if (Math.abs(slope) < 0.5) return 'stable';
        return slope > 0 ? 'improving' : 'declining';
    }
}

// Update visualization when data changes
class VisualizationUpdater {
    constructor() {
        this.integration = new ProductivityIntegration();
        this.chart = null;
    }
    
    async updateVisualization() {
        // Get fresh data
        const data = await this.integration.exportForVisualization();
        
        // Update the ECharts instance if on visualization page
        if (typeof myChart !== 'undefined' && myChart) {
            const option = {
                series: [{
                    data: data.data
                }]
            };
            
            myChart.setOption(option);
        }
        
        // Update statistics
        await this.updateStatistics();
    }
    
    async updateStatistics() {
        const stats = await this.integration.getRealTimeStats();
        const patterns = await this.integration.analyzeProductivityPatterns();
        
        // Update UI elements if they exist
        if (document.getElementById('meanScore')) {
            document.getElementById('meanScore').textContent = stats.todayScore.toFixed(1);
        }
        
        if (document.getElementById('trend')) {
            const trendIcons = {
                'improving': 'UP',
                'stable': '--',
                'declining': 'DOWN'
            };
            
            const trendColors = {
                'improving': '#48bb78',
                'stable': '#ffd93d',
                'declining': '#f56565'
            };
            
            document.getElementById('trend').innerHTML = 
                `<span style="color: ${trendColors[patterns.trend]}">${trendIcons[patterns.trend]} ${patterns.trend}</span>`;
        }
    }
}

// Initialize integration on both pages
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeIntegration);
} else {
    initializeIntegration();
}

async function initializeIntegration() {
    const updater = new VisualizationUpdater();
    
    // Check if we're on the visualization page
    if (window.location.pathname.includes('productivity-parallel-coords.html')) {
        // Load data from task planner
        await updater.updateVisualization();
        
        // Set up periodic updates
        setInterval(() => updater.updateVisualization(), 30000); // Update every 30 seconds
    }
    
    // Listen for storage events (cross-tab communication)
    window.addEventListener('storage', (e) => {
        if (e.key === 'productivityVisualizationData') {
            updater.updateVisualization();
        }
    });
}

// Export for use in other modules
window.ProductivityIntegration = ProductivityIntegration;
window.VisualizationUpdater = VisualizationUpdater;