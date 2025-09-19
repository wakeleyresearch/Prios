# ProductivityFlow - Complete Task Planning & Analytics System

## 🎯 Overview

A comprehensive productivity management platform that combines task planning, goal tracking, and advanced analytics through beautiful visualizations. The system implements the mathematical framework:

**S = w_e·E + w_d·D + w_q·Q + w_g·G**

Where:
- **E** = Effort (normalized using robust sigmoid functions)
- **D** = Duration efficiency (with exponential decay for overruns)
- **Q** = Quality outcomes (hybrid objective/subjective measures)
- **G** = Goal alignment (hierarchical decomposition with deadline proximity)
- **w_i** = Adaptive weights (Σw_i = 1)

## 🚀 New Features - Task Planner & Integration

### **Task Management System**
- 📅 **Calendar Views**: Day, Week, and Month views for comprehensive planning
- ✅ **Smart Task Creation**: Quick-add with priority levels and categories
- 🎯 **Goal Tracking**: Link tasks to goals and track progress
- 🔄 **Recurring Templates**: Pre-configured templates for routine activities
- 💾 **Persistent Storage**: IndexedDB for offline-first data persistence
- 📊 **Real-time Sync**: Automatic synchronization with productivity analytics

### **Three Integrated Views**

#### 1. **Dashboard** (`dashboard.html`)
Unified view combining real-time metrics with task management:
- Today's productivity score with trend indicators
- Task completion metrics
- Weekly performance distribution
- Mini parallel coordinates visualization
- Quick-action floating menu

#### 2. **Task Planner (Enhanced)** (`task-planner-enhanced.html`)
Full-featured task and goal management:
- **Left Panel**: Goals & Projects with progress tracking
- **Center**: Interactive calendar with drag-and-drop
- **Right Panel**: Quick task creation and recurring templates
- **Smart Features**:
  - Automatic productivity scoring per task
  - Goal urgency calculation
  - Category-based quality assessment
  - Time efficiency tracking

#### 3. **Analytics** (`productivity-parallel-coords.html`)
Advanced visualization and analysis:
- Parallel coordinates showing productivity trajectories
- Real-time statistics panel
- Pattern detection algorithms
- Anomaly identification
- Trend analysis

## 📊 How Task Data Links to Productivity Scores

### **Per-Task Scoring**

Each task automatically calculates four component scores:

```javascript
// Effort Score (E)
- High Priority: 90 points
- Medium Priority: 60 points  
- Low Priority: 30 points
- Modified by duration (longer = more effort)

// Duration Efficiency (D)
- Optimal at 60 minutes
- Exponential decay for overruns
- Bonus for early completion

// Quality Score (Q)
- Work tasks: 85 base points
- Learning: 80 points
- Fitness: 70 points
- Personal: 60 points
- Wellness: 50 points

// Goal Alignment (G)
- Linked to goal: 80 points
- No goal link: 30 points
- Urgency multiplier based on deadline
```

### **Daily Aggregation**

The system automatically:
1. Groups tasks by day
2. Calculates average component scores
3. Applies weighted formula: S = 0.25E + 0.25D + 0.25Q + 0.25G
4. Stores in IndexedDB for visualization
5. Updates parallel coordinates in real-time

## 🛠️ Technical Architecture

### **Data Flow**
```
Task Creation → IndexedDB → Scoring Engine → Aggregation → Visualization
     ↓              ↓            ↓               ↓              ↓
 Task Planner   Persistence  Integration.js  Statistics  Parallel Coords
```

### **Storage Schema**

```javascript
// Tasks Table
{
  id: auto-increment,
  title: string,
  priority: 'high'|'medium'|'low',
  category: string,
  date: ISO date,
  duration: minutes,
  goalId: foreign key,
  completed: boolean
}

// Goals Table
{
  id: auto-increment,
  name: string,
  deadline: ISO date,
  category: string,
  totalTasks: number,
  completedTasks: number
}

// Productivity Scores Table
{
  date: primary key,
  effort: 0-100,
  duration: 0-100,
  quality: 0-100,
  goal: 0-100,
  composite: 0-100
}
```

## ⚙️ Scoring Core & Data Flow

- Added `productivity-core.js` as the shared scoring utility so Task Planner, Dashboard, and Analytics use identical normalization and weighting.
- Tasks now carry contextual metadata (energy, focus mode, collaborators, location, time-of-day, confidence) that feeds directly into the integration pipeline and parallel coordinates.
- Integration normalizes data via `validateVisualizationPayload` before persisting to `localStorage`, reducing NaNs and mismatched lengths.
- `JournalNLPParser` extracts richer signals (energy, focus, location, collaborators, context tags) that flow through `TaskAPI` and the visualization stack without manual data entry.

### Next UI Revamp Focus

1. Consolidate the navigation/header components across all pages and surface metadata filters (energy, focus, context) inside the analytics view.
2. Extend dashboard cards to surface daily context insights (energy balance, collaboration load) alongside productivity metrics.
3. Refresh planner forms to expose the new metadata fields (energy, focus, collaborators) with sensible defaults and quick-pick chips.
4. Update reflection and settings surfaces so users can tune NLP sensitivity, context tagging, and scoring weights without editing code.

## 🚀 Quick Start

### **1. Launch the System**

```bash
# Open any of the three entry points:
open dashboard.html        # Unified dashboard view
open task-planner-enhanced.html     # Dedicated task management (enhanced UI)
open productivity-parallel-coords.html  # Analytics view

# Or use the launcher script:
./launch.sh
```

### **2. Create Your First Tasks**

1. Click the **floating + button** or use **Quick Add**
2. Set priority (affects Effort score)
3. Choose category (affects Quality score)  
4. Link to a goal (affects Goal alignment score)
5. Set duration estimate (affects Duration efficiency)

### **3. Track Your Productivity**

- Tasks automatically calculate scores upon creation
- Daily scores aggregate and display in visualizations
- Pattern detection identifies your peak performance times
- Anomaly detection highlights unusual productivity spikes/dips

## 📈 Understanding the Visualizations

### **Parallel Coordinates**
- **X-axis**: Days of the week (Sun-Sat)
- **Y-axis**: Productivity score (0-100)
- **Color**: Task value/priority gradient
  - 🔴 Red/Orange: High-value tasks
  - 🟡 Yellow/Green: Regular tasks
  - 🔵 Blue/Purple: Low-priority tasks
- **Lines**: Individual task or metric trajectories

### **Dashboard Metrics**
- **Today's Score**: Current day composite score
- **Tasks Completed**: Completion rate and count
- **Weekly Average**: 7-day rolling average
- **Goal Progress**: Percentage of linked tasks completed

## ⚙️ Customization

### **Adjust Scoring Weights**

Edit weights in `integration.js`:
```javascript
const weights = {
    effort: 0.30,    // Increase for effort-focused roles
    duration: 0.20,  // Decrease if time is flexible
    quality: 0.35,   // Increase for quality-critical work
    goal: 0.15       // Adjust based on goal importance
}
```

### **Add Custom Categories**

In `task-manager.js`:
```javascript
const categoryScores = {
    work: 85,
    learning: 80,
    fitness: 70,
    personal: 60,
    wellness: 50,
    // Add your categories here:
    research: 90,
    creative: 75
}
```

### **Configure Recurring Templates**

Modify templates in `task-manager.js`:
```javascript
const templates = {
    standup: {
        title: 'Daily Standup',
        time: '08:30',
        duration: 30,
        category: 'work',
        priority: 'high',
        recurring: 'weekdays'  // Options: daily, weekdays, mwf, weekends
    }
}
```

## 📊 Key Features

### **Smart Features**
- ✨ **Auto-scoring**: Every task automatically scored on EDQG components
- 🧠 **Pattern Recognition**: HMM-based state transition analysis
- 🎯 **Goal Urgency**: Exponential urgency as deadlines approach
- 📈 **Trend Detection**: Linear regression for performance trends
- 🚨 **Anomaly Detection**: CUSUM-EWMA algorithm for outliers

### **User Experience**
- 💾 **Offline-First**: Works without internet using IndexedDB
- 🔄 **Real-time Sync**: Changes instantly reflect in visualizations
- 📱 **Responsive**: Adapts to desktop, tablet, and mobile
- ⚡ **Fast**: Sub-millisecond scoring calculations
- 🎨 **Beautiful**: Gradient-based design with smooth animations

## 🔍 Advanced Analytics

### **Statistical Metrics**
- **Cronbach's α**: Reliability assessment (target ≥ 0.70)
- **Bootstrap CI**: 95% confidence intervals
- **EWMA**: Exponentially weighted moving averages
- **Trend Analysis**: Improving/Stable/Declining indicators

### **Pattern Detection**
The system identifies:
- Best performing days of the week
- Peak productivity hours
- Task completion patterns
- Goal achievement trajectories
- Consistency in recurring activities

## 🔧 Troubleshooting

**Issue**: Data not syncing between views
- **Solution**: Check browser console for IndexedDB errors
- Clear cache and reload: `Ctrl+Shift+R`

**Issue**: Visualization not updating
- **Solution**: Click sync button or wait for auto-sync (every 30s)

**Issue**: Tasks not showing productivity scores
- **Solution**: Ensure all required fields are filled (priority, category, duration)

## 🚀 Roadmap

### **Coming Soon**
- [ ] Focus mode with Pomodoro timer
- [ ] Team collaboration features
- [ ] Mobile app (React Native)
- [ ] Cloud sync with authentication
- [ ] AI-powered task suggestions
- [ ] Advanced reporting (PDF export)
- [ ] Integration with calendar apps
- [ ] Voice input for tasks

## 📚 Technical Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Visualization**: ECharts 5.4.3
- **Storage**: IndexedDB (client-side)
- **Mathematics**: Custom implementations of:
  - Adam optimizer
  - CUSUM-EWMA detection
  - Bootstrap BCa intervals
  - Robust sigmoid normalization

## 📄 License

Apache License 2.0

---

*Built with mathematical rigor and visual elegance for actionable productivity insights.*

**Start managing your productivity scientifically today!** 🚀