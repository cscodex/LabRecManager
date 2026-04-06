'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { trainingAPI } from '@/lib/api';
import { Play, CheckCircle2, XCircle, ArrowLeft, Lightbulb, Beaker } from 'lucide-react';
import toast from 'react-hot-toast';
import Editor from '@monaco-editor/react';

export default function ExerciseEditorPage() {
    const { moduleId, exerciseId } = useParams();
    const router = useRouter();
    const { isAuthenticated } = useAuthStore();
    
    const [exercise, setExercise] = useState(null);
    const [code, setCode] = useState('');
    const [output, setOutput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [testResults, setTestResults] = useState(null);
    const [socraticReview, setSocraticReview] = useState(null);
    const [showHint, setShowHint] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) return;
        
        const fetchExercise = async () => {
            try {
                const res = await trainingAPI.getExercise(exerciseId);
                const ex = res.data.data.exercise;
                setExercise(ex);
                setCode(ex.starterCode || '# Write your code here\n');
            } catch (err) {
                toast.error('Failed to load exercise');
                router.push(`/training/${moduleId}`);
            }
        };

        fetchExercise();
    }, [exerciseId, isAuthenticated, moduleId, router]);

    const handleRun = async () => {
        setIsRunning(true);
        setOutput('Running...');
        try {
            const res = await trainingAPI.runCode(exerciseId, { code });
            setOutput(res.data.data.output || 'Done (no output)');
            setTestResults(null); 
            setSocraticReview(null);
        } catch (err) {
            setOutput('Error executing code sandbox');
        } finally {
            setIsRunning(false);
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setOutput('Evaluating against test cases...');
        try {
            const res = await trainingAPI.submitCode(exerciseId, { code });
            const data = res.data.data;
            
            setTestResults(data.results);
            setSocraticReview(data.socraticReview);
            
            if (data.status === 'passed') {
                toast.success('All test cases passed! Mastery updated!');
            } else {
                toast.error('Some test cases failed. See AI review.');
            }
            
            setOutput(''); // Clear manual runner output
        } catch (err) {
            toast.error('Submission failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!exercise) return <div className="p-8 text-center text-slate-500">Loading editor...</div>;

    return (
        <div className="h-screen flex flex-col bg-slate-900 border-t-4 border-indigo-500">
            {/* Top Navigation */}
            <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
                <div className="flex items-center gap-4 text-white">
                    <button onClick={() => router.push(`/training/${moduleId}`)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="font-semibold">{exercise.title}</h1>
                    <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300 capitalize">
                        {exercise.scaffoldLevel.replace('_', ' ')}
                    </span>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleRun} 
                        disabled={isRunning || isSubmitting}
                        className="btn bg-slate-700 hover:bg-slate-600 text-white border-none py-1.5 px-4"
                    >
                        {isRunning ? 'Running...' : <><Play className="w-4 h-4 text-emerald-400" /> Run</>}
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={isRunning || isSubmitting}
                        className="btn bg-indigo-600 hover:bg-indigo-500 text-white border-none py-1.5 px-6 font-bold"
                    >
                        {isSubmitting ? 'Evaluating...' : 'Submit Code'}
                    </button>
                </div>
            </div>

            {/* Main Split Layout */}
            <div className="flex-1 flex overflow-hidden">
                
                {/* Left Panel: Problem Statement & Results */}
                <div className="w-1/3 bg-slate-800 border-r border-slate-700 flex flex-col overflow-y-auto">
                    
                    {/* Problem Description */}
                    <div className="p-6 text-slate-200">
                        <h2 className="text-xl font-bold text-white mb-4">Problem Statement</h2>
                        <div className="prose prose-invert prose-sm leading-relaxed whitespace-pre-wrap">
                            {exercise.description}
                        </div>

                        {/* Hints system (AI Augmented) */}
                        {exercise.hints && exercise.hints.length > 0 && (
                            <div className="mt-8">
                                <button 
                                    onClick={() => setShowHint(!showHint)}
                                    className="flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm font-medium transition"
                                >
                                    <Lightbulb className="w-4 h-4" /> 
                                    {showHint ? 'Hide Hint' : 'Stuck? Show Hint'}
                                </button>
                                {showHint && (
                                    <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-200 text-sm">
                                        {exercise.hints[0]}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Test Results Area */}
                    {(output || testResults) && (
                        <div className="flex-1 p-6 border-t border-slate-700 bg-slate-900/50">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Beaker className="w-4 h-4"/> Console Output
                            </h3>
                            
                            {/* Manual Run Output */}
                            {output && (
                                <pre className="font-mono text-sm text-slate-300 bg-black/30 p-4 rounded-lg overflow-x-auto">
                                    {output}
                                </pre>
                            )}

                            {/* Submission Test Cases */}
                            {testResults && (
                                <div className="space-y-4">
                                    {testResults.map((tr, i) => (
                                        <div key={i} className={`p-4 rounded-lg border ${tr.passed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                {tr.passed ? <CheckCircle2 className="w-5 h-5 text-emerald-400"/> : <XCircle className="w-5 h-5 text-red-400"/>}
                                                <span className="font-bold text-white">Test Case {i + 1}</span>
                                                {tr.input === 'Hidden' && <span className="ml-auto text-xs text-slate-500 uppercase bg-slate-800 px-2 rounded">Hidden Test</span>}
                                            </div>
                                            {!tr.passed && tr.input !== 'Hidden' && (
                                                <div className="mt-3 text-xs font-mono space-y-2">
                                                    <div><span className="text-slate-500">Input:</span> <span className="text-emerald-200">{tr.input}</span></div>
                                                    <div><span className="text-slate-500">Expected:</span> <span className="text-blue-200">{tr.expected}</span></div>
                                                    <div><span className="text-slate-500">Actual:</span> <span className="text-red-200">{tr.actual}</span></div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Socratic AI Review */}
                            {socraticReview && (
                                <div className="mt-8 p-5 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                                    <h4 className="flex items-center gap-2 font-bold text-indigo-300 mb-2">
                                        🤖 AI Reviewer
                                    </h4>
                                    <p className="text-sm text-indigo-100 leading-relaxed">
                                        {socraticReview}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Panel: Monaco Editor */}
                <div className="w-2/3 h-full pt-4">
                    <Editor
                        height="100%"
                        language="python"
                        theme="vs-dark"
                        value={code}
                        onChange={(val) => setCode(val || '')}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineHeight: 24,
                            fontFamily: 'JetBrains Mono, monospace',
                            scrollbar: { vertical: 'auto' },
                            padding: { top: 16 }
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
