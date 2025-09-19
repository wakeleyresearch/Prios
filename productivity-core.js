// Prios productivity scoring core utilities
(function(global) {
  const DEFAULT_WEIGHTS = { effort: 0.25, duration: 0.25, quality: 0.25, goal: 0.25 };
  const PRIORITY_BASE = { high: 90, medium: 65, low: 45 };
  const CATEGORY_QUALITY = {
    work: 85,
    learning: 80,
    fitness: 72,
    personal: 60,
    wellness: 58,
    uncategorized: 55
  };
  const ENERGY_MULTIPLIER = {
    high: 1.12,
    elevated: 1.06,
    medium: 1,
    low: 0.88,
    depleted: 0.75
  };
  const FOCUS_PROFILE = {
    deep: { effort: 1.08, duration: 1.05, quality: 1.05 },
    creative: { effort: 1.04, duration: 0.96, quality: 1.08 },
    collaborative: { effort: 1.02, duration: 0.98, quality: 1.02 },
    administrative: { effort: 0.96, duration: 1.04, quality: 0.94 },
    recovery: { effort: 0.75, duration: 0.85, quality: 0.9 },
    balanced: { effort: 1, duration: 1, quality: 1 }
  };

  const CONTEXT_BONUS = {
    deadline: 8,
    review: 6,
    preparation: 5,
    delivery: 10,
    learning: 4
  };

  function clamp(value, min = 0, max = 100) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }

  function normalizeWeights(weights) {
    const entries = Object.entries(weights || {});
    if (!entries.length) return { ...DEFAULT_WEIGHTS };
    const total = entries.reduce((sum, [, val]) => sum + (Number(val) || 0), 0) || 1;
    const normalized = {};
    for (const [key, val] of entries) {
      normalized[key] = (Number(val) || 0) / total;
    }
    for (const key of Object.keys(DEFAULT_WEIGHTS)) {
      if (normalized[key] === undefined) {
        normalized[key] = DEFAULT_WEIGHTS[key];
      }
    }
    return normalized;
  }

  function effectiveEnergy(level) {
    return ENERGY_MULTIPLIER[level] || ENERGY_MULTIPLIER.medium;
  }

  function focusAdjustments(mode) {
    return FOCUS_PROFILE[mode] || FOCUS_PROFILE.balanced;
  }

  function computeComponents(task = {}, options = {}) {
    const duration = Number(task.duration) || 0;
    const completionRatio = task.completed ? 1 : Math.min(0.85, Number(task.progress || 0.5));
    const energyLevel = task.energyLevel || task.energy || 'medium';
    const focusMode = task.focusMode || 'balanced';
    const contextTags = Array.isArray(task.contextTags) ? task.contextTags : [];
    const goalLinked = Boolean(task.goalId);
    const qualityOverride = Number(task.qualityScore);
    const confidence = typeof task.confidence === 'number' ? clamp(task.confidence, 0, 1) : 0.8;

    const baseEffort = PRIORITY_BASE[task.priority] || 55;
    const energyBoost = effectiveEnergy(energyLevel);
    const focusBoost = focusAdjustments(focusMode).effort;
    const durationContribution = Math.min(duration / 90, 1.2) * 20;
    let effort = baseEffort * energyBoost * focusBoost + durationContribution;

    const optimalDuration = Number(options.optimalDuration || 60);
    const durationRatio = optimalDuration > 0 ? duration / optimalDuration : 1;
    let durationScore = 100 * Math.exp(-0.8 * Math.pow(Math.log(durationRatio || 1), 2));
    durationScore *= focusAdjustments(focusMode).duration;
    durationScore *= goalLinked ? 1.02 : 1;
    durationScore *= completionRatio;

    const categoryQuality = CATEGORY_QUALITY[String(task.category || 'uncategorized')] || CATEGORY_QUALITY.uncategorized;
    let qualityScore = qualityOverride || categoryQuality;
    qualityScore *= focusAdjustments(focusMode).quality;
    if (task.sentiment === 'positive') qualityScore += 6;
    if (task.sentiment === 'negative') qualityScore -= 8;
    qualityScore += Math.min(10, (Number(task.lift) || 0));

    let goalScore = goalLinked ? 78 : 38;
    if (task.goalImportance) {
      goalScore += clamp(Number(task.goalImportance) * 10, 0, 15);
    }
    if (task.goalUrgency) {
      goalScore += clamp(Number(task.goalUrgency) * 8, -10, 12);
    }
    for (const tag of contextTags) {
      goalScore += CONTEXT_BONUS[tag] || 0;
    }

    const contextPenalty = clamp(1 - Math.min(0.35, (Number(task.contextSwitches) || 0) * 0.07), 0.6, 1);
    effort *= contextPenalty;
    durationScore *= contextPenalty;

    const confidenceFloor = 0.6 + confidence * 0.4;
    effort *= confidenceFloor;
    durationScore *= confidenceFloor;
    qualityScore *= confidenceFloor;
    goalScore *= confidenceFloor;

    return {
      effort: clamp(effort),
      duration: clamp(durationScore),
      quality: clamp(qualityScore),
      goal: clamp(goalScore)
    };
  }

  function computeComposite(components, weights) {
    const normalizedWeights = normalizeWeights(weights || DEFAULT_WEIGHTS);
    const { effort = 0, duration = 0, quality = 0, goal = 0 } = components || {};
    return clamp(
      normalizedWeights.effort * effort +
      normalizedWeights.duration * duration +
      normalizedWeights.quality * quality +
      normalizedWeights.goal * goal
    );
  }

  function validateComponents(components) {
    const validated = {};
    for (const key of ['effort', 'duration', 'quality', 'goal']) {
      validated[key] = clamp(Number(components?.[key]) || 0);
    }
    return validated;
  }

  function scoreTask(task, options) {
    const components = computeComponents(task, options);
    const composite = computeComposite(components, options?.weights);
    return {
      components,
      composite,
      weights: normalizeWeights(options?.weights || DEFAULT_WEIGHTS)
    };
  }

  function sanitizeTask(task) {
    if (!task || typeof task !== 'object') return {};
    return {
      ...task,
      duration: Number(task.duration) || 0,
      priority: task.priority || 'medium',
      category: task.category || 'personal',
      energyLevel: task.energyLevel || task.energy || 'medium',
      focusMode: task.focusMode || 'balanced',
      contextTags: Array.isArray(task.contextTags) ? task.contextTags : [],
      collaborators: Array.isArray(task.collaborators) ? task.collaborators : [],
      confidence: typeof task.confidence === 'number' ? task.confidence : 0.8
    };
  }

  global.PriosScoring = {
    DEFAULT_WEIGHTS,
    clamp,
    computeComponents,
    computeComposite,
    normalizeWeights,
    scoreTask,
    validateComponents,
    sanitizeTask
  };
})(typeof window !== 'undefined' ? window : globalThis);
