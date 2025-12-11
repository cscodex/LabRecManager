'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Upload, FileSpreadsheet, Download, Check, X, AlertCircle, Users, GraduationCap } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

export default function ImportStudentsPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [step, setStep] = useState(1); // 1: Select Class, 2: Upload, 3: Preview, 4: Result
    const [csvData, setCsvData] = useState([]);
    const [importResult, setImportResult] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        if (user?.role !== 'admin' && user?.role !== 'principal') {
            router.push('/dashboard');
            toast.error('Only admins can import students');
            return;
        }
        loadClasses();
    }, [isAuthenticated, user, _hasHydrated]);

    const loadClasses = async () => {
        try {
            const res = await api.get('/classes');
            setClasses(res.data.data.classes || []);
        } catch (error) {
            console.error('Failed to load classes:', error);
            toast.error('Failed to load classes');
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.csv')) {
            toast.error('Please upload a CSV file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            parseCSV(text);
        };
        reader.readAsText(file);
    };

    const parseCSV = (text) => {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            toast.error('CSV file is empty or has no data rows');
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[\s-]/g, '_'));
        const data = [];

        // Map common header names
        const headerMap = {
            'student_id': 'studentId',
            'studentid': 'studentId',
            'admission_number': 'admissionNumber',
            'admission_no': 'admissionNumber',
            'admissionno': 'admissionNumber',
            'first_name': 'firstName',
            'firstname': 'firstName',
            'last_name': 'lastName',
            'lastname': 'lastName',
            'email': 'email',
            'phone': 'phone',
            'mobile': 'phone'
        };

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
            if (values.length < 3) continue; // Need at least studentId, firstName, lastName

            const row = {};
            headers.forEach((header, idx) => {
                const mappedKey = headerMap[header] || header;
                row[mappedKey] = values[idx] || '';
            });

            // Generate email if not provided
            if (!row.email && row.firstName && row.lastName) {
                row.email = `${row.firstName.toLowerCase()}.${row.lastName.toLowerCase()}@student.school.edu`;
            }

            // Validate required fields
            if (row.firstName && row.lastName && row.email) {
                data.push({
                    ...row,
                    studentId: row.studentId || row.admissionNumber || '',
                    role: 'student',
                    isValid: true
                });
            } else {
                data.push({
                    ...row,
                    isValid: false,
                    error: 'Missing required fields (firstName, lastName, email)'
                });
            }
        }

        setCsvData(data);
        setStep(3);
    };

    const handleImport = async () => {
        const validStudents = csvData.filter(s => s.isValid);
        if (validStudents.length === 0) {
            toast.error('No valid students to import');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/users/bulk', {
                users: validStudents.map(s => ({
                    email: s.email,
                    firstName: s.firstName,
                    lastName: s.lastName,
                    phone: s.phone,
                    studentId: s.studentId,
                    admissionNumber: s.admissionNumber || s.studentId,
                    role: 'student'
                })),
                classId: selectedClassId || undefined
            });

            setImportResult(response.data.data);
            setStep(4);
            toast.success(response.data.message);
        } catch (error) {
            console.error('Import failed:', error);
            toast.error(error.response?.data?.message || 'Import failed');
        } finally {
            setLoading(false);
        }
    };

    const downloadTemplate = () => {
        const template = 'student_id,first_name,last_name,email,phone\nSTU-2024-001,John,Doe,john.doe@school.edu,9876543210\nSTU-2024-002,Jane,Smith,jane.smith@school.edu,9876543211';
        const blob = new Blob([template], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'students_import_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const selectedClass = classes.find(c => c.id === selectedClassId);

    return (
        <div className="min-h-screen bg-slate-50">
            <PageHeader title="Import Students" titleHindi="छात्र आयात करें">
                <Link href="/classes" className="btn btn-ghost">
                    <X className="w-4 h-4" />
                    Cancel
                </Link>
            </PageHeader>

            <main className="max-w-4xl mx-auto px-4 py-6">
                {/* Progress Steps */}
                <div className="flex items-center justify-center mb-8">
                    {[1, 2, 3, 4].map((s) => (
                        <div key={s} className="flex items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold
                                ${step >= s ? 'bg-primary-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                {step > s ? <Check className="w-5 h-5" /> : s}
                            </div>
                            {s < 4 && (
                                <div className={`w-20 h-1 ${step > s ? 'bg-primary-500' : 'bg-slate-200'}`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step 1: Select Class */}
                {step === 1 && (
                    <div className="card p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                                <GraduationCap className="w-6 h-6 text-primary-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Select Class</h2>
                                <p className="text-sm text-slate-500">Choose a class to enroll students (optional)</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <button
                                    onClick={() => {
                                        setSelectedClassId('');
                                        setStep(2);
                                    }}
                                    className="p-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition text-center"
                                >
                                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                                    <p className="font-medium text-slate-700">No Class</p>
                                    <p className="text-xs text-slate-500">Import without class enrollment</p>
                                </button>

                                {classes.map(cls => (
                                    <button
                                        key={cls.id}
                                        onClick={() => {
                                            setSelectedClassId(cls.id);
                                            setStep(2);
                                        }}
                                        className={`p-4 border-2 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition text-center
                                            ${selectedClassId === cls.id ? 'border-primary-500 bg-primary-50' : 'border-slate-200'}`}
                                    >
                                        <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold">
                                            {cls.gradeLevel}{cls.section || ''}
                                        </div>
                                        <p className="font-medium text-slate-700">{cls.name}</p>
                                        <p className="text-xs text-slate-500">{cls._count?.enrollments || 0} students</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Upload File */}
                {step === 2 && (
                    <div className="card p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                                <Upload className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Upload CSV File</h2>
                                <p className="text-sm text-slate-500">
                                    {selectedClass ? `Importing to: ${selectedClass.name}` : 'Importing without class enrollment'}
                                </p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <button
                                onClick={downloadTemplate}
                                className="btn btn-ghost text-sm"
                            >
                                <Download className="w-4 h-4" />
                                Download Template
                            </button>
                        </div>

                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition"
                        >
                            <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                            <p className="text-lg font-medium text-slate-700 mb-2">Click to upload CSV</p>
                            <p className="text-sm text-slate-500">or drag and drop</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </div>

                        <div className="mt-6 p-4 bg-slate-100 rounded-xl">
                            <h4 className="font-medium text-slate-700 mb-2">Required Columns:</h4>
                            <ul className="text-sm text-slate-600 space-y-1">
                                <li>• <code className="bg-slate-200 px-1 rounded">student_id</code> - Student ID (e.g., STU-2024-001)</li>
                                <li>• <code className="bg-slate-200 px-1 rounded">first_name</code> - First Name</li>
                                <li>• <code className="bg-slate-200 px-1 rounded">last_name</code> - Last Name</li>
                                <li>• <code className="bg-slate-200 px-1 rounded">email</code> - Email (auto-generated if not provided)</li>
                                <li>• <code className="bg-slate-200 px-1 rounded">phone</code> - Phone (optional)</li>
                            </ul>
                        </div>

                        <div className="flex justify-between mt-6">
                            <button onClick={() => setStep(1)} className="btn btn-ghost">
                                Back
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Preview */}
                {step === 3 && (
                    <div className="card p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                                    <Users className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Preview Import</h2>
                                    <p className="text-sm text-slate-500">
                                        {csvData.filter(s => s.isValid).length} valid, {csvData.filter(s => !s.isValid).length} invalid
                                    </p>
                                </div>
                            </div>
                            {selectedClass && (
                                <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                                    → {selectedClass.name}
                                </span>
                            )}
                        </div>

                        <div className="overflow-x-auto max-h-96">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Status</th>
                                        <th className="px-3 py-2 text-left">Student ID</th>
                                        <th className="px-3 py-2 text-left">Name</th>
                                        <th className="px-3 py-2 text-left">Email</th>
                                        <th className="px-3 py-2 text-left">Phone</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {csvData.map((student, idx) => (
                                        <tr key={idx} className={student.isValid ? '' : 'bg-red-50'}>
                                            <td className="px-3 py-2">
                                                {student.isValid ? (
                                                    <Check className="w-5 h-5 text-emerald-500" />
                                                ) : (
                                                    <AlertCircle className="w-5 h-5 text-red-500" />
                                                )}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-xs">{student.studentId || '-'}</td>
                                            <td className="px-3 py-2">{student.firstName} {student.lastName}</td>
                                            <td className="px-3 py-2 text-slate-600">{student.email}</td>
                                            <td className="px-3 py-2 text-slate-600">{student.phone || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between mt-6">
                            <button onClick={() => { setCsvData([]); setStep(2); }} className="btn btn-ghost">
                                Back
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={loading || csvData.filter(s => s.isValid).length === 0}
                                className="btn btn-primary"
                            >
                                {loading ? (
                                    <>
                                        <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Import {csvData.filter(s => s.isValid).length} Students
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: Result */}
                {step === 4 && importResult && (
                    <div className="card p-6">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                                <Check className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h2 className="text-xl font-semibold text-slate-900">Import Complete!</h2>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4 mb-6">
                            <div className="p-4 bg-emerald-50 rounded-xl text-center">
                                <p className="text-3xl font-bold text-emerald-600">{importResult.created?.length || 0}</p>
                                <p className="text-sm text-emerald-700">Students Created</p>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-xl text-center">
                                <p className="text-3xl font-bold text-blue-600">{importResult.enrolled || 0}</p>
                                <p className="text-sm text-blue-700">Enrolled in Class</p>
                            </div>
                            <div className="p-4 bg-red-50 rounded-xl text-center">
                                <p className="text-3xl font-bold text-red-600">{importResult.failed?.length || 0}</p>
                                <p className="text-sm text-red-700">Failed</p>
                            </div>
                        </div>

                        {importResult.failed?.length > 0 && (
                            <div className="mb-6 p-4 bg-red-50 rounded-xl">
                                <h4 className="font-medium text-red-800 mb-2">Failed imports:</h4>
                                <ul className="text-sm text-red-700 space-y-1">
                                    {importResult.failed.map((f, idx) => (
                                        <li key={idx}>• {f.email}: {f.reason}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex justify-center gap-4">
                            <button
                                onClick={() => {
                                    setStep(1);
                                    setCsvData([]);
                                    setImportResult(null);
                                }}
                                className="btn btn-ghost"
                            >
                                Import More
                            </button>
                            <Link href={selectedClassId ? `/classes/${selectedClassId}` : '/classes'} className="btn btn-primary">
                                View Class
                            </Link>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
