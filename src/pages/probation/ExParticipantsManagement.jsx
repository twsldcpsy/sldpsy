import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import RocDateSelect from '../../components/RocDateSelect';
import { Plus, X, Edit, Trash2, Search } from 'lucide-react';
import { toROCDate, calcAge } from '../../utils/dateUtils';

const inputCls = 'w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none';
const TREATMENT_TYPES = ['調查', '保護管束', '假日生活輔導'];
const CONTACT_ROLES = ['少年', '家長'];
const emptyForm = () => ({ name: '', gender: '', birth_date: '', treatment_type: '', status: '參加中', contacts: [{ role: '少年', phone: '' }] });
const STATUS_STYLE = { '參加中': 'bg-green-100 text-green-700', '已結束': 'bg-gray-100 text-gray-500' };

// 聯絡方式：條列顯示（身分：電話）
const ContactList = ({ contacts }) => {
    const list = (contacts || []).filter(c => c.phone);
    if (list.length === 0) return <span className="text-gray-300">-</span>;
    return (
        <ul className="space-y-0.5 text-sm">
            {list.map((c, i) => (
                <li key={i} className="flex gap-2">
                    <span className="shrink-0 px-1.5 rounded bg-gray-100 text-gray-500 text-xs leading-5">{c.role}</span>
                    <span className="text-gray-700">{c.phone}</span>
                </li>
            ))}
        </ul>
    );
};

const ageText = (birth) => {
    const a = calcAge(birth);
    return a === null ? '-' : `${a} 歲`;
};

// 運動戒癮團體專案：參與少年資料庫維護（專案管理者與專案成員皆可完整維護）
const ExParticipantsManagement = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [keyword, setKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [birthIncomplete, setBirthIncomplete] = useState(false);

    const fetchRows = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('ex_participant_list');
            if (error) throw error;
            setRows(data || []);
        } catch (error) {
            console.error('Error fetching participants:', error);
            alert('載入失敗: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRows();
    }, []);

    const openAdd = () => {
        setEditingId(null);
        setForm(emptyForm());
        setBirthIncomplete(false);
        setShowModal(true);
    };

    const openEdit = (r) => {
        setEditingId(r.id);
        setForm({
            name: r.name || '', gender: r.gender || '', birth_date: r.birth_date || '',
            treatment_type: r.treatment_type || '', status: r.status || '參加中',
            contacts: (r.contacts && r.contacts.length > 0) ? r.contacts.map(c => ({ ...c })) : [{ role: '少年', phone: '' }]
        });
        setBirthIncomplete(false);
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (birthIncomplete) {
            alert('出生日期尚未選完整，請選好民國年、月、日，或全部清空。');
            return;
        }
        try {
            const { error } = await supabase.rpc('ex_participant_save', { p_data: { ...form, id: editingId } });
            if (error) throw error;
            setShowModal(false);
            fetchRows();
        } catch (error) {
            alert((editingId ? '更新失敗: ' : '新增失敗: ') + error.message);
        }
    };

    const handleDelete = async (r) => {
        if (!window.confirm(`確定要刪除「${r.name}」的資料嗎？此操作無法復原。`)) return;
        try {
            const { error } = await supabase.rpc('ex_participant_delete', { p_id: r.id });
            if (error) throw error;
            fetchRows();
        } catch (error) {
            alert('刪除失敗: ' + error.message);
        }
    };

    // 聯絡方式（條列）
    const setContact = (i, patch) => setForm(prev => ({ ...prev, contacts: prev.contacts.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));
    const addContact = () => setForm(prev => ({ ...prev, contacts: [...prev.contacts, { role: '家長', phone: '' }] }));
    const removeContact = (i) => setForm(prev => ({ ...prev, contacts: prev.contacts.filter((_, idx) => idx !== i) }));

    const q = keyword.trim().toLowerCase();
    const filtered = rows.filter(r => (!statusFilter || r.status === statusFilter) && (!q || (r.name || '').toLowerCase().includes(q)));

    return (
        <div>
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                <h3 className="text-xl font-bold text-primary">參與少年資料庫維護</h3>
                <Button variant="primary" onClick={openAdd} className="flex items-center gap-1">
                    <Plus className="w-4 h-4" /> 新增參與少年
                </Button>
            </div>

            <div className="flex flex-wrap gap-3 mb-4">
                <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input type="text" className={`${inputCls} pl-9`} placeholder="搜尋姓名"
                        value={keyword} onChange={e => setKeyword(e.target.value)} />
                </div>
                <select className={`${inputCls} bg-white sm:w-40`} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">所有參與狀態</option>
                    <option value="參加中">參加中</option>
                    <option value="已結束">已結束</option>
                </select>
            </div>

            <div className="hidden md:block overflow-x-auto bg-white rounded-xl border border-gray-100">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs">
                            <th className="py-3 px-4 font-medium">參與狀態</th>
                            <th className="py-3 px-4 font-medium">姓名</th>
                            <th className="py-3 px-4 font-medium">性別</th>
                            <th className="py-3 px-4 font-medium">年紀</th>
                            <th className="py-3 px-4 font-medium">處遇類型</th>
                            <th className="py-3 px-4 font-medium">聯絡方式</th>
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
                                <td className="py-3 px-4"><span className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap ${STATUS_STYLE[r.status]}`}>{r.status}</span></td>
                                <td className="py-3 px-4 font-medium text-gray-800">{r.name}</td>
                                <td className="py-3 px-4">{r.gender || '-'}</td>
                                <td className="py-3 px-4 whitespace-nowrap" title={r.birth_date ? `出生日期：${toROCDate(r.birth_date)}` : ''}>{ageText(r.birth_date)}</td>
                                <td className="py-3 px-4">{r.treatment_type || '-'}</td>
                                <td className="py-3 px-4"><ContactList contacts={r.contacts} /></td>
                                <td className="py-3 px-4">
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

            <div className="md:hidden space-y-3">
                {loading ? (
                    <div className="py-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">載入中...</div>
                ) : filtered.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">目前尚無資料</div>
                ) : filtered.map(r => (
                    <div key={r.id} onClick={() => openEdit(r)} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-2">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-800 text-lg">{r.name}</span>
                                <span className={`px-2 py-0.5 rounded-lg text-xs ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="p-2 text-gray-400 hover:text-red-600" title="刪除"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <div className="text-sm text-gray-600">{[r.gender, ageText(r.birth_date) !== '-' && ageText(r.birth_date), r.treatment_type].filter(Boolean).join(' · ') || '-'}</div>
                        <ContactList contacts={r.contacts} />
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 overflow-y-auto p-4 sm:p-10">
                    <div className="bg-white rounded-2xl p-5 sm:p-8 w-full max-w-lg shadow-2xl mt-4 sm:mt-0 sm:my-auto mb-10 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-primary">{editingId ? '編輯參與少年' : '新增參與少年'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">參與狀態</label>
                                    <select className={`${inputCls} bg-white`} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                        <option value="參加中">參加中</option>
                                        <option value="已結束">已結束</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                                    <input type="text" required className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">性別</label>
                                    <select className={`${inputCls} bg-white`} value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                                        <option value="">未填</option>
                                        <option value="男">男</option>
                                        <option value="女">女</option>
                                        <option value="其他">其他</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">處遇類型</label>
                                    <select className={`${inputCls} bg-white`} value={form.treatment_type} onChange={e => setForm({ ...form, treatment_type: e.target.value })}>
                                        <option value="">未填</option>
                                        {TREATMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    出生日期（民國年）
                                    {form.birth_date && <span className="ml-2 text-xs text-gray-400">年紀 {ageText(form.birth_date)}</span>}
                                </label>
                                <RocDateSelect value={form.birth_date} onChange={v => setForm({ ...form, birth_date: v })} onIncomplete={setBirthIncomplete} />
                                {birthIncomplete && <p className="text-xs text-amber-600 mt-1">請選好民國年、月、日（或全部清空）</p>}
                            </div>

                            <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 space-y-2">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-primary text-sm">聯絡方式</h4>
                                    <span className="text-xs text-gray-400">身分與電話，可新增多筆</span>
                                </div>
                                {form.contacts.map((c, i) => (
                                    <div key={i} className="flex gap-2 items-center">
                                        <select className="p-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg bg-white w-24"
                                            value={c.role} onChange={e => setContact(i, { role: e.target.value })}>
                                            {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                        <input type="text" inputMode="tel" className={inputCls} placeholder="電話" value={c.phone}
                                            onChange={e => setContact(i, { phone: e.target.value })} />
                                        <button type="button" onClick={() => removeContact(i)} className="p-2 text-gray-300 hover:text-red-600" title="刪除這一筆"><X className="w-4 h-4" /></button>
                                    </div>
                                ))}
                                <button type="button" onClick={addContact} disabled={form.contacts.length >= 10}
                                    className="flex items-center gap-1 text-sm text-primary hover:underline disabled:opacity-40">
                                    <Plus className="w-4 h-4" /> 新增聯絡方式
                                </button>
                            </div>

                            <div className="pt-2 flex flex-col sm:flex-row justify-end gap-3">
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

export default ExParticipantsManagement;
