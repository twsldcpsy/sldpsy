import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import MultiSelectFilter from '../../components/MultiSelectFilter';
import ExReviewFill from './ExReviewFill';
import ExReviewPrint from './ExReviewPrint';
import { Plus, X, Edit, Trash2, FileText, Printer } from 'lucide-react';
import { toROCDate, getCurrentROCYear } from '../../utils/dateUtils';

const inputCls = 'w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none';
const miniSelect = 'w-full p-1.5 text-sm border border-gray-300 rounded-lg bg-white outline-none disabled:bg-gray-100 disabled:text-gray-400';
const PROJECT_KEY = 'exercise_addiction';
const STATUSES = ['規劃中', '進行中', '已結束', '取消'];
const ATTENDANCE = ['出席', '缺席', '請假'];
const REVIEW_STATUSES = ['待填寫', '已填寫', '已核章'];
const STATUS_STYLE = {
    '規劃中': 'bg-gray-100 text-gray-600',
    '進行中': 'bg-blue-100 text-blue-700',
    '已結束': 'bg-green-100 text-green-700',
    '取消': 'bg-red-100 text-red-600'
};

const emptyForm = () => ({
    year: getCurrentROCYear(), session_no: 1, session_date: '', topic: '', sport: '',
    lecturer: '', venue: '', contact: '', status: '規劃中',
    duty_ids: [], staff_ids: [], youths: []
});

const names = (list) => (list && list.length > 0 ? list.map(x => x.name).join('、') : '-');

// 新活動預設帶入「目前參加中」的所有少年：出席、待填寫、未分配填寫人員
const defaultYouths = (participants) => participants
    .filter(p => p.status === '參加中')
    .map(p => ({ id: p.id, name: p.name, attendance: '出席', review_status: '待填寫', filler_id: '', has_form: false }));

// 區塊標題（編輯視窗用）
const Group = ({ title, hint, children }) => (
    <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-bold text-primary">{title}</h4>
            {hint && <span className="text-xs text-gray-400">{hint}</span>}
        </div>
        {children}
    </div>
);

const Chip = ({ className, children }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${className}`}>{children}</span>
);

const summary = (youths) => {
    const list = youths || [];
    const count = (k, v) => list.filter(y => y[k] === v).length;
    return {
        total: list.length,
        present: count('attendance', '出席'), absent: count('attendance', '缺席'), leave: count('attendance', '請假'),
        stamped: count('review_status', '已核章'), filled: count('review_status', '已填寫'), pending: count('review_status', '待填寫'),
    };
};

// 運動戒癮團體專案：活動課程管理（專案管理者與專案成員皆可維護；考核表填寫／核章另有權限）
const ExSessionsManagement = ({ isManager, officerId }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState([]);           // 本專案成員
    const [participants, setParticipants] = useState([]); // 參與少年（含參與狀態）
    const [yearFilter, setYearFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [addYouthId, setAddYouthId] = useState('');
    const [fillTarget, setFillTarget] = useState(null);   // { sessionId, participantId }
    const [printPayload, setPrintPayload] = useState(null);

    const fetchRows = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('ex_session_list');
            if (error) throw error;
            setRows(data || []);
            return data || [];
        } catch (error) {
            console.error('Error fetching sessions:', error);
            alert('載入失敗: ' + error.message);
            return [];
        } finally {
            setLoading(false);
        }
    };

    const fetchParticipants = async () => {
        const { data } = await supabase.rpc('ex_participant_list');
        setParticipants(data || []);
        return data || [];
    };

    useEffect(() => {
        const load = async () => {
            await fetchRows();
            const { data: opts } = await supabase.rpc('project_member_options', { p_key: PROJECT_KEY });
            setMembers(opts || []);
            await fetchParticipants();
        };
        load();
    }, []);

    const openAdd = async () => {
        const ps = await fetchParticipants();
        setEditingId(null);
        setForm({ ...emptyForm(), youths: defaultYouths(ps) });
        setAddYouthId('');
        setShowModal(true);
    };

    const toForm = (r) => ({
        year: r.year, session_no: r.session_no, session_date: r.session_date || '',
        topic: r.topic || '', sport: r.sport || '', lecturer: r.lecturer || '',
        venue: r.venue || '', contact: r.contact || '', status: r.status,
        duty_ids: (r.duty || []).map(x => x.id),
        staff_ids: (r.attended_staff || []).map(x => x.id),
        youths: (r.youths || []).map(y => ({
            id: y.id, name: y.name, attendance: y.attendance, review_status: y.review_status,
            filler_id: y.filler_id || '', has_form: y.has_form
        }))
    });

    const openEdit = async (r) => {
        await fetchParticipants();
        setEditingId(r.id);
        setForm(toForm(r));
        setAddYouthId('');
        setShowModal(true);
    };

    // 儲存目前表單；回傳活動編號（失敗回傳 null）
    const saveSession = async () => {
        try {
            const payload = {
                ...form, id: editingId,
                youths: form.youths.map(y => ({ id: y.id, attendance: y.attendance, review_status: y.review_status, filler_id: y.filler_id || null }))
            };
            const { data, error } = await supabase.rpc('ex_session_save', { p_data: payload });
            if (error) throw error;
            return data;
        } catch (error) {
            alert((editingId ? '更新失敗: ' : '新增失敗: ') + error.message);
            return null;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const id = await saveSession();
        if (!id) return;
        setShowModal(false);
        fetchRows();
    };

    // 開啟考核表：活動還沒儲存時，先自動儲存活動再開啟（不需要先手動儲存）
    const openFill = async (y) => {
        let sid = editingId;
        if (!sid) {
            sid = await saveSession();
            if (!sid) return;
            setEditingId(sid);
            await fetchRows();
        }
        setFillTarget({ sessionId: sid, participantId: y.id });
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

    // --- 少年名單（表單內）---
    const patchYouth = (id, patch) => setForm(prev => ({ ...prev, youths: prev.youths.map(y => (y.id === id ? { ...y, ...patch } : y)) }));
    const removeYouth = (id) => setForm(prev => ({ ...prev, youths: prev.youths.filter(y => y.id !== id) }));
    const addYouth = () => {
        const p = participants.find(x => x.id === addYouthId);
        if (!p) return;
        setForm(prev => ({ ...prev, youths: [...prev.youths, { id: p.id, name: p.name, attendance: '出席', review_status: '待填寫', filler_id: '', has_form: false }] }));
        setAddYouthId('');
    };
    // 實際出席人員變動時，不在名單內的填寫人員一併清除
    const setAttendedStaff = (vals) => setForm(prev => ({
        ...prev, staff_ids: vals,
        youths: prev.youths.map(y => (y.filler_id && !vals.includes(y.filler_id) ? { ...y, filler_id: '' } : y))
    }));

    // 填寫／列印後，只同步該少年的考核狀態到表單（保留表單內其他尚未儲存的修改）
    const syncYouth = async (pid) => {
        const data = await fetchRows();
        const row = data.find(r => r.id === editingId);
        const y = row?.youths?.find(x => x.id === pid);
        if (y) patchYouth(pid, { review_status: y.review_status, has_form: y.has_form });
    };

    const handlePrint = async (y) => {
        try {
            const { data, error } = await supabase.rpc('ex_review_stamp', { p_session_id: editingId, p_participant_id: y.id });
            if (error) throw error;
            setPrintPayload(data);
            await syncYouth(y.id);
        } catch (error) {
            alert('匯出列印失敗: ' + error.message);
        }
    };

    const years = [...new Set(rows.map(r => r.year))].sort((a, b) => b - a);
    const filtered = rows.filter(r => (!yearFilter || String(r.year) === yearFilter) && (!statusFilter || r.status === statusFilter));

    const cur = getCurrentROCYear();
    const yearOptions = [...new Set([cur - 2, cur - 1, cur, cur + 1, cur + 2, ...rows.map(r => r.year), Number(form.year)])]
        .filter(Boolean).sort((a, b) => b - a);

    const memberOptions = members.map(m => ({ value: m.officer_id, label: `${m.department || '-'}｜${m.name}` }));
    const attendedStaffOptions = members.filter(m => form.staff_ids.includes(m.officer_id));
    const inListIds = new Set(form.youths.map(y => y.id));
    const addableYouths = participants.filter(p => !inListIds.has(p.id));


    // 出席與考核統計（列表用）
    const renderYouths = (r) => {
        const s = summary(r.youths);
        if (s.total === 0) return <span className="text-gray-300">未帶入少年</span>;
        const pct = (n) => `${(n / s.total) * 100}%`;
        return (
            <div className="space-y-2 min-w-[190px]">
                <div className="flex flex-wrap gap-1.5">
                    <Chip className="bg-green-50 text-green-700">出席 {s.present}</Chip>
                    <Chip className="bg-red-50 text-red-600">缺席 {s.absent}</Chip>
                    <Chip className="bg-amber-50 text-amber-700">請假 {s.leave}</Chip>
                </div>
                <div>
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100" title={`已核章 ${s.stamped}／已填寫 ${s.filled}／待填寫 ${s.pending}`}>
                        <div className="bg-green-500" style={{ width: pct(s.stamped) }} />
                        <div className="bg-blue-400" style={{ width: pct(s.filled) }} />
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-xs text-gray-500 mt-1">
                        <span>已核章 {s.stamped}</span>
                        <span>已填寫 {s.filled}</span>
                        <span>待填寫 {s.pending}</span>
                    </div>
                </div>
            </div>
        );
    };

    const renderStaff = (r) => (
        <div className="space-y-1 text-sm min-w-[150px]">
            <div><span className="text-xs text-gray-400 mr-1">輪值</span>{names(r.duty)}</div>
            <div><span className="text-xs text-gray-400 mr-1">出席</span>{names(r.attended_staff)}</div>
        </div>
    );

    const renderPlace = (r) => (
        <div className="space-y-1 text-sm min-w-[130px]">
            <div className="font-medium text-gray-800">{r.venue || <span className="text-gray-300">未填場地</span>}</div>
            <div className="text-gray-500">{r.contact || <span className="text-gray-300">未填聯繫窗口</span>}</div>
        </div>
    );

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

            {/* 桌機：7 欄，每欄上下兩行呈現，減少橫向捲動 */}
            <div className="hidden md:block overflow-x-auto bg-white rounded-xl border border-gray-100">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs">
                            <th className="py-3 px-4 font-medium">場次</th>
                            <th className="py-3 px-4 font-medium">課程</th>
                            <th className="py-3 px-4 font-medium">場地／聯繫窗口</th>
                            <th className="py-3 px-4 font-medium">輪值／實際出席人員</th>
                            <th className="py-3 px-4 font-medium">出席少年與考核</th>
                            <th className="py-3 px-4 font-medium">狀態</th>
                            <th className="py-3 px-4 font-medium text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-700">
                        {loading ? (
                            <tr><td colSpan="7" className="py-10 text-center text-gray-400">載入中...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="7" className="py-10 text-center text-gray-400">目前尚無資料</td></tr>
                        ) : filtered.map(r => (
                            <tr key={r.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition-colors align-top">
                                <td className="py-4 px-4 whitespace-nowrap">
                                    <div className="font-bold text-gray-800">{r.year} 年度 第 {r.session_no} 場</div>
                                    <div className="text-sm text-gray-500 mt-1">{r.session_date ? toROCDate(r.session_date) : <span className="text-gray-300">日期未定</span>}</div>
                                </td>
                                <td className="py-4 px-4">
                                    <div className="font-medium text-gray-800">{r.topic || <span className="text-gray-300">未填主題</span>}</div>
                                    <div className="text-sm text-gray-500 mt-1">{[r.sport, r.lecturer && `講師 ${r.lecturer}`].filter(Boolean).join(' · ') || <span className="text-gray-300">-</span>}</div>
                                </td>
                                <td className="py-4 px-4">{renderPlace(r)}</td>
                                <td className="py-4 px-4">{renderStaff(r)}</td>
                                <td className="py-4 px-4">{renderYouths(r)}</td>
                                <td className="py-4 px-4">
                                    <span className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                                </td>
                                <td className="py-4 px-4">
                                    <div className="flex justify-center gap-1">
                                        <button onClick={() => openEdit(r)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="編輯"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(r)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="刪除"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 手機：卡片 */}
            <div className="md:hidden space-y-3">
                {loading ? (
                    <div className="py-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">載入中...</div>
                ) : filtered.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">目前尚無資料</div>
                ) : filtered.map(r => (
                    <div key={r.id} onClick={() => openEdit(r)} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="font-bold text-gray-800">{r.year} 年度 第 {r.session_no} 場</div>
                                <div className="text-xs text-gray-500 mt-0.5">{r.session_date ? toROCDate(r.session_date) : '日期未定'}</div>
                            </div>
                            <span className={`px-2.5 py-1 rounded-lg text-xs ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                        </div>
                        <div>
                            <div className="font-medium text-primary">{r.topic || '（未填主題）'}</div>
                            <div className="text-sm text-gray-500">{[r.sport, r.lecturer && `講師 ${r.lecturer}`].filter(Boolean).join(' · ')}</div>
                        </div>
                        <div className="pt-2 border-t border-gray-50">{renderPlace(r)}</div>
                        <div className="pt-2 border-t border-gray-50">{renderStaff(r)}</div>
                        <div className="pt-2 border-t border-gray-50">{renderYouths(r)}</div>
                        <div className="flex justify-end">
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="p-2 text-gray-400 hover:text-red-600" title="刪除"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 overflow-y-auto p-4 sm:p-10">
                    <div className="bg-white rounded-2xl p-5 sm:p-8 w-full max-w-4xl shadow-2xl mt-4 sm:mt-0 sm:my-auto mb-10 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-primary">{editingId ? '編輯活動課程' : '新增活動課程'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Group title="場次">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">年度</label>
                                        <select required className={`${inputCls} bg-white`} value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })}>
                                            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">場次</label>
                                        <input type="number" min="1" required className={inputCls} value={form.session_no} onChange={e => setForm({ ...form, session_no: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                                        <input type="date" className={inputCls} value={form.session_date} onChange={e => setForm({ ...form, session_date: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">狀態</label>
                                        <select className={`${inputCls} bg-white`} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </Group>

                            <Group title="課程">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">課程主題</label>
                                        <input type="text" className={inputCls} value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">運動項目</label>
                                        <input type="text" className={inputCls} value={form.sport} onChange={e => setForm({ ...form, sport: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">講師</label>
                                        <input type="text" className={inputCls} value={form.lecturer} onChange={e => setForm({ ...form, lecturer: e.target.value })} />
                                    </div>
                                </div>
                            </Group>

                            <Group title="場地與聯繫窗口">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">場地</label>
                                        <input type="text" className={inputCls} value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">聯繫窗口</label>
                                        <input type="text" className={inputCls} value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} />
                                    </div>
                                </div>
                            </Group>

                            <Group title="工作人員" hint="皆為本專案成員；實際出席人員會成為考核表「填寫人員」的選項">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">輪值人員</label>
                                        <MultiSelectFilter label="選擇輪值人員" options={memberOptions} selected={form.duty_ids}
                                            onChange={vals => setForm({ ...form, duty_ids: vals })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">實際出席人員</label>
                                        <MultiSelectFilter label="選擇實際出席人員" options={memberOptions} selected={form.staff_ids}
                                            onChange={setAttendedStaff} />
                                    </div>
                                </div>
                            </Group>

                            <Group title="出席少年與考核表" hint="預設帶入「目前參加中」的少年；活動尚未儲存時，按「填寫」會先自動儲存">
                                {form.youths.length === 0 ? (
                                    <div className="text-sm text-gray-400 py-3">目前沒有參加中的少年，可用下方選單加入。</div>
                                ) : (
                                    <div className="overflow-x-auto bg-white rounded-lg border border-gray-100">
                                        <table className="w-full text-left text-sm border-collapse">
                                            <thead>
                                                <tr className="text-gray-500 text-xs bg-gray-50 border-b border-gray-100">
                                                    <th className="py-2 px-3 font-medium min-w-[90px]">少年</th>
                                                    <th className="py-2 px-2 font-medium w-24">出席狀態</th>
                                                    <th className="py-2 px-2 font-medium w-28">考核狀態</th>
                                                    <th className="py-2 px-2 font-medium w-36">填寫人員</th>
                                                    <th className="py-2 px-2 font-medium text-center">考核表</th>
                                                    <th className="py-2 w-8"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {form.youths.map(y => {
                                                    const saved = !!editingId;
                                                    // 專案管理者或被分配的填寫人可填寫；已核章後只能檢視
                                                    const mayFill = isManager || (y.filler_id && y.filler_id === officerId);
                                                    const canFill = y.review_status !== '已核章' && mayFill;
                                                    // 已儲存的活動，檢視隨時可開；尚未儲存時，有填寫權限才能開（會自動先儲存）
                                                    const fillDisabled = !saved && !mayFill;
                                                    return (
                                                        <tr key={y.id} className="border-b border-gray-50 last:border-b-0">
                                                            <td className="py-2 px-3 font-medium">{y.name}</td>
                                                            <td className="py-2 px-2">
                                                                <select className={miniSelect} value={y.attendance} onChange={e => patchYouth(y.id, { attendance: e.target.value })}>
                                                                    {ATTENDANCE.map(a => <option key={a} value={a}>{a}</option>)}
                                                                </select>
                                                            </td>
                                                            <td className="py-2 px-2">
                                                                <select className={miniSelect} value={y.review_status} onChange={e => patchYouth(y.id, { review_status: e.target.value })}>
                                                                    {REVIEW_STATUSES.map(a => (
                                                                        <option key={a} value={a} disabled={a !== '待填寫' && !y.has_form}>{a}</option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                            <td className="py-2 px-2">
                                                                <select className={miniSelect} value={y.filler_id} onChange={e => patchYouth(y.id, { filler_id: e.target.value })}
                                                                    disabled={form.staff_ids.length === 0} title={form.staff_ids.length === 0 ? '請先選擇實際出席人員' : ''}>
                                                                    <option value="">未分配</option>
                                                                    {attendedStaffOptions.map(m => <option key={m.officer_id} value={m.officer_id}>{m.name}</option>)}
                                                                </select>
                                                            </td>
                                                            <td className="py-2 px-2">
                                                                <div className="flex justify-center gap-2">
                                                                    <button type="button" disabled={fillDisabled} onClick={() => openFill(y)}
                                                                        title={fillDisabled ? '請先指派自己為填寫人員，或由專案管理者操作' : (canFill ? (saved ? '填寫考核表' : '填寫考核表（會先自動儲存活動）') : '檢視考核表')}
                                                                        className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 flex items-center gap-1 whitespace-nowrap">
                                                                        <FileText className="w-3.5 h-3.5" /> {canFill ? '填寫' : '檢視'}
                                                                    </button>
                                                                    {isManager && (
                                                                        <button type="button" disabled={!saved || !y.has_form} onClick={() => handlePrint(y)}
                                                                            title={!saved ? '請先儲存活動' : (!y.has_form ? '尚未填寫考核表' : '匯出列印（列印後考核狀態會改為已核章）')}
                                                                            className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 flex items-center gap-1 whitespace-nowrap">
                                                                            <Printer className="w-3.5 h-3.5" /> 匯出列印
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-2 pr-2">
                                                                <button type="button" onClick={() => removeYouth(y.id)} disabled={y.has_form}
                                                                    className="p-1 text-gray-300 hover:text-red-600 disabled:opacity-30 disabled:hover:text-gray-300"
                                                                    title={y.has_form ? '已有考核表資料，不能移出名單' : '移出此場名單'}><X className="w-4 h-4" /></button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {addableYouths.length > 0 && (
                                    <div className="flex gap-2 items-center">
                                        <select className={`${miniSelect} sm:w-60`} value={addYouthId} onChange={e => setAddYouthId(e.target.value)}>
                                            <option value="">加入其他參與少年…</option>
                                            {addableYouths.map(p => <option key={p.id} value={p.id}>{p.name}（{p.status}）</option>)}
                                        </select>
                                        <button type="button" onClick={addYouth} disabled={!addYouthId} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-white disabled:opacity-40">加入</button>
                                    </div>
                                )}
                            </Group>

                            <div className="pt-2 flex flex-col sm:flex-row justify-end gap-3">
                                <Button variant="outline" type="button" onClick={() => setShowModal(false)} className="w-full sm:w-auto">關閉</Button>
                                <Button variant="primary" type="submit" className="w-full sm:w-auto">{editingId ? '儲存變更' : '確認新增'}</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {fillTarget && (
                <ExReviewFill sessionId={fillTarget.sessionId} participantId={fillTarget.participantId}
                    onClose={() => setFillTarget(null)} onSaved={() => syncYouth(fillTarget.participantId)} />
            )}
            {printPayload && <ExReviewPrint payload={printPayload} notice="已將考核狀態標為已核章" onClose={() => setPrintPayload(null)} />}
        </div>
    );
};

export default ExSessionsManagement;
