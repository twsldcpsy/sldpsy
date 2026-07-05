import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import MultiSelectFilter from '../../components/MultiSelectFilter';
import { Plus, X, Edit, Trash2, Megaphone, CalendarDays, Clock, Users } from 'lucide-react';
import { toROCDate } from '../../utils/dateUtils';

const BulletinBoardManagement = () => {
    const [bulletins, setBulletins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Dropdown data for audience targeting
    const [psychologists, setPsychologists] = useState([]);
    const [departments, setDepartments] = useState([]);

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        is_active: true,
        start_date: '',
        end_date: '',
        target_all_psychologists: true,
        target_all_officers: true,
        target_psychologist_ids: [],
        target_departments: []
    });

    useEffect(() => {
        fetchBulletins();
        fetchDropdowns();
    }, []);

    const fetchDropdowns = async () => {
        try {
            const { data: psychs } = await supabase
                .from('psychologists')
                .select('id, name')
                .eq('is_active', true)
                .order('name');
            setPsychologists(psychs || []);

            const { data: officersData } = await supabase
                .from('probation_officers')
                .select('department')
                .neq('department', null);
            const depts = [...new Set(officersData?.map(o => o.department))].sort();
            setDepartments(depts);
        } catch (error) {
            console.error('Error fetching dropdowns:', error);
        }
    };

    const fetchBulletins = async () => {
        try {
            const { data, error } = await supabase
                .from('bulletins')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setBulletins(data || []);
        } catch (error) {
            console.error('Error fetching bulletins:', error);
            // Don't alert on first load as table might not exist yet
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAdd = () => {
        setIsEditing(false);
        setEditingId(null);
        setFormData({
            title: '',
            content: '',
            is_active: true,
            start_date: '',
            end_date: '',
            target_all_psychologists: true,
            target_all_officers: true,
            target_psychologist_ids: [],
            target_departments: []
        });
        setShowModal(true);
    };

    const handleOpenEdit = (bulletin) => {
        setIsEditing(true);
        setEditingId(bulletin.id);
        setFormData({
            title: bulletin.title,
            content: bulletin.content || '',
            is_active: bulletin.is_active,
            start_date: bulletin.start_date || '',
            end_date: bulletin.end_date || '',
            target_all_psychologists: bulletin.target_all_psychologists ?? true,
            target_all_officers: bulletin.target_all_officers ?? true,
            target_psychologist_ids: bulletin.target_psychologist_ids || [],
            target_departments: bulletin.target_departments || []
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                title: formData.title,
                content: formData.content,
                is_active: formData.is_active,
                start_date: formData.start_date || null,
                end_date: formData.end_date || null,
                target_all_psychologists: formData.target_all_psychologists,
                target_all_officers: formData.target_all_officers,
                target_psychologist_ids: formData.target_psychologist_ids,
                target_departments: formData.target_departments,
                updated_at: new Date().toISOString()
            };

            let error;
            if (isEditing) {
                const { error: updateError } = await supabase
                    .from('bulletins')
                    .update(payload)
                    .eq('id', editingId);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('bulletins')
                    .insert([payload]);
                error = insertError;
            }

            if (error) throw error;

            setShowModal(false);
            fetchBulletins();
        } catch (error) {
            alert(isEditing ? '更新失敗: ' : '新增失敗: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('確定要刪除此公告嗎？')) return;

        try {
            const { error } = await supabase
                .from('bulletins')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchBulletins();
        } catch (error) {
            alert('刪除失敗: ' + error.message);
        }
    };

    const getEffectiveStatus = (b) => {
        if (!b.is_active) return { label: '已下架', className: 'bg-gray-100 text-gray-500' };
        const today = new Date().toISOString().split('T')[0];
        if (b.start_date && today < b.start_date) {
            return { label: '未開始', className: 'bg-yellow-100 text-yellow-700' };
        }
        if (b.end_date && today > b.end_date) {
            return { label: '已結束', className: 'bg-gray-100 text-gray-500' };
        }
        return { label: '上架中', className: 'bg-green-100 text-green-700' };
    };

    const getAudienceSummary = (b) => {
        const parts = [];
        if (b.target_all_psychologists) parts.push('心理師 (全部)');
        if (b.target_all_officers) parts.push('保護官 (全部)');
        if (b.target_psychologist_ids?.length > 0) parts.push(`個別心理師 (${b.target_psychologist_ids.length})`);
        if (b.target_departments?.length > 0) parts.push(`個別股別 (${b.target_departments.length})`);
        return parts.length > 0 ? parts.join('、') : '未設定';
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                    <Megaphone className="w-5 h-5" /> 公告欄維護
                </h3>
                <Button variant="primary" onClick={handleOpenAdd} className="flex items-center gap-1">
                    <Plus className="w-4 h-4" /> 新增公告
                </Button>
            </div>

            {/* List View */}
            <div className="space-y-4">
                {loading ? (
                    <div className="py-10 text-center text-gray-400 bg-white rounded-xl border border-gray-100">載入中...</div>
                ) : bulletins.length === 0 ? (
                    <div className="py-10 text-center text-gray-400 bg-white rounded-xl border border-gray-100">目前尚無公告</div>
                ) : (
                    bulletins.map((b) => {
                        const status = getEffectiveStatus(b);
                        return (
                            <div key={b.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-bold text-gray-800 text-lg break-words">{b.title}</h4>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${status.className}`}>
                                                {status.label}
                                            </span>
                                        </div>
                                        <p className="text-gray-600 text-sm mt-1.5 line-clamp-2 whitespace-pre-wrap">{b.content}</p>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                        <button onClick={() => handleOpenEdit(b)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="編輯">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(b.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="刪除">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-gray-50 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-gray-500">
                                    <div className="flex items-center gap-1.5">
                                        <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                                        發布於 {toROCDate(b.created_at)}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                                        上架期間：{b.start_date || b.end_date
                                            ? `${b.start_date ? toROCDate(b.start_date) : '不限'} ~ ${b.end_date ? toROCDate(b.end_date) : '不限'}`
                                            : '不限期'}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5 flex-shrink-0" />
                                        顯示對象：{getAudienceSummary(b)}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 overflow-y-auto p-4 sm:p-10 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-5 sm:p-8 w-full max-w-lg shadow-2xl mt-4 sm:mt-0 sm:my-auto mb-10 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800">
                                {isEditing ? '編輯公告' : '新增公告'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">公告標題</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-3 sm:p-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    value={formData.title}
                                    placeholder="請輸入公告標題"
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">公告內容</label>
                                <textarea
                                    required
                                    rows="5"
                                    className="w-full p-3 sm:p-2.5 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                                    value={formData.content}
                                    placeholder="請輸入公告詳細內容"
                                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">上架期間 (選填，不填則不限制)</label>
                                <div className="flex flex-col sm:flex-row items-center gap-2">
                                    <input
                                        type="date"
                                        className="w-full p-3 sm:p-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                        value={formData.start_date}
                                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                    />
                                    <span className="text-gray-400">~</span>
                                    <input
                                        type="date"
                                        className="w-full p-3 sm:p-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                        value={formData.end_date}
                                        onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">超過此期間，公告會自動下架，不需手動關閉「立即上架顯示」</p>
                            </div>

                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
                                <h4 className="text-sm font-bold text-gray-700">顯示對象</h4>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 sm:w-4 sm:h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                                            checked={formData.target_all_psychologists}
                                            onChange={e => setFormData({ ...formData, target_all_psychologists: e.target.checked })}
                                        />
                                        心理師 (全部)
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 sm:w-4 sm:h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                                            checked={formData.target_all_officers}
                                            onChange={e => setFormData({ ...formData, target_all_officers: e.target.checked })}
                                        />
                                        保護官 (全部)
                                    </label>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">個別心理師</label>
                                        <MultiSelectFilter
                                            label="選擇心理師"
                                            options={psychologists.map(p => ({ value: p.id, label: p.name }))}
                                            selected={formData.target_psychologist_ids}
                                            onChange={vals => setFormData({ ...formData, target_psychologist_ids: vals })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">個別股別</label>
                                        <MultiSelectFilter
                                            label="選擇股別"
                                            options={departments.map(d => ({ value: d, label: d }))}
                                            selected={formData.target_departments}
                                            onChange={vals => setFormData({ ...formData, target_departments: vals })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    id="is_active"
                                    type="checkbox"
                                    className="w-5 h-5 sm:w-4 sm:h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                                    checked={formData.is_active}
                                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                />
                                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer">
                                    立即上架顯示
                                </label>
                            </div>

                            <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3">
                                <Button variant="outline" type="button" onClick={() => setShowModal(false)} className="w-full sm:w-auto">取消</Button>
                                <Button variant="primary" type="submit" className="w-full sm:w-auto">
                                    {isEditing ? '儲存變更' : '確認發布'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BulletinBoardManagement;
