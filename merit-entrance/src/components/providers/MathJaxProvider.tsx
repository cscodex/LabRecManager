'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';

declare global {
    interface Window {
        MathJax: any;
    }
}

interface MathJaxContextType {
    typeset: (elements?: HTMLElement | HTMLElement[]) => void;
    ready: boolean;
}

const MathJaxContext = createContext<MathJaxContextType>({
    typeset: () => { },
    ready: false,
});

export const useMathJax = () => useContext(MathJaxContext);

export function MathJaxProvider({ children }: { children: React.ReactNode }) {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        // Check if MathJax is already loaded and ready
        if (window.MathJax && window.MathJax.typesetPromise && typeof window.MathJax.typesetPromise === 'function') {
            setReady(true);
            return;
        }

        // Only setup config if it's not already set or if it's just a config object (not the library)
        if (!window.MathJax || !window.MathJax.version) {
            window.MathJax = {
                loader: {
                    load: ['[tex]/noerrors', '[tex]/noundefined']
                },
                tex: {
                    packages: { '[+]': ['noerrors', 'noundefined'] },
                    inlineMath: [['$', '$'], ['\\(', '\\)']],
                    displayMath: [['$$', '$$'], ['\\[', '\\]']],
                    processEscapes: true,
                },
                svg: {
                    fontCache: 'global'
                },
                options: {
                    ignoreHtmlClass: 'tex2jax_ignore',
                    processHtmlClass: 'tex2jax_process'
                },
                startup: {
                    typeset: false,
                }
            };
        }

        // Check if script is already in DOM to avoid duplicates
        const existingScript = document.getElementById('mathjax-script');
        if (!existingScript) {
            const script = document.createElement('script');
            script.src = '/mathjax/tex-mml-chtml.js';
            script.id = 'mathjax-script';
            script.async = true;
            document.head.appendChild(script);
        } else {
            // If script exists but ready state isn't set (rare race condition), ensure we check availability
            const checkMathJax = setInterval(() => {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    setReady(true);
                    clearInterval(checkMathJax);
                }
            }, 100);

            // Cleanup interval on unmount
            return () => clearInterval(checkMathJax);
        }

        // Do NOT remove script on unmount to preserve singleton
    }, []);

    const promiseRef = useRef<Promise<void>>(Promise.resolve());

    const typeset = useCallback((elements?: HTMLElement | HTMLElement[]) => {
        if (!window.MathJax) {
            console.warn('MathJax not loaded yet');
            return;
        }

        promiseRef.current = promiseRef.current.then(() => {
            if (window.MathJax.typesetPromise) {
                return window.MathJax.typesetPromise(elements).catch((err: any) => {
                    console.error('MathJax typeset failed:', err);
                });
            }
            return Promise.resolve();
        });
    }, []);

    const contextValue = useMemo(() => ({ typeset, ready }), [typeset, ready]);

    return (
        <MathJaxContext.Provider value={contextValue}>
            {children}
        </MathJaxContext.Provider>
    );
}
