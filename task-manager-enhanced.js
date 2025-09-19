// Task Manager - Enhanced with Rhythm Component
// Complete Task Planning System with Productivity Integration including Rhythm (R)

// Initialize IndexedDB for persistent storage
let db;
const DB_NAME = 'ProductivityDB';
const DB_VERSION = 2; // Incremented for schema update

// Data structures
let tasks = [];
let goals = [];
let templates = [];
let rhythmData = [];
let currentWeekOffset = 0;
let selectedPriority = 'medium';
let currentView = 'week';

// Initialize Rhythm Analyzer
let rhythmAnalyzer = null;

// Initialize database with updated schema
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            console.error('Database failed to open');
            reject(request.error);
        };
        
        request.onsuccess = () => {
            db = request.result;
            console.log('Database opened successfully');
            
            // Initialize rhythm analyzer
            rhythmAnalyzer = new RhythmAnalyzer({
                idealSleepTime: localStorage.getItem('idealSleepTime') || "22:30",
                idealWakeTime: localStorage.getItem('idealWakeTime') || "06:30"
            });
            
            loadData();
            resolve(db);
        };
        
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            const oldVersion = e.oldVersion;
            
            // Create object stores
            if (!db.objectStoreNames.contains('tasks')) {
                const taskStore = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
                taskStore.createIndex('date', 'date', { unique: false });
                taskStore.createIndex('category', 'category', { unique: false });
                taskStore.createIndex('goalId', 'goalId', { unique: false });
                taskStore.createIndex('completed', 'completed', { unique: false });
                taskStore.createIndex('completedOnTime', 'completedOnTime', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('goals')) {
                const goalStore = db.createObjectStore('goals', { keyPath: 'id', autoIncrement: true });
                goalStore.createIndex('category', 'category', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('templates')) {
                const templateStore = db.createObjectStore('templates', { keyPath: 'id', autoIncrement: true });
                templateStore.createIndex('type', 'type', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('productivity_scores')) {
                const scoreStore = db.createObjectStore('productivity_scores', { keyPath: 'date' });
                scoreStore.createIndex('week', 'week', { unique: false });
            }
            
            // NEW: Rhythm data store
            if (!db.objectStoreNames.contains('rhythm_data')) {
                const rhythmStore = db.createObjectStore('rhythm_data', { keyPath: 'id', autoIncrement: true });
                rhythmStore.createIndex('date', 'date', { unique: false });
                rhythmStore.createIndex('type', 'type', { unique: false });
            }
            
            // NEW: Sleep tracking store
            if (!db.objectStoreNames.contains('sleep_data')) {
                const sleepStore = db.createObjectStore('sleep_data', { keyPath: 'date' });
                sleepStore.createIndex('week', 'week', { unique: false });
            }
        };
    });
}

// Enhanced Task class with rhythm component
class Task {
    constructor(data) {
        // Existing fields
        this.title = data.title;
        this.description = data.description || '';
        this.priority = data.priority || 'medium';
        this.date = data.date;
        this.time = data.time || '';
        this.duration = data.duration || 60;
        this.category = data.category || 'personal';
        this.goalId = data.goalId || null;
        this.completed = data.completed || false;
        this.recurring = data.recurring || null;
        this.effort = data.effort || 0;
        this.quality = data.quality || 0;
        
        // NEW: Rhythm-related fields
        this.completedOnTime = data.completedOnTime || false;
        this.actualCompletionTime = data.actualCompletionTime || null;
        this.plannedStartTime = data.plannedStartTime || this.time;
        this.actualStartTime = data.actualStartTime || null;
    }
    
    getProductivityComponents() {
        // Calculate E, D, Q, G, R components for productivity score
        const components = {
            effort: this.calculateEffortScore(),
            duration: this.calculateDurationScore(),
            quality: this.calculateQualityScore(),
            goal: this.calculateGoalScore(),
            rhythm: this.calculateRhythmScore()  // NEW
        };
        
        return components;
    }
    
    calculateEffortScore() {
        const priorityWeights = { high: 1.0, medium: 0.7, low: 0.4 };
        const durationFactor = Math.min(this.duration / 120, 1);
        return priorityWeights[this.priority] * durationFactor * 100;
    }
    
    calculateDurationScore() {
        if (this.completed) {
            const efficiency = this.duration <= 60 ? 1.0 : Math.exp(-0.01 * (this.duration - 60));
            return efficiency * 100;
        }
        return 50;
    }
    
    calculateQualityScore() {
        const categoryWeights = {
            work: 0.9,
            learning: 0.85,
            fitness: 0.7,
            personal: 0.6,
            wellness: 0.5
        };
        
        const baseScore = categoryWeights[this.category] || 0.5;
        return (this.completed ? baseScore : baseScore * 0.3) * 100;
    }
    
    calculateGoalScore() {
        if (this.goalId) {
            const goal = goals.find(g => g.id === this.goalId);
            if (goal) {
                const urgency = this.calculateGoalUrgency(goal);
                return urgency * 100;
            }
        }
        return 30;
    }
    
    // NEW: Rhythm score calculation
    calculateRhythmScore() {
        let rhythmScore = 50; // Base score
        
        // On-time completion bonus
        if (this.completedOnTime) {
            rhythmScore += 20;
        }
        
        // Time consistency bonus
        if (this.actualStartTime && this.plannedStartTime) {
            const timeDiff = Math.abs(
                this.timeToMinutes(this.actualStartTime) - 
                this.timeToMinutes(this.plannedStartTime)
            );
            
            if (timeDiff < 15) {
                rhythmScore += 20; // Very consistent
            } else if (timeDiff < 30) {
                rhythmScore += 10; // Moderately consistent
            }
        }
        
        // Recurring task consistency
        if (this.recurring && this.completed) {
            rhythmScore += 10;
        }
        
        return Math.min(100, Math.max(0, rhythmScore));
    }
    
    calculateGoalUrgency(goal) {
        if (!goal.deadline) return 0.5;
        
        const now = new Date();
        const deadline = new Date(goal.deadline);
        const daysUntilDeadline = (deadline - now) / (1000 * 60 * 60 * 24);
        
        return Math.exp(-0.05 * Math.max(daysUntilDeadline, 0));
    }
    
    timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }
}

// Save task with rhythm tracking
async function saveTask(task) {
    await ensureDBReady();
    
    const transaction = db.transaction(['tasks', 'rhythm_data'], 'readwrite');
    const taskStore = transaction.objectStore('tasks');
    const rhythmStore = transaction.objectStore('rhythm_data');
    
    const request = task.id ? taskStore.put(task) : taskStore.add(task);
    
    request.onsuccess = async (e) => {
        const newId = task.id ? task.id : e.target.result;
        if (!task.id) task.id = newId;
        
        // Track rhythm data
        const rhythmEntry = {
            date: task.date,
            type: 'task_timing',
            taskId: newId,
            plannedTime: task.plannedStartTime,
            actualTime: task.actualStartTime,
            completed: task.completed,
            completedOnTime: task.completedOnTime
        };
        
        rhythmStore.add(rhythmEntry);
        
        console.log('Task saved with rhythm tracking:', task);
        loadData();
        calculateDailyProductivity(task.date);
        
        // Dispatch event for integration layer
        window.dispatchEvent(new CustomEvent('tasks-changed', { 
            detail: { 
                type: task.id ? 'updated' : 'added',
                taskId: newId,
                includesRhythm: true
            }
        }));
    };
}

// Track sleep data
async function saveSleepData(sleepData) {
    await ensureDBReady();
    
    const transaction = db.transaction(['sleep_data', 'rhythm_data'], 'readwrite');
    const sleepStore = transaction.objectStore('sleep_data');
    const rhythmStore = transaction.objectStore('rhythm_data');
    
    // Save to sleep store
    sleepStore.put(sleepData);
    
    // Also track in rhythm data
    const rhythmEntry = {
        date: sleepData.date,
        type: 'sleep',
        sleepTime: sleepData.sleepTime,
        wakeTime: sleepData.wakeTime,
        quality: sleepData.quality,
        duration: sleepData.duration
    };
    
    rhythmStore.add(rhythmEntry);
    
    console.log('Sleep data saved:', sleepData);
    
    // Trigger rhythm recalculation
    calculateDailyRhythm(sleepData.date);
}

// Calculate daily rhythm score
async function calculateDailyRhythm(date) {
    await ensureDBReady();
    
    const transaction = db.transaction(['rhythm_data', 'tasks', 'sleep_data'], 'readonly');
    const rhythmStore = transaction.objectStore('rhythm_data');
    const taskStore = transaction.objectStore('tasks');
    const sleepStore = transaction.objectStore('sleep_data');
    
    // Get rhythm data for the date range (last 7 days)
    const endDate = new Date(date);
    const startDate = new Date(date);
    startDate.setDate(startDate.getDate() - 7);
    
    const rhythmData = [];
    const taskData = [];
    const sleepData = [];
    
    // Fetch all relevant data
    const range = IDBKeyRange.bound(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
    );
    
    const rhythmRequest = rhythmStore.index('date').getAll(range);
    const taskRequest = taskStore.index('date').getAll(range);
    const sleepRequest = sleepStore.getAll();
    
    rhythmRequest.onsuccess = () => {
        rhythmData.push(...rhythmRequest.result);
    };
    
    taskRequest.onsuccess = () => {
        taskData.push(...taskRequest.result);
    };
    
    sleepRequest.onsuccess = async () => {
        sleepData.push(...sleepRequest.result);
        
        // Calculate rhythm score using the analyzer
        if (rhythmAnalyzer) {
            const rhythmScore = await rhythmAnalyzer.computeRhythmScore({
                sleepData: sleepData.map(s => ({
                    sleepTime: s.sleepTime,
                    wakeTime: s.wakeTime
                })),
                attendanceData: taskData
                    .filter(t => t.category === 'work' || t.category === 'learning')
                    .map(t => ({
                        onTime: t.completedOnTime
                    })),
                taskData: taskData.map(t => ({
                    date: t.date,
                    completed: t.completed
                })),
                activityData: rhythmData
                    .filter(r => r.type === 'task_timing')
                    .map(r => ({
                        timestamp: `${r.date}T${r.actualTime || r.plannedTime}`
                    }))
            });
            
            // Store the rhythm score
            await storeRhythmScore(date, rhythmScore);
            
            // Dispatch event for UI update
            window.dispatchEvent(new CustomEvent('rhythm-updated', {
                detail: {
                    date: date,
                    score: rhythmScore.composite,
                    components: rhythmScore.components,
                    insights: rhythmScore.insights
                }
            }));
        }
    };
}

// Store rhythm score in productivity scores
async function storeRhythmScore(date, rhythmScore) {
    await ensureDBReady();
    
    const transaction = db.transaction(['productivity_scores'], 'readwrite');
    const store = transaction.objectStore('productivity_scores');
    
    // Get existing score or create new
    const request = store.get(date);
    
    request.onsuccess = () => {
        const existingScore = request.result || { date: date };
        
        // Add rhythm component
        existingScore.rhythm = rhythmScore.composite;
        existingScore.rhythmComponents = rhythmScore.components;
        existingScore.rhythmInsights = rhythmScore.insights;
        
        // Recalculate composite with rhythm
        if (existingScore.effort && existingScore.duration && 
            existingScore.quality && existingScore.goal) {
            
            // Updated weights including rhythm
            const weights = {
                effort: 0.20,
                duration: 0.20,
                quality: 0.25,
                goal: 0.20,
                rhythm: 0.15
            };
            
            existingScore.composite = 
                weights.effort * existingScore.effort +
                weights.duration * existingScore.duration +
                weights.quality * existingScore.quality +
                weights.goal * existingScore.goal +
                weights.rhythm * existingScore.rhythm;
        }
        
        store.put(existingScore);
    };
}

// Enhanced templates with rhythm considerations
const defaultTemplates = {
    morningRoutine: {
        title: 'Morning Routine',
        time: '06:30',
        duration: 45,
        category: 'wellness',
        priority: 'high',
        recurring: 'daily',
        rhythmImpact: 'high'
    },
    standup: {
        title: 'Daily Standup',
        time: '09:00',
        duration: 15,
        category: 'work',
        priority: 'high',
        recurring: 'weekdays',
        rhythmImpact: 'medium'
    },
    workout: {
        title: 'Workout Session',
        time: '18:00',
        duration: 60,
        category: 'fitness',
        priority: 'medium',
        recurring: 'mwf',
        rhythmImpact: 'high'
    },
    eveningReview: {
        title: 'Evening Review',
        time: '21:00',
        duration: 20,
        category: 'personal',
        priority: 'medium',
        recurring: 'daily',
        rhythmImpact: 'high'
    }
};

// Load data with rhythm components
async function loadData() {
    if (!db) return;
    
    // Load tasks
    const taskTransaction = db.transaction(['tasks'], 'readonly');
    const taskStore = taskTransaction.objectStore('tasks');
    const taskRequest = taskStore.getAll();
    
    taskRequest.onsuccess = () => {
        tasks = taskRequest.result;
        if (typeof renderCalendar === 'function') {
            renderCalendar();
        }
    };
    
    // Load goals
    const goalTransaction = db.transaction(['goals'], 'readonly');
    const goalStore = goalTransaction.objectStore('goals');
    const goalRequest = goalStore.getAll();
    
    goalRequest.onsuccess = () => {
        goals = goalRequest.result;
        if (typeof renderGoals === 'function') {
            renderGoals();
        }
    };
    
    // Load rhythm data
    const rhythmTransaction = db.transaction(['rhythm_data'], 'readonly');
    const rhythmStore = rhythmTransaction.objectStore('rhythm_data');
    const rhythmRequest = rhythmStore.getAll();
    
    rhythmRequest.onsuccess = () => {
        rhythmData = rhythmRequest.result;
        if (typeof updateRhythmIndicators === 'function') {
            updateRhythmIndicators();
        }
    };
    
    // Load templates
    loadTemplates();
}

// Calculate daily productivity with rhythm
async function calculateDailyProductivity(date) {
    await ensureDBReady();
    
    const transaction = db.transaction(['tasks'], 'readonly');
    const store = transaction.objectStore('tasks');
    const index = store.index('date');
    
    const request = index.getAll(date);
    
    request.onsuccess = async () => {
        const dayTasks = request.result;
        
        if (dayTasks.length === 0) return;
        
        // Calculate average scores for each component
        let totalE = 0, totalD = 0, totalQ = 0, totalG = 0, totalR = 0;
        let count = 0;
        
        dayTasks.forEach(taskData => {
            const task = new Task(taskData);
            const components = task.getProductivityComponents();
            
            totalE += components.effort;
            totalD += components.duration;
            totalQ += components.quality;
            totalG += components.goal;
            totalR += components.rhythm;
            count++;
        });
        
        const avgScores = {
            effort: totalE / count,
            duration: totalD / count,
            quality: totalQ / count,
            goal: totalG / count,
            rhythm: totalR / count
        };
        
        // Updated weights with rhythm
        const weights = {
            effort: 0.20,
            duration: 0.20,
            quality: 0.25,
            goal: 0.20,
            rhythm: 0.15
        };
        
        const composite = 
            weights.effort * avgScores.effort +
            weights.duration * avgScores.duration +
            weights.quality * avgScores.quality +
            weights.goal * avgScores.goal +
            weights.rhythm * avgScores.rhythm;
        
        // Store productivity score
        const scoreTransaction = db.transaction(['productivity_scores'], 'readwrite');
        const scoreStore = scoreTransaction.objectStore('productivity_scores');
        
        const score = {
            date: date,
            ...avgScores,
            composite: composite,
            taskCount: count,
            timestamp: new Date().toISOString()
        };
        
        scoreStore.put(score);
        
        console.log('Daily productivity calculated with rhythm:', score);
        
        // Also calculate rhythm score for the day
        calculateDailyRhythm(date);
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('productivity-calculated', {
            detail: score
        }));
    };
}

// Helper function to ensure DB is ready
async function ensureDBReady() {
    if (!db) {
        await initDB();
    }
    return db;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Task,
        initDB,
        saveTask,
        saveSleepData,
        calculateDailyProductivity,
        calculateDailyRhythm,
        loadData
    };
}
