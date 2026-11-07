import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import MultiSelectFilter from '../../components/MultiSelectFilter';
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Lock } from 'lucide-react';
import {
    QUESTION_TYPES, createQuestion, hasOptions, canTrigger, getTriggerValues,
    sanitizeQuestions, getTodayString
} from '../../utils/surveyUtils';

const inputClass = 'w-full p-3 sm:p-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-500';
const checkClass = 'w-5 h-5 sm:w-4 sm:h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300';

const emptyForm = () => ({
    id: null,
    title: '',
    description: '',
    start_date: getTodayString(),
    end_date: '',
    mode: 'single',
    fill_limit: 1,
    edit_limit: 0,
    is_anonymous: false,
    target_all_psychologists: true,
    target_all_officers: true,
    target_psychologist_ids: [],
    target_departments: [],
    questions: [createQuestion('single')]
});

// surveyId 有值 = 編輯；copyFromId 有值 = 以舊問卷為範本新增；皆無 = 全新
const SurveyEditor = ({ adminId, surveyId, copyFromId, onBack, onSaved }) => {
    const [form, setForm] = useState(emptyForm());
    const [hasResponses, setHasResponses] = useState(false);
    const [loading, setLoading] = useState(!!(surveyId || copyFromId));
    const [saving, setSaving] = useState(false);
    const [psychologists, setPsychologists] = useState([]);
    const [departments, setDepartments] = useState([]);

    useEffect(() => {
        const loadDropdowns = async () => {
            const { data: psychs } = await supabase.from('psychologists').select('id, name').eq('is_active', true).order('name');
            setPsychologists(psychs || []);
            const { data: officers } = await supabase.from('probation_officers').select('department').neq('department', null);
            setDepartments([...new Set((officers || []).map(o => o.department))].sort());
        };
        loadDropdowns();
    }, []);

    useEffect(() => {
        const sourceId = surveyId || copyFromId;
        if (!sourceId) return;
        const load = async () => {
            const { data, error } = await supabase.rpc('survey_admin_get', { p_admin_id: adminId, p_survey_id: sourceId });
            if (error) {
                alert('載入失敗：' + error.message);
                onBack();
                return;
            }
            const isCopy = !surveyId;
            setForm({
                ...emptyForm(),
                ...data,
                id: isCopy ? null : data.id,
                title: isCopy ? `${data.title} (複本)` : data.title,
                description: data.description || '',
                start_date: isCopy ? getTodayString() : data.start_date,
                end_date: isCopy ? '' : data.end_date
            });
            setHasResponses(!isCopy && data.has_responses);
            setLoading(false);
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const set = (patch) => setForm(f => ({ ...f, ...patch }));
    const locked = hasResponses; // 已有人填答：題目、作答模式、匿名設定鎖定

    const setQuestions = (questions) => set({ questions: sanitizeQuestions(questions) });
    const updateQuestion = (index, patch) =>
        setQuestions(form.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));

    const changeType = (index, type) => {
        const q = form.questions[index];
        updateQuestion(index, {
            type,
            options: hasOptions(type) ? (q.options.length >= 2 ? q.options : ['選項 1', '選項 2']) : [],
            // 換成不能觸發跳題的題型時，後面依賴它的條件由 sanitizeQuestions 清掉
        });
    };

    const moveQuestion = (index, dir) => {
        const target = index + dir;
        if (target < 0 || target >= form.questions.length) return;
        const next = [...form.questions];
        [next[index], next[target]] = [next[target], next[index]];
        setQuestions(next);
    };

    const removeQuestion = (index) => {
        if (form.questions.length === 1) return alert('至少需要一題');
        setQuestions(form.questions.filter((_, i) => i !== index));
    };

    const validate = () => {
        if (!form.title.trim()) return '請輸入問卷標題';
        if (!form.start_date || !form.end_date) return '請設定填寫期間';
        if (form.end_date < form.start_date) return '結束日期不可早於開始日期';
        if (!form.target_all_psychologists && !form.target_all_officers
            && form.target_psychologist_ids.length === 0 && form.target_departments.length === 0) {
            return '請至少選擇一個填寫對象';
        }
        for (const [i, q] of form.questions.entries()) {
            if (!q.text.trim()) return `第 ${i + 1} 題尚未輸入題目`;
            if (hasOptions(q.type)) {
                const opts = q.options.map(o => o.trim()).filter(Boolean);
                if (opts.length < 2) return `第 ${i + 1} 題至少需要兩個選項`;
                if (new Set(opts).size !== opts.length) return `第 ${i + 1} 題有重複的選項`;
            }
            if (q.show_if && (!q.show_if.values || q.show_if.values.length === 0)) {
                return `第 ${i + 1} 題的跳題條件尚未選擇答案`;
            }
        }
        return null;
    };

    const handleSave = async () => {
        const problem = validate();
        if (problem) return alert(problem);

        const questions = form.questions.map(q => ({
            ...q,
            text: q.text.trim(),
            options: hasOptions(q.type) ? q.options.map(o => o.trim()).filter(Boolean) : []
        }));

        setSaving(true);
        const { error } = await supabase.rpc('survey_admin_save', {
            p_admin_id: adminId,
            p_survey: { ...form, questions }
        });
        setSaving(false);
        if (error) return alert('儲存失敗：' + error.message);
        onSaved();
    };

    if (loading) return <div className="py-10 text-center text-gray-400">載入中...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="返回">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-bold text-primary">{form.id ? '編輯問卷' : '新增問卷'}</h3>
            </div>

            {locked && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">
                    <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    已有人填答，題目、作答模式與匿名設定已鎖定；標題、說明、期間、對象與次數仍可修改。
                </div>
            )}

            {/* 基本設定 */}
            <section className="bg-white p-5 rounded-xl border border-gray-100 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">問卷標題</label>
                    <input className={inputClass} value={form.title} onChange={e => set({ title: e.target.value })} placeholder="請輸入問卷標題" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">問卷說明 (選填)</label>
                    <textarea rows="3" className={`${inputClass} resize-none`} value={form.description} onChange={e => set({ description: e.target.value })} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">填寫期間 (含起訖日；截止後問卷自動從公告欄消失)</label>
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                        <input type="date" className={inputClass} value={form.start_date} onChange={e => set({ start_date: e.target.value })} />
                        <span className="text-gray-400">~</span>
                        <input type="date" className={inputClass} value={form.end_date} onChange={e => set({ end_date: e.target.value })} />
                    </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
                    <h4 className="text-sm font-bold text-gray-700">填寫對象</h4>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                            <input type="checkbox" className={checkClass} checked={form.target_all_psychologists} onChange={e => set({ target_all_psychologists: e.target.checked })} />
                            心理師 (全部)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                            <input type="checkbox" className={checkClass} checked={form.target_all_officers} onChange={e => set({ target_all_officers: e.target.checked })} />
                            保護官 (全部)
                        </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">個別心理師</label>
                            <MultiSelectFilter
                                label="選擇心理師"
                                options={psychologists.map(p => ({ value: p.id, label: p.name }))}
                                selected={form.target_psychologist_ids}
                                onChange={vals => set({ target_psychologist_ids: vals })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">個別股別</label>
                            <MultiSelectFilter
                                label="選擇股別"
                                options={departments.map(d => ({ value: d, label: d }))}
                                selected={form.target_departments}
                                onChange={vals => set({ target_departments: vals })}
                            />
                        </div>
                    </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
                    <h4 className="text-sm font-bold text-gray-700">作答方式</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className={`p-3 rounded-lg border cursor-pointer text-sm ${form.mode === 'single' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'} ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}>
                            <input type="radio" className="mr-2" disabled={locked} checked={form.mode === 'single'} onChange={() => set({ mode: 'single' })} />
                            <b>單次填答</b>
                            <p className="text-xs text-gray-500 mt-1">每人填一份，送出後可修改指定次數</p>
                        </label>
                        <label className={`p-3 rounded-lg border cursor-pointer text-sm ${form.mode === 'repeat' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'} ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}>
                            <input type="radio" className="mr-2" disabled={locked} checked={form.mode === 'repeat'} onChange={() => set({ mode: 'repeat' })} />
                            <b>重複填答</b>
                            <p className="text-xs text-gray-500 mt-1">每人可填多份，每份獨立、不可修改</p>
                        </label>
                    </div>

                    {form.mode === 'single' ? (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">可修改次數 (0 = 送出後不可修改)</label>
                            <input
                                type="number" min="0" className={`${inputClass} sm:max-w-[160px]`}
                                disabled={form.is_anonymous}
                                value={form.is_anonymous ? 0 : form.edit_limit}
                                onChange={e => set({ edit_limit: Math.max(0, parseInt(e.target.value) || 0) })}
                            />
                            {form.is_anonymous && <p className="text-xs text-gray-500 mt-1">匿名問卷無法對應到個人答案，因此不能修改。</p>}
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">每人最多可填份數</label>
                            <input
                                type="number" min="1" className={`${inputClass} sm:max-w-[160px]`}
                                value={form.fill_limit}
                                onChange={e => set({ fill_limit: Math.max(1, parseInt(e.target.value) || 1) })}
                            />
                        </div>
                    )}

                    <label className={`flex items-start gap-2 text-sm text-gray-700 ${locked ? 'opacity-60' : 'cursor-pointer'}`}>
                        <input type="checkbox" className={`${checkClass} mt-0.5`} disabled={locked} checked={form.is_anonymous}
                            onChange={e => set({ is_anonymous: e.target.checked, edit_limit: e.target.checked ? 0 : form.edit_limit })} />
                        <span>
                            匿名問卷
                            <span className="block text-xs text-gray-500">
                                系統仍會記錄「誰已填寫」以便催填與限制次數，但答案不與姓名連結，你也看不到誰填了什麼。
                            </span>
                        </span>
                    </label>
                </div>
            </section>

            {/* 題目 */}
            <section className="space-y-4">
                <h4 className="font-bold text-gray-800">題目</h4>
                {form.questions.map((q, index) => {
                    const triggers = form.questions.slice(0, index).filter(p => canTrigger(p.type));
                    const refQuestion = q.show_if ? form.questions.find(p => p.id === q.show_if.question_id) : null;
                    return (
                        <div key={q.id} className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 shadow-sm space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-bold text-primary">第 {index + 1} 題</span>
                                {!locked && (
                                    <div className="flex gap-1">
                                        <button type="button" onClick={() => moveQuestion(index, -1)} disabled={index === 0} className="p-2 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="上移"><ChevronUp className="w-4 h-4" /></button>
                                        <button type="button" onClick={() => moveQuestion(index, 1)} disabled={index === form.questions.length - 1} className="p-2 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="下移"><ChevronDown className="w-4 h-4" /></button>
                                        <button type="button" onClick={() => removeQuestion(index)} className="p-2 text-gray-400 hover:text-red-600" title="刪除"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <select className={inputClass} disabled={locked} value={q.type} onChange={e => changeType(index, e.target.value)}>
                                    {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                                <input className={`${inputClass} sm:col-span-2`} disabled={locked} placeholder="題目文字" value={q.text} onChange={e => updateQuestion(index, { text: e.target.value })} />
                            </div>

                            {hasOptions(q.type) && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">選項 (一行一個)</label>
                                    <textarea
                                        rows={Math.max(3, q.options.length + 1)} className={`${inputClass} resize-none`} disabled={locked}
                                        value={q.options.join('\n')}
                                        onChange={e => updateQuestion(index, { options: e.target.value.split('\n') })}
                                    />
                                </div>
                            )}

                            {q.type === 'scale' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input className={inputClass} disabled={locked} placeholder="1 分代表 (選填，例：非常不同意)" value={q.scale_low || ''} onChange={e => updateQuestion(index, { scale_low: e.target.value })} />
                                    <input className={inputClass} disabled={locked} placeholder="5 分代表 (選填，例：非常同意)" value={q.scale_high || ''} onChange={e => updateQuestion(index, { scale_high: e.target.value })} />
                                </div>
                            )}

                            <label className={`flex items-center gap-2 text-sm text-gray-700 ${locked ? 'opacity-60' : 'cursor-pointer'}`}>
                                <input type="checkbox" className={checkClass} disabled={locked} checked={q.required} onChange={e => updateQuestion(index, { required: e.target.checked })} />
                                必填
                            </label>

                            {/* 條件跳題 */}
                            <div className="pt-3 border-t border-gray-50">
                                {!q.show_if ? (
                                    <button
                                        type="button" disabled={locked || triggers.length === 0}
                                        onClick={() => updateQuestion(index, { show_if: { question_id: triggers[0].id, values: [] } })}
                                        className="text-xs text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                                    >
                                        {triggers.length === 0 ? '條件顯示 (前面需有單選或量表題)' : '+ 設定條件顯示'}
                                    </button>
                                ) : (
                                    <div className="space-y-2 text-sm">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-gray-600">僅當</span>
                                            <select
                                                className="p-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100" disabled={locked}
                                                value={q.show_if.question_id}
                                                onChange={e => updateQuestion(index, { show_if: { question_id: e.target.value, values: [] } })}
                                            >
                                                {triggers.map(t => (
                                                    <option key={t.id} value={t.id}>第 {form.questions.indexOf(t) + 1} 題 {t.text.slice(0, 16)}</option>
                                                ))}
                                            </select>
                                            <span className="text-gray-600">的答案是下列任一項時才顯示：</span>
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            {getTriggerValues(refQuestion).map(v => (
                                                <label key={v} className="flex items-center gap-1.5 text-gray-700">
                                                    <input
                                                        type="checkbox" className={checkClass} disabled={locked}
                                                        checked={q.show_if.values.includes(v)}
                                                        onChange={e => updateQuestion(index, {
                                                            show_if: {
                                                                ...q.show_if,
                                                                values: e.target.checked ? [...q.show_if.values, v] : q.show_if.values.filter(x => x !== v)
                                                            }
                                                        })}
                                                    />
                                                    {v}
                                                </label>
                                            ))}
                                        </div>
                                        {!locked && (
                                            <button type="button" onClick={() => updateQuestion(index, { show_if: null })} className="text-xs text-gray-500 hover:text-red-600">移除條件</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {!locked && (
                    <Button variant="outline" type="button" onClick={() => setQuestions([...form.questions, createQuestion('single')])} className="flex items-center gap-1">
                        <Plus className="w-4 h-4" /> 新增題目
                    </Button>
                )}
            </section>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                <Button variant="outline" type="button" onClick={onBack} className="w-full sm:w-auto">取消</Button>
                <Button variant="primary" type="button" onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                    {saving ? '儲存中...' : form.id ? '儲存變更' : '建立問卷'}
                </Button>
            </div>
        </div>
    );
};

export default SurveyEditor;
