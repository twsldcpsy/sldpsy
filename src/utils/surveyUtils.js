export const QUESTION_TYPES = [
    { value: 'single', label: '單選題' },
    { value: 'multi', label: '複選題' },
    { value: 'text', label: '簡答題' },
    { value: 'longtext', label: '長文題' },
    { value: 'scale', label: '量表題 (1~5)' },
    { value: 'date', label: '日期題' }
];

export const SCALE_VALUES = [1, 2, 3, 4, 5];

export const hasOptions = (type) => type === 'single' || type === 'multi';
// 只有這兩種題型可以當作「條件跳題」的依據
export const canTrigger = (type) => type === 'single' || type === 'scale';

export const newQuestionId = () => `q_${Math.random().toString(36).slice(2, 8)}`;

// 「分段」與題目放在同一個清單，只用來分隔區塊，不可作答
export const isSection = (q) => q.type === 'section';

export const createSection = () => ({
    id: newQuestionId(),
    type: 'section',
    text: '',
    description: ''
});

// 題號只算可作答的題目 (分段不佔題號)
export const getQuestionNumbers = (questions) => {
    const numbers = {};
    let n = 0;
    questions.forEach(q => { if (!isSection(q)) numbers[q.id] = ++n; });
    return numbers;
};

export const createQuestion = (type = 'single') => ({
    id: newQuestionId(),
    type,
    text: '',
    description: '',
    required: false,
    options: hasOptions(type) ? ['選項 1', '選項 2'] : [],
    scale_low: '',
    scale_high: '',
    show_if: null
});

// 跳題條件的可選值：單選題為各選項，量表為 1~5 (一律以字串比對，與資料庫一致)
export const getTriggerValues = (question) => {
    if (!question) return [];
    if (question.type === 'single') return question.options || [];
    if (question.type === 'scale') return SCALE_VALUES.map(String);
    return [];
};

// 條件只能參照「前面」的單選/量表題，其餘一律移除，避免排序或刪題後留下失效條件
export const sanitizeQuestions = (questions) => questions.map((q, i) => {
    if (!q.show_if) return q;
    const ref = questions.slice(0, i).find(p => p.id === q.show_if.question_id && canTrigger(p.type));
    if (!ref) return { ...q, show_if: null };
    const valid = getTriggerValues(ref);
    const values = (q.show_if.values || []).filter(v => valid.includes(v));
    // values 可以暫時是空的 (剛按下「設定條件顯示」、尚未勾選答案)，儲存時由編輯器檢查
    return { ...q, show_if: { question_id: ref.id, values } };
});

// 依目前答案算出哪些題目該顯示 (與資料庫 survey_submit 的判斷邏輯一致)
export const getVisibleQuestionIds = (questions, answers) => {
    const visible = new Set();
    for (const q of questions) {
        const c = q.show_if;
        if (c && c.question_id) {
            if (!visible.has(c.question_id)) continue;
            const a = answers[c.question_id];
            if (a === undefined || a === null || !(c.values || []).includes(String(a))) continue;
        }
        visible.add(q.id);
    }
    return visible;
};

export const isAnswerEmpty = (v) =>
    v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

// 問卷目前狀態 (管理員列表用)；today 為 'YYYY-MM-DD'
export const getSurveyStatus = (s, today = getTodayString()) => {
    if (s.is_closed) return { label: '已關閉', className: 'bg-gray-100 text-gray-500' };
    if (today < s.start_date) return { label: '未開始', className: 'bg-yellow-100 text-yellow-700' };
    if (today > s.end_date) return { label: '已結束', className: 'bg-gray-100 text-gray-500' };
    return { label: '進行中', className: 'bg-green-100 text-green-700' };
};

// 台灣時區的今天，與資料庫 survey_today() 一致
export const getTodayString = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());

export const getAudienceSummary = (s) => {
    const parts = [];
    if (s.target_all_psychologists) parts.push('心理師 (全部)');
    if (s.target_all_officers) parts.push('保護官 (全部)');
    if (s.target_psychologist_ids?.length > 0) parts.push(`個別心理師 (${s.target_psychologist_ids.length})`);
    if (s.target_departments?.length > 0) parts.push(`個別股別 (${s.target_departments.length})`);
    return parts.length > 0 ? parts.join('、') : '未設定';
};

// 使用者端：某份問卷我目前的進度與可執行動作
export const getMySurveyState = (s) => {
    const editable = s.mode === 'single' && !s.is_anonymous; // 具名單次填答才有「修改」
    const filled = s.fill_count > 0;
    const editsLeft = Math.max(0, s.allowed_edits - s.edits_used);
    const fillsLeft = Math.max(0, s.allowed_fills - s.fill_count);

    if (!filled) return { pending: true, canAct: true, actionLabel: '填寫', text: '尚未填寫' };
    if (editable) {
        return editsLeft > 0
            ? { pending: false, canAct: true, actionLabel: '修改', text: `已填寫，可修改（剩 ${editsLeft} 次）` }
            : { pending: false, canAct: false, actionLabel: '檢視', text: '已填寫（無法再修改）' };
    }
    return fillsLeft > 0
        ? { pending: false, canAct: true, actionLabel: '再填一份', text: `已填 ${s.fill_count} 份，還可再填 ${fillsLeft} 份` }
        : { pending: false, canAct: false, actionLabel: null, text: `已填 ${s.fill_count} 份（已達上限）` };
};

// 截止提醒：只有尚未填寫的問卷才標示急迫程度
export const getUrgency = (s, pending) => {
    if (!pending) return 'normal';
    if (s.days_left <= 0) return 'today';
    if (s.days_left <= 3) return 'soon';
    return 'normal';
};

export const getDeadlineText = (s) => {
    if (s.days_left <= 0) return '今天截止';
    if (s.days_left <= 3) return `剩 ${s.days_left} 天`;
    return `截止 ${s.end_date}`;
};

const popupKey = (viewer, surveyId) => `survey_popup_seen:${viewer.type}:${viewer.id}:${surveyId}`;

export const hasSeenSurveyPopup = (viewer, surveyId) => {
    try { return localStorage.getItem(popupKey(viewer, surveyId)) === '1'; } catch { return false; }
};

export const markSurveyPopupSeen = (viewer, surveyId) => {
    try { localStorage.setItem(popupKey(viewer, surveyId), '1'); } catch { /* 無法寫入時略過 */ }
};
