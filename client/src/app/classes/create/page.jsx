'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GraduationCap, Save, X, Users, BookOpen } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

export default function CreateClassPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [academicYears, setAcademicYears] = useState([]);
    const [instructors, setInstructors] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        nameHindi: '',
        gradeLevel: '',
        section: '',
        stream: '',
        academicYearId: '',
        classTeacherId: '',
        maxStudents: 60
    });

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        if (user?.role !== 'admin' && user?.role !== 'principal') {
            router.push('/classes');
            toast.error('Only admins can create classes');
            return;
        }
        loadFormData();
    }, [isAuthenticated, user, _hasHydrated]);

    const loadFormData = async () => {
        try {
            const [yearsRes, usersRes] = await Promise.all([
                api.get('/academic-years'),
                api.get('/users?role=instructor&limit=100')
            ]);

            setAcademicYears(yearsRes.data.data.academicYears || []);
            setInstructors(usersRes.data.data.users || []);

            // Set default academic year to current
            const currentYear = yearsRes.data.data.academicYears?.find(y => y.isCurrent);
            if (currentYear) {
                setFormData(prev => ({ ...prev, academicYearId: currentYear.id }));
            }
        } catch (error) {
            console.error('Failed to load form data:', error);
            toast.error('Failed to load required data');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.gradeLevel || !formData.academicYearId) {
            toast.error('Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/classes', {
                ...formData,
                gradeLevel: parseInt(formData.gradeLevel),
                maxStudents: parseInt(formData.maxStudents)
            });

            toast.success('Class created successfully!');
            router.push(`/classes/${response.data.data.class.id}`);
        } catch (error) {
            console.error('Failed to create class:', error);
            toast.error(error.response?.data?.message || 'Failed to create class');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Generate class name suggestion
    const generateClassName = () => {
        const grade = formData.gradeLevel;
        const section = formData.section || 'A';
        const stream = formData.stream;

        let name = `Class ${grade}`;
        if (section) name += `-${section}`;
        if (stream) name += ` (${stream})`;

        return name;
    };

    useEffect(() => {
        if (formData.gradeLevel && !formData.name) {
            const suggestedName = generateClassName();
            setFormData(prev => ({ ...prev, name: suggestedName }));
        }
    }, [formData.gradeLevel, formData.section, formData.stream]);

    return (
        <div className="min-h-screen bg-slate-50">
            <PageHeader title="Create New Class" titleHindi="नई कक्षा बनाएं">
                <Link href="/classes" className="btn btn-ghost">
                    <X className="w-4 h-4" />
                    Cancel
                </Link>
            </PageHeader>

            <main className="max-w-3xl mx-auto px-4 py-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Information */}
                    <div className="card p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                                <GraduationCap className="w-5 h-5 text-primary-600" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-slate-900">Basic Information</h2>
                                <p className="text-sm text-slate-500">Enter class details</p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Grade Level <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="gradeLevel"
                                    value={formData.gradeLevel}
                                    onChange={handleChange}
                                    className="input"
                                    required
                                >
                                    <option value="">Select Grade</option>
                                    {[...Array(12)].map((_, i) => (
                                        <option key={i + 1} value={i + 1}>
                                            Grade {i + 1} (Class {i + 1})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Section
                                </label>
                                <select
                                    name="section"
                                    value={formData.section}
                                    onChange={handleChange}
                                    className="input"
                                >
                                    <option value="">No Section</option>
                                    {['A', 'B', 'C', 'D', 'E', 'F'].map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Class Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="input"
                                    placeholder="e.g., Class 10-A"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    कक्षा का नाम (Hindi)
                                </label>
                                <input
                                    type="text"
                                    name="nameHindi"
                                    value={formData.nameHindi}
                                    onChange={handleChange}
                                    className="input"
                                    placeholder="e.g., कक्षा 10-अ"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Stream
                                </label>
                                <select
                                    name="stream"
                                    value={formData.stream}
                                    onChange={handleChange}
                                    className="input"
                                >
                                    <option value="">General</option>
                                    <option value="Commerce">Commerce (वाणिज्य)</option>
                                    <option value="NonMedical">Non-Medical / PCM (नॉन-मेडिकल)</option>
                                    <option value="Medical">Medical / PCB (मेडिकल)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Max Students
                                </label>
                                <input
                                    type="number"
                                    name="maxStudents"
                                    value={formData.maxStudents}
                                    onChange={handleChange}
                                    className="input"
                                    min="10"
                                    max="100"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Academic Year & Teacher */}
                    <div className="card p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                <BookOpen className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-slate-900">Assignment Details</h2>
                                <p className="text-sm text-slate-500">Academic year and class teacher</p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Academic Year <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="academicYearId"
                                    value={formData.academicYearId}
                                    onChange={handleChange}
                                    className="input"
                                    required
                                >
                                    <option value="">Select Academic Year</option>
                                    {academicYears.map(year => (
                                        <option key={year.id} value={year.id}>
                                            {year.yearLabel} {year.isCurrent ? '(Current)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Class Teacher
                                </label>
                                <select
                                    name="classTeacherId"
                                    value={formData.classTeacherId}
                                    onChange={handleChange}
                                    className="input"
                                >
                                    <option value="">Select Teacher (Optional)</option>
                                    {instructors.map(instructor => (
                                        <option key={instructor.id} value={instructor.id}>
                                            {instructor.firstName} {instructor.lastName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    {formData.gradeLevel && (
                        <div className="card p-6 bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
                            <h3 className="text-sm font-medium text-primary-800 mb-3">Preview</h3>
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-2xl font-bold text-primary-600 shadow-sm">
                                    {formData.gradeLevel}
                                    {formData.section && <span className="text-lg">{formData.section}</span>}
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold text-primary-900">{formData.name || 'Class Name'}</h4>
                                    {formData.nameHindi && (
                                        <p className="text-primary-700">{formData.nameHindi}</p>
                                    )}
                                    <p className="text-sm text-primary-600">
                                        {formData.stream || 'General'} • Max {formData.maxStudents} students
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Submit */}
                    <div className="flex justify-end gap-3">
                        <Link href="/classes" className="btn btn-ghost">
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary"
                        >
                            {loading ? (
                                <>
                                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Create Class
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}
