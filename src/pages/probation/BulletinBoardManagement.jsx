import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import { Plus, X, Edit, Trash2, Megaphone } from 'lucide-react';
import { toROCDate } from '../../utils/dateUtils';

const BulletinBoardManagement = () => {
    const [bulletins, setBulletins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        is_active: true
    });

    useEffect(() => {
        fetchBulletins();
    }, []);

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
            is_active: true
        });
        setShowModal(true);
    };

    const handleOpenEdit = (bulletin) => {
        setIsEditing(true);
        setEditingId(bulletin.id);
        setFormData({
            title: bulletin.title,
            content: bulletin.content || '',
            is_active: bulletin.is_active
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
            <div className="overflow-hidden rounded-xl border border-gray-100 shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-gray-600 text-sm">
                        <tr>
                            <th className="py-3 px-4 font-medium">標題</th>
                            <th className="py-3 px-4 font-medium w-1/2">內容摘要</th>
                            <th className="py-3 px-4 font-medium">發布日</th>
                            <th className="py-3 px-4 font-medium text-center">狀態</th>
                            <th className="py-3 px-4 font-medium text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan="5" className="py-8 text-center text-gray-400">載入中...</td></tr>
                        ) : bulletins.length === 0 ? (
                            <tr><td colSpan="5" className="py-8 text-center text-gray-400">目前尚無公告</td></tr>
                        ) : (
                            bulletins.map((b) => (
                                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="py-3 px-4 font-medium text-gray-800">{b.title}</td>
                                    <td className="py-3 px-4 text-gray-600 truncate max-w-xs">{b.content}</td>
                                    <td className="py-3 px-4 text-sm text-gray-500">
                                        {toROCDate(b.created_at)}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {b.is_active ? '上架中' : '已下架'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 flex justify-center gap-2">
                                        <button onClick={() => handleOpenEdit(b)} className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title="編輯">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(b.id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors" title="刪除">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl">
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
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
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
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                                    value={formData.content}
                                    placeholder="請輸入公告詳細內容"
                                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    id="is_active"
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                                    checked={formData.is_active}
                                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                />
                                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer">
                                    立即上架顯示
                                </label>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <Button variant="outline" type="button" onClick={() => setShowModal(false)}>取消</Button>
                                <Button variant="primary" type="submit">
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
