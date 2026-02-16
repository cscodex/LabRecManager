'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

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

    // Prepare data for charts
    const difficultyData = [1, 2, 3, 4, 5].map(level => ({
        name: `Level ${level}`,
        value: difficultyCounts[level] || 0
    })).filter(d => d.value > 0);

    const typeData = Object.entries(typeCounts).map(([type, count]) => {
        const label = type === 'mcq_single' ? 'Single Choice' :
            type === 'mcq_multiple' ? 'Multi Choice' :
                type === 'paragraph' ? 'Paragraph' :
                    type === 'fill_blank' ? 'Fill Blank' : type;
        return { name: label, value: count };
    }).filter(d => d.value > 0);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
    const DIFFICULTY_COLORS = ['#4ade80', '#4ade80', '#facc15', '#f87171', '#f87171']; // Green, Green, Yellow, Red, Red

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Tag Distribution (Bar Chart) */}
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

            {/* Difficulty Distribution (Pie Chart) */}
            <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-col">
                <h3 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wider">Difficulty Levels</h3>
                <div className="flex-1 w-full h-[140px] relative">
                    {difficultyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={difficultyData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={30}
                                    outerRadius={50}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {difficultyData.map((entry, index) => {
                                        const level = parseInt(entry.name.split(' ')[1]);
                                        return <Cell key={`cell-${index}`} fill={DIFFICULTY_COLORS[level - 1] || '#8884d8'} />;
                                    })}
                                </Pie>
                                <Tooltip />
                                <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data</div>
                    )}
                </div>
            </div>

            {/* Type Distribution (Pie Chart) */}
            <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-col">
                <h3 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wider">Question Types</h3>
                <div className="flex-1 w-full h-[140px] relative">
                    {typeData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={typeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={30}
                                    outerRadius={50}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {typeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data</div>
                    )}
                </div>
            </div>
        </div>
    );
}
