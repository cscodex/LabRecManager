'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { formatDateTimeIST, getText } from '@/lib/utils';
import {
    ChevronLeft, Search, User, Mail, Phone, School,
    TrendingUp, Award, Clock, Download,
    ChevronDown, ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';

interface Student {
    id: string;
    name: string;
    roll_number: string;
    email: string | null;
    school: string | null;
    class: string | null;
}

interface StudentReport {
    student: {
        id: string;
        name: string;
        roll_number: string;
        email: string | null;
        created_at: string;
    };
    stats: {
        totalAttempts: number;
        completedAttempts: number;
        averageScore: number;
        averagePercentage: number;
    };
    history: {
        id: string;
        examTitle: Record<string, string>;
        score: number;
        totalMarks: number;
        percentage: number;
        status: string;
        date: string;
    }[];
}

export default function StudentAnalyticsPage() {
    const router = useRouter();
    const { user, language, isAuthenticated, _hasHydrated } = useAuthStore();

    const [searchTerm, setSearchTerm] = useState('');
    const [students, setStudents] = useState<Student[]>([]);
    const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [report, setReport] = useState<StudentReport | null>(null);
    const [loadingList, setLoadingList] = useState(true);
    const [loadingReport, setLoadingReport] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || !['admin', 'superadmin'].includes(user?.role || '')) {
            router.push('/');
            return;
        }
        loadStudents();
    }, [_hasHydrated, isAuthenticated, user, router]);

    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredStudents([]);
            setShowDropdown(false);
            return;
        }

        const lowerTerm = searchTerm.toLowerCase();
        const filtered = students.filter(s =>
            s.name.toLowerCase().includes(lowerTerm) ||
            s.roll_number.toLowerCase().includes(lowerTerm)
        ).slice(0, 10); // Limit to 10 suggestions

        setFilteredStudents(filtered);
        setShowDropdown(true);
    }, [searchTerm, students]);

    const loadStudents = async () => {
        try {
            const response = await fetch('/api/admin/students');
            const data = await response.json();
            if (data.success) {
                setStudents(data.students);
            }
        } catch (error) {
            console.error('Failed to load students');
        } finally {
            setLoadingList(false);
        }
    };

    const loadReport = async (studentId: string) => {
        setLoadingReport(true);
        try {
            const response = await fetch(`/api/admin/reports/student/${studentId}`);
            const data = await response.json();
            if (data.success) {
                setReport(data.report);
                // Also format data for chart if needed
            } else {
                toast.error(data.error || 'Failed to load report');
            }
        } catch (error) {
            toast.error('Error loading report');
        } finally {
            setLoadingReport(false);
        }
    };

    const handleSelectStudent = (student: Student) => {
        setSelectedStudentId(student.id);
        setSearchTerm(`${student.name} (${student.roll_number})`);
        setShowDropdown(false);
        loadReport(student.id);
    };

    const exportToCSV = () => {
        if (!report) return;

        const headers = ['Exam Title', 'Date', 'Status', 'Score', 'Total Marks', 'Percentage'];
        const rows = report.history.map(attempt => [
            getText(attempt.examTitle, language),
            new Date(attempt.date).toLocaleString(),
            attempt.status,
            attempt.score || 0,
            attempt.totalMarks,
            `${attempt.percentage}%`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${report.student.name}_report.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Chart Data Preparation
    const chartData = report?.history
        .filter(h => h.status === 'submitted')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(h => ({
            name: getText(h.examTitle, language).substring(0, 15) + '...',
            fullTitle: getText(h.examTitle, language),
            percentage: h.percentage,
            date: new Date(h.date).toLocaleDateString()
        })) || [];

    if (!_hasHydrated) return null;

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link href="/admin/reports" className="text-gray-500 hover:text-gray-700">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-xl font-bold text-gray-900">Student Analytics</h1>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
                {/* Search Section */}
                <div className="relative max-w-xl mx-auto">
                    <div className="relative">
                        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => {
                                if (filteredStudents.length > 0) setShowDropdown(true);
                            }}
                            placeholder="Search student by name or roll number..."
                            className="w-full pl-10 pr-4 py-3 border rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    {/* Dropdown Results */}
                    {showDropdown && filteredStudents.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 max-h-80 overflow-y-auto z-50">
                            {filteredStudents.map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => handleSelectStudent(student)}
                                    className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-0 transition"
                                >
                                    <p className="font-medium text-gray-900">{student.name}</p>
                                    <p className="text-sm text-gray-500">{student.roll_number} • {student.school || 'No School'}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {loadingReport ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : report ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Profile & KPI */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            {/* Profile Card */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-1">
                                <div className="text-center mb-6">
                                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <User className="w-10 h-10 text-blue-600" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-900">{report.student.name}</h2>
                                    <p className="text-gray-500 font-medium">{report.student.roll_number}</p>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center gap-3 text-gray-600">
                                        <Mail className="w-4 h-4" />
                                        <span className="truncate">{report.student.email || 'No Email'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-gray-600">
                                        <Clock className="w-4 h-4" />
                                        <span>Joined: {new Date(report.student.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-3 text-purple-600 mb-2">
                                        <Award className="w-5 h-5" />
                                        <h3 className="font-medium">Avg Score</h3>
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900">{report.stats.averagePercentage}%</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {report.stats.averageScore} avg marks
                                    </p>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-3 text-blue-600 mb-2">
                                        <TrendingUp className="w-5 h-5" />
                                        <h3 className="font-medium">Total Attempts</h3>
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900">{report.stats.totalAttempts}</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {report.stats.completedAttempts} completed
                                    </p>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-3 text-green-600 mb-2">
                                        <Clock className="w-5 h-5" />
                                        <h3 className="font-medium">Completion Rate</h3>
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900">
                                        {report.stats.totalAttempts > 0
                                            ? Math.round((report.stats.completedAttempts / report.stats.totalAttempts) * 100)
                                            : 0}%
                                    </p>
                                    <p className="text-sm text-gray-500 mt-1">Exams finished</p>
                                </div>
                            </div>
                        </div>

                        {/* Performance Chart */}
                        {chartData.length > 0 && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 mb-6">Performance Trend</h3>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                            <CartesianGrid stroke="#f5f5f5" vertical={false} />
                                            <XAxis
                                                dataKey="name"
                                                tick={{ fontSize: 12, fill: '#6b7280' }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                domain={[0, 100]}
                                                tick={{ fontSize: 12, fill: '#6b7280' }}
                                                axisLine={false}
                                                tickLine={false}
                                                unit="%"
                                            />
                                            <RechartsTooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                formatter={(value: any) => [`${value}%`, 'Score']}
                                                labelFormatter={(label, payload) => {
                                                    if (payload && payload.length > 0) {
                                                        const data = payload[0].payload;
                                                        return `${data.fullTitle} (${data.date})`;
                                                    }
                                                    return label;
                                                }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="percentage"
                                                stroke="#2563eb"
                                                strokeWidth={3}
                                                dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                                                activeDot={{ r: 6 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* Attempts Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6 border-b flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900">Attempt History</h3>
                                <button
                                    onClick={exportToCSV}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                                >
                                    <Download className="w-4 h-4" />
                                    Export CSV
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exam</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Percentage</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {report.history.map((attempt) => (
                                            <tr key={attempt.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium text-gray-900">
                                                    {getText(attempt.examTitle, language)}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {formatDateTimeIST(attempt.date)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${attempt.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                        {attempt.status === 'submitted' ? 'Completed' : 'In Progress'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-medium">
                                                    {attempt.score !== null ? `${attempt.score} / ${attempt.totalMarks}` : '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {attempt.status === 'submitted' && attempt.score !== null ? (
                                                        <span className={`font-semibold ${attempt.percentage >= 60 ? 'text-green-600' :
                                                            attempt.percentage >= 40 ? 'text-yellow-600' : 'text-red-600'
                                                            }`}>
                                                            {attempt.percentage}%
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                        <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900">Search for a student</h3>
                        <p className="text-gray-500 max-w-sm mx-auto mt-2">
                            Enter a name or roll number above to view detailed performance analytics for a specific student.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
