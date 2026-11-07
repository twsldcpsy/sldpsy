import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import { ArrowLeft, Download, Unlock, EyeOff } from 'lucide-react';
import { toROCDate } from '../../utils/dateUtils';
import { hasOptions, SCALE_VALUES, isSection, getQuestionNumbers } from '../../utils/surveyUtils';

const formatAnswer = (q, v) => {
    if (v === undefined || v === null) return '';
    return Array.isArray(v) ? v.join('、') : String(v);
};

const average = (nums) => (nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : '-');

const Bar = ({ label, count, total }) => {
    const pct = total ? Math.round((count / total) * 100) : 0;
    return (
        <div className="text-sm">
            <div className="flex justify-between text-gray-700 mb-0.5">
                <span className="break-words pr-2">{label}</span>
                <span className="flex-shrink-0 text-gray-500">{count} 人次 ({pct}%)</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
};

// 單一題目的統計。compare = true 時，選擇題與量表改為「各組並排」。
const QuestionStats = ({ q, index, responses, groups, compare }) => {
    const answered = responses.filter(r => r.answers[q.id] !== undefined && r.answers[q.id] !== null && r.answers[q.id] !== '');
    const values = answered.map(r => r.answers[q.id]);

    let body;
    if (hasOptions(q.type) || q.type === 'scale') {
        const options = q.type === 'scale' ? SCALE_VALUES.map(String) : q.options;
        const countOf = (list, opt) => list.filter(r => {
            const a = r.answers[q.id];
            return Array.isArray(a) ? a.map(String).includes(opt) : String(a) === opt;
        }).length;

        if (compare) {
            body = (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="text-gray-500 border-b border-gray-100">
                                <th className="py-2 pr-3">{q.type === 'scale' ? '組別' : '選項'}</th>
                                {q.type === 'scale'
                                    ? <><th className="py-2 px-2">填答數</th><th className="py-2 px-2">平均</th></>
                                    : groups.map(g => <th key={g} className="py-2 px-2 whitespace-nowrap">{g}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {q.type === 'scale'
                                ? groups.map(g => {
                                    const nums = answered.filter(r => r.respondent_group === g).map(r => Number(r.answers[q.id]));
                                    return <tr key={g} className="border-b border-gray-50"><td className="py-2 pr-3">{g}</td><td className="px-2">{nums.length}</td><td className="px-2">{average(nums)}</td></tr>;
                                })
                                : options.map(opt => (
                                    <tr key={opt} className="border-b border-gray-50">
                                        <td className="py-2 pr-3">{opt}</td>
                                        {groups.map(g => <td key={g} className="px-2">{countOf(answered.filter(r => r.respondent_group === g), opt)}</td>)}
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            );
        } else {
            const total = q.type === 'multi' ? answered.length : answered.length;
            body = (
                <div className="space-y-2">
                    {q.type === 'scale' && <p className="text-sm text-gray-600">平均 <b>{average(values.map(Number))}</b> 分</p>}
                    {options.map(opt => <Bar key={opt} label={q.type === 'scale' ? `${opt} 分` : opt} count={countOf(answered, opt)} total={total} />)}
                    {q.type === 'multi' && <p className="text-xs text-gray-400">複選題百分比以填答人數為分母，加總可能超過 100%。</p>}
                </div>
            );
        }
    } else {
        body = answered.length === 0 ? <p className="text-sm text-gray-400">尚無回答</p> : (
            <ul className="space-y-1.5 max-h-60 overflow-y-auto">
                {answered.map((r, i) => (
                    <li key={i} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap break-words">
                        {String(r.answers[q.id])}
                        <span className="block text-xs text-gray-400 mt-0.5">
                            {[r.respondent_name, r.respondent_group].filter(Boolean).join(' · ')}
                        </span>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-100 space-y-3">
            <div className="flex justify-between gap-3">
                <h5 className="font-bold text-gray-800 break-words">{index + 1}. {q.text}</h5>
                <span className="text-xs text-gray-400 flex-shrink-0">{answered.length} 人作答</span>
            </div>
            {body}
        </div>
    );
};

const SurveyResults = ({ adminId, surveyId, onBack }) => {
    const [tab, setTab] = useState('roster');
    const [survey, setSurvey] = useState(null);
    const [responses, setResponses] = useState([]);
    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(true);
    const [groupFilter, setGroupFilter] = useState('all');
    const [rosterFilter, setRosterFilter] = useState('all');

    const load = useCallback(async () => {
        const [res, ros] = await Promise.all([
            supabase.rpc('survey_admin_results', { p_admin_id: adminId, p_survey_id: surveyId }),
            supabase.rpc('survey_admin_roster', { p_admin_id: adminId, p_survey_id: surveyId })
        ]);
        if (res.error || ros.error) {
            alert('載入失敗：' + (res.error || ros.error).message);
            return onBack();
        }
        setSurvey(res.data.survey);
        setResponses(res.data.responses);
        setRoster(ros.data);
        setLoading(false);
    }, [adminId, surveyId, onBack]);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { load(); }, [load]);

    const groups = useMemo(() => [...new Set(responses.map(r => r.respondent_group).filter(Boolean))].sort(), [responses]);
    const filteredResponses = useMemo(() => {
        if (groupFilter === 'all' || groupFilter === 'compare') return responses;
        return responses.filter(r => r.respondent_group === groupFilter);
    }, [responses, groupFilter]);

    if (loading) return <div className="py-10 text-center text-gray-400">載入中...</div>;

    const numbers = getQuestionNumbers(survey.questions);
    const allowedLabel = survey.mode === 'single' && !survey.is_anonymous ? '修改' : '再填';
    const filledCount = roster.filter(r => r.fill_count > 0).length;
    const visibleRoster = roster.filter(r => rosterFilter === 'all' || (rosterFilter === 'done' ? r.fill_count > 0 : r.fill_count === 0));

    const handleGrant = async (r) => {
        const input = window.prompt(`為「${r.name}」增加幾次${allowedLabel}機會？`, '1');
        if (input === null) return;
        const amount = parseInt(input);
        if (!(amount >= 1)) return alert('請輸入大於 0 的整數');
        const { error } = await supabase.rpc('survey_admin_grant', {
            p_admin_id: adminId, p_survey_id: surveyId, p_type: r.respondent_type, p_respondent_id: r.respondent_id, p_amount: amount
        });
        if (error) return alert('解鎖失敗：' + error.message);
        load();
    };

    const handleExport = () => {
        try {
            const answerRows = responses.map(r => {
                const row = {};
                if (!survey.is_anonymous) {
                    row['填答者'] = r.respondent_name || '';
                    row['填答時間'] = r.submitted_at ? toROCDate(r.submitted_at) : '';
                }
                row['身分/股別'] = r.respondent_group || '';
                survey.questions.filter(q => !isSection(q)).forEach((q) => { row[`${numbers[q.id]}. ${q.text}`] = formatAnswer(q, r.answers[q.id]); });
                return row;
            });
            const rosterRows = roster.map(r => ({
                '姓名': r.name,
                '身分/股別': r.group_name,
                '狀態': r.fill_count > 0 ? '已填寫' : '未填寫',
                '填寫份數': r.fill_count,
                '已修改次數': r.edits_used
            }));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(answerRows), '作答內容');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rosterRows), '填寫名單');
            XLSX.writeFile(wb, `問卷_${survey.title.slice(0, 20)}_${toROCDate(new Date())}.xlsx`);
        } catch (error) {
            console.error('Export failed:', error);
            alert('匯出失敗: ' + error.message);
        }
    };

    const tabBtn = (id, label) => (
        <button
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-secondary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
        >{label}</button>
    );

    return (
        <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <button onClick={onBack} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="返回"><ArrowLeft className="w-5 h-5" /></button>
                    <div className="min-w-0">
                        <h3 className="text-xl font-bold text-primary break-words">{survey.title}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                            已填 {filledCount} / 應填 {roster.length} 人 · 共 {responses.length} 份
                            {survey.is_anonymous && <span className="ml-2 inline-flex items-center gap-1 text-purple-600"><EyeOff className="w-3.5 h-3.5" />匿名問卷</span>}
                        </p>
                    </div>
                </div>
                <Button variant="outline" onClick={handleExport} className="flex-shrink-0 flex items-center gap-1 !py-1.5 !px-3 text-sm">
                    <Download className="w-4 h-4" /> <span className="hidden sm:inline">匯出 Excel</span>
                </Button>
            </div>

            <div className="flex gap-3 border-b border-gray-100 pb-2">
                {tabBtn('roster', '填寫名單')}
                {tabBtn('stats', '統計')}
            </div>

            {tab === 'roster' && (
                <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 space-y-3">
                    <div className="flex gap-2 text-sm">
                        {[['all', `全部 (${roster.length})`], ['done', `已填 (${filledCount})`], ['todo', `未填 (${roster.length - filledCount})`]].map(([id, label]) => (
                            <button key={id} onClick={() => setRosterFilter(id)}
                                className={`px-3 py-1 rounded-full border ${rosterFilter === id ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600'}`}>{label}</button>
                        ))}
                    </div>
                    {survey.is_anonymous && <p className="text-xs text-gray-500">匿名問卷僅顯示「是否已填」，不顯示填寫時間，也無法得知答案屬於誰。</p>}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="text-gray-500 border-b border-gray-100">
                                    <th className="py-2 pr-3">姓名</th><th className="py-2 px-2">身分/股別</th><th className="py-2 px-2">狀態</th>
                                    <th className="py-2 px-2">份數</th>
                                    {survey.mode === 'single' && !survey.is_anonymous && <th className="py-2 px-2">已修改</th>}
                                    <th className="py-2 px-2">填寫時間</th><th className="py-2 pl-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRoster.map(r => (
                                    <tr key={`${r.respondent_type}-${r.respondent_id}`} className="border-b border-gray-50">
                                        <td className="py-2 pr-3 whitespace-nowrap">{r.name}</td>
                                        <td className="px-2 whitespace-nowrap">{r.group_name}</td>
                                        <td className="px-2">
                                            <span className={`px-2 py-0.5 rounded-full text-xs ${r.fill_count > 0 ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                                {r.fill_count > 0 ? '已填' : '未填'}
                                            </span>
                                        </td>
                                        <td className="px-2">{r.fill_count}</td>
                                        {survey.mode === 'single' && !survey.is_anonymous && <td className="px-2">{r.edits_used}</td>}
                                        <td className="px-2 whitespace-nowrap">{r.last_submitted_at ? toROCDate(r.last_submitted_at) : '-'}</td>
                                        <td className="pl-2 text-right">
                                            {r.fill_count > 0 && (
                                                <button onClick={() => handleGrant(r)} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 whitespace-nowrap">
                                                    <Unlock className="w-3.5 h-3.5" /> 解鎖{allowedLabel}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {visibleRoster.length === 0 && <tr><td colSpan="7" className="py-6 text-center text-gray-400">沒有符合的對象</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {tab === 'stats' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm">
                        <label className="text-gray-600">檢視：</label>
                        <select className="p-2 border border-gray-300 rounded-lg" value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
                            <option value="all">全部</option>
                            <option value="compare">各組並排比較</option>
                            {groups.map(g => <option key={g} value={g}>僅 {g}</option>)}
                        </select>
                    </div>
                    {survey.is_anonymous && groupFilter !== 'all' && (
                        <p className="text-xs text-purple-700 bg-purple-50 rounded-lg p-2">
                            提醒：匿名問卷依單位分組時，人數很少的組別（例如只有 1 人）等同於看得出是誰填的，解讀時請留意。
                        </p>
                    )}
                    {responses.length === 0 ? (
                        <div className="py-10 text-center text-gray-400 bg-white rounded-xl border border-gray-100">尚無人填答</div>
) : survey.questions.filter(q => !isSection(q)).map((q) => (
                        <QuestionStats key={q.id} q={q} index={numbers[q.id] - 1} responses={filteredResponses} groups={groups} compare={groupFilter === 'compare'} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default SurveyResults;
