import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import SurveyEditor from './SurveyEditor';
import SurveyResults from './SurveyResults';
import { Plus, Edit, Trash2, ClipboardList, CalendarDays, Users, BarChart3, Copy, Power, EyeOff } from 'lucide-react';
import { toROCDate } from '../../utils/dateUtils';
import { getSurveyStatus, getAudienceSummary } from '../../utils/surveyUtils';

const modeText = (s) => (s.mode === 'single'
    ? `單次填答，可修改 ${s.edit_limit} 次`
    : `重複填答，每人最多 ${s.fill_limit} 份`);

// 系統管理員專用：adminId 為登入者 (role = admin) 的 officerId
const SurveyManagement = ({ adminId }) => {
    const [view, setView] = useState({ name: 'list' }); // list | edit | results
    const [surveys, setSurveys] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchSurveys = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc('survey_admin_list', { p_admin_id: adminId });
        if (error) {
            console.error('Error fetching surveys:', error);
            alert('載入問卷失敗：' + error.message);
        } else {
            setSurveys(data || []);
        }
        setLoading(false);
    }, [adminId]);

    useEffect(() => {
        // 回到列表時重新載入 (fetch-on-mount 模式，與其他管理頁一致)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (view.name === 'list') fetchSurveys();
    }, [view.name, fetchSurveys]);

    const toggleClosed = async (s) => {
        const msg = s.is_closed ? '確定要重新開放此問卷嗎？' : '確定要提前關閉此問卷嗎？關閉後使用者的公告欄將不再顯示。';
        if (!window.confirm(msg)) return;
        const { error } = await supabase.rpc('survey_admin_set_closed', { p_admin_id: adminId, p_survey_id: s.id, p_closed: !s.is_closed });
        if (error) return alert('操作失敗：' + error.message);
        fetchSurveys();
    };

    const handleDelete = async (s) => {
        const extra = s.response_count > 0 ? `\n此問卷已有 ${s.respondent_count} 人填答，所有答案會一併永久刪除。` : '';
        if (!window.confirm(`確定要刪除「${s.title}」嗎？${extra}`)) return;
        const { error } = await supabase.rpc('survey_admin_delete', { p_admin_id: adminId, p_survey_id: s.id });
        if (error) return alert('刪除失敗：' + error.message);
        fetchSurveys();
    };

    if (view.name === 'edit') {
        return (
            <SurveyEditor
                adminId={adminId}
                surveyId={view.surveyId}
                copyFromId={view.copyFromId}
                onBack={() => setView({ name: 'list' })}
                onSaved={() => setView({ name: 'list' })}
            />
        );
    }

    if (view.name === 'results') {
        return <SurveyResults adminId={adminId} surveyId={view.surveyId} onBack={() => setView({ name: 'list' })} />;
    }

    const iconBtn = 'p-2 text-gray-400 rounded-lg transition-colors';

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" /> 問卷管理
                </h3>
                <Button variant="primary" onClick={() => setView({ name: 'edit' })} className="flex items-center gap-1">
                    <Plus className="w-4 h-4" /> 新增問卷
                </Button>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="py-10 text-center text-gray-400 bg-white rounded-xl border border-gray-100">載入中...</div>
                ) : surveys.length === 0 ? (
                    <div className="py-10 text-center text-gray-400 bg-white rounded-xl border border-gray-100">目前尚無問卷</div>
                ) : surveys.map((s) => {
                    const status = getSurveyStatus(s);
                    return (
                        <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start gap-4">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-bold text-gray-800 text-lg break-words">{s.title}</h4>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${status.className}`}>{status.label}</span>
                                        {s.is_anonymous && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 flex items-center gap-1">
                                                <EyeOff className="w-3 h-3" /> 匿名
                                            </span>
                                        )}
                                    </div>
                                    {s.description && <p className="text-gray-600 text-sm mt-1.5 line-clamp-2 whitespace-pre-wrap">{s.description}</p>}
                                </div>
                                <div className="flex flex-wrap justify-end gap-1 flex-shrink-0">
                                    <button onClick={() => setView({ name: 'results', surveyId: s.id })} className={`${iconBtn} hover:text-green-600 hover:bg-green-50`} title="名單與統計"><BarChart3 className="w-4 h-4" /></button>
                                    <button onClick={() => setView({ name: 'edit', surveyId: s.id })} className={`${iconBtn} hover:text-blue-600 hover:bg-blue-50`} title="編輯"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => setView({ name: 'edit', copyFromId: s.id })} className={`${iconBtn} hover:text-blue-600 hover:bg-blue-50`} title="複製"><Copy className="w-4 h-4" /></button>
                                    <button onClick={() => toggleClosed(s)} className={`${iconBtn} hover:text-amber-600 hover:bg-amber-50`} title={s.is_closed ? '重新開放' : '提前關閉'}><Power className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete(s)} className={`${iconBtn} hover:text-red-600 hover:bg-red-50`} title="刪除"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-gray-50 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-gray-500">
                                <div className="flex items-center gap-1.5">
                                    <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                                    期間：{toROCDate(s.start_date)} ~ {toROCDate(s.end_date)}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 flex-shrink-0" />
                                    對象：{getAudienceSummary(s)}
                                </div>
                                <div>{s.question_count} 題 · {modeText(s)}</div>
                                <div>已有 {s.respondent_count} 人填答 ({s.response_count} 份)</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SurveyManagement;
