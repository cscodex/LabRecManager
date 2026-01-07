import { useEffect, useRef, useState } from 'react';
import * as docx from 'docx-preview';
import jspreadsheet from 'jspreadsheet-ce';
import * as xlsx from 'xlsx';

// Import styles if possible, otherwise we might need CDN links or global css
// Typically jspreadsheet comes with css
try {
    require('jspreadsheet-ce/dist/jspreadsheet.css');
    require('jsuites/dist/jsuites.css');
} catch (e) {
    // If CSS import fails (next.js sometimes picky), we fall back to CDN in render
    console.warn('Could not import jspreadsheet css', e);
}

export default function FileViewer({ url, fileType }) {
    const containerRef = useRef(null);
    const spreadsheetRef = useRef(null); // Reference to the spreadsheet instance
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!url || !containerRef.current) return;
        setLoading(true);
        setError(null);

        let active = true;

        const loadFile = async () => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error('Failed to fetch file');
                const blob = await response.blob();

                if (!active) return;

                if (fileType === 'docx') {
                    // DOCX Preview
                    // Clear container
                    containerRef.current.innerHTML = '';
                    await docx.renderAsync(blob, containerRef.current, containerRef.current, {
                        className: 'docx-viewer',
                        inWrapper: true
                    });
                }
                else if (['xlsx', 'xls', 'csv'].includes(fileType)) {
                    // Excel/CSV using Jspreadsheet
                    const data = await blob.arrayBuffer();
                    let jsonData = [];

                    if (fileType === 'csv') {
                        // For CSV, we can just read text or use xlsx
                        const text = await new Response(blob).text();
                        jsonData = jspreadsheet.helpers.parseCSV(text);
                    } else {
                        // For Excel, use SheetJS to convert to array
                        const workbook = xlsx.read(data, { type: 'array' });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
                    }

                    if (!active) return;

                    containerRef.current.innerHTML = '';
                    // Create wrapper for spreadsheet to control size
                    const spreadDiv = document.createElement('div');
                    containerRef.current.appendChild(spreadDiv);

                    spreadsheetRef.current = jspreadsheet(spreadDiv, {
                        data: jsonData,
                        search: true,
                        pagination: 20,
                        tableOverflow: true,
                        tableWidth: '100%',
                        tableHeight: '600px',
                        defaultColWidth: 100,
                    });
                }
                setLoading(false);
            } catch (err) {
                console.error(err);
                if (active) {
                    setError('Failed to load document preview. ' + err.message);
                    setLoading(false);
                }
            }
        };

        loadFile();

        return () => {
            active = false;
            if (spreadsheetRef.current) {
                jspreadsheet.destroy(spreadsheetRef.current);
                spreadsheetRef.current = null;
            }
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [url, fileType]);

    return (
        <div className="relative w-full h-full min-h-[500px] bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col">
            {/* Fallback CSS if import failed */}
            <link rel="stylesheet" href="https://bossanova.uk/jspreadsheet/v4/jexcel.css" type="text/css" />
            <link rel="stylesheet" href="https://jsuites.net/v4/jsuites.css" type="text/css" />

            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                    <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2"></div>
                        <p className="text-slate-500">Loading preview...</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                    <p className="text-red-500">{error}</p>
                </div>
            )}

            <div className="flex-1 overflow-auto bg-slate-50 p-4" ref={containerRef}></div>
        </div>
    );
}
