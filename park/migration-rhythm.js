/**
 * Data Migration Script for Rhythm Component
 * Migrates existing productivity data to include rhythm scoring
 * Run this once to upgrade from version 1 to version 2
 */

class RhythmMigration {
    constructor() {
        this.oldVersion = 1;
        this.newVersion = 2;
        this.db = null;
    }

    async migrate() {
        console.log('🔄 Starting Rhythm Migration...');
        
        try {
            // Check current database version
            const currentVersion = await this.getCurrentVersion();
            
            if (currentVersion >= this.newVersion) {
                console.log('✅ Database already at version 2 or higher');
                return { success: true, message: 'No migration needed' };
            }
            
            // Backup existing data
            const backup = await this.backupData();
            console.log('💾 Backup created:', backup);
            
            // Perform migration
            await this.upgradeDatabase();
            
            // Migrate existing tasks
            await this.migrateTasks();
            
            // Generate initial rhythm data
            await this.generateInitialRhythmData();
            
            // Recalculate all scores with rhythm
            await this.recalculateAllScores();
            
            // Verify migration
            const verified = await this.verifyMigration();
            
            if (verified) {
                console.log('✅ Migration completed successfully!');
                return { 
                    success: true, 
                    message: 'Migration completed',
                    backup: backup
                };
            } else {
                throw new Error('Migration verification failed');
            }
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            
            // Attempt to restore from backup
            await this.restoreFromBackup();
            
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    async getCurrentVersion() {
        return new Promise((resolve) => {
            const request = indexedDB.open('ProductivityDB');
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const version = db.version;
                db.close();
                resolve(version);
            };
            
            request.onerror = () => {
                resolve(0);
            };
        });
    }

    async backupData() {
        const backup = {
            timestamp: new Date().toISOString(),
            version: this.oldVersion,
            data: {}
        };
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('ProductivityDB', this.oldVersion);
            
            request.onsuccess = async (event) => {
                const db = event.target.result;
                
                // Backup all stores
                const stores = ['tasks', 'goals', 'productivity_scores'];
                
                for (const storeName of stores) {
                    if (db.objectStoreNames.contains(storeName)) {
                        backup.data[storeName] = await this.getAllFromStore(db, storeName);
                    }
                }
                
                db.close();
                
                // Save backup to localStorage
                localStorage.setItem('productivity_backup', JSON.stringify(backup));
                
                resolve(backup);
            };
            
            request.onerror = () => {
                reject(new Error('Failed to create backup'));
            };
        });
    }

    async getAllFromStore(db, storeName) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async upgradeDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('ProductivityDB', this.newVersion);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                console.log('📊 Upgrading database schema...');
                
                // Add new stores for rhythm tracking
                if (!db.objectStoreNames.contains('rhythm_data')) {
                    const rhythmStore = db.createObjectStore('rhythm_data', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    rhythmStore.createIndex('date', 'date', { unique: false });
                    rhythmStore.createIndex('type', 'type', { unique: false });
                    rhythmStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('✅ Created rhythm_data store');
                }
                
                if (!db.objectStoreNames.contains('sleep_data')) {
                    const sleepStore = db.createObjectStore('sleep_data', { 
                        keyPath: 'date' 
                    });
                    sleepStore.createIndex('week', 'week', { unique: false });
                    sleepStore.createIndex('quality', 'quality', { unique: false });
                    console.log('✅ Created sleep_data store');
                }
                
                if (!db.objectStoreNames.contains('attendance_data')) {
                    const attendanceStore = db.createObjectStore('attendance_data', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    attendanceStore.createIndex('date', 'date', { unique: false });
                    attendanceStore.createIndex('type', 'type', { unique: false });
                    console.log('✅ Created attendance_data store');
                }
                
                // Update existing tasks store with new indexes
                if (db.objectStoreNames.contains('tasks')) {
                    const taskStore = event.target.transaction.objectStore('tasks');
                    
                    if (!taskStore.indexNames.contains('completedOnTime')) {
                        taskStore.createIndex('completedOnTime', 'completedOnTime', { unique: false });
                        console.log('✅ Added completedOnTime index to tasks');
                    }
                }
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('✅ Database upgraded to version', this.newVersion);
                resolve();
            };
            
            request.onerror = () => {
                reject(new Error('Failed to upgrade database'));
            };
        });
    }

    async migrateTasks() {
        console.log('📝 Migrating existing tasks...');
        
        const transaction = this.db.transaction(['tasks'], 'readwrite');
        const store = transaction.objectStore('tasks');
        const request = store.getAll();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = async () => {
                const tasks = request.result;
                let migrated = 0;
                
                for (const task of tasks) {
                    // Add rhythm-related fields if missing
                    if (task.completedOnTime === undefined) {
                        task.completedOnTime = task.completed || false;
                    }
                    
                    if (!task.plannedStartTime) {
                        task.plannedStartTime = task.time || '09:00';
                    }
                    
                    if (!task.actualStartTime) {
                        task.actualStartTime = task.completed ? task.time : null;
                    }
                    
                    // Update task
                    store.put(task);
                    migrated++;
                }
                
                console.log(`✅ Migrated ${migrated} tasks`);
                resolve(migrated);
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async generateInitialRhythmData() {
        console.log('🎵 Generating initial rhythm data...');
        
        const today = new Date();
        const rhythmTransaction = this.db.transaction(['rhythm_data', 'sleep_data'], 'readwrite');
        const rhythmStore = rhythmTransaction.objectStore('rhythm_data');
        const sleepStore = rhythmTransaction.objectStore('sleep_data');
        
        // Generate sample sleep data for the past 7 days
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            // Generate realistic sleep times with some variation
            const baseSleeHour = 22 + Math.random() * 2; // 22:00 - 00:00
            const baseWakeHour = 6 + Math.random() * 1.5; // 06:00 - 07:30
            
            const sleepTime = `${Math.floor(baseSleeHour).toString().padStart(2, '0')}:${Math.floor((baseSleeHour % 1) * 60).toString().padStart(2, '0')}`;
            const wakeTime = `${Math.floor(baseWakeHour).toString().padStart(2, '0')}:${Math.floor((baseWakeHour % 1) * 60).toString().padStart(2, '0')}`;
            
            // Calculate duration
            let duration = baseWakeHour - (baseSleeHour > 24 ? baseSleeHour - 24 : baseSleeHour);
            if (duration < 0) duration += 24;
            
            const sleepData = {
                date: dateStr,
                sleepTime: sleepTime,
                wakeTime: wakeTime,
                duration: duration * 60, // in minutes
                quality: Math.floor(Math.random() * 2) + 3 // 3-5 quality
            };
            
            sleepStore.put(sleepData);
            
            // Also add to rhythm data
            rhythmStore.add({
                date: dateStr,
                type: 'sleep',
                sleepTime: sleepTime,
                wakeTime: wakeTime,
                quality: sleepData.quality,
                duration: duration
            });
        }
        
        console.log('✅ Generated initial rhythm data');
    }

    async recalculateAllScores() {
        console.log('🔄 Recalculating all productivity scores with rhythm...');
        
        const transaction = this.db.transaction(['productivity_scores', 'tasks', 'rhythm_data'], 'readwrite');
        const scoreStore = transaction.objectStore('productivity_scores');
        const taskStore = transaction.objectStore('tasks');
        const rhythmStore = transaction.objectStore('rhythm_data');
        
        // Get all existing scores
        const scores = await this.getAllFromStore(this.db, 'productivity_scores');
        
        for (const score of scores) {
            // Get rhythm data for this date
            const rhythmData = await this.getRhythmForDate(score.date);
            
            // Calculate rhythm score (simplified)
            let rhythmScore = 50; // Base score
            
            if (rhythmData.sleep) {
                // Check sleep consistency
                const sleepTime = this.timeToMinutes(rhythmData.sleep.sleepTime);
                const wakeTime = this.timeToMinutes(rhythmData.sleep.wakeTime);
                const idealSleep = this.timeToMinutes('22:30');
                const idealWake = this.timeToMinutes('06:30');
                
                const sleepDiff = Math.abs(sleepTime - idealSleep);
                const wakeDiff = Math.abs(wakeTime - idealWake);
                
                // Better consistency = higher score
                rhythmScore = Math.max(0, 100 - (sleepDiff + wakeDiff) / 2);
            }
            
            // Add rhythm component to score
            score.rhythm = rhythmScore;
            
            // Recalculate composite with new weights
            const weights = {
                effort: 0.20,
                duration: 0.20,
                quality: 0.25,
                goal: 0.20,
                rhythm: 0.15
            };
            
            score.composite = 
                (score.effort || 0) * weights.effort +
                (score.duration || 0) * weights.duration +
                (score.quality || 0) * weights.quality +
                (score.goal || 0) * weights.goal +
                (score.rhythm || 0) * weights.rhythm;
            
            // Update score
            scoreStore.put(score);
        }
        
        console.log(`✅ Recalculated ${scores.length} productivity scores`);
    }

    async getRhythmForDate(date) {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['rhythm_data'], 'readonly');
            const store = transaction.objectStore('rhythm_data');
            const index = store.index('date');
            const request = index.getAll(date);
            
            request.onsuccess = () => {
                const data = request.result;
                const result = {};
                
                data.forEach(item => {
                    if (item.type === 'sleep') {
                        result.sleep = item;
                    } else if (item.type === 'task_timing') {
                        result.taskTiming = result.taskTiming || [];
                        result.taskTiming.push(item);
                    }
                });
                
                resolve(result);
            };
            
            request.onerror = () => {
                resolve({});
            };
        });
    }

    timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    async verifyMigration() {
        console.log('✔️ Verifying migration...');
        
        // Check database version
        const version = await this.getCurrentVersion();
        if (version !== this.newVersion) {
            console.error('Version mismatch:', version, 'expected:', this.newVersion);
            return false;
        }
        
        // Check for new stores
        const storesNeeded = ['rhythm_data', 'sleep_data', 'attendance_data'];
        const transaction = this.db.transaction(storesNeeded, 'readonly');
        
        for (const storeName of storesNeeded) {
            if (!this.db.objectStoreNames.contains(storeName)) {
                console.error('Missing store:', storeName);
                return false;
            }
        }
        
        // Check for rhythm scores in productivity_scores
        const scoreStore = transaction.objectStore('productivity_scores');
        const scores = await this.getAllFromStore(this.db, 'productivity_scores');
        
        if (scores.length > 0) {
            const hasRhythm = scores.some(s => s.rhythm !== undefined);
            if (!hasRhythm) {
                console.warn('No rhythm scores found in productivity_scores');
            }
        }
        
        console.log('✅ Migration verified successfully');
        return true;
    }

    async restoreFromBackup() {
        console.log('🔙 Attempting to restore from backup...');
        
        const backupStr = localStorage.getItem('productivity_backup');
        if (!backupStr) {
            console.error('No backup found');
            return false;
        }
        
        try {
            const backup = JSON.parse(backupStr);
            
            // Delete current database
            await this.deleteDatabase();
            
            // Recreate with old version
            const request = indexedDB.open('ProductivityDB', backup.version);
            
            request.onsuccess = async (event) => {
                const db = event.target.result;
                
                // Restore data
                for (const [storeName, data] of Object.entries(backup.data)) {
                    const transaction = db.transaction([storeName], 'readwrite');
                    const store = transaction.objectStore(storeName);
                    
                    for (const item of data) {
                        store.put(item);
                    }
                }
                
                db.close();
                console.log('✅ Backup restored successfully');
                return true;
            };
            
        } catch (error) {
            console.error('Failed to restore backup:', error);
            return false;
        }
    }

    async deleteDatabase() {
        return new Promise((resolve, reject) => {
            const deleteReq = indexedDB.deleteDatabase('ProductivityDB');
            
            deleteReq.onsuccess = () => {
                console.log('Database deleted');
                resolve();
            };
            
            deleteReq.onerror = () => {
                reject(new Error('Failed to delete database'));
            };
        });
    }

    // Utility function to export all data
    async exportData() {
        const exportData = {
            version: this.newVersion,
            timestamp: new Date().toISOString(),
            data: {}
        };
        
        const stores = [
            'tasks', 'goals', 'productivity_scores', 
            'rhythm_data', 'sleep_data', 'attendance_data'
        ];
        
        for (const storeName of stores) {
            if (this.db.objectStoreNames.contains(storeName)) {
                exportData.data[storeName] = await this.getAllFromStore(this.db, storeName);
            }
        }
        
        // Create downloadable file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `productivity-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('✅ Data exported successfully');
        return exportData;
    }

    // Utility function to import data
    async importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (event) => {
                try {
                    const importData = JSON.parse(event.target.result);
                    
                    // Validate import data
                    if (!importData.version || !importData.data) {
                        throw new Error('Invalid import file format');
                    }
                    
                    // Clear existing data
                    console.log('Clearing existing data...');
                    
                    // Import new data
                    for (const [storeName, data] of Object.entries(importData.data)) {
                        const transaction = this.db.transaction([storeName], 'readwrite');
                        const store = transaction.objectStore(storeName);
                        
                        // Clear store
                        store.clear();
                        
                        // Add imported data
                        for (const item of data) {
                            store.put(item);
                        }
                    }
                    
                    console.log('✅ Data imported successfully');
                    resolve(importData);
                    
                } catch (error) {
                    console.error('Import failed:', error);
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file);
        });
    }
}

// Auto-run migration if this is the first load after update
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', async () => {
        const migration = new RhythmMigration();
        
        // Check if migration is needed
        const currentVersion = await migration.getCurrentVersion();
        
        if (currentVersion < 2) {
            console.log('🚀 Rhythm component migration required');
            
            // Show migration UI
            if (confirm('A new update is available that adds Rhythm tracking to your productivity system. Would you like to upgrade now?')) {
                const result = await migration.migrate();
                
                if (result.success) {
                    alert('✅ Migration completed successfully! Your productivity system now includes Rhythm tracking.');
                    
                    // Reload the page to use new features
                    window.location.reload();
                } else {
                    alert('❌ Migration failed. Your data has been preserved. Error: ' + result.error);
                }
            }
        }
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RhythmMigration;
}
