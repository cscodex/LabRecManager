'use client';

import { useEffect, useRef, memo } from 'react';
import { useMathJax } from './providers/MathJaxProvider';
import { cn } from '@/lib/utils';

interface MathTextProps {
    text: string;
    className?: string;
    inline?: boolean;
}

export function MathTextComponent({ text, className, inline = false }: MathTextProps) {
    const { typeset, ready } = useMathJax();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ready && ref.current) {
            // Ensure typeset is called with an array containing the element
            // Adding a small delay to ensure DOM is ready can sometimes help with race conditions
            const timer = setTimeout(() => {
                typeset([ref.current!]);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [text, ready, typeset]);

    const Component = inline ? 'span' : 'div';

    return (
        <Component
            ref={ref}
            className={cn("math-content tex2jax_process", className)}
            dangerouslySetInnerHTML={{ __html: text || '' }}
        />
    );
}

export const MathText = memo(MathTextComponent);
