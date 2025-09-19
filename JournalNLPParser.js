// Enhanced NLP Parser with multiple extraction strategies
class JournalNLPParser {
  constructor() {
    // Expanded duration patterns
    this.durationPatterns = [
      // Standard formats: 2h30m, 2h 30m, 2 hours 30 minutes
      /(\d+\.?\d*)\s*h(?:ours?)?\s*(?:and\s*)?(\d+)\s*m(?:ins?|inutes?)?/gi,
      /(\d+\.?\d*)\s*h(?:ours?)?/gi,
      /(\d+)\s*m(?:ins?|inutes?)?(?!\w)/gi,
      // Natural language: "for about an hour", "around 45 minutes"
      /(?:for\s+)?(?:about|around|roughly|approximately|nearly)?\s*(\d+\.?\d*)\s*h(?:ours?)?/gi,
      /(?:for\s+)?(?:about|around|roughly|approximately|nearly)?\s*(\d+)\s*m(?:ins?|inutes?)?/gi,
      // Time ranges: "from 9am to 11am", "2-3pm"
      /from\s*(\d{1,2}):?(\d{2})?\s*([ap]m)?\s*(?:to|-)\s*(\d{1,2}):?(\d{2})?\s*([ap]m)?/gi,
      // Relative: "all morning", "whole afternoon"
      /(?:all|whole|entire)\s*(morning|afternoon|evening|day)/gi,
      // Fractional hours: "half an hour", "quarter hour"
      /(?:a\s+)?(?:(half|quarter|third)\s+(?:an?\s+)?hour)/gi
    ];

    // Comprehensive category mapping with weighted keywords
    this.categoryKeywords = {
      work: {
        primary: ['meeting', 'presentation', 'client', 'project', 'report', 'email', 'slack', 
                 'standup', 'sprint', 'code', 'coding', 'debug', 'deploy', 'review', 'planning',
                 'strategy', 'proposal', 'documentation', 'analysis', 'budget'],
        secondary: ['worked on', 'finished', 'completed', 'delivered', 'submitted', 'organized'],
        weight: 1.5
      },
      learning: {
        primary: ['course', 'tutorial', 'study', 'learn', 'practice', 'read', 'reading', 'book',
                 'article', 'research', 'video', 'lecture', 'class', 'training', 'workshop'],
        secondary: ['watched', 'explored', 'discovered', 'understood', 'figured out'],
        weight: 1.3
      },
      fitness: {
        primary: ['gym', 'workout', 'exercise', 'run', 'running', 'walk', 'walking', 'yoga',
                 'swim', 'bike', 'cycling', 'weights', 'cardio', 'stretching', 'sports'],
        secondary: ['burned', 'calories', 'steps', 'miles', 'km', 'reps', 'sets'],
        weight: 1.4
      },
      wellness: {
        primary: ['meditation', 'meditate', 'journal', 'therapy', 'breathing', 'mindfulness',
                 'relax', 'massage', 'spa', 'self-care', 'mental health', 'counseling'],
        secondary: ['calm', 'peaceful', 'centered', 'balanced', 'restored'],
        weight: 1.2
      },
      personal: {
        primary: ['shopping', 'groceries', 'cooking', 'cleaning', 'laundry', 'family', 'friends',
                 'call', 'chat', 'hobby', 'game', 'movie', 'show', 'music', 'art'],
        secondary: ['home', 'house', 'apartment', 'personal', 'life'],
        weight: 1.0
      }
    };

    // Sentiment/Quality indicators with intensity scores
    this.sentimentIndicators = {
      positive: {
        high: ['excellent', 'amazing', 'fantastic', 'wonderful', 'outstanding', 'brilliant', 
               'exceptional', 'perfect', 'superb', 'great'],
        medium: ['good', 'productive', 'focused', 'efficient', 'happy', 'satisfied', 'pleased',
                'comfortable', 'confident', 'energetic'],
        low: ['okay', 'fine', 'decent', 'alright', 'manageable', 'reasonable']
      },
      negative: {
        high: ['terrible', 'awful', 'horrible', 'disaster', 'nightmare', 'worst', 'unbearable'],
        medium: ['difficult', 'challenging', 'frustrating', 'stressful', 'tired', 'exhausted',
                'overwhelmed', 'anxious', 'worried'],
        low: ['slow', 'boring', 'tedious', 'mundane', 'repetitive', 'uninspiring']
      },
      neutral: ['normal', 'usual', 'regular', 'standard', 'routine', 'typical']
    };

    // Task quality indicators
    this.qualityIndicators = {
      completion: ['completed', 'finished', 'done', 'accomplished', 'achieved', 'delivered'],
      progress: ['worked on', 'continued', 'progressed', 'advanced', 'moved forward'],
      struggle: ['struggled', 'stuck', 'blocked', 'delayed', 'postponed'],
      interruption: ['interrupted', 'distracted', 'sidetracked', 'paused']
    };

    // Common task templates for better extraction
    this.taskTemplates = [
      /(?:I\s+)?(?:worked on|completed|finished|did|spent time on)\s+(.+?)(?:\s+for|\s+during|,|\.|\s+and\s+|$)/gi,
      /(.+?)\s+(?:took|lasted|went for)\s+/gi,
      /(?:had|attended|participated in)\s+(?:a\s+)?(.+?)(?:\s+for|\s+with|,|\.|\s+and\s+|$)/gi
    ];
  }

  // Main parsing function
  parseJournal(text) {
    // Normalize text
    const normalized = this.normalizeText(text);
    
    // Split into logical segments
    const segments = this.segmentText(normalized);
    
    // Extract tasks from each segment
    const tasks = [];
    for (const segment of segments) {
      const task = this.extractTaskFromSegment(segment);
      if (task && task.title) {
        tasks.push(task);
      }
    }
    
    // Post-process and merge related tasks
    return this.postProcessTasks(tasks);
  }

  normalizeText(text) {
    return text
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .replace(/[""]/g, '"')          // Normalize quotes
      .replace(/['']/g, "'")          // Normalize apostrophes
      .replace(/\s+([,.;])/g, '$1')   // Remove space before punctuation
      .trim();
  }

  segmentText(text) {
    // Smart segmentation based on multiple indicators
    const segments = [];
    
    // Try splitting by conjunctions and punctuation
    const patterns = [
      /(?:[.;!?]|\sand\s|\sthen\s|\safter that\s|\snext\s|\slater\s)/gi
    ];
    
    let remaining = text;
    for (const pattern of patterns) {
      const parts = remaining.split(pattern);
      if (parts.length > 1) {
        segments.push(...parts.filter(p => p.trim().length > 5));
        remaining = '';
        break;
      }
    }
    
    if (remaining) {
      segments.push(remaining);
    }
    
    return segments.map(s => s.trim()).filter(Boolean);
  }

  extractTaskFromSegment(segment) {
    const task = {
      title: '',
      duration: null,
      time: null,
      category: 'personal',
      sentiment: null,
      quality: null,
      notes: '',
      confidence: 0
    };

    // Extract time first (explicit times or periods)
    const timeInfo = this.extractTimeInfo(segment);

    // Extract duration with all patterns (also captures range start time)
    const durationInfo = this.extractDuration(segment);
    task.duration = durationInfo.minutes;
    // Prefer range start time if available; else use standalone time
    task.time = durationInfo.startTime || timeInfo.startTime || null;
    
    // Remove duration from segment for cleaner title extraction
    let cleanSegment = segment;
    if (durationInfo.matchedText) {
      cleanSegment = segment.replace(durationInfo.matchedText, '').trim();
    }
    if (timeInfo.matchedText) {
      cleanSegment = cleanSegment.replace(timeInfo.matchedText, '').trim();
    }

    // Extract task title using templates and heuristics
    task.title = this.extractTitle(cleanSegment);
    
    // Determine category with weighted scoring
    task.category = this.determineCategory(segment);
    
    // Extract sentiment and quality
    const sentimentInfo = this.extractSentiment(segment);
    task.sentiment = sentimentInfo.sentiment;
    task.quality = sentimentInfo.quality;
    
    // Calculate confidence score
    task.confidence = this.calculateConfidence(task, segment);
    
    // Build contextual notes
    task.notes = this.buildNotes(sentimentInfo, durationInfo, segment);
    
    return task;
  }

  extractDuration(text) {
    let totalMinutes = 0;
    let matchedText = '';
    let startTime = null;
    
    // Try time range patterns first (most specific)
    const rangeMatch = text.match(/from\s*(\d{1,2}):?(\d{2})?\s*([ap]m)?\s*(?:to|- )\s*(\d{1,2}):?(\d{2})?\s*([ap]m)?/i);
    if (rangeMatch) {
      const startHour = parseInt(rangeMatch[1]);
      const startMin = parseInt(rangeMatch[2] || '0');
      const endHour = parseInt(rangeMatch[4]);
      const endMin = parseInt(rangeMatch[5] || '0');
      
      // Handle AM/PM
      let adjustedStart = startHour;
      let adjustedEnd = endHour;
      if (rangeMatch[3] === 'pm' && startHour < 12) adjustedStart += 12;
      if (rangeMatch[6] === 'pm' && endHour < 12) adjustedEnd += 12;
      if (rangeMatch[3] === 'am' && startHour === 12) adjustedStart = 0;
      if (rangeMatch[6] === 'am' && endHour === 12) adjustedEnd = 0;
      
      totalMinutes = (adjustedEnd * 60 + endMin) - (adjustedStart * 60 + startMin);
      matchedText = rangeMatch[0];
      startTime = `${String(adjustedStart).padStart(2,'0')}:${String(startMin).padStart(2,'0')}`;
      return { minutes: totalMinutes > 0 ? totalMinutes : 0, matchedText, confidence: 0.95, startTime };
    }
    
    // Try relative duration patterns
    const relativeMatch = text.match(/(?:all|whole|entire)\s*(morning|afternoon|evening|day)/i);
    if (relativeMatch) {
      const periods = {
        'morning': 240,    // 4 hours
        'afternoon': 300,  // 5 hours
        'evening': 180,    // 3 hours
        'day': 480        // 8 hours
      };
      return { 
        minutes: periods[relativeMatch[1].toLowerCase()] || 120, 
        matchedText: relativeMatch[0],
        confidence: 0.7
      };
    }
    
    // Try fractional patterns
    const fractionMatch = text.match(/(?:a\s+)?(?:(half|quarter|third)\s+(?:an?\s+)?hour)/i);
    if (fractionMatch) {
      const fractions = {
        'half': 30,
        'quarter': 15,
        'third': 20
      };
      return { 
        minutes: fractions[fractionMatch[1].toLowerCase()] || 30, 
        matchedText: fractionMatch[0],
        confidence: 0.85
      };
    }
    
    // Try standard duration patterns
    for (const pattern of this.durationPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        let mins = 0;
        
        // Handle hours and minutes
        if (match[1] && match[2]) {
          // Format: 2h 30m
          mins = parseFloat(match[1]) * 60 + parseInt(match[2]);
        } else if (match[1] && match[0].toLowerCase().includes('h')) {
          // Format: 2h
          mins = parseFloat(match[1]) * 60;
        } else if (match[1]) {
          // Format: 30m
          mins = parseInt(match[1]);
        }
        
        if (mins > 0) {
          totalMinutes += mins;
          matchedText = match[0];
        }
      }
    }
    
    return { 
      minutes: totalMinutes || null, 
      matchedText,
      confidence: totalMinutes ? 0.9 : 0,
      startTime
    };
  }

  // Extract explicit time-of-day or qualitative periods
  extractTimeInfo(text) {
    const lower = text.toLowerCase();
    let settings = {};
    try { settings = JSON.parse(localStorage.getItem('appSettings') || '{}'); } catch {}
    const wake = settings?.sleep?.wake || '07:00';
    const bed = settings?.sleep?.bed || '22:30';
    // Explicit time like "at 3 pm", "3pm", "14:30"
    const explicitPatterns = [
      /\bat\s*(\d{1,2}):?(\d{2})?\s*([ap]m)?\b/i,
      /\b(\d{1,2}):(\d{2})\s*([ap]m)?\b/i,
      /\b(\d{1,2})\s*([ap]m)\b/i
    ];
    for (const pat of explicitPatterns) {
      const m = lower.match(pat);
      if (m) {
        let h = parseInt(m[1]);
        let min = parseInt(m[2] || '0');
        const ap = (m[3] || '').toLowerCase();
        if (ap === 'pm' && h < 12) h += 12;
        if (ap === 'am' && h === 12) h = 0;
        const startTime = `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
        return { startTime, matchedText: m[0] };
      }
    }

    // Periods of day
    // Build period map relative to wake/bed when sensible
    const [wakeH, wakeM] = wake.split(':').map(Number);
    const [bedH, bedM] = bed.split(':').map(Number);
    const clampH = (h)=> String(Math.min(23, Math.max(0, h))).padStart(2,'0');
    const periodMap = {
      morning: `${clampH(wakeH + 2)}:${String(wakeM).padStart(2,'0')}`,
      breakfast: `${clampH(wakeH + 1)}:${String(wakeM).padStart(2,'0')}`,
      noon: '12:00',
      midday: '12:00',
      lunch: '12:00',
      afternoon: '14:00',
      evening: `${clampH(bedH - 3)}:${String(bedM).padStart(2,'0')}`,
      dinner: `${clampH(bedH - 4)}:${String(bedM).padStart(2,'0')}`,
      night: `${clampH(bedH - 1)}:${String(bedM).padStart(2,'0')}`,
      tonight: `${clampH(bedH - 3)}:${String(bedM).padStart(2,'0')}`,
      midnight: '00:00'
    };
    const periodMatch = lower.match(/\b(morning|afternoon|evening|night|tonight|noon|midday|midnight|lunch|breakfast|dinner)\b/i);
    if (periodMatch) {
      return { startTime: periodMap[periodMatch[1].toLowerCase()], matchedText: periodMatch[0] };
    }
    return { startTime: null, matchedText: '' };
  }

  extractTitle(segment) {
    // Remove common filler words and clean up
    let title = segment
      .replace(/^(I\s+)?(also\s+)?/i, '')
      .replace(/\b(just|really|actually|basically|simply)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Try to match against task templates
    for (const template of this.taskTemplates) {
      const match = template.exec(title);
      if (match && match[1]) {
        title = match[1].trim();
        break;
      }
    }
    
    // Clean up the title
    title = title
      .replace(/\s*\([^)]*\)/g, '') // Remove parenthetical content
      .replace(/^(and|then|after|next)\s+/i, '') // Remove transition words
      .replace(/\s+(and|with|for)\s*$/i, '') // Remove trailing prepositions
      .trim();
    
    // Capitalize first letter
    if (title) {
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }
    
    return title;
  }

  determineCategory(text) {
    const scores = {};
    const lowerText = text.toLowerCase();
    
    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      let score = 0;
      
      // Check primary keywords (higher weight)
      for (const keyword of keywords.primary) {
        if (lowerText.includes(keyword)) {
          score += 2 * keywords.weight;
        }
      }
      
      // Check secondary keywords (lower weight)
      for (const keyword of keywords.secondary) {
        if (lowerText.includes(keyword)) {
          score += 1 * keywords.weight;
        }
      }
      
      scores[category] = score;
    }
    
    // Return category with highest score, default to 'personal'
    const bestCategory = Object.entries(scores)
      .sort(([,a], [,b]) => b - a)[0];
    
    return (bestCategory && bestCategory[1] > 0) ? bestCategory[0] : 'personal';
  }

  extractSentiment(text) {
    const lowerText = text.toLowerCase();
    let sentiment = 'neutral';
    let quality = null;
    let intensity = 0;
    const emotions = [];
    
    // Check positive sentiments
    for (const [level, words] of Object.entries(this.sentimentIndicators.positive)) {
      for (const word of words) {
        if (lowerText.includes(word)) {
          emotions.push(word);
          const levelIntensity = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
          if (levelIntensity > intensity) {
            sentiment = 'positive';
            intensity = levelIntensity;
          }
        }
      }
    }
    
    // Check negative sentiments (can override positive if stronger)
    for (const [level, words] of Object.entries(this.sentimentIndicators.negative)) {
      for (const word of words) {
        if (lowerText.includes(word)) {
          emotions.push(word);
          const levelIntensity = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
          if (levelIntensity >= intensity) {
            sentiment = 'negative';
            intensity = levelIntensity;
          }
        }
      }
    }
    
    // Check quality indicators
    for (const [qualityType, words] of Object.entries(this.qualityIndicators)) {
      for (const word of words) {
        if (lowerText.includes(word)) {
          quality = qualityType;
          break;
        }
      }
    }
    
    return {
      sentiment,
      intensity,
      quality,
      emotions: [...new Set(emotions)]
    };
  }

  calculateConfidence(task, originalSegment) {
    let confidence = 0;
    
    // Title extraction confidence
    if (task.title && task.title.length > 5) confidence += 0.3;
    if (task.title && !task.title.includes('...')) confidence += 0.1;
    
    // Duration confidence
    if (task.duration) confidence += 0.2;
    
    // Category confidence (not default)
    if (task.category !== 'personal') confidence += 0.2;
    
    // Sentiment/quality confidence
    if (task.sentiment !== 'neutral') confidence += 0.1;
    if (task.quality) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  buildNotes(sentimentInfo, durationInfo, segment) {
    const notes = [];
    
    // Add emotional context
    if (sentimentInfo.emotions.length > 0) {
      notes.push(`Felt ${sentimentInfo.emotions.join(', ')}`);
    }
    
    // Add quality context
    if (sentimentInfo.quality) {
      const qualityText = {
        'completion': 'Successfully completed',
        'progress': 'Made progress',
        'struggle': 'Experienced challenges',
        'interruption': 'Had interruptions'
      };
      notes.push(qualityText[sentimentInfo.quality]);
    }
    
    // Add intensity if significant
    if (sentimentInfo.intensity >= 2) {
      const intensityText = sentimentInfo.intensity === 3 ? 'Very' : 'Moderately';
      notes.push(`${intensityText} ${sentimentInfo.sentiment}`);
    }
    
    // Add confidence note if low
    if (durationInfo.confidence && durationInfo.confidence < 0.8) {
      notes.push('Duration estimated');
    }
    
    return notes.join('. ');
  }

  postProcessTasks(tasks) {
    // Merge consecutive tasks that might be related
    const processed = [];
    
    for (let i = 0; i < tasks.length; i++) {
      const current = tasks[i];
      
      // Check if this might be additional context for previous task
      if (i > 0 && current.confidence < 0.5) {
        const prev = processed[processed.length - 1];
        if (prev && this.shouldMergeTasks(prev, current)) {
          // Merge into previous task
          prev.notes = [prev.notes, current.notes].filter(Boolean).join('. ');
          if (!prev.duration && current.duration) {
            prev.duration = current.duration;
          }
          continue;
        }
      }
      
      processed.push(current);
    }
    
    return processed;
  }

  shouldMergeTasks(task1, task2) {
    // Don't merge if both have good titles
    if (task1.title.length > 10 && task2.title.length > 10) return false;
    
    // Merge if categories match and one has low confidence
    if (task1.category === task2.category && task2.confidence < 0.4) return true;
    
    // Merge if second task seems like a continuation
    const continuationWords = ['also', 'then', 'after', 'plus', 'and'];
    if (continuationWords.some(word => task2.title.toLowerCase().startsWith(word))) return true;
    
    return false;
  }
}

// Enhanced UI component for preview with confidence visualization
class JournalPreviewUI {
  constructor(parser) {
    this.parser = parser;
  }

  generatePreviewHTML(tasks) {
    if (!tasks.length) {
      return '<div class="no-tasks">No tasks detected. Try being more specific about activities and durations.</div>';
    }

    const html = tasks.map(task => {
      const confidenceClass = task.confidence > 0.7 ? 'high' : task.confidence > 0.4 ? 'medium' : 'low';
      const sentimentIcon = {
        'positive': '😊',
        'negative': '😔',
        'neutral': '😐'
      }[task.sentiment] || '';

      return `
        <div class="task-preview ${confidenceClass}-confidence">
          <div class="task-header">
            <span class="task-title">${task.title}</span>
            <span class="task-meta">
              ${task.duration ? `⏱️ ${task.duration}m` : ''}
              ${sentimentIcon}
              <span class="category-badge ${task.category}">${task.category}</span>
            </span>
          </div>
          ${task.notes ? `<div class="task-notes">${task.notes}</div>` : ''}
          <div class="confidence-bar">
            <div class="confidence-fill" style="width: ${task.confidence * 100}%"></div>
            <span class="confidence-label">Confidence: ${Math.round(task.confidence * 100)}%</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="preview-container">
        <div class="preview-header">Detected ${tasks.length} task(s)</div>
        ${html}
      </div>
    `;
  }
}

// Initialize the enhanced parser once and bind events safely
(() => {
  if (window.__journalNLP_bound__) return; // prevent duplicate bindings
  window.__journalNLP_bound__ = true;
  const nlpParser = new JournalNLPParser();
  const previewUI = new JournalPreviewUI(nlpParser);

  const previewBtn = document.getElementById('previewBtn');
  const saveBtn = document.getElementById('saveJournalBtn');
  const input = document.getElementById('journalInput');
  const preview = document.getElementById('journalPreview');
  if (!previewBtn || !saveBtn || !input || !preview) return;

  previewBtn.addEventListener('click', () => {
    const text = input.value;
    const tasks = nlpParser.parseJournal(text);
    preview.innerHTML = previewUI.generatePreviewHTML(tasks);
  });

  saveBtn.addEventListener('click', async () => {
    const text = input.value;
    const parsed = nlpParser.parseJournal(text);
    if (!parsed.length) {
      alert('No tasks detected. Try describing specific activities with durations.');
      return;
    }
    if (window.TaskAPI?.ensureDBReady) { await window.TaskAPI.ensureDBReady(); }
    const today = new Date().toISOString().split('T')[0];
    let savedCount = 0;
    for (const p of parsed) {
      if (p.confidence < 0.3) continue;
      const task = {
        title: p.title,
        description: p.notes || '',
        priority: p.sentiment === 'positive' ? 'high' : p.sentiment === 'negative' ? 'low' : 'medium',
        date: today,
        time: p.time || '',
        duration: p.duration || 60,
        category: p.category,
        goalId: null,
        completed: true,
        sentiment: p.sentiment,
        quality: p.quality,
        confidence: p.confidence
      };
      await window.TaskAPI.saveTask(task);
      savedCount++;
    }
    alert(`Saved ${savedCount} task(s). Analytics dashboard will update shortly.`);
    showSaveSummary(parsed);
  });
})();

// Summary visualization after save
function showSaveSummary(tasks) {
  const summary = {
    totalTime: tasks.reduce((sum, t) => sum + (t.duration || 0), 0),
    byCategory: {},
    avgSentiment: 0
  };
  
  tasks.forEach(t => {
    if (!summary.byCategory[t.category]) {
      summary.byCategory[t.category] = { count: 0, minutes: 0 };
    }
    summary.byCategory[t.category].count++;
    summary.byCategory[t.category].minutes += t.duration || 0;
  });
  
  // Calculate average sentiment
  const sentimentScores = {
    'positive': 1,
    'neutral': 0,
    'negative': -1
  };
  summary.avgSentiment = tasks.reduce((sum, t) => 
    sum + sentimentScores[t.sentiment], 0) / tasks.length;
  
  console.log('Day Summary:', summary);
  // You could display this in a modal or tooltip
}