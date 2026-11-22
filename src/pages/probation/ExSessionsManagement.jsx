import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import MultiSelectFilter from '../../components/MultiSelectFilter';
import { Plus, X, Edit, Trash2, Copy } from 'lucide-react';
import { toROCDate, getCurrentROCYear } from '../../utils/dateUtils';

const inputCls = 'w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none';
const PROJECT_KEY = 'exercise_addiction';
const STATUSES = ['規劃中', '進行中', '已結束', '取消'];
const STATUS_STYLE = {
    '規劃中': 'bg-gray-100 text-gray-600',
    '進行中': 'bg-blue-100 text-blue-700',
    '已結束': 'bg-green-100 text-green-700',
    '取消': 'bg-red-100 text-red-600'
};

const emptyForm = () => ({
    year: getCurrentROCYear(), session_no: 1, session_date: '', topic: '', sport: '',
    lecturer: '', venue: '', contact: '', status: '規劃中',
    duty_ids: [], staff_ids: [], youth_ids: []
});

const names = (list) => (list && list.length > 0 ? list.map(x => x.name).join('、') : '-');

// 運動戒癮團體專案：活動課程管理（專案管理者與專案成員皆可完整維護）
const ExSessionsManagement = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState([]);       // 本專案成員（輪值、實際出席人員）
    const [participants, setParticipants] = useState([]); // 參與少年（出席少年）
    const [yearFilter, setYearFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm());

    useEffect(() => {
        const load = async () => {
            await fetchRows();
            const { data: opts } = await supabase.rpc('project_member_options', { p_key: PROJECT_KEY });
            setMembers(opts || []);
            const { data: ps } = await supabase.rpc('ex_participant_list');
            setParticipants(ps || []);
        };
        load();
    }, []);

    const fetchRows = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('ex_session_list');
            if (error) throw error;
            setRows(data || []);
        } catch (error) {
            console.error('Error fetching sessions:', error);
            alert('載入失敗: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const openAdd = () => {
        setEditingId(null);
        setForm(emptyForm());
        setShowModal(true);
    };

    const toForm = (r) => ({
        year: r.year, session_no: r.session_no, session_date: r.session_date || '',
        topic: r.topic || '', sport: r.sport || '', lecturer: r.lecturer || '',
        venue: r.venue || '', contact: r.contact || '', status: r.status,
        duty_ids: (r.duty || []).map(x => x.id),
        staff_ids: (r.attended_staff || []).map(x => x.id),
        youth_ids: (r.youths || []).map(x => x.id)
    });

    const openEdit = (r) => {
        setEditingId(r.id);
        setForm(toForm(r));
        setShowModal(true);
    };

    // 複製：帶入同一筆的內容，場次加一；日期與實際出席（人員、少年）清空，狀態回到規劃中
    const openCopy = (r) => {
        setEditingId(null);
        setForm({ ...toForm(r), session_no: Number(r.session_no) + 1, session_date: '', status: '規劃中', staff_ids: [], youth_ids: [] });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.rpc('ex_session_save', { p_data: { ...form, id: editingId } });
            if (error) throw error;
            setShowModal(false);
            fetchRows();
        } catch (error) {
            alert((editingId ? '更新失敗: ' : '新增失敗: ') + error.message);
        }
    };

    const handleDelete = async (r) => {
        if (!window.confirm(`確定要刪除「${r.year} 年度第 ${r.session_no} 場」嗎？此操作無法復原。`)) return;
        try {
            const { error } = await supabase.rpc('ex_session_delete', { p_id: r.id });
            if (error) throw error;
            fetchRows();
        } catch (error) {
            alert('刪除失敗: ' + error.message);
        }
    };

    const years = [...new Set(rows.map(r => r.year))].sort((a, b) => b - a);
    const filtered = rows.filter(r => (!yearFilter || String(r.year) === yearFilter) && (!statusFilter || r.status === statusFilter));

    // 年度選單：目前年度前後各兩年，加上資料中已有的年度
    const cur = getCurrentROCYear();
    const yearOptions = [...new Set([cur - 2, cur - 1, cur, cur + 1, cur + 2, ...rows.map(r => r.year), Number(form.year)])]
        .filter(Boolean).sort((a, b) => b - a);

    const memberOptions = members.map(m => ({ value: m.officer_id, label: `${m.department || '-'}｜${m.name}` }));
    const youthOptions = participants.map(p => ({ value: p.id, label: p.name }));

    return (
        <div>
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                <h3 className="text-xl font-bold text-primary">活動課程管理</h3>
                <Button variant="primary" onClick={openAdd} className="flex items-center gap-1">
                    <Plus className="w-4 h-4" /> 新增活動課程
                </Button>
            </div>

            <div className="flex flex-wrap gap-3 mb-4">
                <select className={`${inputCls} bg-white sm:w-40`} value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                    <option value="">所有年度</option>
                    {years.map(y => <option key={y} value={y}>{y} 年度</option>)}
                </select>
                <select className={`${inputCls} bg-white sm:w-40`} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">所有狀態</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-600">
                            <th className="py-3 px-3">年度</th>
                            <th className="py-3 px-3">場次</th>
                            <th className="py-3 px-3">日期</th>
                            <th className="py-3 px-3">課程主題</th>
                            <th className="py-3 px-3">運動項目</th>
                            <th className="py-3 px-3">講師</th>
                            <th className="py-3 px-3">場地</th>
                            <th className="py-3 px-3">聯繫窗口</th>
                            <th className="py-3 px-3">輪值人員</th>
                            <th className="py-3 px-3">實際出席人員</th>
                            <th className="py-3 px-3">出席少年</th>
                            <th className="py-3 px-3">狀態</th>
                            <th className="py-3 px-3 text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-700">
                        {loading ? (
                            <tr><td colSpan="13" className="py-8 text-center text-gray-400">載入中...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="13" className="py-8 text-center text-gray-400">目前尚無資料</td></tr>
                        ) : filtered.map(r => (
                            <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors align-top">
                                <td className="py-3 px-3">{r.year}</td>
                                <td className="py-3 px-3">{r.session_no}</td>
                                <td className="py-3 px-3 whitespace-nowrap">{r.session_date ? toROCDate(r.session_date) : '-'}</td>
                                <td className="py-3 px-3 font-medium">{r.topic || '-'}</td>
                                <td className="py-3 px-3">{r.sport || '-'}</td>
                                <td className="py-3 px-3">{r.lecturer || '-'}</td>
                                <td className="py-3 px-3">{r.venue || '-'}</td>
                                <td className="py-3 px-3">{r.contact || '-'}</td>
                                <td className="py-3 px-3">{names(r.duty)}</td>
                                <td className="py-3 px-3">{names(r.attended_staff)}</td>
                                <td className="py-3 px-3" title={names(r.youths)}>{(r.youths || []).length > 0 ? `${r.youths.length} 人：${names(r.youths)}` : '-'}</td>
                                <td className="py-3 px-3">
                                    <span className={`px-2 py-1 rounded-lg text-xs whitespace-nowrap ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                                </td>
                                <td className="py-3 px-3">
                                    <div className="flex justify-center gap-2">
                                        <button onClick={() => openCopy(r)} className="p-1 text-gray-400 hover:text-green-600 transition-colors" title="複製（建立下一場）">
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => openEdit(r)} className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title="編輯">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(r)} className="p-1 text-gray-400 hover:text-red-600 transition-colors" title="刪除">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden space-y-3">
                {loading ? (
                    <div className="py-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">載入中...</div>
                ) : filtered.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">目前尚無資料</div>
                ) : filtered.map(r => (
                    <div key={r.id} onClick={() => openEdit(r)} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="font-bold text-gray-800">{r.year} 年度 第 {r.session_no} 場</div>
                                <div className="text-sm text-primary">{r.topic || '（未填主題）'}</div>
                            </div>
                            <span className={`px-2 py-1 rounded-lg text-xs ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                            <div><span className="text-gray-400">日期：</span>{r.session_date ? toROCDate(r.session_date) : '-'}</div>
                            <div><span className="text-gray-400">運動項目：</span>{r.sport || '-'}</div>
                            <div><span className="text-gray-400">講師：</span>{r.lecturer || '-'}</div>
                            <div><span className="text-gray-400">場地：</span>{r.venue || '-'}</div>
                            <div><span className="text-gray-400">聯繫窗口：</span>{r.contact || '-'}</div>
                            <div><span className="text-gray-400">輪值人員：</span>{names(r.duty)}</div>
                            <div><span className="text-gray-400">實際出席人員：</span>{names(r.attended_staff)}</div>
                            <div><span className="text-gray-400">出席少年：</span>{names(r.youths)}</div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-50 flex justify-end gap-2">
                            <button onClick={(e) => { e.stopPropagation(); openCopy(r); }} className="p-2 text-gray-400 hover:text-green-600" title="複製（建立下一場）"><Copy className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="p-2 text-gray-400 hover:text-red-600" title="刪除"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 overflow-y-auto p-4 sm:p-10">
                    <div className="bg-white rounded-2xl p-5 sm:p-8 w-full max-w-2xl shadow-2xl mt-4 sm:mt-0 sm:my-auto mb-10 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-primary">{editingId ? '編輯活動課程' : '新增活動課程'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">年度</label>
                                    <select required className={`${inputCls} bg-white`} value={form.year}
                                        onChange={e => setForm({ ...form, year: Number(e.target.value) })}>
                                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">場次</label>
                                    <input type="number" min="1" required className={inputCls} value={form.session_no}
                                        onChange={e => setForm({ ...form, session_no: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                                    <input type="date" className={inputCls} value={form.session_date}
                                        onChange={e => setForm({ ...form, session_date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">狀態</label>
                                    <select className={`${inputCls} bg-white`} value={form.status}
                                        onChange={e => setForm({ ...form, status: e.target.value })}>
                                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">課程主題</label>
                                    <input type="text" className={inputCls} value={form.topic}
                                        onChange={e => setForm({ ...form, topic: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">運動項目</label>
                                    <input type="text" className={inputCls} value={form.sport}
                                        onChange={e => setForm({ ...form, sport: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">講師</label>
                                    <input type="text" className={inputCls} value={form.lecturer}
                                        onChange={e => setForm({ ...form, lecturer: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">場地</label>
                                    <input type="text" className={inputCls} value={form.venue}
                                        onChange={e => setForm({ ...form, venue: e.target.value })} />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">聯繫窗口</label>
                                    <input type="text" className={inputCls} value={form.contact}
                                        onChange={e => setForm({ ...form, contact: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">輪值人員（本專案成員）</label>
                                    <MultiSelectFilter label="選擇輪值人員" options={memberOptions} selected={form.duty_ids}
                                        onChange={vals => setForm({ ...form, duty_ids: vals })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">實際出席人員（本專案成員）</label>
                                    <MultiSelectFilter label="選擇實際出席人員" options={memberOptions} selected={form.staff_ids}
                                        onChange={vals => setForm({ ...form, staff_ids: vals })} />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">出席少年（從參與少年名單勾選）</label>
                                    <MultiSelectFilter label="選擇出席少年" options={youthOptions} selected={form.youth_ids}
                                        onChange={vals => setForm({ ...form, youth_ids: vals })} />
                                </div>
                            </div>
                            <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3">
                                <Button variant="outline" type="button" onClick={() => setShowModal(false)} className="w-full sm:w-auto">取消</Button>
                                <Button variant="primary" type="submit" className="w-full sm:w-auto">{editingId ? '儲存變更' : '確認新增'}</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExSessionsManagement;
