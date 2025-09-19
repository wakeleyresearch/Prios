// Task Manager - Complete Task Planning System with Productivity Integration

// Initialize IndexedDB for persistent storage
let db;
const DB_NAME = 'ProductivityDB';
const DB_VERSION = 1;

// Data structures
let tasks = [];
let goals = [];
let templates = [];
let currentWeekOffset = 0;
let selectedPriority = 'medium';
let currentView = 'week';

// Initialize database
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
            loadData();
            resolve(db);
        };
        
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            
            // Create object stores
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
            
            if (!db.objectStoreNames.contains('templates')) {
                const templateStore = db.createObjectStore('templates', { keyPath: 'id', autoIncrement: true });
                templateStore.createIndex('type', 'type', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('productivity_scores')) {
                const scoreStore = db.createObjectStore('productivity_scores', { keyPath: 'date' });
                scoreStore.createIndex('week', 'week', { unique: false });
            }
        };
    });
}

// Ensure DB is initialized before operations
function ensureDBReady() {
    return db ? Promise.resolve(db) : initDB();
}

// Load data from IndexedDB
async function loadData() {
    // Load tasks
    const taskTransaction = db.transaction(['tasks'], 'readonly');
    const taskStore = taskTransaction.objectStore('tasks');
    const taskRequest = taskStore.getAll();
    
    taskRequest.onsuccess = () => {
        tasks = taskRequest.result;
        renderCalendar();
    };
    
    // Load goals
    const goalTransaction = db.transaction(['goals'], 'readonly');
    const goalStore = goalTransaction.objectStore('goals');
    const goalRequest = goalStore.getAll();
    
    goalRequest.onsuccess = () => {
        goals = goalRequest.result;
        renderGoals();
    };
    
    // Load templates
    loadTemplates();
}

// Task Management Functions
class Task {
    constructor(data) {
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
    }
    
    getProductivityComponents() {
        // Calculate E, D, Q, G components for productivity score
        const components = {
            effort: this.calculateEffortScore(),
            duration: this.calculateDurationScore(),
            quality: this.calculateQualityScore(),
            goal: this.calculateGoalScore()
        };
        
        return components;
    }
    
    calculateEffortScore() {
        // Effort based on priority and duration
        const priorityWeights = { high: 1.0, medium: 0.7, low: 0.4 };
        const durationFactor = Math.min(this.duration / 120, 1); // Normalize to 2 hours max
        return priorityWeights[this.priority] * durationFactor * 100;
    }
    
    calculateDurationScore() {
        // Duration efficiency - was it completed on time?
        if (this.completed) {
            const efficiency = this.duration <= 60 ? 1.0 : Math.exp(-0.01 * (this.duration - 60));
            return efficiency * 100;
        }
        return 50; // Default for uncompleted tasks
    }
    
    calculateQualityScore() {
        // Quality based on category importance and completion
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
        // Goal alignment - is this linked to a goal?
        if (this.goalId) {
            const goal = goals.find(g => g.id === this.goalId);
            if (goal) {
                const urgency = this.calculateGoalUrgency(goal);
                return urgency * 100;
            }
        }
        return 30; // Low score for non-goal tasks
    }
    
    calculateGoalUrgency(goal) {
        if (!goal.deadline) return 0.5;
        
        const now = new Date();
        const deadline = new Date(goal.deadline);
        const daysUntilDeadline = (deadline - now) / (1000 * 60 * 60 * 24);
        
        // Exponential urgency as deadline approaches
        return Math.exp(-0.05 * Math.max(daysUntilDeadline, 0));
    }
}

// Save task to IndexedDB
function saveTask(task) {
    const doSave = () => {
        const transaction = db.transaction(['tasks'], 'readwrite');
        const store = transaction.objectStore('tasks');
        
        const request = task.id ? store.put(task) : store.add(task);
        
        request.onsuccess = (e) => {
            const newId = task.id ? task.id : e.target.result;
            if (!task.id) task.id = newId;
            console.log('Task saved successfully', task);
            loadData();
            calculateDailyProductivity(task.date);
            window.dispatchEvent(new CustomEvent('tasks-changed', { detail: { type: task.id ? 'update' : 'create', task } }));
        };
        
        request.onerror = () => {
            console.error('Error saving task:', request.error);
        };
    };
    
    if (!db) {
        ensureDBReady().then(doSave);
    } else {
        doSave();
    }
}

// Calculate and store daily productivity scores
async function calculateDailyProductivity(date) {
    const dayTasks = tasks.filter(t => t.date === date);
    
    if (dayTasks.length === 0) return;
    
    // Calculate component scores
    let totalE = 0, totalD = 0, totalQ = 0, totalG = 0;
    
    dayTasks.forEach(task => {
        const taskObj = new Task(task);
        const components = taskObj.getProductivityComponents();
        
        totalE += components.effort;
        totalD += components.duration;
        totalQ += components.quality;
        totalG += components.goal;
    });
    
    // Average the scores
    const count = dayTasks.length;
    const avgE = totalE / count;
    const avgD = totalD / count;
    const avgQ = totalQ / count;
    const avgG = totalG / count;
    
    // Calculate composite score using default weights
    const weights = { e: 0.25, d: 0.25, q: 0.25, g: 0.25 };
    const compositeScore = weights.e * avgE + weights.d * avgD + weights.q * avgQ + weights.g * avgG;
    
    // Store in IndexedDB
    const productivityData = {
        date: date,
        week: getWeekNumber(new Date(date)),
        effort: avgE,
        duration: avgD,
        quality: avgQ,
        goal: avgG,
        composite: compositeScore,
        taskCount: count
    };
    
    const transaction = db.transaction(['productivity_scores'], 'readwrite');
    const store = transaction.objectStore('productivity_scores');
    store.put(productivityData);
    
    console.log(`Productivity score for ${date}: ${compositeScore.toFixed(1)}`);
}

// UI Functions
function openTaskModal() {
    document.getElementById('taskModal').classList.add('active');
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('taskDate').value = today;
}

function openGoalModal() {
    document.getElementById('goalModal').classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Quick add task
function quickAddTask() {
    const input = document.getElementById('quickTaskInput');
    const title = input.value.trim();
    
    if (!title) return;
    
    const task = new Task({
        title: title,
        date: new Date().toISOString().split('T')[0],
        priority: 'medium',
        category: 'personal'
    });
    
    saveTask(task);
    input.value = '';
}

// Add recurring task from template
function addRecurringTask(templateType) {
    const templates = {
        standup: {
            title: 'Daily Standup',
            time: '08:30',
            duration: 30,
            category: 'work',
            priority: 'high',
            recurring: 'weekdays'
        },
        gym: {
            title: 'Gym Workout',
            time: '18:00',
            duration: 90,
            category: 'fitness',
            priority: 'medium',
            recurring: 'mwf'
        },
        spanish: {
            title: 'Spanish Practice',
            time: '19:00',
            duration: 30,
            category: 'learning',
            priority: 'medium',
            recurring: 'daily'
        }
    };
    
    const template = templates[templateType];
    if (!template) return;
    
    // Add tasks for the next 7 days based on recurrence
    const today = new Date();
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        
        if (shouldAddRecurringTask(date, template.recurring)) {
            const task = new Task({
                ...template,
                date: date.toISOString().split('T')[0]
            });
            
            saveTask(task);
        }
    }
    
    showNotification(`${template.title} added to schedule`);
}

function shouldAddRecurringTask(date, pattern) {
    const day = date.getDay();
    
    switch(pattern) {
        case 'daily':
            return true;
        case 'weekdays':
            return day >= 1 && day <= 5;
        case 'mwf':
            return day === 1 || day === 3 || day === 5;
        case 'weekends':
            return day === 0 || day === 6;
        default:
            return false;
    }
}

// Calendar rendering
function renderCalendar() {
    const view = document.getElementById('calendarView');
    
    if (currentView === 'week') {
        renderWeekView();
    } else if (currentView === 'day') {
        renderDayView();
    } else {
        renderMonthView();
    }
}

function renderWeekView() {
    const startDate = getWeekStart(currentWeekOffset);
    const weekDates = [];
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        weekDates.push(date);
    }
    
    // Update week display
    const weekDisplay = document.getElementById('weekDisplay');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startMonth = monthNames[weekDates[0].getMonth()];
    const endMonth = monthNames[weekDates[6].getMonth()];
    const startDay = weekDates[0].getDate();
    const endDay = weekDates[6].getDate();
    const year = weekDates[0].getFullYear();
    
    if (startMonth === endMonth) {
        weekDisplay.textContent = `Week of ${startMonth} ${startDay}-${endDay}, ${year}`;
    } else {
        weekDisplay.textContent = `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
    }
    
    // Build calendar HTML (simplified for demo)
    // In a real implementation, this would dynamically generate all time slots
    updateTaskBlocks(weekDates);
}

function updateTaskBlocks(weekDates) {
    // Group tasks by date
    const tasksByDate = {};
    
    weekDates.forEach(date => {
        const dateStr = date.toISOString().split('T')[0];
        tasksByDate[dateStr] = tasks.filter(t => t.date === dateStr);
    });
    
    // Update calendar display with tasks
    // This would dynamically update the DOM in a real implementation
    console.log('Tasks grouped by date:', tasksByDate);
}

function getWeekStart(offset = 0) {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day + (offset * 7);
    return new Date(date.setDate(diff));
}

function navigateWeek(direction) {
    currentWeekOffset += direction;
    renderCalendar();
}

function goToToday() {
    currentWeekOffset = 0;
    renderCalendar();
}

function changeView(view) {
    currentView = view;
    
    // Update active button
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderCalendar();
}

// Goal rendering
function renderGoals() {
    const goalList = document.getElementById('goalList');
    goalList.innerHTML = '';
    
    goals.forEach(goal => {
        const li = document.createElement('li');
        li.className = 'goal-item';
        li.innerHTML = `
            <div class="goal-name">${goal.name}</div>
            <div class="goal-progress">${goal.completedTasks || 0}/${goal.totalTasks || 0} tasks completed</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${calculateGoalProgress(goal)}%"></div>
            </div>
        `;
        li.onclick = () => selectGoal(goal.id);
        goalList.appendChild(li);
    });
}

function calculateGoalProgress(goal) {
    if (!goal.totalTasks || goal.totalTasks === 0) return 0;
    return Math.round((goal.completedTasks / goal.totalTasks) * 100);
}

// Form handling
document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    
    // Task form submission
    document.getElementById('taskForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const task = new Task({
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            priority: selectedPriority,
            date: document.getElementById('taskDate').value,
            time: document.getElementById('taskTime').value,
            duration: parseInt(document.getElementById('taskDuration').value),
            category: document.getElementById('taskCategory').value,
            goalId: document.getElementById('taskGoal').value || null
        });
        
        saveTask(task);
        closeModal('taskModal');
        document.getElementById('taskForm').reset();
    });
    
    // Goal form submission
    document.getElementById('goalForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const goal = {
            name: document.getElementById('goalName').value,
            description: document.getElementById('goalDescription').value,
            deadline: document.getElementById('goalDeadline').value,
            category: document.getElementById('goalCategory').value,
            metric: document.getElementById('goalMetric').value,
            totalTasks: 0,
            completedTasks: 0,
            created: new Date().toISOString()
        };
        
        const transaction = db.transaction(['goals'], 'readwrite');
        const store = transaction.objectStore('goals');
        store.add(goal);
        
        transaction.oncomplete = () => {
            loadData();
            closeModal('goalModal');
            document.getElementById('goalForm').reset();
        };
    });
    
    // Priority selection
    document.querySelectorAll('.priority-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.priority-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            option.classList.add('selected');
            selectedPriority = option.dataset.priority;
        });
    });
    
    // Category filter
    document.querySelectorAll('.category-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.category-chip').forEach(c => {
                c.classList.remove('active');
            });
            chip.classList.add('active');
            filterTasksByCategory(chip.dataset.category);
        });
    });
});

// Export function to get productivity data for visualization
async function exportProductivityData() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['productivity_scores'], 'readonly');
        const store = transaction.objectStore('productivity_scores');
        const request = store.getAll();
        
        request.onsuccess = () => {
            const scores = request.result;
            
            // Format for parallel coordinates visualization
            const formattedData = scores.map(score => {
                const date = new Date(score.date);
                const dayOfWeek = date.getDay();
                
                return {
                    date: score.date,
                    dayOfWeek: dayOfWeek,
                    effort: score.effort,
                    duration: score.duration,
                    quality: score.quality,
                    goal: score.goal,
                    composite: score.composite
                };
            });
            
            resolve(formattedData);
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

// Integration with productivity visualization
function syncWithVisualization() {
    exportProductivityData().then(data => {
        // Store in localStorage for the visualization page to access
        localStorage.setItem('productivityData', JSON.stringify(data));
        
        showNotification('Data synced with analytics');
    });
}

// Utility functions
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function showNotification(message) {
    // Simple notification (could be replaced with a toast library)
    console.log('Notification:', message);
    
    // Create toast element
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 1rem 2rem;
        border-radius: 0.5rem;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 9999;
        animation: slideUp 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Auto-sync every 5 minutes
setInterval(syncWithVisualization, 5 * 60 * 1000);

// Initial sync on load
window.addEventListener('load', () => {
    setTimeout(syncWithVisualization, 1000);
});

// Load templates
function loadTemplates() {
    // Default templates if none exist
    const defaultTemplates = [
        {
            id: 1,
            type: 'work',
            title: 'Daily Standup',
            icon: '👥',
            schedule: 'Mon-Fri, 8:30 AM',
            duration: 30,
            priority: 'high',
            category: 'work'
        },
        {
            id: 2,
            type: 'fitness',
            title: 'Gym Workout',
            icon: '💪',
            schedule: 'Mon/Wed/Fri, 6:00 PM',
            duration: 90,
            priority: 'medium',
            category: 'fitness'
        },
        {
            id: 3,
            type: 'learning',
            title: 'Spanish Practice',
            icon: '📚',
            schedule: 'Daily, 7:00 PM',
            duration: 30,
            priority: 'medium',
            category: 'learning'
        },
        {
            id: 4,
            type: 'wellness',
            title: 'Morning Meditation',
            icon: '🧘',
            schedule: 'Daily, 7:00 AM',
            duration: 15,
            priority: 'low',
            category: 'wellness'
        }
    ];
    
    // Check if templates exist
    const transaction = db.transaction(['templates'], 'readonly');
    const store = transaction.objectStore('templates');
    const request = store.count();
    
    request.onsuccess = () => {
        if (request.result === 0) {
            // Add default templates
            const writeTransaction = db.transaction(['templates'], 'readwrite');
            const writeStore = writeTransaction.objectStore('templates');
            
            defaultTemplates.forEach(template => {
                writeStore.add(template);
            });
        }
    };
}

// ----- Lightweight CRUD helpers for other pages -----
function getAllTasks() {
    return new Promise((resolve, reject) => {
        const proceed = () => {
            const transaction = db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        };
        if (!db) ensureDBReady().then(proceed); else proceed();
    });
}

function getTaskById(id) {
    return new Promise((resolve, reject) => {
        const proceed = () => {
            const transaction = db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const request = store.get(Number(id));
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        };
        if (!db) ensureDBReady().then(proceed); else proceed();
    });
}

function updateTask(updatedTask) {
    if (!updatedTask || updatedTask.id == null) throw new Error('updateTask requires task with id');
    return new Promise((resolve, reject) => {
        const proceed = () => {
            const tx = db.transaction(['tasks'], 'readwrite');
            const store = tx.objectStore('tasks');
            const req = store.put(updatedTask);
            req.onsuccess = () => {
                loadData();
                calculateDailyProductivity(updatedTask.date);
                window.dispatchEvent(new CustomEvent('tasks-changed', { detail: { type: 'update', task: updatedTask } }));
                resolve(true);
            };
            req.onerror = () => reject(req.error);
        };
        if (!db) ensureDBReady().then(proceed); else proceed();
    });
}

function deleteTask(id) {
    return new Promise((resolve, reject) => {
        const proceed = () => {
            // Need the task date for productivity recalc; fetch first
            const tx1 = db.transaction(['tasks'], 'readonly');
            const store1 = tx1.objectStore('tasks');
            const req1 = store1.get(Number(id));
            req1.onsuccess = () => {
                const task = req1.result;
                const tx = db.transaction(['tasks'], 'readwrite');
                const store = tx.objectStore('tasks');
                const req = store.delete(Number(id));
                req.onsuccess = () => {
                    loadData();
                    if (task && task.date) calculateDailyProductivity(task.date);
                    window.dispatchEvent(new CustomEvent('tasks-changed', { detail: { type: 'delete', task: { id: Number(id) } } }));
                    resolve(true);
                };
                req.onerror = () => reject(req.error);
            };
            req1.onerror = () => reject(req1.error);
        };
        if (!db) ensureDBReady().then(proceed); else proceed();
    });
}

// Expose a tiny API for other pages to consume without duplicating DB logic
window.TaskAPI = {
    ensureDBReady,
    getAllTasks,
    getTaskById,
    saveTask, // accepts Task instance or plain object
    updateTask,
    deleteTask,
    Task // class for convenience
};