import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import Button from './Button';
import { X, EyeOff } from 'lucide-react';
import { SCALE_VALUES, getVisibleQuestionIds, isAnswerEmpty, getMySurveyState, isSection, getQuestionNumbers } from '../utils/surveyUtils';

const inputClass = 'w-full p-3 sm:p-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:bg-gray-100';

// viewer = { type: 'psychologist' | 'officer', id }
const SurveyForm = ({ viewer, surveyId, onClose, onSubmitted }) => {
    const [survey, setSurvey] = useState(null);
    const [answers, setAnswers] = useState({});
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const load = async () => {
            const { data, error } = await supabase.rpc('survey_get_for_me', {
                p_type: viewer.type, p_id: viewer.id, p_survey_id: surveyId
            });
            if (error) return setError(error.message);
            setSurvey(data);
            setAnswers(data.my_answers || {});
        };
        load();
    }, [viewer.type, viewer.id, surveyId]);

    const state = survey ? getMySurveyState(survey) : null;
    const isEditing = !!survey && survey.mode === 'single' && !survey.is_anonymous && survey.fill_count > 0;
    // 無法再填 / 修改時，只能檢視 (具名單次問卷可看到自己先前的答案)
    const readOnly = !!state && !state.canAct;
    const visible = useMemo(() => (survey ? getVisibleQuestionIds(survey.questions, answers) : new Set()), [survey, answers]);

    // 要顯示的項目：被隱藏的題目不顯示；分段底下沒有任何可見題目時，分段標題也一併隱藏
    const items = useMemo(() => {
        if (!survey) return [];
        const shown = survey.questions.filter(q => visible.has(q.id));
        return shown.filter((q, i) => {
            if (!isSection(q)) return true;
            const next = shown[i + 1];
            return !!next && !isSection(next);
        });
    }, [survey, visible]);
    const numbers = useMemo(() => getQuestionNumbers(items), [items]);

    const setAnswer = (id, value) => setAnswers(a => ({ ...a, [id]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const missing = survey.questions.find(q => !isSection(q) && visible.has(q.id) && q.required && isAnswerEmpty(answers[q.id]));
        if (missing) return alert(`尚有必填題未作答：${missing.text}`);

        let confirmMsg = '確定要送出嗎？';
        if (isEditing) {
            const left = survey.allowed_edits - survey.edits_used - 1;
            confirmMsg = `確定要送出修改嗎？送出後${left > 0 ? `還可再修改 ${left} 次` : '將無法再修改'}。`;
        } else if (survey.mode === 'single' && survey.allowed_edits === 0) {
            confirmMsg = '送出後無法修改，確定要送出嗎？';
        } else if (survey.mode === 'single' && !survey.is_anonymous) {
            confirmMsg = `確定要送出嗎？送出後還可修改 ${survey.allowed_edits} 次。`;
        }
        if (!window.confirm(confirmMsg)) return;

        // 只送出目前顯示的題目，被隱藏題目的舊答案不留
        const payload = {};
        survey.questions.forEach(q => { if (!isSection(q) && visible.has(q.id) && !isAnswerEmpty(answers[q.id])) payload[q.id] = answers[q.id]; });

        setSubmitting(true);
        const { error } = await supabase.rpc('survey_submit', {
            p_type: viewer.type, p_id: viewer.id, p_survey_id: surveyId, p_answers: payload
        });
        setSubmitting(false);
        if (error) return alert('送出失敗：' + error.message);
        alert('已送出，謝謝您的填寫！');
        onSubmitted();
    };

    const renderInput = (q) => {
        const value = answers[q.id];
        switch (q.type) {
            case 'single':
                return (
                    <div className="space-y-2">
                        {q.options.map(opt => (
                            <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer min-h-[36px]">
                                <input type="radio" disabled={readOnly} checked={value === opt} onChange={() => setAnswer(q.id, opt)} className="w-5 h-5 sm:w-4 sm:h-4" />
                                {opt}
                            </label>
                        ))}
                    </div>
                );
            case 'multi':
                return (
                    <div className="space-y-2">
                        {q.options.map(opt => {
                            const list = Array.isArray(value) ? value : [];
                            return (
                                <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer min-h-[36px]">
                                    <input
                                        type="checkbox" disabled={readOnly} checked={list.includes(opt)} className="w-5 h-5 sm:w-4 sm:h-4 rounded"
                                        onChange={e => setAnswer(q.id, e.target.checked ? [...list, opt] : list.filter(x => x !== opt))}
                                    />
                                    {opt}
                                </label>
                            );
                        })}
                    </div>
                );
            case 'scale':
                return (
                    <div>
                        <div className="flex gap-2">
                            {SCALE_VALUES.map(n => (
                                <button
                                    key={n} type="button" disabled={readOnly} onClick={() => setAnswer(q.id, n)}
                                    className={`flex-1 min-h-[44px] rounded-lg border text-sm font-medium ${value === n ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                                >{n}</button>
                            ))}
                        </div>
                        {(q.scale_low || q.scale_high) && (
                            <div className="flex justify-between text-xs text-gray-500 mt-1"><span>1 = {q.scale_low}</span><span>5 = {q.scale_high}</span></div>
                        )}
                    </div>
                );
            case 'date':
                return <input type="date" className={inputClass} disabled={readOnly} value={value || ''} onChange={e => setAnswer(q.id, e.target.value)} />;
            case 'longtext':
                return <textarea rows="4" maxLength={5000} className={`${inputClass} resize-none`} disabled={readOnly} value={value || ''} onChange={e => setAnswer(q.id, e.target.value)} />;
            default:
                return <input type="text" maxLength={5000} className={inputClass} disabled={readOnly} value={value || ''} onChange={e => setAnswer(q.id, e.target.value)} />;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 overflow-y-auto p-4 sm:p-10">
            <div className="bg-white rounded-2xl p-5 sm:p-8 w-full max-w-2xl shadow-2xl mt-4 sm:mt-0 sm:my-auto mb-10 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start gap-3 mb-4">
                    <h3 className="text-xl font-bold text-gray-800 break-words">{survey?.title || '問卷'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X className="w-6 h-6" /></button>
                </div>

                {error ? (
                    <div className="py-8 text-center text-red-600 text-sm">{error}</div>
                ) : !survey ? (
                    <div className="py-8 text-center text-gray-400">載入中...</div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {survey.description && <p className="text-sm text-gray-600 whitespace-pre-wrap">{survey.description}</p>}
                        <div className="flex flex-wrap gap-2 text-xs">
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full">截止日期：{survey.end_date}</span>
                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full">{state.text}</span>
                            {survey.is_anonymous && (
                                <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-full inline-flex items-center gap-1">
                                    <EyeOff className="w-3 h-3" /> 匿名作答，管理員看不到誰填了什麼
                                </span>
                            )}
                        </div>

                        {readOnly && survey.mode === 'single' && !survey.is_anonymous && (
                            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">修改次數已用完，以下為你送出的內容。如需再修改，請聯絡系統管理員。</p>
                        )}

                        {items.map((q) => isSection(q) ? (
                            <div key={q.id} className="pt-3 border-t-2 border-blue-100">
                                <h4 className="text-base font-bold text-primary">{q.text}</h4>
                                {q.description && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{q.description}</p>}
                            </div>
                        ) : (
                            <div key={q.id} className="space-y-2">
                                <p className="text-sm font-medium text-gray-800">
                                    {numbers[q.id]}. {q.text}{q.required && <span className="text-red-500 ml-1">*</span>}
                                </p>
                                {q.description && <p className="text-xs text-gray-500 whitespace-pre-wrap">{q.description}</p>}
                                {renderInput(q)}
                            </div>
                        ))}

                        <div className="pt-3 flex flex-col sm:flex-row justify-end gap-3">
                            <Button variant="outline" type="button" onClick={onClose} className="w-full sm:w-auto">{readOnly ? '關閉' : '取消'}</Button>
                            {!readOnly && (
                                <Button variant="primary" type="submit" disabled={submitting} className="w-full sm:w-auto">
                                    {submitting ? '送出中...' : isEditing ? '送出修改' : '送出'}
                                </Button>
                            )}
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default SurveyForm;
