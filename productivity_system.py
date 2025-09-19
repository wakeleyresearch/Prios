#!/usr/bin/env python3
"""
Advanced Productivity Scoring System
Implements the complete mathematical framework for S = w_e·E + w_d·D + w_q·Q + w_g·G
"""

import numpy as np
import pandas as pd
import json
from scipy import stats
from scipy.signal import find_peaks
from sklearn.preprocessing import MinMaxScaler, StandardScaler
from typing import Dict, List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

class ProductivityScoringSystem:
    """
    Complete implementation of the mathematical productivity framework
    """
    
    def __init__(self):
        self.weights = {'effort': 0.25, 'duration': 0.25, 'quality': 0.25, 'goal': 0.25}
        self.scaler = MinMaxScaler()
        self.ewma_alpha = 0.2
        self.cusum_threshold = 5
        self.hmm_states = 3
        
    def robust_sigmoid_normalization(self, x: np.ndarray, use_median: bool = True) -> np.ndarray:
        """
        Sigmoid normalization using robust statistics
        From the mathematical framework document
        """
        if use_median:
            center = np.median(x)
            scale = (np.percentile(x, 75) - np.percentile(x, 25)) / 1.35
        else:
            center = np.mean(x)
            scale = np.std(x)
        
        if scale == 0:
            scale = 1  # Prevent division by zero
            
        return 1 / (1 + np.exp(-(x - center) / scale))
    
    def advanced_duration_score(self, estimated_time: float, actual_time: float, 
                               complexity_factor: float = 1.0) -> float:
        """
        Duration efficiency with complexity adjustment
        """
        base_ratio = estimated_time / actual_time if actual_time > 0 else 1
        adjusted_ratio = base_ratio * complexity_factor
        return 1 / (1 + np.exp(-5 * (adjusted_ratio - 0.8)))
    
    def calculate_composite_score(self, E: np.ndarray, D: np.ndarray, 
                                 Q: np.ndarray, G: np.ndarray) -> np.ndarray:
        """
        Calculate composite productivity score
        """
        w = self.weights
        return (w['effort'] * E + w['duration'] * D + 
                w['quality'] * Q + w['goal'] * G)
    
    def adam_optimizer(self, gradients: Dict[str, float], iteration: int = 1,
                      m: Optional[Dict] = None, v: Optional[Dict] = None) -> Dict[str, float]:
        """
        Adam optimizer for weight updates
        """
        beta1 = 0.9
        beta2 = 0.999
        epsilon = 1e-8
        eta = 0.001
        
        if m is None:
            m = {k: 0 for k in gradients}
        if v is None:
            v = {k: 0 for k in gradients}
        
        updated_weights = {}
        
        for key in gradients:
            # Update biased first moment estimate
            m[key] = beta1 * m[key] + (1 - beta1) * gradients[key]
            # Update biased second raw moment estimate
            v[key] = beta2 * v[key] + (1 - beta2) * (gradients[key] ** 2)
            
            # Compute bias-corrected first moment estimate
            m_hat = m[key] / (1 - beta1 ** iteration)
            # Compute bias-corrected second raw moment estimate
            v_hat = v[key] / (1 - beta2 ** iteration)
            
            # Update weights
            updated_weights[key] = self.weights[key] - eta * (m_hat / (np.sqrt(v_hat) + epsilon))
        
        # Normalize to ensure sum = 1
        total = sum(updated_weights.values())
        for key in updated_weights:
            updated_weights[key] = max(0.01, updated_weights[key] / total)
        
        return updated_weights
    
    def adaptive_cusum_ewma_detector(self, data: np.ndarray, 
                                    dynamic_threshold: bool = True) -> Tuple[List[int], np.ndarray]:
        """
        Combined CUSUM-EWMA algorithm for anomaly detection
        """
        n = len(data)
        lambda_ewma = 0.2
        k = 0.5  # CUSUM slack parameter
        
        # Dynamic threshold calculation using MAD
        if dynamic_threshold:
            mad = np.median(np.abs(data - np.median(data)))
            h = 5 * mad if mad > 0 else self.cusum_threshold
            mu0 = np.median(data)
        else:
            h = self.cusum_threshold
            mu0 = np.mean(data)
        
        cusum_pos = np.zeros(n)
        cusum_neg = np.zeros(n)
        ewma = np.zeros(n)
        ewma[0] = data[0] if len(data) > 0 else 0
        
        anomalies = []
        
        for t in range(1, n):
            # EWMA update
            ewma[t] = lambda_ewma * data[t] + (1 - lambda_ewma) * ewma[t-1]
            
            # CUSUM calculation
            cusum_pos[t] = max(0, cusum_pos[t-1] + (ewma[t] - mu0 - k))
            cusum_neg[t] = max(0, cusum_neg[t-1] - (ewma[t] - mu0 + k))
            
            # Adaptive threshold adjustment
            if dynamic_threshold and t > 100:
                recent_window = ewma[max(0, t-100):t]
                h = 5 * np.std(recent_window) if len(recent_window) > 0 else h
            
            if cusum_pos[t] > h or cusum_neg[t] > h:
                anomalies.append(t)
                # Reset after detection
                cusum_pos[t] = 0
                cusum_neg[t] = 0
        
        return anomalies, ewma
    
    def calculate_cronbach_alpha(self, data: np.ndarray) -> float:
        """
        Calculate Cronbach's alpha for reliability assessment
        """
        k = data.shape[1]  # Number of items
        
        # Calculate item variances
        item_variances = np.var(data, axis=0)
        
        # Calculate total score variance
        total_scores = np.sum(data, axis=1)
        total_variance = np.var(total_scores)
        
        if total_variance == 0:
            return 0
        
        # Calculate Cronbach's alpha
        alpha = (k / (k - 1)) * (1 - np.sum(item_variances) / total_variance)
        
        return max(0, min(1, alpha))  # Bound between 0 and 1
    
    def bootstrap_bca_confidence_interval(self, data: np.ndarray, 
                                        statistic: callable = np.mean,
                                        n_bootstrap: int = 1000, 
                                        alpha: float = 0.05) -> Tuple[float, float]:
        """
        BCa bootstrap confidence intervals with acceleration correction
        """
        bootstrap_statistics = []
        
        for _ in range(n_bootstrap):
            sample = np.random.choice(data, size=len(data), replace=True)
            bootstrap_statistics.append(statistic(sample))
        
        bootstrap_statistics = np.array(bootstrap_statistics)
        
        # Calculate bias correction
        original_stat = statistic(data)
        z0 = stats.norm.ppf(np.mean(bootstrap_statistics < original_stat))
        
        # Calculate acceleration using jackknife
        jackknife_values = []
        for i in range(len(data)):
            jack_sample = np.delete(data, i)
            jackknife_values.append(statistic(jack_sample))
        
        jackknife_values = np.array(jackknife_values)
        jack_mean = np.mean(jackknife_values)
        
        # Acceleration factor
        numerator = np.sum((jack_mean - jackknife_values) ** 3)
        denominator = 6 * (np.sum((jack_mean - jackknife_values) ** 2) ** 1.5)
        acceleration = numerator / denominator if denominator != 0 else 0
        
        # Compute BCa intervals
        z_alpha = stats.norm.ppf(alpha / 2)
        
        # Avoid division by zero
        denom1 = 1 - acceleration * (z0 + z_alpha)
        denom2 = 1 - acceleration * (z0 - z_alpha)
        
        if denom1 != 0:
            alpha1 = stats.norm.cdf(z0 + (z0 + z_alpha) / denom1)
        else:
            alpha1 = alpha / 2
            
        if denom2 != 0:
            alpha2 = stats.norm.cdf(z0 + (z0 - z_alpha) / denom2)
        else:
            alpha2 = 1 - alpha / 2
        
        lower = np.percentile(bootstrap_statistics, 100 * alpha1)
        upper = np.percentile(bootstrap_statistics, 100 * alpha2)
        
        return lower, upper
    
    def generate_parallel_coords_data(self, n_tasks: int = 100, 
                                     n_days: int = 7) -> Dict:
        """
        Generate synthetic productivity data for parallel coordinates visualization
        """
        np.random.seed(42)  # For reproducibility
        
        # Initialize data arrays
        effort_scores = np.zeros((n_tasks, n_days))
        duration_scores = np.zeros((n_tasks, n_days))
        quality_scores = np.zeros((n_tasks, n_days))
        goal_scores = np.zeros((n_tasks, n_days))
        
        # Task categories (for color mapping)
        task_values = np.random.uniform(0, 1, n_tasks)
        
        # Generate realistic patterns
        for task_idx in range(n_tasks):
            # Base productivity level for this task
            base_effort = np.random.uniform(40, 80)
            base_duration = np.random.uniform(50, 90)
            base_quality = np.random.uniform(30, 70)
            base_goal = np.random.uniform(45, 85)
            
            # Task value influences performance
            value_boost = task_values[task_idx] * 20
            
            for day in range(n_days):
                # Day-of-week effects
                dow_effect = self._day_of_week_effect(day)
                
                # Generate component scores with patterns
                effort_scores[task_idx, day] = np.clip(
                    base_effort + dow_effect['effort'] + np.random.normal(0, 5) + value_boost,
                    0, 100
                )
                
                duration_scores[task_idx, day] = np.clip(
                    base_duration + dow_effect['duration'] + np.random.normal(0, 4),
                    0, 100
                )
                
                quality_scores[task_idx, day] = np.clip(
                    base_quality + dow_effect['quality'] + np.random.normal(0, 6) + value_boost/2,
                    0, 100
                )
                
                goal_scores[task_idx, day] = np.clip(
                    base_goal + dow_effect['goal'] + np.random.normal(0, 3),
                    0, 100
                )
        
        # Normalize using robust sigmoid
        effort_norm = np.array([self.robust_sigmoid_normalization(effort_scores[:, d]) 
                                for d in range(n_days)]).T * 100
        duration_norm = np.array([self.robust_sigmoid_normalization(duration_scores[:, d]) 
                                  for d in range(n_days)]).T * 100
        quality_norm = np.array([self.robust_sigmoid_normalization(quality_scores[:, d]) 
                                 for d in range(n_days)]).T * 100
        goal_norm = np.array([self.robust_sigmoid_normalization(goal_scores[:, d]) 
                              for d in range(n_days)]).T * 100
        
        # Calculate composite scores
        composite_scores = np.zeros((n_tasks, n_days))
        for day in range(n_days):
            composite_scores[:, day] = self.calculate_composite_score(
                effort_norm[:, day], 
                duration_norm[:, day],
                quality_norm[:, day], 
                goal_norm[:, day]
            )
        
        # Detect anomalies
        all_scores = composite_scores.flatten()
        anomalies, ewma = self.adaptive_cusum_ewma_detector(all_scores)
        
        # Calculate statistics
        cronbach_alpha = self.calculate_cronbach_alpha(composite_scores)
        
        # Bootstrap confidence intervals for mean
        mean_scores = np.mean(composite_scores, axis=1)
        ci_lower, ci_upper = self.bootstrap_bca_confidence_interval(mean_scores)
        
        # Prepare data for parallel coordinates
        parallel_data = []
        for task_idx in range(n_tasks):
            task_data = list(composite_scores[task_idx, :])
            task_data.append(task_values[task_idx] * 100)  # Add value for color
            parallel_data.append(task_data)
        
        return {
            'parallel_data': parallel_data,
            'weights': self.weights,
            'cronbach_alpha': cronbach_alpha,
            'confidence_interval': (ci_lower, ci_upper),
            'anomalies': anomalies,
            'ewma': ewma.tolist(),
            'statistics': {
                'mean': np.mean(composite_scores),
                'std': np.std(composite_scores),
                'median': np.median(composite_scores),
                'q1': np.percentile(composite_scores, 25),
                'q3': np.percentile(composite_scores, 75)
            }
        }
    
    def _day_of_week_effect(self, day: int) -> Dict[str, float]:
        """
        Realistic day-of-week productivity patterns
        """
        # Monday (1) and Tuesday (2) - high productivity
        # Wednesday (3) - moderate
        # Thursday (4) - dip
        # Friday (5) - recovery
        # Weekend (0, 6) - variable
        
        effects = {
            0: {'effort': -10, 'duration': -5, 'quality': 0, 'goal': -15},    # Sunday
            1: {'effort': 15, 'duration': 10, 'quality': 12, 'goal': 18},     # Monday
            2: {'effort': 12, 'duration': 15, 'quality': 10, 'goal': 14},     # Tuesday
            3: {'effort': 5, 'duration': 8, 'quality': 8, 'goal': 10},        # Wednesday
            4: {'effort': -8, 'duration': -10, 'quality': -5, 'goal': -12},   # Thursday
            5: {'effort': 3, 'duration': 5, 'quality': 10, 'goal': 8},        # Friday
            6: {'effort': -5, 'duration': 0, 'quality': 5, 'goal': -8}        # Saturday
        }
        
        return effects.get(day, {'effort': 0, 'duration': 0, 'quality': 0, 'goal': 0})
    
    def export_for_visualization(self, output_file: str = 'productivity_data.json'):
        """
        Export data in format ready for ECharts visualization
        """
        data = self.generate_parallel_coords_data()
        
        # Format for ECharts
        echarts_data = {
            'data': data['parallel_data'],
            'dimensions': [
                {'name': 'Sun', 'min': 0, 'max': 100},
                {'name': 'Mon', 'min': 0, 'max': 100},
                {'name': 'Tue', 'min': 0, 'max': 100},
                {'name': 'Wed', 'min': 0, 'max': 100},
                {'name': 'Thu', 'min': 0, 'max': 100},
                {'name': 'Fri', 'min': 0, 'max': 100},
                {'name': 'Sat', 'min': 0, 'max': 100},
                {'name': 'Value', 'min': 0, 'max': 100}
            ],
            'metadata': {
                'weights': data['weights'],
                'cronbach_alpha': float(data['cronbach_alpha']),
                'confidence_interval': data['confidence_interval'],
                'statistics': data['statistics'],
                'anomaly_count': len(data['anomalies'])
            }
        }
        
        with open(output_file, 'w') as f:
            json.dump(echarts_data, f, indent=2)
        
        print(f"Data exported to {output_file}")
        print(f"Cronbach's Alpha: {data['cronbach_alpha']:.3f}")
        print(f"Mean Score: {data['statistics']['mean']:.1f}")
        print(f"Confidence Interval: [{data['confidence_interval'][0]:.1f}, {data['confidence_interval'][1]:.1f}]")
        print(f"Anomalies Detected: {len(data['anomalies'])}")
        
        return echarts_data


def main():
    """
    Generate productivity data for visualization
    """
    system = ProductivityScoringSystem()
    
    # Generate and export data
    data = system.export_for_visualization()
    
    # Demonstrate weight optimization
    print("\nOptimizing weights using Adam optimizer...")
    
    # Simulate gradients (in practice, these would come from backpropagation)
    gradients = {
        'effort': np.random.uniform(-0.1, 0.1),
        'duration': np.random.uniform(-0.1, 0.1),
        'quality': np.random.uniform(-0.1, 0.1),
        'goal': np.random.uniform(-0.1, 0.1)
    }
    
    new_weights = system.adam_optimizer(gradients, iteration=1)
    print(f"Original weights: {system.weights}")
    print(f"Updated weights: {new_weights}")
    
    # Generate sample productivity report
    print("\n" + "="*50)
    print("PRODUCTIVITY ANALYSIS REPORT")
    print("="*50)
    
    stats = data['metadata']['statistics']
    print(f"\nPerformance Metrics:")
    print(f"  • Mean Score: {stats['mean']:.1f}")
    print(f"  • Std Deviation: {stats['std']:.1f}")
    print(f"  • Median: {stats['median']:.1f}")
    print(f"  • IQR: {stats['q1']:.1f} - {stats['q3']:.1f}")
    
    print(f"\nReliability Assessment:")
    print(f"  • Cronbach's α: {data['metadata']['cronbach_alpha']:.3f}")
    
    reliability_interpretation = {
        0.9: "Excellent",
        0.8: "Good",
        0.7: "Acceptable",
        0.6: "Questionable",
        0.0: "Poor"
    }
    
    alpha = data['metadata']['cronbach_alpha']
    for threshold, label in sorted(reliability_interpretation.items(), reverse=True):
        if alpha >= threshold:
            print(f"  • Interpretation: {label}")
            break
    
    print(f"\nAnomaly Detection:")
    print(f"  • Anomalies Found: {data['metadata']['anomaly_count']}")
    print(f"  • Detection Method: CUSUM-EWMA with adaptive thresholds")
    
    print("\nVisualization ready at: productivity-parallel-coords.html")


if __name__ == "__main__":
    main()