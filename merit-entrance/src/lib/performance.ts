/**
 * Performance and Difficulty Utilities
 * 
 * These utilities provide standardized calculations for difficulty badges
 * and performance factors across the application.
 */

/**
 * Difficulty Level Scale:
 * - 1.0 - 1.5: Easy (Green)
 * - 1.6 - 2.5: Medium (Yellow)
 * - 2.6 - 3.5: Moderate (Orange)
 * - 3.6 - 4.0+: Hard (Red)
 */
export const getDifficultyBadge = (difficulty: number): { label: string; color: string } => {
    if (difficulty <= 1.5) return { label: 'Easy', color: 'bg-green-100 text-green-700' };
    if (difficulty <= 2.5) return { label: 'Medium', color: 'bg-yellow-100 text-yellow-700' };
    if (difficulty <= 3.5) return { label: 'Moderate', color: 'bg-orange-100 text-orange-700' };
    return { label: 'Hard', color: 'bg-red-100 text-red-700' };
};

/**
 * Performance Factor Formula:
 * Performance = (Score ÷ MaxScore) × (1 + (Difficulty - 1) × 0.2)
 * 
 * Derivation:
 * - Base: Score ratio (0 to 1)
 * - Difficulty Multiplier: Amplifies performance based on difficulty level
 *   - Easy (1): 1.0x multiplier
 *   - Medium (2): 1.2x multiplier
 *   - Moderate (3): 1.4x multiplier
 *   - Hard (4): 1.6x multiplier
 * 
 * This rewards students who perform well on harder questions.
 * Example: 80% score on Hard (4) = 0.8 × 1.6 = 1.28 performance factor
 */
export const calculatePerformanceFactor = (
    score: number,
    maxScore: number,
    difficulty: number
): number => {
    if (maxScore === 0) return 0;
    const basePerformance = score / maxScore;
    const difficultyMultiplier = 1 + (difficulty - 1) * 0.2;
    return Math.round(basePerformance * difficultyMultiplier * 100) / 100;
};

/**
 * Returns color class based on performance factor
 * - >= 0.8: Green (Excellent)
 * - >= 0.5: Yellow (Average)
 * - < 0.5: Red (Needs Improvement)
 */
export const getPerformanceColor = (factor: number): string => {
    if (factor >= 0.8) return 'text-green-600';
    if (factor >= 0.5) return 'text-yellow-600';
    return 'text-red-500';
};

/**
 * Get difficulty color class for inline styling (without badge)
 */
export const getDifficultyColor = (difficulty: number): string => {
    if (difficulty >= 3.5) return 'bg-red-50 text-red-600';
    if (difficulty >= 2.5) return 'bg-yellow-50 text-yellow-600';
    return 'bg-green-50 text-green-600';
};
