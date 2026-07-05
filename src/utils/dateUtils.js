export const getROCYear = (dateOrString) => {
    if (!dateOrString) return '';
    const date = new Date(dateOrString);
    if (isNaN(date.getTime())) return '';
    return date.getFullYear() - 1911;
};

export const PSYCHOLOGIST_COLORS = [
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-green-100 text-green-800 border-green-200',
    'bg-purple-100 text-purple-800 border-purple-200',
    'bg-orange-100 text-orange-800 border-orange-200',
    'bg-pink-100 text-pink-800 border-pink-200',
    'bg-teal-100 text-teal-800 border-teal-200',
    'bg-indigo-100 text-indigo-800 border-indigo-200',
    'bg-cyan-100 text-cyan-800 border-cyan-200',
    'bg-rose-100 text-rose-800 border-rose-200',
    'bg-lime-100 text-lime-800 border-lime-200',
    'bg-amber-100 text-amber-800 border-amber-200',
    'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200'
];

export const getPsychologistColor = (psychologistId, psychologistList = []) => {
    if (!psychologistId) return 'bg-gray-100 text-gray-800 border-gray-200';

    // Assign colors by each psychologist's fixed position in the full roster
    // (ordered by name) so that, as long as there are no more psychologists
    // than colors, every psychologist gets a distinct, stable color.
    const index = psychologistList.findIndex(p => p.id === psychologistId);
    if (index === -1) {
        let hash = 0;
        for (let i = 0; i < psychologistId.length; i++) {
            hash = psychologistId.charCodeAt(i) + ((hash << 5) - hash);
        }
        return PSYCHOLOGIST_COLORS[Math.abs(hash) % PSYCHOLOGIST_COLORS.length];
    }

    return PSYCHOLOGIST_COLORS[index % PSYCHOLOGIST_COLORS.length];
};

export const toROCDate = (dateOrString) => {
    if (!dateOrString) return '';
    const date = new Date(dateOrString);
    if (isNaN(date.getTime())) return '';
    const rocYear = date.getFullYear() - 1911;
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${rocYear}-${month}-${day}`;
};

export const toROCFullDate = (dateOrString) => {
    if (!dateOrString) return '';
    const date = new Date(dateOrString);
    if (isNaN(date.getTime())) return '';
    const rocYear = date.getFullYear() - 1911;
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${rocYear}年${month}月${day}日`;
};

// For dropdowns: Generate current ROC year
export const getCurrentROCYear = () => {
    return new Date().getFullYear() - 1911;
};

// Helper for '2026-01-20' -> '115-01-20'
// Useful for direct string manipulation if timezone safety is concern
export const convertDateStringToROC = (isoDateString) => {
    if (!isoDateString) return '';
    const [year, month, day] = isoDateString.split('-');
    if (!year || !month || !day) return isoDateString;
    const rocYear = parseInt(year) - 1911;
    return `${rocYear}-${month}-${day}`;
};

export const getTimeOptions = () => {
    const times = [];
    for (let i = 8; i <= 21; i++) { // 08:00 to 21:30
        times.push(`${String(i).padStart(2, '0')}:00`);
        times.push(`${String(i).padStart(2, '0')}:30`);
    }
    return times;
};
