/**
 * Rhythm Component Testing Suite
 * Comprehensive tests for rhythm scoring and integration
 */

class RhythmTester {
    constructor() {
        this.testResults = [];
        this.rhythmAnalyzer = null;
        this.integration = null;
    }

    async runAllTests() {
        console.log('🧪 Starting Rhythm Component Test Suite...\n');
        
        this.rhythmAnalyzer = new RhythmAnalyzer();
        this.integration = new ProductivityIntegration();
        
        const tests = [
            this.testCircularStatistics,
            this.testSleepConsistencyScoring,
            this.testAttendanceStreaks,
            this.testTaskConsistencyCalculation,
            this.testCircadianAlignment,
            this.testCompositeRhythmScore,
            this.testWeightNormalization,
            this.testDatabaseIntegration,
            this.testVisualizationData,
            this.testEdgeCases
        ];
        
        let passed = 0;
        let failed = 0;
        
        for (const test of tests) {
            try {
                const result = await test.call(this);
                if (result.passed) {
                    console.log(`✅ ${result.name}`);
                    passed++;
                } else {
                    console.log(`❌ ${result.name}: ${result.error}`);
                    failed++;
                }
                this.testResults.push(result);
            } catch (error) {
                console.log(`❌ Test failed with error: ${error.message}`);
                failed++;
            }
        }
        
        console.log('\n📊 Test Results Summary:');
        console.log(`   Passed: ${passed}/${tests.length}`);
        console.log(`   Failed: ${failed}/${tests.length}`);
        console.log(`   Success Rate: ${((passed/tests.length) * 100).toFixed(1)}%`);
        
        return {
            passed,
            failed,
            total: tests.length,
            results: this.testResults
        };
    }

    async testCircularStatistics() {
        const testName = 'Circular Statistics';
        
        try {
            // Test circular mean calculation
            const times = ['22:00', '22:30', '23:00', '23:30', '00:00'];
            const radians = times.map(t => this.rhythmAnalyzer.timeToRadians(t));
            const stats = this.rhythmAnalyzer.circularStatistics(radians);
            
            // Verify mean is around 23:00 (in radians)
            const expectedMean = this.rhythmAnalyzer.timeToRadians('23:00');
            const tolerance = 0.1;
            
            if (Math.abs(stats.mean - expectedMean) > tolerance) {
                throw new Error(`Circular mean incorrect. Expected ~${expectedMean}, got ${stats.mean}`);
            }
            
            // Verify variance is low (consistent times)
            if (stats.variance > 0.5) {
                throw new Error(`Variance too high for consistent times: ${stats.variance}`);
            }
            
            return { name: testName, passed: true };
            
        } catch (error) {
            return { name: testName, passed: false, error: error.message };
        }
    }

    async testSleepConsistencyScoring() {
        const testName = 'Sleep Consistency Scoring';
        
        try {
            // Test with consistent sleep times
            const consistentSleep = [
                { sleepTime: '22:30', wakeTime: '06:30' },
                { sleepTime: '22:35', wakeTime: '06:35' },
                { sleepTime: '22:25', wakeTime: '06:25' },
                { sleepTime: '22:30', wakeTime: '06:30' }
            ];
            
            const score1 = this.rhythmAnalyzer.calculateSleepConsistency(consistentSleep);
            
            if (score1 < 0.8) {
                throw new Error(`Consistent sleep should score > 0.8, got ${score1}`);
            }
            
            // Test with inconsistent sleep times
            const inconsistentSleep = [
                { sleepTime: '21:00', wakeTime: '05:00' },
                { sleepTime: '01:00', wakeTime: '09:00' },
                { sleepTime: '23:00', wakeTime: '06:00' },
                { sleepTime: '02:00', wakeTime: '10:00' }
            ];
            
            const score2 = this.rhythmAnalyzer.calculateSleepConsistency(inconsistentSleep);
            
            if (score2 > 0.5) {
                throw new Error(`Inconsistent sleep should score < 0.5, got ${score2}`);
            }
            
            return { name: testName, passed: true };
            
        } catch (error) {
            return { name: testName, passed: false, error: error.message };
        }
    }

    async testAttendanceStreaks() {
        const testName = 'Attendance Streak Calculation';
        
        try {
            // Test perfect attendance
            const perfectAttendance = Array(10).fill({ onTime: true });
            const score1 = this.rhythmAnalyzer.calculateAttendanceConsistency(perfectAttendance);
            
            if (score1 < 0.95) {
                throw new Error(`Perfect attendance should score > 0.95, got ${score1}`);
            }
            
            // Test with streaks
            const streakAttendance = [
                { onTime: true },
                { onTime: true },
                { onTime: true },
                { onTime: false },
                { onTime: true },
                { onTime: true },
                { onTime: false },
                { onTime: true },
                { onTime: true },
                { onTime: true }
            ];
            
            const score2 = this.rhythmAnalyzer.calculateAttendanceConsistency(streakAttendance);
            
            if (score2 < 0.6 || score2 > 0.9) {
                throw new Error(`Streak attendance should score 0.6-0.9, got ${score2}`);
            }
            
            // Verify streak bonus is applied
            const noStreaks = [
                { onTime: true },
                { onTime: false },
                { onTime: true },
                { onTime: false },
                { onTime: true }
            ];
            
            const score3 = this.rhythmAnalyzer.calculateAttendanceConsistency(noStreaks);
            
            if (score3 > score2) {
                throw new Error('Streak bonus not working correctly');
            }
            
            return { name: testName, passed: true };
            
        } catch (error) {
            return { name: testName, passed: false, error: error.message };
        }
    }

    async testTaskConsistencyCalculation() {
        const testName = 'Task Consistency Calculation';
        
        try {
            // Test consistent task completion
            const consistentTasks = Array(14).fill(null).map((_, i) => ({
                date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                completed: Math.random() > 0.2 // 80% completion rate
            }));
            
            const score1 = this.rhythmAnalyzer.calculateTaskCompletionConsistency(consistentTasks);
            
            if (score1 < 0.5) {
                throw new Error(`Consistent tasks should score > 0.5, got ${score1}`);
            }
            
            // Test trend detection
            const improvingTasks = Array(14).fill(null).map((_, i) => ({
                date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                completed: i < 7 ? Math.random() > 0.5 : Math.random() > 0.1 // Improving over time
            }));
            
            const score2 = this.rhythmAnalyzer.calculateTaskCompletionConsistency(improvingTasks);
            
            // Should detect positive trend
            if (score2 < score1) {
                throw new Error('Trend detection not working correctly');
            }
            
            return { name: testName, passed: true };
            
        } catch (error) {
            return { name: testName, passed: false, error: error.message };
        }
    }

    async testCircadianAlignment() {
        const testName = 'Circadian Alignment Scoring';
        
        try {
            // Test optimal activity times (morning and afternoon peaks)
            const optimalActivity = [
                { timestamp: new Date('2024-01-01T10:00:00') },
                { timestamp: new Date('2024-01-01T11:00:00') },
                { timestamp: new Date('2024-01-01T16:00:00') },
                { timestamp: new Date('2024-01-01T17:00:00') }
            ];
            
            const score1 = this.rhythmAnalyzer.calculateCircadianAlignment(optimalActivity);
            
            if (score1 < 0.7) {
                throw new Error(`Optimal activity should score > 0.7, got ${score1}`);
            }
            
            // Test suboptimal activity times (late night)
            const lateNightActivity = [
                { timestamp: new Date('2024-01-01T23:00:00') },
                { timestamp: new Date('2024-01-01T00:00:00') },
                { timestamp: new Date('2024-01-01T01:00:00') },
                { timestamp: new Date('2024-01-01T02:00:00') }
            ];
            
            const score2 = this.rhythmAnalyzer.calculateCircadianAlignment(lateNightActivity);
            
            if (score2 > 0.3) {
                throw new Error(`Late night activity should score < 0.3, got ${score2}`);
            }
            
            return { name: testName, passed: true };
            
        } catch (error) {
            return { name: testName, passed: false, error: error.message };
        }
    }

    async testCompositeRhythmScore() {
        const testName = 'Composite Rhythm Score';
        
        try {
            const testData = {
                sleepData: [
                    { sleepTime: '22:30', wakeTime: '06:30' },
                    { sleepTime: '22:25', wakeTime: '06:35' }
                ],
                attendanceData: [
                    { onTime: true },
                    { onTime: true },
                    { onTime: false }
                ],
                taskData: [
                    { date: '2024-01-01', completed: true },
                    { date: '2024-01-02', completed: true },
                    { date: '2024-01-03', completed: false }
                ],
                activityData: [
                    { timestamp: new Date('2024-01-01T10:00:00') },
                    { timestamp: new Date('2024-01-01T14:00:00') }
                ]
            };
            
            const result = await this.rhythmAnalyzer.computeRhythmScore(testData);
            
            // Check composite is within valid range
            if (result.composite < 0 || result.composite > 100) {
                throw new Error(`Composite score out of range: ${result.composite}`);
            }
            
            // Check all components are present
            const requiredComponents = ['sleep', 'attendance', 'task', 'circadian'];
            for (const comp of requiredComponents) {
                if (result.components[comp] === undefined) {
                    throw new Error(`Missing component: ${comp}`);
                }
                
                if (result.components[comp] < 0 || result.components[comp] > 100) {
                    throw new Error(`Component ${comp} out of range: ${result.components[comp]}`);
                }
            }
            
            // Check insights are generated
            if (!Array.isArray(result.insights)) {
                throw new Error('Insights not generated');
            }
            
            return { name: testName, passed: true };
            
        } catch (error) {
            return { name: testName, passed: false, error: error.message };
        }
    }

    async testWeightNormalization() {
        const testName = 'Weight Normalization';
        
        try {
            // Test that weights sum to 1
            const weights = {
                effort: 0.20,
                duration: 0.20,
                quality: 0.25,
                goal: 0.20,
                rhythm: 0.15
            };
            
            const sum = Object.values(weights).reduce((a, b) => a + b, 0);
            
            if (Math.abs(sum - 1.0) > 0.001) {
                throw new Error(`Weights don't sum to 1: ${sum}`);
            }
            
            // Test weight update with normalization
            const newWeights = {
                effort: 25,
                duration: 25,
                quality: 20,
                goal: 20,
                rhythm: 30
            };
            
            const normalized = {};
            const total = Object.values(newWeights).reduce((a, b) => a + b, 0);
            
            for (const [key, value] of Object.entries(newWeights)) {
                normalized[key] = value / total;
            }
            
            const normalizedSum = Object.values(normalized).reduce((a, b) => a + b, 0);
            
            if (Math.abs(normalizedSum - 1.0) > 0.001) {
                throw new Error(`Normalized weights don't sum to 1: ${normalizedSum}`);
            }
            
            return { name: testName, passed: true };
            
        } catch (error) {
            return { name: testName, passed: false, error: error.message };
        }
    }

    async testDatabaseIntegration() {
        const testName = 'Database Integration';
        
        try {
            // Test database connection
            await this.integration._dbReady;
            
            if (!this.integration.db) {
                throw new Error('Database not initialized');
            }
            
            // Check for rhythm stores
            const requiredStores = ['rhythm_data', 'sleep_data'];
            const hasStores = requiredStores.every(store => 
                this.integration.db.objectStoreNames.contains(store)
            );
            
            if (!hasStores) {
                throw new Error('Required rhythm stores not found');
            }
            
            // Test data insertion
            const testSleepData = {
                date: '2024-01-01',
                sleepTime: '22:30',
                wakeTime: '06:30',
                quality: 4,
                duration: 480
            };
            
            const transaction = this.integration.db.transaction(['sleep_data'], 'readwrite');
            const store = transaction.objectStore('sleep_data');
            
            await new Promise((resolve, reject) => {
                const request = store.put(testSleepData);
                request.onsuccess = resolve;
                request.onerror = reject;
            });
            
            // Test data retrieval
            const retrieveTransaction = this.integration.db.transaction(['sleep_data'], 'readonly');
            const retrieveStore = retrieveTransaction.objectStore('sleep_data');
            
            const retrieved = await new Promise((resolve, reject) => {
                const request = retrieveStore.get('2024-01-01');
                request.onsuccess = () => resolve(request.result);
                request.onerror = reject;
            });
            
            if (!retrieved || retrieved.sleepTime !== '22:30') {
                throw new Error('Data retrieval failed');
            }
            
            return { name: testName, passed: true };
            
        } catch (error) {
            return { name: testName, passed: false, error: error.message };
        }
    }

    async testVisualizationData() {
        const testName = 'Visualization Data Generation';
        
        try {
            // Test parallel coordinates data generation
            const parallelData = await this.integration.generateParallelCoordsData();
            
            if (!parallelData.dimensions || !parallelData.data) {
                throw new Error('Invalid parallel coordinates data structure');
            }
            
            // Check for 5 dimensions (days of week)
            if (parallelData.dimensions.length !== 7) {
                throw new Error(`Expected 7 dimensions, got ${parallelData.dimensions.length}`);
            }
            
            // Check data includes rhythm component
            const hasRhythm = parallelData.data.some(d => d.name && d.name.includes('rhythm'));
            
            if (!hasRhythm) {
                throw new Error('Rhythm component not in visualization data');
            }
            
            return { name: testName, passed: true };
            
        } catch (error) {
            return { name: testName, passed: false, error: error.message };
        }
    }

    async testEdgeCases() {
        const testName = 'Edge Cases';
        
        try {
            // Test with empty data
            const emptyResult = await this.rhythmAnalyzer.computeRhythmScore({
                sleepData: [],
                attendanceData: [],
                taskData: [],
                activityData: []
            });
            
            if (emptyResult.composite < 0 || emptyResult.composite > 100) {
                throw new Error('Invalid score for empty data');
            }
            
            // Test with overnight sleep (crossing midnight)
            const overnightSleep = [
                { sleepTime: '23:30', wakeTime: '07:00' },
                { sleepTime: '00:30', wakeTime: '08:00' }
            ];
            
            const overnightScore = this.rhythmAnalyzer.calculateSleepConsistency(overnightSleep);
            
            if (isNaN(overnightScore)) {
                throw new Error('NaN returned for overnight sleep');
            }
            
            // Test with single data point
            const singlePoint = await this.rhythmAnalyzer.computeRhythmScore({
                sleepData: [{ sleepTime: '22:00', wakeTime: '06:00' }],
                attendanceData: [{ onTime: true }],
                taskData: [{ date: '2024-01-01', completed: true }],
                activityData: [{ timestamp: new Date() }]
            });
            
            if (!singlePoint || singlePoint.composite === undefined) {
                throw new Error('Failed with single data point');
            }
            
            // Test with invalid time format
            try {
                this.rhythmAnalyzer.timeToMinutes('25:00');
                // Should handle gracefully
            } catch (e) {
                throw new Error('Failed to handle invalid time format');
            }
            
            return { name: testName, passed: true };
            
        } catch (error) {
            return { name: testName, passed: false, error: error.message };
        }
    }

    // Utility function to generate test report
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total: this.testResults.length,
                passed: this.testResults.filter(r => r.passed).length,
                failed: this.testResults.filter(r => !r.passed).length
            },
            details: this.testResults,
            recommendations: []
        };
        
        // Add recommendations based on failures
        const failures = this.testResults.filter(r => !r.passed);
        
        if (failures.length > 0) {
            failures.forEach(failure => {
                if (failure.name.includes('Database')) {
                    report.recommendations.push('Check database migration status');
                }
                if (failure.name.includes('Circular')) {
                    report.recommendations.push('Review circular statistics implementation');
                }
                if (failure.name.includes('Weight')) {
                    report.recommendations.push('Verify weight normalization logic');
                }
            });
        }
        
        return report;
    }
}

// Test runner UI
if (typeof window !== 'undefined') {
    window.RhythmTester = RhythmTester;
    
    // Add test button to page if in development mode
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.addEventListener('DOMContentLoaded', () => {
            const testButton = document.createElement('button');
            testButton.textContent = '🧪 Run Rhythm Tests';
            testButton.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                padding: 10px 20px;
                background: #9333EA;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                z-index: 10000;
                font-family: monospace;
            `;
            
            testButton.addEventListener('click', async () => {
                const tester = new RhythmTester();
                console.clear();
                const results = await tester.runAllTests();
                
                // Show results in alert
                const message = `Test Results:\n` +
                    `Passed: ${results.passed}/${results.total}\n` +
                    `Failed: ${results.failed}/${results.total}\n` +
                    `Success Rate: ${((results.passed/results.total) * 100).toFixed(1)}%\n\n` +
                    `Check console for detailed results`;
                
                alert(message);
                
                // Log detailed report
                console.log('📊 Detailed Test Report:', tester.generateReport());
            });
            
            document.body.appendChild(testButton);
        });
    }
}

// Export for use in testing frameworks
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RhythmTester;
}
