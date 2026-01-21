'use client';

import dynamic from 'next/dynamic';
import { useMemo, useRef, useCallback } from 'react';
import 'react-quill-new/dist/quill.snow.css';

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(
    async () => {
        const { default: RQ } = await import('react-quill-new');
        return RQ;
    },
    {
        ssr: false,
        loading: () => (
            <div className="h-48 border rounded-lg flex items-center justify-center bg-gray-50 text-gray-400">
                Loading editor...
            </div>
        ),
    }
);

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export default function RichTextEditor({
    value,
    onChange,
    placeholder = 'Enter content...',
    className = '',
}: RichTextEditorProps) {
    const quillRef = useRef<any>(null);

    // Quill modules configuration - must be stable
    const modules = useMemo(
        () => ({
            toolbar: [
                [{ header: [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ color: [] }, { background: [] }],
                [{ list: 'ordered' }, { list: 'bullet' }],
                [{ indent: '-1' }, { indent: '+1' }],
                [{ align: [] }],
                ['link'],
                ['clean'],
            ],
            clipboard: {
                matchVisual: false,
            },
        }),
        []
    );

    const formats = useMemo(
        () => [
            'header',
            'bold',
            'italic',
            'underline',
            'strike',
            'color',
            'background',
            'list',
            'bullet',
            'indent',
            'align',
            'link',
        ],
        []
    );

    // Stable onChange handler that only fires when content actually changes
    const handleChange = useCallback(
        (content: string, delta: any, source: string) => {
            // Only update if the change came from user input, not programmatic updates
            if (source === 'user') {
                onChange(content);
            }
        },
        [onChange]
    );

    return (
        <div className={`rich-text-editor ${className}`}>
            <ReactQuill
                ref={quillRef}
                theme="snow"
                value={value || ''}
                onChange={handleChange}
                modules={modules}
                formats={formats}
                placeholder={placeholder}
            />
            <style jsx global>{`
                .rich-text-editor .ql-container {
                    min-height: 200px;
                    font-size: 14px;
                    border-bottom-left-radius: 8px;
                    border-bottom-right-radius: 8px;
                }
                .rich-text-editor .ql-toolbar {
                    border-top-left-radius: 8px;
                    border-top-right-radius: 8px;
                    background: #f9fafb;
                }
                .rich-text-editor .ql-editor {
                    min-height: 180px;
                }
                .rich-text-editor .ql-editor.ql-blank::before {
                    color: #9ca3af;
                    font-style: normal;
                }
            `}</style>
        </div>
    );
}
