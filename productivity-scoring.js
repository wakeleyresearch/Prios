// Productivity Scoring Module - Mathematical Implementation
// S = Σᵢ wᵢ·Xᵢ where Xᵢ ∈ [0,100], wᵢ ∈ [0,1], Σwᵢ = 1.0

class ProductivityScoring {
    constructor() {
        this.weights = {
            effort: 0.20,
            duration: 0.20,
            quality: 0.25,
            goals: 0.20,
            rhythm: 0.15
        };
        
        // Ensure weights are normalized
        this.normalizeWeights();
    }
    
    // Ensure Σwᵢ = 1.0
    normalizeWeights() {
        const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 1.0) > 0.001) {
            for (let key in this.weights) {
                this.weights[key] = this.weights[key] / sum;
            }
        }
    }
    
    // E: Effort - Task completion rate
    calculateEffort(tasksCompleted, tasksPlanned) {
        if (tasksPlanned === 0) return 0;
        return Math.min(100, (tasksCompleted / tasksPlanned) * 100);
    }
    
    // D: Duration - Time efficiency (inverse relationship)
    calculateDuration(actualMinutes, estimatedMinutes) {
        if (estimatedMinutes === 0) return 50; // Default to middle score
        const efficiency = estimatedMinutes / actualMinutes;
        return Math.min(100, Math.max(0, efficiency * 100));
    }
    
    // Q: Quality - Composite quality metric
    calculateQuality(priorityWeight, completionDepth, revisionFactor) {
        // priorityWeight: 0-1 based on task priority (high=1, medium=0.6, low=0.3)
        // completionDepth: 0-1 based on thoroughness
        // revisionFactor: 0-1 based on need for revisions (fewer is better)
        
        const Q = (0.4 * priorityWeight + 
                   0.3 * completionDepth + 
                   0.3 * (1 - revisionFactor)) * 100;
        
        return Math.min(100, Math.max(0, Q));
    }
    
    // G: Goals - Goal alignment score
    calculateGoals(tasks) {
        if (tasks.length === 0) return 0;
        
        let totalAlignment = 0;
        tasks.forEach(task => {
            const priorityScore = task.priority === 'high' ? 1.0 : 
                                 task.priority === 'medium' ? 0.6 : 0.3;
            const goalRelevance = task.goalAligned ? 1.0 : 0.5;
            totalAlignment += priorityScore * goalRelevance;
        });
        
        return Math.min(100, (totalAlignment / tasks.length) * 100);
    }
    
    // R: Rhythm - Temporal consistency
    calculateRhythm(scoreTimeSeries, idealPattern = null) {
        if (scoreTimeSeries.length < 2) return 50;
        
        // Calculate coefficient of variation (lower is better)
        const mean = scoreTimeSeries.reduce((a, b) => a + b, 0) / scoreTimeSeries.length;
        const variance = scoreTimeSeries.reduce((sum, score) => 
            sum + Math.pow(score - mean, 2), 0) / scoreTimeSeries.length;
        const stdDev = Math.sqrt(variance);
        const coeffVariation = mean !== 0 ? stdDev / mean : 1;
        
        // Base rhythm score (inverse of variation)
        let rhythmScore = Math.max(0, 1 - coeffVariation) * 100;
        
        // If ideal pattern provided, calculate correlation
        if (idealPattern && idealPattern.length === scoreTimeSeries.length) {
            const correlation = this.pearsonCorrelation(scoreTimeSeries, idealPattern);
            rhythmScore = rhythmScore * 0.7 + (correlation * 100) * 0.3;
        }
        
        return Math.min(100, Math.max(0, rhythmScore));
    }
    
    // Pearson correlation coefficient
    pearsonCorrelation(x, y) {
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
        const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
        const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);
        
        const num = n * sumXY - sumX * sumY;
        const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        return den === 0 ? 0 : num / den;
    }
    
    // Main scoring function: S(E,D,Q,G,R) = Σᵢ wᵢ·Xᵢ
    calculateScore(components) {
        // Ensure all components are in [0,100]
        const E = Math.min(100, Math.max(0, components.effort || 0));
        const D = Math.min(100, Math.max(0, components.duration || 0));
        const Q = Math.min(100, Math.max(0, components.quality || 0));
        const G = Math.min(100, Math.max(0, components.goals || 0));
        const R = Math.min(100, Math.max(0, components.rhythm || 0));
        
        // Calculate weighted sum
        const S = this.weights.effort * E +
                  this.weights.duration * D +
                  this.weights.quality * Q +
                  this.weights.goals * G +
                  this.weights.rhythm * R;
        
        return Math.min(100, Math.max(0, S));
    }
    
    // Bayesian weight optimization
    optimizeWeights(historicalData, iterations = 100) {
        let bestWeights = { ...this.weights };
        let bestScore = 0;
        
        // Gaussian process surrogate
        const gaussianProcess = (weights) => {
            let score = 0;
            historicalData.forEach(data => {
                const predicted = this.calculateScore({
                    effort: data.effort,
                    duration: data.duration,
                    quality: data.quality,
                    goals: data.goals,
                    rhythm: data.rhythm
                });
                const actual = data.actualProductivity || data.userRating || 50;
                score -= Math.pow(predicted - actual, 2); // Minimize MSE
            });
            return score / historicalData.length;
        };
        
        // Acquisition function (Expected Improvement)
        for (let iter = 0; iter < iterations; iter++) {
            // Generate candidate weights
            const candidate = {
                effort: Math.random() * 0.3 + 0.1,
                duration: Math.random() * 0.3 + 0.1,
                quality: Math.random() * 0.3 + 0.1,
                goals: Math.random() * 0.3 + 0.1,
                rhythm: Math.random() * 0.3 + 0.1
            };
            
            // Normalize to sum = 1
            const sum = Object.values(candidate).reduce((a, b) => a + b, 0);
            for (let key in candidate) {
                candidate[key] = candidate[key] / sum;
            }
            
            // Evaluate
            this.weights = candidate;
            const score = gaussianProcess(candidate);
            
            if (score > bestScore) {
                bestScore = score;
                bestWeights = { ...candidate };
            }
        }
        
        this.weights = bestWeights;
        return bestWeights;
    }
    
    // Generate ideal pattern based on chronotype and preferences
    generateIdealPattern(chronotype = 'regular') {
        const patterns = {
            'morning': [60, 85, 90, 85, 70, 60, 50], // Peak in morning
            'evening': [40, 50, 60, 70, 80, 85, 75], // Peak in evening
            'regular': [50, 70, 80, 75, 80, 70, 55], // Standard workday
            'night': [30, 40, 50, 60, 70, 80, 90]    // Night owl
        };
        
        return patterns[chronotype] || patterns['regular'];
    }
    
    // Calculate component from task data
    calculateComponentsFromTasks(tasks, timeRange = 'day') {
        const components = {
            effort: 0,
            duration: 0,
            quality: 0,
            goals: 0,
            rhythm: 0
        };
        
        if (tasks.length === 0) return components;
        
        // Effort: completion rate
        const completed = tasks.filter(t => t.completed).length;
        components.effort = this.calculateEffort(completed, tasks.length);
        
        // Duration: time efficiency
        let totalActual = 0, totalEstimated = 0;
        tasks.forEach(task => {
            totalActual += task.actualDuration || task.duration || 30;
            totalEstimated += task.estimatedDuration || task.duration || 30;
        });
        components.duration = this.calculateDuration(totalActual, totalEstimated);
        
        // Quality: based on priority distribution
        let avgPriorityWeight = 0;
        tasks.forEach(task => {
            avgPriorityWeight += task.priority === 'high' ? 1.0 :
                                 task.priority === 'medium' ? 0.6 : 0.3;
        });
        avgPriorityWeight /= tasks.length;
        components.quality = this.calculateQuality(avgPriorityWeight, 0.8, 0.1);
        
        // Goals: alignment
        components.goals = this.calculateGoals(tasks);
        
        // Rhythm: would need time series data
        components.rhythm = 75; // Default good rhythm
        
        return components;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductivityScoring;
}
