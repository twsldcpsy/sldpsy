import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import { PROJECT_ROLE_LABEL } from '../../utils/projectUtils';

// 運動戒癮團體專案：工作分配維護
// 本專案的成員（專案管理者、專案成員）被指派進專案時自動出現在此；
// 股別、姓名、分機取自工作人員資料（唯讀，請到「工作人員維護」修改），只有「工作內容」在此編輯。
const ExAssignmentsManagement = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [drafts, setDrafts] = useState({});   // officer_id -> 尚未儲存的內容
    const [savingId, setSavingId] = useState(null);

    const fetchRows = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('ex_assignment_list');
            if (error) throw error;
            setRows(data || []);
            setDrafts({});
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

    const current = (r) => (drafts[r.officer_id] !== undefined ? drafts[r.officer_id] : (r.work_content || ''));
    const isDirty = (r) => drafts[r.officer_id] !== undefined && drafts[r.officer_id] !== (r.work_content || '');

    const handleSave = async (r) => {
        try {
            setSavingId(r.officer_id);
            const { error } = await supabase.rpc('ex_assignment_save', { p_officer_id: r.officer_id, p_content: current(r) });
            if (error) throw error;
            setRows(prev => prev.map(x => (x.officer_id === r.officer_id ? { ...x, work_content: current(r) } : x)));
            setDrafts(prev => {
                const next = { ...prev };
                delete next[r.officer_id];
                return next;
            });
        } catch (error) {
            alert('儲存失敗: ' + error.message);
        } finally {
            setSavingId(null);
        }
    };

    const area = (r) => (
        <textarea
            rows={4}
            className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none"
            placeholder="輸入此人在本專案的工作內容"
            value={current(r)}
            onChange={e => setDrafts(prev => ({ ...prev, [r.officer_id]: e.target.value }))}
        />
    );

    const saveBtn = (r) => (
        <Button variant="primary" onClick={() => handleSave(r)} disabled={!isDirty(r) || savingId === r.officer_id}
            className="text-xs py-1 px-3 whitespace-nowrap">
            {savingId === r.officer_id ? '儲存中...' : (isDirty(r) ? '儲存' : '已儲存')}
        </Button>
    );

    return (
        <div>
            <div className="mb-6">
                <h3 className="text-xl font-bold text-primary">工作分配維護</h3>
                <p className="text-xs text-gray-400 mt-1">
                    本專案成員會自動列在這裡；股別、姓名、分機請到「工作人員維護」修改，這裡只編輯工作內容。
                </p>
            </div>

            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
                            <th className="py-3 px-4 w-28">股別</th>
                            <th className="py-3 px-4 w-40">姓名</th>
                            <th className="py-3 px-4 w-24">分機</th>
                            <th className="py-3 px-4">工作內容</th>
                            <th className="py-3 px-4 w-24"></th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-700">
                        {loading ? (
                            <tr><td colSpan="5" className="py-8 text-center text-gray-400">載入中...</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan="5" className="py-8 text-center text-gray-400">本專案尚無成員，請系統管理者在「專案管理」加入成員</td></tr>
                        ) : rows.map(r => (
                            <tr key={r.officer_id} className="border-b border-gray-50 align-top">
                                <td className="py-3 px-4 font-bold text-primary">{r.department || '-'}</td>
                                <td className="py-3 px-4">
                                    <div className="font-medium">{r.name}</div>
                                    <div className="text-xs text-gray-400">{PROJECT_ROLE_LABEL[r.project_role]}</div>
                                </td>
                                <td className="py-3 px-4">{r.extension_number || '-'}</td>
                                <td className="py-3 px-4">{area(r)}</td>
                                <td className="py-3 px-4">{saveBtn(r)}</td>
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
                        {area(r)}
                        <div className="flex justify-end">{saveBtn(r)}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ExAssignmentsManagement;
