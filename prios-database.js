// Prios Unified Database Layer
class PriosDatabase {
    constructor() {
        this.collections = {
            tasks: 'priosTasks',
            goals: 'priosGoals',
            reflections: 'priosReflections',
            scores: 'priosScores',
            settings: 'priosSettings'
        };
        
        this.listeners = {};
        this.scoring = new RobustProductivityScoring();
    }
    
    // Centralized task creation with automatic scoring
    createTask(taskData) {
        const task = {
            id: Date.now(),
            createdAt: new Date().toISOString(),
            ...taskData,
            components: this.calculateTaskComponents(taskData)
        };
        
        const tasks = this.getTasks();
        tasks.push(task);
        this.save('tasks', tasks);
        
        // Trigger score recalculation
        this.updateProductivityScore();
        this.emit('taskCreated', task);
        
        return task;
    }
    
    // Calculate components for a task
    calculateTaskComponents(task) {
        return {
            effort: task.completed ? 100 : 0,
            duration: this.scoring.calculateDuration(
                task.actualDuration || task.duration,
                task.estimatedDuration || task.duration
            ),
            quality: this.scoring.calculateQuality(
                task.priority === 'high' ? 1.0 : task.priority === 'medium' ? 0.6 : 0.3,
                task.completionDepth || 0.8,
                task.revisions || 0
            ),
            goals: task.goalAligned ? 100 : 50,
            rhythm: this.scoring.calculateRhythm()
        };
    }
    
    // Update overall productivity score
    updateProductivityScore() {
        const tasks = this.getTasks();
        const today = new Date().toISOString().split('T')[0];
        const todayTasks = tasks.filter(t => t.date === today);
        
        // Calculate aggregate components
        const components = this.scoring.calculateComponentsFromTasks(todayTasks);
        const score = this.scoring.calculateScore(components);
        
        // Store score
        const scores = this.getScores();
        scores.push({
            date: today,
            score: score,
            components: components,
            timestamp: new Date().toISOString()
        });
        
        // Keep last 30 days
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const filtered = scores.filter(s => new Date(s.timestamp) > cutoff);
        this.save('scores', filtered);
        
        this.emit('scoreUpdated', { score, components });
        return score;
    }
    
    // Process reflection with NLP
    processReflection(reflectionData) {
        const reflection = {
            id: Date.now(),
            ...reflectionData,
            timestamp: new Date().toISOString()
        };
        
        // Extract tasks if journal mode
        if (reflection.mode === 'journal' && reflection.journal) {
            reflection.extractedTasks = this.extractTasksFromText(reflection.journal);
            
            // Auto-create tasks
            reflection.extractedTasks.forEach(taskData => {
                this.createTask({
                    ...taskData,
                    source: 'reflection',
                    reflectionId: reflection.id
                });
            });
        }
        
        const reflections = this.getReflections();
        reflections.push(reflection);
        this.save('reflections', reflections);
        
        // Update rhythm component based on consistency
        this.updateRhythmFromReflections();
        
        this.emit('reflectionProcessed', reflection);
        return reflection;
    }
    
    // Update rhythm based on reflection consistency
    updateRhythmFromReflections() {
        const reflections = this.getReflections();
        const last7Days = reflections.slice(-7);
        
        if (last7Days.length >= 5) {
            // Check for daily reflection habit
            const consistency = last7Days.filter(r => r.mood && r.sleep).length / 7;
            
            // Update scoring engine's rhythm history
            const rhythmBonus = consistency * 20; // Up to 20 point bonus
            this.scoring.updateHistory(50 + rhythmBonus);
        }
    }
    
    // Extract tasks from natural language
    extractTasksFromText(text) {
        const tasks = [];
        const patterns = [
            /(?:worked on|completed|finished)\s+(.+?)\s+for\s+(\d+(?:\.\d+)?)\s*(hours?|mins?)/gi,
            /spent\s+(\d+(?:\.\d+)?)\s*(hours?|mins?)\s+on\s+(.+?)(?:\.|,|;|$)/gi
        ];
        
        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const taskName = match[1] || match[3];
                const duration = parseFloat(match[2] || match[1]);
                const unit = match[3] || match[2];
                
                const minutes = unit?.includes('hour') ? duration * 60 : duration;
                
                tasks.push({
                    title: taskName.trim(),
                    duration: Math.round(minutes),
                    completed: true,
                    priority: this.inferPriority(taskName)
                });
            }
        });
        
        return tasks;
    }
    
    // Infer task priority from keywords
    inferPriority(taskName) {
        const high = /urgent|critical|important|deadline/i;
        const low = /minor|optional|maybe|sometime/i;
        
        if (high.test(taskName)) return 'high';
        if (low.test(taskName)) return 'low';
        return 'medium';
    }
    
    // Optimize weights based on historical performance
    optimizeWeights() {
        const tasks = this.getTasks();
        const scores = this.getScores();
        
        // Prepare historical data
        const historicalData = scores.map(s => ({
            ...s.components,
            outcome: s.userRating || s.score // Use user rating if available
        }));
        
        // Run optimization
        const optimizedWeights = this.scoring.optimizeWeights(historicalData);
        
        // Save to settings
        this.updateSettings({ componentWeights: optimizedWeights });
        
        this.emit('weightsOptimized', optimizedWeights);
        return optimizedWeights;
    }
    
    // Data access methods
    getTasks() {
        return JSON.parse(localStorage.getItem(this.collections.tasks) || '[]');
    }
    
    getGoals() {
        return JSON.parse(localStorage.getItem(this.collections.goals) || '[]');
    }
    
    getReflections() {
        return JSON.parse(localStorage.getItem(this.collections.reflections) || '[]');
    }
    
    getScores() {
        return JSON.parse(localStorage.getItem(this.collections.scores) || '[]');
    }
    
    getSettings() {
        return JSON.parse(localStorage.getItem(this.collections.settings) || '{}');
    }
    
    updateSettings(updates) {
        const settings = this.getSettings();
        Object.assign(settings, updates);
        this.save('settings', settings);
        this.emit('settingsUpdated', settings);
        return settings;
    }
    
    save(collection, data) {
        localStorage.setItem(this.collections[collection], JSON.stringify(data));
    }
    
    // Event system
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }
    
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
}

// Global instance
const priosDB = new PriosDatabase();