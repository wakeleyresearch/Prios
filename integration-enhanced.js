/**
 * Integration Layer - Enhanced with Rhythm Component
 * Connects Task Planner with Productivity Visualization including Rhythm (R)
 */

class ProductivityIntegration {
    constructor() {
        this.db = null;
        this._dbReady = this.initDatabase();
        this.rhythmAnalyzer = null;
        
        // Updated weights including rhythm
        this.weights = {
            effort: 0.20,
            duration: 0.20,
            quality: 0.25,
            goal: 0.20,
            rhythm: 0.15
        };
    }
    
    async initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('ProductivityDB', 2); // Version 2 for rhythm
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                
                // Existing stores
                if (!db.objectStoreNames.contains('tasks')) {
                    const taskStore = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
                    taskStore.createIndex('date', 'date', { unique: false });
                    taskStore.createIndex('category', 'category', { unique: false });
                    taskStore.createIndex('goalId', 'goalId', { unique: false });
                    taskStore.createIndex('completedOnTime', 'completedOnTime', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('goals')) {
                    const goalStore = db.createObjectStore('goals', { keyPath: 'id', autoIncrement: true });
                    goalStore.createIndex('category', 'category', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('productivity_scores')) {
                    const scoreStore = db.createObjectStore('productivity_scores', { keyPath: 'date' });
                    scoreStore.createIndex('week', 'week', { unique: false });
                    scoreStore.createIndex('composite', 'composite', { unique: false });
                }
                
                // NEW: Rhythm-specific stores
                if (!db.objectStoreNames.contains('rhythm_data')) {
                    const rhythmStore = db.createObjectStore('rhythm_data', { keyPath: 'id', autoIncrement: true });
                    rhythmStore.createIndex('date', 'date', { unique: false });
                    rhythmStore.createIndex('type', 'type', { unique: false });
                    rhythmStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('sleep_data')) {
                    const sleepStore = db.createObjectStore('sleep_data', { keyPath: 'date' });
                    sleepStore.createIndex('week', 'week', { unique: false });
                    sleepStore.createIndex('quality', 'quality', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('attendance_data')) {
                    const attendanceStore = db.createObjectStore('attendance_data', { keyPath: 'id', autoIncrement: true });
                    attendanceStore.createIndex('date', 'date', { unique: false });
                    attendanceStore.createIndex('type', 'type', { unique: false });
                }
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                
                // Initialize rhythm analyzer
                this.rhythmAnalyzer = new RhythmAnalyzer({
                    idealSleepTime: localStorage.getItem('idealSleepTime') || "22:30",
                    idealWakeTime: localStorage.getItem('idealWakeTime') || "06:30",
                    idealWorkStart: localStorage.getItem('idealWorkStart') || "09:00",
                    idealWorkEnd: localStorage.getItem('idealWorkEnd') || "17:00"
                });
                
                resolve(this.db);
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        });
    }
    
    /**
     * Fetch all tasks within a date range
     */
    async getTasksInRange(startDate, endDate) {
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
    
    /**
     * Get rhythm data for analysis
     */
    async getRhythmData(startDate, endDate) {
        if (!this.db) await this._dbReady;
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['rhythm_data', 'sleep_data'], 'readonly');
            const rhythmStore = transaction.objectStore('rhythm_data');
            const sleepStore = transaction.objectStore('sleep_data');
            
            const range = IDBKeyRange.bound(startDate, endDate);
            
            const rhythmData = [];
            const sleepData = [];
            
            const rhythmRequest = rhythmStore.index('date').getAll(range);
            const sleepRequest = sleepStore.getAll(range);
            
            rhythmRequest.onsuccess = () => {
                rhythmData.push(...rhythmRequest.result);
            };
            
            sleepRequest.onsuccess = () => {
                sleepData.push(...sleepRequest.result);
                
                resolve({
                    rhythm: rhythmData,
                    sleep: sleepData
                });
            };
            
            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    }
    
    /**
     * Calculate weekly productivity with rhythm component
     */
    async calculateWeeklyProductivity() {
        if (!this.db) await this._dbReady;
        
        const weeks = [];
        const today = new Date();
        
        // Get last 4 weeks of data
        for (let weekOffset = -3; weekOffset <= 0; weekOffset++) {
            const weekData = await this.getWeekData(weekOffset);
            weeks.push(weekData);
        }
        
        return weeks;
    }
    
    /**
     * Get week data with rhythm analysis
     */
    async getWeekData(weekOffset) {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffset * 7));
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        const startStr = startOfWeek.toISOString().split('T')[0];
        const endStr = endOfWeek.toISOString().split('T')[0];
        
        // Get tasks and rhythm data
        const tasks = await this.getTasksInRange(startStr, endStr);
        const rhythmData = await this.getRhythmData(startStr, endStr);
        
        // Calculate daily scores including rhythm
        const dailyScores = {};
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(startOfWeek);
            currentDate.setDate(startOfWeek.getDate() + i);
            const dateStr = currentDate.toISOString().split('T')[0];
            
            const dayTasks = tasks.filter(t => t.date === dateStr);
            const dayRhythm = rhythmData.rhythm.filter(r => r.date === dateStr);
            const daySleep = rhythmData.sleep.find(s => s.date === dateStr);
            
            if (dayTasks.length > 0) {
                const scores = await this.calculateDayScores(dayTasks, dayRhythm, daySleep);
                dailyScores[daysOfWeek[i]] = scores;
            } else {
                dailyScores[daysOfWeek[i]] = {
                    effort: 0,
                    duration: 0,
                    quality: 0,
                    goal: 0,
                    rhythm: 0,
                    composite: 0
                };
            }
        }
        
        return {
            weekStart: startStr,
            weekEnd: endStr,
            dailyScores: dailyScores,
            weekNumber: weekOffset
        };
    }
    
    /**
     * Calculate scores for a single day including rhythm
     */
    async calculateDayScores(dayTasks, dayRhythm, daySleep) {
        let totalE = 0, totalD = 0, totalQ = 0, totalG = 0, totalR = 0;
        let count = 0;
        
        // Calculate task-based components
        for (const taskData of dayTasks) {
            const components = this.calculateTaskComponents(taskData);
            totalE += components.effort;
            totalD += components.duration;
            totalQ += components.quality;
            totalG += components.goal;
            count++;
        }
        
        // Calculate rhythm score
        const rhythmScore = await this.calculateRhythmScore(dayTasks, dayRhythm, daySleep);
        totalR = rhythmScore * count; // Scale to match other components
        
        if (count === 0) {
            return {
                effort: 0,
                duration: 0,
                quality: 0,
                goal: 0,
                rhythm: 0,
                composite: 0
            };
        }
        
        const avgScores = {
            effort: totalE / count,
            duration: totalD / count,
            quality: totalQ / count,
            goal: totalG / count,
            rhythm: totalR / count
        };
        
        // Calculate composite with updated weights
        const composite = 
            this.weights.effort * avgScores.effort +
            this.weights.duration * avgScores.duration +
            this.weights.quality * avgScores.quality +
            this.weights.goal * avgScores.goal +
            this.weights.rhythm * avgScores.rhythm;
        
        return {
            ...avgScores,
            composite: composite
        };
    }
    
    /**
     * Calculate rhythm score for a day
     */
    async calculateRhythmScore(tasks, rhythmData, sleepData) {
        if (!this.rhythmAnalyzer) {
            return 50; // Default if analyzer not initialized
        }
        
        // Prepare data for rhythm analyzer
        const analysisData = {
            sleepData: sleepData ? [{
                sleepTime: sleepData.sleepTime,
                wakeTime: sleepData.wakeTime
            }] : [],
            
            attendanceData: tasks
                .filter(t => t.category === 'work' || t.category === 'learning')
                .map(t => ({
                    onTime: t.completedOnTime || false
                })),
            
            taskData: tasks.map(t => ({
                date: t.date,
                completed: t.completed || false
            })),
            
            activityData: rhythmData.map(r => ({
                timestamp: new Date(`${r.date}T${r.actualTime || r.plannedTime || '12:00'}`)
            }))
        };
        
        const result = await this.rhythmAnalyzer.computeRhythmScore(analysisData);
        return result.composite;
    }
    
    /**
     * Calculate individual task components
     */
    calculateTaskComponents(task) {
        // Effort score
        const priorityWeights = { high: 1.0, medium: 0.7, low: 0.4 };
        const durationFactor = Math.min((task.duration || 60) / 120, 1);
        const effort = priorityWeights[task.priority || 'medium'] * durationFactor * 100;
        
        // Duration efficiency
        let duration = 50;
        if (task.completed) {
            const efficiency = task.duration <= 60 ? 1.0 : Math.exp(-0.01 * ((task.duration || 60) - 60));
            duration = efficiency * 100;
        }
        
        // Quality score
        const categoryWeights = {
            work: 0.9,
            learning: 0.85,
            fitness: 0.7,
            personal: 0.6,
            wellness: 0.5
        };
        const baseQuality = categoryWeights[task.category || 'personal'] || 0.5;
        const quality = (task.completed ? baseQuality : baseQuality * 0.3) * 100;
        
        // Goal alignment
        const goal = task.goalId ? 80 : 30;
        
        return {
            effort: effort,
            duration: duration,
            quality: quality,
            goal: goal
        };
    }
    
    /**
     * Generate data for parallel coordinates visualization with rhythm
     */
    async generateParallelCoordsData() {
        if (!this.db) await this._dbReady;
        
        const weeks = await this.calculateWeeklyProductivity();
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        // Transform data for ECharts parallel coordinates
        const data = [];
        
        weeks.forEach((week, weekIndex) => {
            // Create lines for each component
            const components = ['effort', 'duration', 'quality', 'goal', 'rhythm', 'composite'];
            
            components.forEach(component => {
                const line = [];
                daysOfWeek.forEach(day => {
                    line.push(week.dailyScores[day][component]);
                });
                
                data.push({
                    value: line,
                    name: `Week ${weekIndex + 1} - ${component}`,
                    lineStyle: {
                        width: component === 'composite' ? 3 : 1,
                        opacity: component === 'composite' ? 1 : 0.7
                    }
                });
            });
        });
        
        return {
            dimensions: daysOfWeek.map((day, i) => ({
                name: day,
                type: 'value',
                min: 0,
                max: 100
            })),
            data: data
        };
    }
    
    /**
     * Update weights dynamically based on context
     */
    updateWeights(newWeights) {
        // Ensure weights sum to 1
        const sum = Object.values(newWeights).reduce((a, b) => a + b, 0);
        
        if (Math.abs(sum - 1.0) > 0.001) {
            // Normalize weights
            for (const key in newWeights) {
                newWeights[key] = newWeights[key] / sum;
            }
        }
        
        this.weights = newWeights;
        
        // Store weights in localStorage for persistence
        localStorage.setItem('productivityWeights', JSON.stringify(this.weights));
        
        // Trigger recalculation event
        window.dispatchEvent(new CustomEvent('weights-updated', {
            detail: this.weights
        }));
    }
    
    /**
     * Get rhythm insights for a date range
     */
    async getRhythmInsights(startDate, endDate) {
        const rhythmData = await this.getRhythmData(startDate, endDate);
        
        if (!this.rhythmAnalyzer) {
            return [];
        }
        
        // Analyze patterns
        const sleepTimes = rhythmData.sleep.map(s => s.sleepTime).filter(t => t);
        const wakeTimes = rhythmData.sleep.map(s => s.wakeTime).filter(t => t);
        
        const insights = [];
        
        // Sleep consistency insight
        if (sleepTimes.length > 3) {
            const sleepRadians = sleepTimes.map(t => this.timeToRadians(t));
            const stats = this.circularStatistics(sleepRadians);
            
            if (stats.variance > 0.5) {
                insights.push({
                    type: 'warning',
                    category: 'sleep',
                    message: 'Your sleep schedule varies significantly. Try to maintain more consistent sleep times.',
                    severity: 'medium'
                });
            } else if (stats.variance < 0.2) {
                insights.push({
                    type: 'success',
                    category: 'sleep',
                    message: 'Excellent sleep consistency! Keep up the regular schedule.',
                    severity: 'positive'
                });
            }
        }
        
        // Task timing patterns
        const taskTimings = rhythmData.rhythm
            .filter(r => r.type === 'task_timing' && r.actualTime)
            .map(r => r.actualTime);
        
        if (taskTimings.length > 5) {
            const timingRadians = taskTimings.map(t => this.timeToRadians(t));
            const stats = this.circularStatistics(timingRadians);
            
            // Check if tasks cluster around certain times
            const meanHour = (stats.mean / (2 * Math.PI)) * 24;
            
            if (meanHour >= 10 && meanHour <= 12) {
                insights.push({
                    type: 'info',
                    category: 'productivity',
                    message: 'You tend to be most active in the morning - great alignment with natural productivity peaks!',
                    severity: 'positive'
                });
            } else if (meanHour >= 22 || meanHour <= 5) {
                insights.push({
                    type: 'warning',
                    category: 'circadian',
                    message: 'Many tasks are scheduled late at night. Consider shifting work to daytime hours.',
                    severity: 'high'
                });
            }
        }
        
        return insights;
    }
    
    /**
     * Utility functions for circular statistics
     */
    timeToRadians(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        return (totalMinutes / (24 * 60)) * 2 * Math.PI;
    }
    
    circularStatistics(radians) {
        const n = radians.length;
        let sinSum = 0, cosSum = 0;
        
        radians.forEach(r => {
            sinSum += Math.sin(r);
            cosSum += Math.cos(r);
        });
        
        const meanSin = sinSum / n;
        const meanCos = cosSum / n;
        const mean = Math.atan2(meanSin, meanCos);
        const R = Math.sqrt(meanSin * meanSin + meanCos * meanCos);
        const variance = 1 - R;
        
        return { mean, variance, resultantLength: R };
    }
}

// Export for use in visualization components
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductivityIntegration;
}

// Auto-initialize if in browser
if (typeof window !== 'undefined') {
    window.ProductivityIntegration = ProductivityIntegration;
}
