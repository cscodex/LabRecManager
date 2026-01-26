'use client';

import React, { useState, useRef, useCallback } from 'react';

// Comprehensive symbol categories for PCM and Biology
const SYMBOL_CATEGORIES = {
    'Math - Basic': [
        { symbol: '+', name: 'Plus' },
        { symbol: '−', name: 'Minus' },
        { symbol: '×', name: 'Multiply' },
        { symbol: '÷', name: 'Divide' },
        { symbol: '=', name: 'Equals' },
        { symbol: '≠', name: 'Not Equal' },
        { symbol: '≈', name: 'Approximately' },
        { symbol: '±', name: 'Plus Minus' },
        { symbol: '∞', name: 'Infinity' },
        { symbol: '≡', name: 'Identical' },
        { symbol: '∴', name: 'Therefore' },
        { symbol: '∵', name: 'Because' },
    ],
    'Math - Greek': [
        { symbol: 'α', name: 'Alpha' },
        { symbol: 'β', name: 'Beta' },
        { symbol: 'γ', name: 'Gamma' },
        { symbol: 'δ', name: 'Delta (small)' },
        { symbol: 'ε', name: 'Epsilon' },
        { symbol: 'ζ', name: 'Zeta' },
        { symbol: 'η', name: 'Eta' },
        { symbol: 'θ', name: 'Theta' },
        { symbol: 'λ', name: 'Lambda' },
        { symbol: 'μ', name: 'Mu' },
        { symbol: 'ν', name: 'Nu' },
        { symbol: 'π', name: 'Pi' },
        { symbol: 'ρ', name: 'Rho' },
        { symbol: 'σ', name: 'Sigma (small)' },
        { symbol: 'τ', name: 'Tau' },
        { symbol: 'φ', name: 'Phi' },
        { symbol: 'ψ', name: 'Psi' },
        { symbol: 'ω', name: 'Omega (small)' },
        { symbol: 'Δ', name: 'Delta (capital)' },
        { symbol: 'Σ', name: 'Sigma (capital)' },
        { symbol: 'Π', name: 'Pi (capital)' },
        { symbol: 'Ω', name: 'Omega (capital)' },
        { symbol: 'Φ', name: 'Phi (capital)' },
        { symbol: 'Ψ', name: 'Psi (capital)' },
    ],
    'Math - Operators': [
        { symbol: '√', name: 'Square Root' },
        { symbol: '∛', name: 'Cube Root' },
        { symbol: '∜', name: 'Fourth Root' },
        { symbol: '∫', name: 'Integral' },
        { symbol: '∬', name: 'Double Integral' },
        { symbol: '∭', name: 'Triple Integral' },
        { symbol: '∮', name: 'Contour Integral' },
        { symbol: '∑', name: 'Summation' },
        { symbol: '∏', name: 'Product' },
        { symbol: '∂', name: 'Partial Derivative' },
        { symbol: '∇', name: 'Nabla/Del' },
        { symbol: '∈', name: 'Element of' },
        { symbol: '∉', name: 'Not Element of' },
        { symbol: '⊂', name: 'Subset' },
        { symbol: '⊃', name: 'Superset' },
        { symbol: '⊆', name: 'Subset/Equal' },
        { symbol: '∪', name: 'Union' },
        { symbol: '∩', name: 'Intersection' },
        { symbol: '∅', name: 'Empty Set' },
        { symbol: 'ℝ', name: 'Real Numbers' },
        { symbol: 'ℤ', name: 'Integers' },
        { symbol: 'ℕ', name: 'Natural Numbers' },
        { symbol: 'ℂ', name: 'Complex Numbers' },
    ],
    'Math - Relations': [
        { symbol: '<', name: 'Less Than' },
        { symbol: '>', name: 'Greater Than' },
        { symbol: '≤', name: 'Less/Equal' },
        { symbol: '≥', name: 'Greater/Equal' },
        { symbol: '≪', name: 'Much Less' },
        { symbol: '≫', name: 'Much Greater' },
        { symbol: '∝', name: 'Proportional' },
        { symbol: '⊥', name: 'Perpendicular' },
        { symbol: '∥', name: 'Parallel' },
        { symbol: '∠', name: 'Angle' },
        { symbol: '∟', name: 'Right Angle' },
        { symbol: '°', name: 'Degree' },
    ],
    'Superscripts': [
        { symbol: '⁰', name: 'Super 0' },
        { symbol: '¹', name: 'Super 1' },
        { symbol: '²', name: 'Super 2' },
        { symbol: '³', name: 'Super 3' },
        { symbol: '⁴', name: 'Super 4' },
        { symbol: '⁵', name: 'Super 5' },
        { symbol: '⁶', name: 'Super 6' },
        { symbol: '⁷', name: 'Super 7' },
        { symbol: '⁸', name: 'Super 8' },
        { symbol: '⁹', name: 'Super 9' },
        { symbol: 'ⁿ', name: 'Super n' },
        { symbol: 'ⁱ', name: 'Super i' },
        { symbol: '⁺', name: 'Super +' },
        { symbol: '⁻', name: 'Super -' },
        { symbol: '⁼', name: 'Super =' },
        { symbol: '⁽', name: 'Super (' },
        { symbol: '⁾', name: 'Super )' },
    ],
    'Subscripts': [
        { symbol: '₀', name: 'Sub 0' },
        { symbol: '₁', name: 'Sub 1' },
        { symbol: '₂', name: 'Sub 2' },
        { symbol: '₃', name: 'Sub 3' },
        { symbol: '₄', name: 'Sub 4' },
        { symbol: '₅', name: 'Sub 5' },
        { symbol: '₆', name: 'Sub 6' },
        { symbol: '₇', name: 'Sub 7' },
        { symbol: '₈', name: 'Sub 8' },
        { symbol: '₉', name: 'Sub 9' },
        { symbol: 'ₙ', name: 'Sub n' },
        { symbol: 'ₓ', name: 'Sub x' },
        { symbol: '₊', name: 'Sub +' },
        { symbol: '₋', name: 'Sub -' },
        { symbol: '₌', name: 'Sub =' },
        { symbol: '₍', name: 'Sub (' },
        { symbol: '₎', name: 'Sub )' },
    ],
    'Chemistry': [
        { symbol: '→', name: 'Reaction Arrow' },
        { symbol: '⇌', name: 'Equilibrium' },
        { symbol: '⇋', name: 'Equilibrium (alt)' },
        { symbol: '↑', name: 'Gas Evolved' },
        { symbol: '↓', name: 'Precipitate' },
        { symbol: '⟶', name: 'Long Arrow' },
        { symbol: '⟵', name: 'Long Left Arrow' },
        { symbol: '⟷', name: 'Long Double Arrow' },
        { symbol: '°', name: 'Degree' },
        { symbol: '•', name: 'Radical Dot' },
        { symbol: '‡', name: 'Double Dagger' },
        { symbol: 'Δ', name: 'Heat/Change' },
        { symbol: '⊕', name: 'Positive Charge' },
        { symbol: '⊖', name: 'Negative Charge' },
        { symbol: '·', name: 'Dot (hydrate)' },
    ],
    'Physics': [
        { symbol: 'ℏ', name: 'h-bar (Planck)' },
        { symbol: 'Å', name: 'Angstrom' },
        { symbol: '℃', name: 'Celsius' },
        { symbol: '℉', name: 'Fahrenheit' },
        { symbol: 'Ω', name: 'Ohm' },
        { symbol: 'μ', name: 'Micro' },
        { symbol: '·', name: 'Dot Product' },
        { symbol: '×', name: 'Cross Product' },
        { symbol: '⃗', name: 'Vector Arrow' },
        { symbol: '∥', name: 'Parallel' },
        { symbol: '⊥', name: 'Perpendicular' },
        { symbol: 'λ', name: 'Wavelength' },
        { symbol: 'ν', name: 'Frequency' },
        { symbol: 'ε', name: 'Permittivity' },
        { symbol: '∂', name: 'Partial' },
    ],
    'Biology': [
        { symbol: '♀', name: 'Female' },
        { symbol: '♂', name: 'Male' },
        { symbol: '†', name: 'Died/Extinct' },
        { symbol: '‡', name: 'Double Cross' },
        { symbol: '°C', name: 'Celsius' },
        { symbol: '±', name: 'Plus/Minus' },
        { symbol: '×', name: 'Cross (breeding)' },
        { symbol: '→', name: 'Yields/Produces' },
        { symbol: '⇌', name: 'Reversible' },
        { symbol: 'μ', name: 'Micro' },
        { symbol: 'Σ', name: 'Sum' },
        { symbol: 'Δ', name: 'Change' },
    ],
    'Arrows': [
        { symbol: '→', name: 'Right Arrow' },
        { symbol: '←', name: 'Left Arrow' },
        { symbol: '↔', name: 'Left-Right Arrow' },
        { symbol: '⇒', name: 'Double Right' },
        { symbol: '⇐', name: 'Double Left' },
        { symbol: '⇔', name: 'Double Both' },
        { symbol: '↑', name: 'Up Arrow' },
        { symbol: '↓', name: 'Down Arrow' },
        { symbol: '↗', name: 'Up-Right' },
        { symbol: '↘', name: 'Down-Right' },
        { symbol: '↙', name: 'Down-Left' },
        { symbol: '↖', name: 'Up-Left' },
    ],
};

// Example templates for quick insertion
const TEMPLATES = {
    math: [
        { name: 'Quadratic Formula', content: 'x = (-b ± √(b² - 4ac)) / 2a' },
        { name: 'Pythagorean', content: 'a² + b² = c²' },
        { name: 'Einstein', content: 'E = mc²' },
        { name: 'Area of Circle', content: 'A = πr²' },
        { name: 'Derivative', content: 'dy/dx = lim(Δx→0) [f(x+Δx) - f(x)] / Δx' },
        { name: 'Euler\'s Identity', content: 'e^(iπ) + 1 = 0' },
    ],
    chemistry: [
        { name: 'Water', content: 'H₂O' },
        { name: 'Carbon Dioxide', content: 'CO₂' },
        { name: 'Sulfuric Acid', content: 'H₂SO₄' },
        { name: 'Photosynthesis', content: '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂' },
        { name: 'Combustion of Methane', content: 'CH₄ + 2O₂ → CO₂ + 2H₂O' },
        { name: 'Haber Process', content: 'N₂ + 3H₂ ⇌ 2NH₃' },
        { name: 'pH Definition', content: 'pH = -log₁₀[H⁺]' },
    ],
    physics: [
        { name: 'Newton\'s 2nd Law', content: 'F = ma' },
        { name: 'Kinetic Energy', content: 'KE = ½mv²' },
        { name: 'Coulomb\'s Law', content: 'F = kq₁q₂/r²' },
        { name: 'Wave Equation', content: 'v = fλ' },
        { name: 'Planck\'s Equation', content: 'E = hν' },
        { name: 'Ohm\'s Law', content: 'V = IR' },
        { name: 'Gravitational Force', content: 'F = Gm₁m₂/r²' },
    ],
    biology: [
        { name: 'ATP Hydrolysis', content: 'ATP + H₂O → ADP + Pᵢ + Energy' },
        { name: 'DNA Base Pairs', content: 'A=T, G≡C' },
        { name: 'Cellular Respiration', content: 'C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + ATP' },
        { name: 'Mendelian Ratio', content: '3:1 or 9:3:3:1' },
    ],
};

interface ScientificEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export default function ScientificEditor({
    value,
    onChange,
    placeholder = 'Enter your content here...',
    className = '',
}: ScientificEditorProps) {
    const [activeCategory, setActiveCategory] = useState<string>('Math - Basic');
    const [activeTemplateCategory, setActiveTemplateCategory] = useState<string>('math');
    const [showSymbols, setShowSymbols] = useState(true);
    const [showTemplates, setShowTemplates] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const editorRef = useRef<HTMLTextAreaElement>(null);

    // Insert symbol at cursor position
    const insertSymbol = useCallback((symbol: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const newValue = value.substring(0, start) + symbol + value.substring(end);
        onChange(newValue);

        // Restore cursor position after symbol
        setTimeout(() => {
            editor.focus();
            editor.setSelectionRange(start + symbol.length, start + symbol.length);
        }, 0);
    }, [value, onChange]);

    // Insert template
    const insertTemplate = useCallback((template: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const newValue = value.substring(0, start) + template + value.substring(end);
        onChange(newValue);

        setTimeout(() => {
            editor.focus();
            editor.setSelectionRange(start + template.length, start + template.length);
        }, 0);
    }, [value, onChange]);

    // Filter symbols by search query
    type SymbolItem = { symbol: string; name: string };
    type SymbolCategories = Record<string, SymbolItem[]>;

    const filteredSymbols: SymbolCategories = searchQuery
        ? Object.entries(SYMBOL_CATEGORIES).reduce<SymbolCategories>((acc, [category, symbols]) => {
            const filtered = symbols.filter(
                (s) =>
                    s.symbol.includes(searchQuery) ||
                    s.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            if (filtered.length > 0) {
                acc[category] = filtered;
            }
            return acc;
        }, {})
        : { [activeCategory]: SYMBOL_CATEGORIES[activeCategory as keyof typeof SYMBOL_CATEGORIES] };

    return (
        <div className={`scientific-editor border border-gray-300 rounded-lg overflow-hidden ${className}`}>
            {/* Toolbar */}
            <div className="bg-gray-100 border-b border-gray-300 p-2">
                <div className="flex flex-wrap gap-2 mb-2">
                    <button
                        onClick={() => { setShowSymbols(true); setShowTemplates(false); }}
                        className={`px-3 py-1 rounded text-sm font-medium ${showSymbols && !showTemplates ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'}`}
                    >
                        🔢 Symbols
                    </button>
                    <button
                        onClick={() => { setShowTemplates(true); setShowSymbols(false); }}
                        className={`px-3 py-1 rounded text-sm font-medium ${showTemplates ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'}`}
                    >
                        📝 Templates
                    </button>
                    <button
                        onClick={() => { setShowSymbols(false); setShowTemplates(false); }}
                        className={`px-3 py-1 rounded text-sm font-medium ${!showSymbols && !showTemplates ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'}`}
                    >
                        ✏️ Editor Only
                    </button>
                </div>

                {/* Symbol Picker */}
                {showSymbols && (
                    <div className="mt-2">
                        {/* Search */}
                        <div className="mb-2">
                            <input
                                type="text"
                                placeholder="Search symbols..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        {/* Category Tabs */}
                        {!searchQuery && (
                            <div className="flex flex-wrap gap-1 mb-2">
                                {Object.keys(SYMBOL_CATEGORIES).map((category) => (
                                    <button
                                        key={category}
                                        onClick={() => setActiveCategory(category)}
                                        className={`px-2 py-1 text-xs rounded ${activeCategory === category
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        {category}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Symbols Grid */}
                        <div className="bg-white p-2 rounded border border-gray-200 max-h-40 overflow-y-auto">
                            {Object.entries(filteredSymbols).map(([category, symbols]) => (
                                <div key={category}>
                                    {searchQuery && (
                                        <div className="text-xs text-gray-500 mb-1">{category}</div>
                                    )}
                                    <div className="grid grid-cols-10 gap-1">
                                        {symbols.map((item, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => insertSymbol(item.symbol)}
                                                title={item.name}
                                                className="w-8 h-8 flex items-center justify-center text-lg bg-gray-50 hover:bg-blue-100 rounded border border-gray-200 hover:border-blue-400 transition-colors"
                                            >
                                                {item.symbol}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Templates */}
                {showTemplates && (
                    <div className="mt-2">
                        <div className="flex gap-2 mb-2">
                            {Object.keys(TEMPLATES).map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveTemplateCategory(cat)}
                                    className={`px-3 py-1 text-sm rounded capitalize ${activeTemplateCategory === cat
                                        ? 'bg-green-600 text-white'
                                        : 'bg-white text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        <div className="bg-white p-2 rounded border border-gray-200 max-h-40 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-2">
                                {TEMPLATES[activeTemplateCategory as keyof typeof TEMPLATES].map((template, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => insertTemplate(template.content)}
                                        className="text-left px-3 py-2 bg-gray-50 hover:bg-green-50 rounded border border-gray-200 hover:border-green-400 transition-colors"
                                    >
                                        <div className="text-xs text-gray-500 mb-1">{template.name}</div>
                                        <div className="text-sm font-mono">{template.content}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Editor Area */}
            <textarea
                ref={editorRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full min-h-[200px] p-4 font-mono text-base text-gray-900 bg-white resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
            />
        </div>
    );
}

// Export symbol categories for use in other components
export { SYMBOL_CATEGORIES, TEMPLATES };
