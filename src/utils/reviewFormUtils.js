// 考核表欄位類型與預設值（表單維護、填寫、列印共用）
export const FIELD_TYPES = [
    { value: 'section', label: '分段標題' },
    { value: 'text', label: '短文字' },
    { value: 'textarea', label: '長文字' },
    { value: 'number', label: '數字' },
    { value: 'select', label: '單選（下拉）' },
    { value: 'checkbox', label: '多選' },
    { value: 'scale', label: '評分（1 到 N）' },
];

export const DEFAULT_PRINT = {
    title: '運動戒癮團體考核表',
    subtitle: '',
    show_session: true,
    show_youth: true,
    signatures: ['填表人', '專案管理者'],
    footer: '',
};

export const newFieldId = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const newField = (type = 'text') => ({
    id: newFieldId(), type, label: '', required: false,
    options: type === 'select' || type === 'checkbox' ? ['選項一', '選項二'] : [],
    scale_max: 5,
});

// 把欄位值轉成列印／檢視用文字
export const displayValue = (field, value) => {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return '';
    if (field.type === 'checkbox') return Array.isArray(value) ? value.join('、') : String(value);
    if (field.type === 'scale') return `${value} / ${field.scale_max || 5}`;
    return String(value);
};
