import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

// Checkbox dropdown for multi-select filters (status / department / psychologist, etc.)
const MultiSelectFilter = ({ label, options, selected, onChange, className = '' }) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (value) => {
        if (selected.includes(value)) {
            onChange(selected.filter(v => v !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const displayLabel = selected.length > 0 ? `${label} (已選 ${selected.length})` : label;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 shadow-sm bg-white text-left flex justify-between items-center gap-2"
            >
                <span className={`truncate ${selected.length > 0 ? 'text-gray-800' : 'text-gray-500'}`}>{displayLabel}</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg p-2 space-y-0.5">
                    {options.length === 0 ? (
                        <div className="text-xs text-gray-400 px-2 py-1">無選項</div>
                    ) : (
                        options.map(opt => (
                            <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-primary rounded focus:ring-primary/20 border-gray-300"
                                    checked={selected.includes(opt.value)}
                                    onChange={() => toggleOption(opt.value)}
                                />
                                {opt.label}
                            </label>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default MultiSelectFilter;
