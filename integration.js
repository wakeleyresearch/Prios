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
        const today = new Date();
        
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
        startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffset * 7));
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        const tasks = await this.getTasksInRange(
            startOfWeek.toISOString().split('T')[0],
            endOfWeek.toISOString().split('T')[0]
        );
        
        // Group tasks by day and calculate scores
        const dayScores = [];
        for (let day = 0; day < 7; day++) {
            const currentDate = new Date(startOfWeek);
            currentDate.setDate(startOfWeek.getDate() + day);
            const dateStr = currentDate.toISOString().split('T')[0];
            
            const dayTasks = tasks.filter(t => t.date === dateStr);
            const score = this.calculateDayScore(dayTasks);
            dayScores.push(score);
        }
        
        return dayScores;
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
        
        // Default weights - can be adjusted
        const weights = { e: 0.25, d: 0.25, q: 0.25, g: 0.25 };
        const composite = weights.e * avgEffort + 
                         weights.d * avgDuration + 
                         weights.q * avgQuality + 
                         weights.g * avgGoal;
        
        return {
            effort: avgEffort,
            duration: avgDuration,
            quality: avgQuality,
            goal: avgGoal,
            composite: composite
        };
    }
    
    calculateTaskScores(task) {
        // Priority-based effort score
        const priorityScores = { high: 90, medium: 60, low: 30 };
        const effort = priorityScores[task.priority] || 50;
        
        // Duration efficiency score
        const optimalDuration = 60; // 60 minutes is optimal
        const durationRatio = Math.min(task.duration / optimalDuration, 2);
        const duration = task.completed 
            ? 100 * Math.exp(-0.5 * Math.abs(durationRatio - 1))
            : 30;
        
        // Category-based quality score
        const categoryScores = {
            work: 85,
            learning: 80,
            fitness: 70,
            personal: 60,
            wellness: 50
        };
        const quality = (categoryScores[task.category] || 50) * 
                       (task.completed ? 1.0 : 0.3);
        
        // Goal alignment score
        const goal = task.goalId ? 80 : 30;
        
        return {
            effort: effort,
            duration: duration,
            quality: quality,
            goal: goal
        };
    }
    
    // Format data for parallel coordinates visualization
    formatForParallelCoords(weeklyData) {
        const formattedData = [];
        const taskDetails = [];
        
        // Sample task names that would come from actual data
        const sampleTasks = [
            "Daily Standup", "Team Meeting", "Code Review", "Project Planning",
            "Email Review", "Documentation", "Sprint Planning", "Client Meeting",
            "Morning Run", "Gym Workout", "Yoga Session", "Meditation",
            "Online Course", "Book Reading", "Tutorial Video", "Research Paper",
            "Meal Prep", "Grocery Shopping", "Family Time", "House Cleaning"
        ];
        
        weeklyData.forEach((week, weekIndex) => {
            // Create a line for each metric type
            const metrics = ['effort', 'duration', 'quality', 'goal', 'composite'];
            
            metrics.forEach((metric, metricIndex) => {
                const dataPoint = [];
                
                // Add scores for each day of the week
                week.forEach(dayData => {
                    dataPoint.push(dayData[metric]);
                });
                
                // Add metric value for color coding (0-100 scale)
                const avgScore = dataPoint.reduce((a, b) => a + b, 0) / 7;
                dataPoint.push(avgScore);
                
                formattedData.push(dataPoint);
                
                // Create realistic task detail for tooltip
                const taskIndex = (weekIndex * 5 + metricIndex) % sampleTasks.length;
                const taskName = sampleTasks[taskIndex];
                
                taskDetails.push({
                    title: taskName,
                    category: metric === 'effort' ? 'work' : 
                             metric === 'quality' ? 'learning' :
                             metric === 'duration' ? 'fitness' : 'personal',
                    priority: avgScore > 70 ? 'high' : avgScore > 40 ? 'medium' : 'low',
                    weekIndex: weekIndex,
                    metric: metric,
                    description: `${metric.charAt(0).toUpperCase() + metric.slice(1)} score for ${taskName}`
                });
            });
        });
        
        return { data: formattedData, taskDetails: taskDetails };
    }
    
    // Export data for visualization page
    async exportForVisualization() {
        const result = await this.calculateWeeklyProductivity();
        
        // Add metadata
        const exportData = {
            data: result.data,
            taskDetails: result.taskDetails,
            metadata: {
                generated: new Date().toISOString(),
                weeks: 4,
                metrics: ['effort', 'duration', 'quality', 'goal', 'composite']
            },
            weights: { effort: 0.25, duration: 0.25, quality: 0.25, goal: 0.25 }
        };
        
        // Store in localStorage for cross-page access
        localStorage.setItem('productivityVisualizationData', JSON.stringify(exportData));
        
        return exportData;
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
        const weekData = await this.calculateWeeklyProductivity();
        
        // Find best performing days
        const dayAverages = [];
        for (let day = 0; day < 7; day++) {
            let dayTotal = 0;
            let count = 0;
            
            weekData.forEach(dataPoint => {
                if (dataPoint[day] !== undefined) {
                    dayTotal += dataPoint[day];
                    count++;
                }
            });
            
            dayAverages.push(count > 0 ? dayTotal / count : 0);
        }
        
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const bestDayIndex = dayAverages.indexOf(Math.max(...dayAverages));
        const worstDayIndex = dayAverages.indexOf(Math.min(...dayAverages));
        
        // Trend analysis
        const recentScores = weekData.slice(-7).map(d => d[7]); // Get composite scores
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
                'improving': '📈',
                'stable': '➡️',
                'declining': '📉'
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