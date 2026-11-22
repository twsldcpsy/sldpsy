import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import { PROJECT_ROLE_LABEL } from '../../utils/projectUtils';

// 運動戒癮團體專案：工作分配維護
// 本專案的成員（專案管理者、專案成員）被指派進專案時自動出現在此；
// 股別、姓名、分機取自工作人員資料（請到「工作人員維護」修改），「主責項目」與「工作內容」在此編輯。
// 平常是唯讀的閱讀模式；只有專案管理者（與系統管理者）看得到「編輯」，資料庫也只接受他們的寫入。
const RESPONSIBILITIES = ['計劃統籌', '協同辦理'];

const ExAssignmentsManagement = ({ canEdit }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [drafts, setDrafts] = useState({});   // officer_id -> { work_content?, responsibility? }
    const [saving, setSaving] = useState(false);

    const fetchRows = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('ex_assignment_list');
            if (error) throw error;
            setRows(data || []);
        } catch (error) {
            console.error('Error fetching assignments:', error);
            alert('載入失敗: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRows();
    }, []);

    const contentOf = (r) => (drafts[r.officer_id]?.work_content !== undefined ? drafts[r.officer_id].work_content : (r.work_content || ''));
    const respOf = (r) => (drafts[r.officer_id]?.responsibility !== undefined ? drafts[r.officer_id].responsibility : (r.responsibility || ''));
    const isDirty = (r) => contentOf(r) !== (r.work_content || '') || respOf(r) !== (r.responsibility || '');
    const patchDraft = (id, patch) => setDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    const dirtyCount = rows.filter(isDirty).length;

    const startEdit = () => {
        setDrafts({});
        setEditing(true);
    };

    const cancelEdit = () => {
        if (dirtyCount > 0 && !window.confirm('尚有未儲存的修改，確定要放棄嗎？')) return;
        setDrafts({});
        setEditing(false);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            for (const r of rows.filter(isDirty)) {
                const { error } = await supabase.rpc('ex_assignment_save', {
                    p_officer_id: r.officer_id, p_content: contentOf(r), p_responsibility: respOf(r)
                });
                if (error) throw error;
            }
            setDrafts({});
            setEditing(false);
            await fetchRows();
        } catch (error) {
            alert('儲存失敗: ' + error.message);
            await fetchRows(); // 已成功的列會更新，其餘保留在編輯畫面
        } finally {
            setSaving(false);
        }
    };

    const respView = (r) => (r.responsibility
        ? <span className={`px-2 py-1 rounded-lg text-xs ${r.responsibility === '計劃統籌' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}`}>{r.responsibility}</span>
        : <span className="text-gray-300">-</span>);

    const respEdit = (r) => (
        <select
            className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-secondary/20 outline-none"
            value={respOf(r)}
            onChange={e => patchDraft(r.officer_id, { responsibility: e.target.value })}
        >
            <option value="">未指定</option>
            {RESPONSIBILITIES.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
    );

    const contentView = (r) => (r.work_content
        ? <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{r.work_content}</div>
        : <span className="text-gray-300">-</span>);

    const contentEdit = (r) => (
        <textarea
            rows={4}
            className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none"
            placeholder="輸入此人在本專案的工作內容"
            value={contentOf(r)}
            onChange={e => patchDraft(r.officer_id, { work_content: e.target.value })}
        />
    );

    return (
        <div>
            <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
                <div>
                    <h3 className="text-xl font-bold text-primary">工作分配維護</h3>
                    <p className="text-xs text-gray-400 mt-1">
                        本專案成員會自動列在這裡；股別、姓名、分機請到「工作人員維護」修改。
                        {!canEdit && '（僅專案管理者可編輯）'}
                    </p>
                </div>
                {canEdit && (editing ? (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={cancelEdit} disabled={saving}>取消</Button>
                        <Button variant="primary" onClick={handleSave} disabled={saving || dirtyCount === 0}>
                            {saving ? '儲存中...' : (dirtyCount > 0 ? `儲存（${dirtyCount} 筆修改）` : '儲存')}
                        </Button>
                    </div>
                ) : (
                    <Button variant="primary" onClick={startEdit} disabled={loading || rows.length === 0}>編輯</Button>
                ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
                            <th className="py-3 px-4 w-36">主責項目</th>
                            <th className="py-3 px-4 w-28">股別</th>
                            <th className="py-3 px-4 w-40">姓名</th>
                            <th className="py-3 px-4 w-24">分機</th>
                            <th className="py-3 px-4">工作內容</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-700">
                        {loading ? (
                            <tr><td colSpan="5" className="py-8 text-center text-gray-400">載入中...</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan="5" className="py-8 text-center text-gray-400">本專案尚無成員，請系統管理者在「專案管理」加入成員</td></tr>
                        ) : rows.map(r => (
                            <tr key={r.officer_id} className="border-b border-gray-50 align-top">
                                <td className="py-3 px-4">{editing ? respEdit(r) : respView(r)}</td>
                                <td className="py-3 px-4 font-bold text-primary">{r.department || '-'}</td>
                                <td className="py-3 px-4">
                                    <div className="font-medium">{r.name}</div>
                                    <div className="text-xs text-gray-400">{PROJECT_ROLE_LABEL[r.project_role]}</div>
                                </td>
                                <td className="py-3 px-4">{r.extension_number || '-'}</td>
                                <td className="py-3 px-4">{editing ? contentEdit(r) : contentView(r)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden space-y-3">
                {loading ? (
                    <div className="py-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">載入中...</div>
                ) : rows.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">本專案尚無成員</div>
                ) : rows.map(r => (
                    <div key={r.officer_id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-2">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="font-bold text-gray-800 text-lg">{r.name}</div>
                                <div className="text-xs text-primary font-medium">{r.department || '-'} ｜ {PROJECT_ROLE_LABEL[r.project_role]}</div>
                            </div>
                            <div className="text-sm text-gray-500">分機 {r.extension_number || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-400 mb-1">主責項目</div>
                            {editing ? respEdit(r) : respView(r)}
                        </div>
                        <div>
                            <div className="text-xs text-gray-400 mb-1">工作內容</div>
                            {editing ? contentEdit(r) : contentView(r)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ExAssignmentsManagement;
