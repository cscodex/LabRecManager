'use client';

interface QuestionStatsProps {
    stats?: {
        difficultyDistribution?: Record<number, number>;
        typeDistribution?: Record<string, number>;
        totalQuestions?: number;
    };
    questions: { id: string; type: string; difficulty: number; tags: { id: string; name: string }[] }[];
}

export default function QuestionStats({ stats, questions }: QuestionStatsProps) {
    // Use server-side stats if available, otherwise compute from current page
    const difficultyCounts: Record<number, number> = stats?.difficultyDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const typeCounts: Record<string, number> = stats?.typeDistribution || {};
    const totalQ = stats?.totalQuestions || questions.length;

    // If no server stats, calculate from current page
    if (!stats?.difficultyDistribution) {
        questions.forEach(q => { difficultyCounts[q.difficulty] = (difficultyCounts[q.difficulty] || 0) + 1; });
    }
    if (!stats?.typeDistribution) {
        questions.forEach(q => { typeCounts[q.type] = (typeCounts[q.type] || 0) + 1; });
    }

    // Tag counts always from current page (tags change with filters)
    const tagCounts: Record<string, number> = {};
    questions.forEach(q => {
        if (q.tags && q.tags.length > 0) {
            q.tags.forEach(t => { tagCounts[t.name] = (tagCounts[t.name] || 0) + 1; });
        } else {
            tagCounts['No Tag'] = (tagCounts['No Tag'] || 0) + 1;
        }
    });
    const sortedTags = Object.entries(tagCounts).sort(([, a], [, b]) => b - a).slice(0, 8);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Tag Distribution */}
            <div className="bg-white p-4 rounded-xl shadow-sm border">
                <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Questions by Tag</h3>
                <div className="space-y-2">
                    {sortedTags.map(([tag, count]) => (
                        <div key={tag} className="flex items-center justify-between text-sm">
                            <span className="truncate max-w-[70%] text-gray-700" title={tag}>{tag}</span>
                            <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full"
                                        style={{ width: `${Math.min(100, (count / Math.max(1, totalQ)) * 100)}%` }}
                                    />
                                </div>
                                <span className="text-gray-900 font-medium w-6 text-right">{count}</span>
                            </div>
                        </div>
                    ))}
                    {sortedTags.length === 0 && <p className="text-gray-400 text-sm italic">No tags found</p>}
                </div>
            </div>

            {/* Difficulty Distribution */}
            <div className="bg-white p-4 rounded-xl shadow-sm border">
                <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Difficulty Levels</h3>
                <div className="flex items-end justify-between h-32 px-2 mt-4 space-x-2">
                    {[1, 2, 3, 4, 5].map(level => {
                        const count = difficultyCounts[level] || 0;
                        const maxCount = Math.max(1, ...Object.values(difficultyCounts));
                        const height = (count / maxCount) * 100;
                        const color = level <= 2 ? 'bg-green-400' : level === 3 ? 'bg-yellow-400' : 'bg-red-400';
                        return (
                            <div key={level} className="flex flex-col items-center w-full group">
                                <span className="text-xs text-gray-700 mb-1 font-medium">{count}</span>
                                <div
                                    className={`w-full rounded-t-sm ${color} transition-all duration-500`}
                                    style={{ height: `${Math.max(4, height)}%` }}
                                />
                                <span className="text-xs font-bold text-gray-600 mt-2">{level}</span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Type Distribution */}
            <div className="bg-white p-4 rounded-xl shadow-sm border">
                <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Question Types</h3>
                <div className="space-y-3 mt-2">
                    {Object.entries(typeCounts).map(([type, count]) => {
                        const label = type === 'mcq_single' ? 'Single Choice' : type === 'mcq_multiple' ? 'Multi Choice' : type === 'paragraph' ? 'Paragraph' : type === 'fill_blank' ? 'Fill Blank' : type;
                        return (
                            <div key={type} className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">{label}</span>
                                <span className="font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-800">{count}</span>
                            </div>
                        )
                    })}
                    {Object.keys(typeCounts).length === 0 && <p className="text-gray-400 text-sm italic">No data</p>}
                </div>
            </div>
        </div>
    );
}
