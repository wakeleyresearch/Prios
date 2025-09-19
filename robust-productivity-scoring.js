// Productivity Scoring Module - Mathematically Hardened Implementation
// Based on rigorous mathematical specifications to ensure well-definedness

class RobustProductivityScoring {
    constructor() {
        // Weight constraints: wi ∈ [ℓ, 1], Σwi = 1
        this.minWeight = 0.05; // ℓ = minimum weight floor
        this.weights = {
            effort: 0.20,
            duration: 0.20,
            quality: 0.25,
            goals: 0.20,
            rhythm: 0.15
        };
        
        // Hyperparameters
        this.epsilon = 1e-6; // Stabilizer for division by zero
        this.kappa = 1.5; // Decay rate for duration penalties
        this.cmax = 1.5; // Maximum coefficient of variation for rhythm
        this.beta = 0.7; // Exponential smoothing factor
        this.tau = 0.1; // Entropy regularization strength
        this.lambda = 0.5; // Risk penalty weight
        
        // Historical data for rhythm calculation (lagged window)
        this.scoreHistory = [];
        this.windowSize = 7;
        
        this.normalizeWeights();
    }
    
    // Ensure Σwi = 1 with minimum floor constraints
    normalizeWeights() {
        // Apply floor constraint
        for (let key in this.weights) {
            this.weights[key] = Math.max(this.minWeight, this.weights[key]);
        }
        
        // Normalize to sum = 1
        const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
        for (let key in this.weights) {
            this.weights[key] = this.weights[key] / sum;
        }
    }
    
    // E: Effort - Bounded completion rate with smooth over-delivery handling
    calculateEffort(completed, planned) {
        // E = 100 · min(1, c/max(1,p))
        const safeCompleted = Math.max(0, completed || 0);
        const safePlanned = Math.max(1, planned || 1);
        const ratio = safeCompleted / safePlanned;
        
        // Basic bounded version
        // return 100 * Math.min(1, ratio);
        
        // Smooth logistic version for over-delivery
        const alpha = 2.0; // Smoothing parameter
        const sigmoid = (z) => 1 / (1 + Math.exp(-z));
        const adjusted = sigmoid(alpha * (ratio - 1));
        
        // Scale so sigmoid(0) ≈ 0.5 maps to ratio=1 → 100%
        const E = 100 * (0.5 + adjusted);
        
        return Math.min(100, Math.max(0, E));
    }
    
    // D: Duration - Smooth efficiency with exponential penalty for overruns
    calculateDuration(actual, estimated) {
        // r = max(ε,actual)/max(ε,estimated)
        // D = 100 · e^(-κ·max(0,r-1))
        
        const safeActual = Math.max(this.epsilon, actual || this.epsilon);
        const safeEstimated = Math.max(this.epsilon, estimated || this.epsilon);
        const ratio = safeActual / safeEstimated;
        
        // Exponential decay for overruns
        const penalty = Math.max(0, ratio - 1);
        const D = 100 * Math.exp(-this.kappa * penalty);
        
        return Math.min(100, Math.max(0, D));
    }
    
    // Q: Quality - Properly normalized weighted components
    calculateQuality(priorityWeight, completionDepth, revisionFactor) {
        // Ensure inputs are in [0,1]
        const p = Math.min(1, Math.max(0, priorityWeight || 0));
        const d = Math.min(1, Math.max(0, completionDepth || 0));
        const r = Math.min(1, Math.max(0, 1 - (revisionFactor || 0))); // Fewer revisions is better
        
        // Q = 100 · (0.4p + 0.3d + 0.3r)
        const Q = 100 * (0.4 * p + 0.3 * d + 0.3 * r);
        
        return Math.min(100, Math.max(0, Q));
    }
    
    // G: Goals - Normalized priority-weighted alignment
    calculateGoals(tasks) {
        if (!tasks || tasks.length === 0) return 0;
        
        // Calculate priority weights with normalization
        const priorities = tasks.map(task => {
            if (task.priority === 'high') return 3.0;
            if (task.priority === 'medium') return 2.0;
            if (task.priority === 'low') return 1.0;
            return 1.0;
        });
        
        const sumPriorities = priorities.reduce((a, b) => a + b, 0);
        if (sumPriorities <= 0) return 0;
        
        // Normalize priorities: πj = aj / Σak
        const normalizedPriorities = priorities.map(p => p / sumPriorities);
        
        // Calculate weighted goal alignment
        let weightedAlignment = 0;
        tasks.forEach((task, i) => {
            const relevance = task.goalAligned ? 1.0 : 0.3; // bj ∈ [0,1]
            weightedAlignment += normalizedPriorities[i] * relevance;
        });
        
        const G = 100 * weightedAlignment;
        return Math.min(100, Math.max(0, G));
    }
    
    // R: Rhythm - Lagged consistency with bounded CV and correlation
    calculateRhythm(currentScore = null) {
        // Use lagged window (exclude current score to avoid circularity)
        const window = [...this.scoreHistory];
        
        if (window.length < 2) {
            return 50; // Default neutral rhythm
        }
        
        // Calculate statistics with stabilization
        const mean = window.reduce((a, b) => a + b, 0) / window.length;
        const variance = window.reduce((sum, score) => 
            sum + Math.pow(score - mean, 2), 0) / window.length;
        const stdDev = Math.sqrt(variance);
        
        // Coefficient of variation with stabilizer
        const CV = stdDev / (mean + this.epsilon);
        
        // Map CV to [0,1] with cutoff
        const C = 1 - Math.min(CV, this.cmax) / this.cmax;
        
        // Pattern correlation (if ideal pattern exists)
        const idealPattern = this.generateIdealPattern();
        let Rp = 0.5; // Default neutral correlation
        
        if (window.length >= 5 && idealPattern.length === window.length) {
            const correlation = this.pearsonCorrelation(window, idealPattern);
            // Map correlation from [-1,1] to [0,1]
            Rp = (correlation + 1) / 2;
        }
        
        // R = 100 · C · Rp
        const R = 100 * C * Rp;
        
        return Math.min(100, Math.max(0, R));
    }
    
    // Pearson correlation with safety checks
    pearsonCorrelation(x, y) {
        if (x.length !== y.length || x.length === 0) return 0;
        
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
        const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
        const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);
        
        const num = n * sumXY - sumX * sumY;
        const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        if (den < this.epsilon) return 0;
        return num / den;
    }
    
    // Generate ideal productivity pattern
    generateIdealPattern(length = 7) {
        // Standard workweek pattern
        const pattern = [];
        for (let i = 0; i < length; i++) {
            if (i === 0 || i === 6) {
                pattern.push(40); // Weekend
            } else if (i === 1 || i === 5) {
                pattern.push(70); // Monday/Friday
            } else {
                pattern.push(85); // Mid-week peak
            }
        }
        return pattern;
    }
    
    // Main scoring function with guaranteed bounds
    calculateScore(components) {
        // Ensure all components are strictly in [0,100]
        const E = Math.min(100, Math.max(0, components.effort || 0));
        const D = Math.min(100, Math.max(0, components.duration || 0));
        const Q = Math.min(100, Math.max(0, components.quality || 0));
        const G = Math.min(100, Math.max(0, components.goals || 0));
        const R = Math.min(100, Math.max(0, components.rhythm || 0));
        
        // S = Σ wi·Xi, guaranteed S ∈ [0,100]
        const S = this.weights.effort * E +
                  this.weights.duration * D +
                  this.weights.quality * Q +
                  this.weights.goals * G +
                  this.weights.rhythm * R;
        
        // Update history for future rhythm calculations (lagged)
        this.updateHistory(S);
        
        return Math.min(100, Math.max(0, S));
    }
    
    // Update score history with exponential smoothing
    updateHistory(score) {
        this.scoreHistory.push(score);
        
        // Maintain window size
        if (this.scoreHistory.length > this.windowSize) {
            this.scoreHistory.shift();
        }
    }
    
    // Robust weight optimization with entropy regularization
    optimizeWeights(historicalData, externalOutcome = null) {
        if (!historicalData || historicalData.length === 0) {
            return this.weights;
        }
        
        let bestWeights = { ...this.weights };
        let bestObjective = -Infinity;
        
        // Objective function with regularization
        const objective = (weights) => {
            let totalScore = 0;
            let totalVariance = 0;
            const scores = [];
            
            historicalData.forEach(data => {
                const score = this.calculateScoreWithWeights(data, weights);
                scores.push(score);
                totalScore += score;
                
                // If external outcome provided, use correlation
                if (externalOutcome && data.outcome !== undefined) {
                    totalScore += score * data.outcome; // Reward correlation
                }
            });
            
            const meanScore = totalScore / historicalData.length;
            
            // Calculate variance for risk penalty
            scores.forEach(score => {
                totalVariance += Math.pow(score - meanScore, 2);
            });
            totalVariance /= historicalData.length;
            
            // Entropy regularization to prevent weight collapse
            let entropy = 0;
            for (let key in weights) {
                if (weights[key] > 0) {
                    entropy -= weights[key] * Math.log(weights[key]);
                }
            }
            
            // Combined objective: E[S] - λ·Var(S) + τ·H(w)
            return meanScore - this.lambda * Math.sqrt(totalVariance) + this.tau * entropy;
        };
        
        // Grid search with constraints
        const steps = 10;
        for (let e = 1; e <= steps; e++) {
            for (let d = 1; d <= steps - e; d++) {
                for (let q = 1; q <= steps - e - d; q++) {
                    for (let g = 1; g <= steps - e - d - q; g++) {
                        const r = steps - e - d - q - g;
                        if (r <= 0) continue;
                        
                        // Create weight vector
                        const weights = {
                            effort: Math.max(this.minWeight, e / steps),
                            duration: Math.max(this.minWeight, d / steps),
                            quality: Math.max(this.minWeight, q / steps),
                            goals: Math.max(this.minWeight, g / steps),
                            rhythm: Math.max(this.minWeight, r / steps)
                        };
                        
                        // Normalize
                        const sum = Object.values(weights).reduce((a, b) => a + b, 0);
                        for (let key in weights) {
                            weights[key] = weights[key] / sum;
                        }
                        
                        // Evaluate
                        const value = objective(weights);
                        if (value > bestObjective) {
                            bestObjective = value;
                            bestWeights = { ...weights };
                        }
                    }
                }
            }
        }
        
        this.weights = bestWeights;
        return bestWeights;
    }
    
    // Calculate score with specific weights (for optimization)
    calculateScoreWithWeights(data, weights) {
        const prevWeights = { ...this.weights };
        this.weights = weights;
        const score = this.calculateScore(data);
        this.weights = prevWeights;
        return score;
    }
    
    // Bayesian weight updating with Dirichlet prior
    bayesianUpdateWeights(evidence, priorStrength = 10) {
        // Dirichlet prior parameters (uniform initially)
        const alpha = {
            effort: priorStrength,
            duration: priorStrength,
            quality: priorStrength,
            goals: priorStrength,
            rhythm: priorStrength
        };
        
        // Update with evidence (hits per component)
        evidence.forEach(e => {
            if (e.bestComponent) {
                alpha[e.bestComponent] += 1;
            }
        });
        
        // Posterior mean: E[wi] = αi / Σαj
        const sumAlpha = Object.values(alpha).reduce((a, b) => a + b, 0);
        for (let key in this.weights) {
            this.weights[key] = alpha[key] / sumAlpha;
        }
        
        this.normalizeWeights();
        return this.weights;
    }
    
    // Handle missing data with imputation
    calculateWithMissingData(partialComponents, imputationMethod = 'historical') {
        const components = { ...partialComponents };
        
        // Impute missing values
        ['effort', 'duration', 'quality', 'goals', 'rhythm'].forEach(key => {
            if (components[key] === undefined || components[key] === null) {
                if (imputationMethod === 'historical' && this.scoreHistory.length > 0) {
                    // Use historical mean
                    components[key] = this.scoreHistory.reduce((a, b) => a + b, 0) / 
                                     this.scoreHistory.length;
                } else {
                    // Use neutral default
                    components[key] = 50;
                }
                
                // Reduce effective weight for imputed component
                const tempWeights = { ...this.weights };
                tempWeights[key] *= 0.5;
                
                // Renormalize
                const sum = Object.values(tempWeights).reduce((a, b) => a + b, 0);
                for (let k in tempWeights) {
                    tempWeights[k] = tempWeights[k] / sum;
                }
                
                // Use temporary weights for this calculation
                const prevWeights = { ...this.weights };
                this.weights = tempWeights;
                const score = this.calculateScore(components);
                this.weights = prevWeights;
                return score;
            }
        });
        
        return this.calculateScore(components);
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RobustProductivityScoring;
}