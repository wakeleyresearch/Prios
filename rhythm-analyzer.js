/**
 * Rhythm Analyzer Module
 * Implements circular statistics and consistency metrics for productivity rhythm scoring
 * Mathematical foundation: Von Mises distribution for circular data
 */

class RhythmAnalyzer {
    constructor(config = {}) {
        this.config = {
            idealSleepTime: config.idealSleepTime || "22:30",
            idealWakeTime: config.idealWakeTime || "06:30",
            idealWorkStart: config.idealWorkStart || "09:00",
            idealWorkEnd: config.idealWorkEnd || "17:00",
            weights: {
                sleep: 0.30,
                attendance: 0.20,
                task: 0.30,
                circadian: 0.20
            },
            ...config
        };
        
        // Convert ideal times to minutes for calculations
        this.ideals = {
            sleep: this.timeToMinutes(this.config.idealSleepTime),
            wake: this.timeToMinutes(this.config.idealWakeTime),
            workStart: this.timeToMinutes(this.config.idealWorkStart),
            workEnd: this.timeToMinutes(this.config.idealWorkEnd)
        };
    }
    
    /**
     * Main entry point - calculates composite rhythm score
     */
    async computeRhythmScore(data) {
        const components = {
            sleep: this.calculateSleepConsistency(data.sleepData || []),
            attendance: this.calculateAttendanceConsistency(data.attendanceData || []),
            task: this.calculateTaskCompletionConsistency(data.taskData || []),
            circadian: this.calculateCircadianAlignment(data.activityData || [])
        };
        
        // Weighted harmonic mean to emphasize weakest component
        const weights = this.config.weights;
        let harmonicSum = 0;
        let weightSum = 0;
        
        for (const [key, value] of Object.entries(components)) {
            if (value > 0) {
                harmonicSum += weights[key] / value;
                weightSum += weights[key];
            }
        }
        
        const compositeScore = weightSum > 0 ? weightSum / harmonicSum : 0;
        
        return {
            composite: Math.min(100, Math.max(0, compositeScore * 100)),
            components: {
                sleep: components.sleep * 100,
                attendance: components.attendance * 100,
                task: components.task * 100,
                circadian: components.circadian * 100
            },
            insights: this.generateInsights(components)
        };
    }
    
    /**
     * Sleep consistency using circular statistics
     */
    calculateSleepConsistency(sleepData) {
        if (!sleepData || sleepData.length === 0) return 0.5;
        
        // Convert times to radians
        const sleepRadians = sleepData.map(d => this.timeToRadians(d.sleepTime));
        const wakeRadians = sleepData.map(d => this.timeToRadians(d.wakeTime));
        
        // Calculate circular mean and variance
        const sleepStats = this.circularStatistics(sleepRadians);
        const wakeStats = this.circularStatistics(wakeRadians);
        
        // Calculate deviation from ideal times
        const sleepDeviation = this.circularDistance(
            sleepStats.mean,
            this.timeToRadians(this.ideals.sleep)
        );
        const wakeDeviation = this.circularDistance(
            wakeStats.mean,
            this.timeToRadians(this.ideals.wake)
        );
        
        // Consistency score based on circular variance (lower is better)
        const consistencyScore = Math.exp(-2 * (sleepStats.variance + wakeStats.variance));
        
        // Alignment score based on deviation from ideal
        const alignmentScore = Math.exp(-0.5 * (sleepDeviation + wakeDeviation));
        
        return 0.6 * consistencyScore + 0.4 * alignmentScore;
    }
    
    /**
     * Attendance consistency with streak analysis
     */
    calculateAttendanceConsistency(attendanceData) {
        if (!attendanceData || attendanceData.length === 0) return 0.5;
        
        // Calculate streaks
        const streaks = [];
        let currentStreak = 0;
        
        attendanceData.forEach(record => {
            if (record.onTime) {
                currentStreak++;
            } else {
                if (currentStreak > 0) {
                    streaks.push(currentStreak);
                }
                currentStreak = 0;
            }
        });
        
        if (currentStreak > 0) {
            streaks.push(currentStreak);
        }
        
        // Base rate
        const baseRate = attendanceData.filter(r => r.onTime).length / attendanceData.length;
        
        // Streak bonus (logarithmic to prevent gaming)
        const streakBonus = streaks.length > 0
            ? streaks.reduce((sum, s) => sum + Math.log1p(s), 0) / attendanceData.length
            : 0;
        
        // Calculate irregularity penalty
        const absences = attendanceData
            .map((r, i) => r.onTime ? null : i)
            .filter(i => i !== null);
        
        let irregularityPenalty = 0;
        if (absences.length > 1) {
            const gaps = [];
            for (let i = 1; i < absences.length; i++) {
                gaps.push(absences[i] - absences[i-1]);
            }
            const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
            const stdGap = Math.sqrt(
                gaps.reduce((sum, g) => sum + Math.pow(g - meanGap, 2), 0) / gaps.length
            );
            irregularityPenalty = meanGap > 0 ? stdGap / meanGap : 0;
        }
        
        return Math.min(1.0, baseRate + 0.2 * streakBonus - 0.1 * irregularityPenalty);
    }
    
    /**
     * Task completion consistency analysis
     */
    calculateTaskCompletionConsistency(taskData) {
        if (!taskData || taskData.length === 0) return 0.5;
        
        // Group by day and calculate daily completion rates
        const dailyRates = {};
        taskData.forEach(task => {
            const date = task.date;
            if (!dailyRates[date]) {
                dailyRates[date] = { completed: 0, total: 0 };
            }
            dailyRates[date].total++;
            if (task.completed) {
                dailyRates[date].completed++;
            }
        });
        
        const rates = Object.values(dailyRates).map(d => d.completed / d.total);
        
        if (rates.length === 0) return 0.5;
        
        // Calculate coefficient of variation
        const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
        const variance = rates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rates.length;
        const cv = Math.sqrt(variance) / (mean + 0.001);
        
        // Convert to score (inverse sigmoid)
        const consistencyScore = 1 / (1 + Math.exp(5 * (cv - 0.5)));
        
        // Trend analysis (reward improving trend)
        let trendBonus = 0;
        if (rates.length > 7) {
            const trend = this.calculateTrend(rates);
            trendBonus = Math.tanh(trend * 10);
        }
        
        // Weekly pattern detection (penalize high variation)
        let periodicityScore = 0.5;
        if (rates.length > 14) {
            periodicityScore = 1 - this.detectWeeklyPattern(rates);
        }
        
        return 0.5 * consistencyScore + 0.3 * periodicityScore + 0.2 * Math.max(0, trendBonus);
    }
    
    /**
     * Circadian rhythm alignment scoring
     */
    calculateCircadianAlignment(activityData) {
        if (!activityData || activityData.length === 0) return 0.5;
        
        // Extract hour distribution
        const hourDistribution = new Array(24).fill(0);
        activityData.forEach(activity => {
            const hour = new Date(activity.timestamp).getHours();
            hourDistribution[hour]++;
        });
        
        // Normalize distribution
        const total = hourDistribution.reduce((a, b) => a + b, 0);
        const normalized = hourDistribution.map(h => h / total);
        
        // Define optimal activity windows
        const optimalWindows = {
            morningPeak: { start: 10, end: 12, weight: 0.3 },
            afternoonPeak: { start: 16, end: 18, weight: 0.3 },
            postLunchDip: { start: 13, end: 15, weight: -0.2 },  // Negative weight
            lateNight: { start: 23, end: 5, weight: -0.5 }       // Strong penalty
        };
        
        let alignmentScore = 0.5;  // Base score
        
        for (const [period, config] of Object.entries(optimalWindows)) {
            let periodActivity = 0;
            for (let hour = config.start; hour <= config.end; hour++) {
                const h = hour % 24;
                periodActivity += normalized[h];
            }
            alignmentScore += config.weight * periodActivity;
        }
        
        return Math.min(1.0, Math.max(0, alignmentScore));
    }
    
    /**
     * Utility Functions
     */
    
    timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    timeToRadians(timeStr) {
        const minutes = typeof timeStr === 'string' ? this.timeToMinutes(timeStr) : timeStr;
        return (minutes / (24 * 60)) * 2 * Math.PI;
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
        
        // Circular mean
        const mean = Math.atan2(meanSin, meanCos);
        
        // Circular variance (1 - R, where R is resultant length)
        const R = Math.sqrt(meanSin * meanSin + meanCos * meanCos);
        const variance = 1 - R;
        
        // Circular standard deviation
        const stdDev = Math.sqrt(-2 * Math.log(R));
        
        return { mean, variance, stdDev, resultantLength: R };
    }
    
    circularDistance(angle1, angle2) {
        const diff = Math.abs(angle1 - angle2);
        return Math.min(diff, 2 * Math.PI - diff);
    }
    
    calculateTrend(values) {
        const n = values.length;
        const x = Array.from({length: n}, (_, i) => i);
        const y = values;
        
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return slope;
    }
    
    detectWeeklyPattern(values) {
        if (values.length < 14) return 0;
        
        // Simple FFT approximation for weekly pattern
        const weeklyFreq = 7;
        let weeklyComponent = 0;
        
        for (let i = 0; i < values.length - weeklyFreq; i++) {
            weeklyComponent += Math.abs(values[i] - values[i + weeklyFreq]);
        }
        
        return weeklyComponent / (values.length - weeklyFreq);
    }
    
    generateInsights(components) {
        const insights = [];
        
        // Sleep insights
        if (components.sleep < 0.5) {
            insights.push({
                type: 'warning',
                category: 'sleep',
                message: 'Your sleep schedule is inconsistent. Try to maintain regular sleep/wake times.'
            });
        } else if (components.sleep > 0.8) {
            insights.push({
                type: 'success',
                category: 'sleep',
                message: 'Excellent sleep consistency! This supports sustained productivity.'
            });
        }
        
        // Task completion insights
        if (components.task < 0.4) {
            insights.push({
                type: 'warning',
                category: 'task',
                message: 'Task completion varies significantly. Consider time-blocking for consistency.'
            });
        }
        
        // Circadian insights
        if (components.circadian < 0.5) {
            insights.push({
                type: 'info',
                category: 'circadian',
                message: 'Your activity patterns could better align with natural productivity peaks.'
            });
        }
        
        return insights;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RhythmAnalyzer;
}
