import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import { Plus, X, Edit, Trash2, Search } from 'lucide-react';
import { toROCDate } from '../../utils/dateUtils';

const inputCls = 'w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none';
const PROJECT_KEY = 'exercise_addiction';
const EMPTY = { name: '', gender: '', birth_date: '', case_number: '', department: '', contact_info: '', counselor_id: '', status: '參加中' };
const STATUS_STYLE = { '參加中': 'bg-green-100 text-green-700', '已結束': 'bg-gray-100 text-gray-500' };

// 運動戒癮團體專案：參與少年資料庫維護（專案管理者與專案成員皆可完整維護）
const ExParticipantsManagement = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [counselors, setCounselors] = useState([]); // 本專案的成員
    const [departments, setDepartments] = useState([]);
    const [keyword, setKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY);

    useEffect(() => {
        const load = async () => {
            await fetchRows();
            const { data: opts } = await supabase.rpc('project_member_options', { p_key: PROJECT_KEY });
            setCounselors(opts || []);
            const { data: officers } = await supabase.rpc('get_admin_view_officers');
            setDepartments([...new Set((officers || []).map(o => o.department).filter(Boolean))].sort());
        };
        load();
    }, []);

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

    const openAdd = () => {
        setEditingId(null);
        setForm(EMPTY);
        setShowModal(true);
    };

    const openEdit = (r) => {
        setEditingId(r.id);
        setForm({
            name: r.name || '', gender: r.gender || '', birth_date: r.birth_date || '',
            case_number: r.case_number || '', department: r.department || '',
            contact_info: r.contact_info || '', counselor_id: r.counselor_id || '', status: r.status || '參加中'
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
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

    const q = keyword.trim().toLowerCase();
    const filtered = rows.filter(r => (!statusFilter || r.status === statusFilter) && (!q
        || (r.name || '').toLowerCase().includes(q)
        || (r.case_number || '').toLowerCase().includes(q)
        || (r.counselor_name || '').toLowerCase().includes(q)));

    return (
        <div>
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                <h3 className="text-xl font-bold text-primary">參與少年資料庫維護</h3>
                <Button variant="primary" onClick={openAdd} className="flex items-center gap-1">
                    <Plus className="w-4 h-4" /> 新增參與少年
                </Button>
            </div>

            <div className="flex flex-wrap gap-3 mb-4">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input type="text" className={`${inputCls} pl-9`} placeholder="搜尋姓名、案號、認輔人員"
                        value={keyword} onChange={e => setKeyword(e.target.value)} />
                </div>
                <select className={`${inputCls} bg-white sm:w-40`} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">所有參與狀態</option>
                    <option value="參加中">參加中</option>
                    <option value="已結束">已結束</option>
                </select>
            </div>

            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
                            <th className="py-3 px-4">姓名</th>
                            <th className="py-3 px-4">性別</th>
                            <th className="py-3 px-4">出生日期</th>
                            <th className="py-3 px-4">案號／編號</th>
                            <th className="py-3 px-4">所屬股別</th>
                            <th className="py-3 px-4">參與狀態</th>
                            <th className="py-3 px-4">認輔人員</th>
                            <th className="py-3 px-4">聯絡方式</th>
                            <th className="py-3 px-4 text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-700">
                        {loading ? (
                            <tr><td colSpan="9" className="py-8 text-center text-gray-400">載入中...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="9" className="py-8 text-center text-gray-400">目前尚無資料</td></tr>
                        ) : filtered.map(r => (
                            <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                <td className="py-3 px-4 font-medium">{r.name}</td>
                                <td className="py-3 px-4">{r.gender || '-'}</td>
                                <td className="py-3 px-4">{r.birth_date ? toROCDate(r.birth_date) : '-'}</td>
                                <td className="py-3 px-4">{r.case_number || '-'}</td>
                                <td className="py-3 px-4">{r.department || '-'}</td>
                                <td className="py-3 px-4"><span className={`px-2 py-1 rounded-lg text-xs ${STATUS_STYLE[r.status]}`}>{r.status}</span></td>
                                <td className="py-3 px-4">{r.counselor_name || '-'}</td>
                                <td className="py-3 px-4">{r.contact_info || '-'}</td>
                                <td className="py-3 px-4 flex justify-center gap-2">
                                    <button onClick={() => openEdit(r)} className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title="編輯">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(r)} className="p-1 text-gray-400 hover:text-red-600 transition-colors" title="刪除">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
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
                                <div className="font-bold text-gray-800 text-lg">{r.name}</div>
                                <div className="text-xs text-primary font-medium">{r.department || '-'}</div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="p-2 text-gray-400 hover:text-red-600" title="刪除">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                            <div><span className="text-gray-400">參與狀態：</span>{r.status}</div>
                            <div><span className="text-gray-400">性別：</span>{r.gender || '-'}</div>
                            <div><span className="text-gray-400">出生日期：</span>{r.birth_date ? toROCDate(r.birth_date) : '-'}</div>
                            <div><span className="text-gray-400">案號／編號：</span>{r.case_number || '-'}</div>
                            <div><span className="text-gray-400">認輔人員：</span>{r.counselor_name || '-'}</div>
                            <div><span className="text-gray-400">聯絡方式：</span>{r.contact_info || '-'}</div>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 overflow-y-auto p-4 sm:p-10">
                    <div className="bg-white rounded-2xl p-5 sm:p-8 w-full max-w-lg shadow-2xl mt-4 sm:mt-0 sm:my-auto mb-10 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-primary">{editingId ? '編輯參與少年' : '新增參與少年'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                                <input type="text" required className={inputCls} value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">性別</label>
                                    <select className={`${inputCls} bg-white`} value={form.gender}
                                        onChange={e => setForm({ ...form, gender: e.target.value })}>
                                        <option value="">未填</option>
                                        <option value="男">男</option>
                                        <option value="女">女</option>
                                        <option value="其他">其他</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">出生日期</label>
                                    <input type="date" className={inputCls} value={form.birth_date}
                                        onChange={e => setForm({ ...form, birth_date: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">案號／編號</label>
                                    <input type="text" className={inputCls} value={form.case_number}
                                        onChange={e => setForm({ ...form, case_number: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">所屬股別</label>
                                    <select className={`${inputCls} bg-white`} value={form.department}
                                        onChange={e => setForm({ ...form, department: e.target.value })}>
                                        <option value="">未填</option>
                                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">參與狀態</label>
                                <select className={`${inputCls} bg-white`} value={form.status}
                                    onChange={e => setForm({ ...form, status: e.target.value })}>
                                    <option value="參加中">參加中</option>
                                    <option value="已結束">已結束</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">認輔人員（限本專案成員）</label>
                                <select className={`${inputCls} bg-white`} value={form.counselor_id}
                                    onChange={e => setForm({ ...form, counselor_id: e.target.value })}>
                                    <option value="">未指定</option>
                                    {counselors.map(c => (
                                        <option key={c.officer_id} value={c.officer_id}>{c.department || '-'}｜{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">聯絡方式（少年或家長）</label>
                                <input type="text" className={inputCls} value={form.contact_info}
                                    onChange={e => setForm({ ...form, contact_info: e.target.value })} />
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

export default ExParticipantsManagement;
