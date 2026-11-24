import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import { Plus, X, Trash2, Edit, KeyRound } from 'lucide-react';

// 新增帳號與「重設為預設密碼」共用的預設值
const DEFAULT_PASSWORD = 'psy';

const PsychologistDatabase = () => {
    const [psychologists, setPsychologists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Form Data
    const [formData, setFormData] = useState({
        name: '',
        qualification: '',
        password: '',
        contact_info: '',
        is_active: true
    });

    // Fetch data
    useEffect(() => {
        fetchPsychologists();
    }, []);

    const fetchPsychologists = async () => {
        try {
            // Use RPC to get full data including passwords for Admin
            const { data, error } = await supabase
                .rpc('get_admin_view_psychologists');

            if (error) throw error;
            setPsychologists(data);
        } catch (error) {
            console.error('Error fetching psychologists:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAdd = () => {
        setIsEditing(false);
        setEditingId(null);
        setFormData({
            name: '',
            qualification: '諮商心理師',
            password: DEFAULT_PASSWORD, // Default for new users
            contact_info: '',
            is_active: true
        });
        setShowModal(true);
    };

    const handleOpenEdit = (psychologist) => {
        setIsEditing(true);
        setEditingId(psychologist.id);
        setFormData({
            name: psychologist.name,
            qualification: psychologist.qualification || '諮商心理師',
            password: '', // Leave blank for security, only fill to reset
            contact_info: psychologist.contact_info || '',
            is_active: psychologist.is_active
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                // Update basic info via RPC
                const { error: updateError } = await supabase
                    .rpc('admin_update_psychologist', {
                        target_id: editingId,
                        p_name: formData.name,
                        p_qualification: formData.qualification || null,
                        p_contact_info: formData.contact_info || null,
                        p_is_active: formData.is_active
                    });

                if (updateError) throw updateError;

                // Handle Password Reset if provided (Separate RPC)
                if (formData.password) {
                    const { error: pwdError } = await supabase
                        .rpc('admin_reset_password_psychologist', {
                            target_id: editingId,
                            new_password: formData.password
                        });
                    if (pwdError) throw pwdError;
                }
            } else {
                // Insert New User via RPC
                const { error: insertError } = await supabase
                    .rpc('admin_create_psychologist', {
                        p_name: formData.name,
                        p_qualification: formData.qualification || '諮商心理師',
                        p_password: formData.password || DEFAULT_PASSWORD,
                        p_contact_info: formData.contact_info || null,
                        p_is_active: formData.is_active
                    });

                if (insertError) throw insertError;
            }

            // Reset and Refresh
            setShowModal(false);
            fetchPsychologists();
        } catch (error) {
            alert(isEditing ? '更新失敗: ' : '新增失敗: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('確定要刪除此位心理師資料嗎？此操作無法復原。')) return;

        try {
            const { error } = await supabase
                .rpc('admin_delete_psychologist', { target_id: id });

            if (error) throw error;
            fetchPsychologists();
        } catch (error) {
            alert('刪除失敗: ' + error.message);
        }
    };

    const handleResetToDefault = async (target) => {
        if (!window.confirm(`確定要將「${target.name}」的密碼重設為預設密碼（${DEFAULT_PASSWORD}）嗎？\n請通知該心理師登入後自行修改密碼。`)) return;

        try {
            const { error } = await supabase
                .rpc('admin_reset_password_psychologist', { target_id: target.id, new_password: DEFAULT_PASSWORD });

            if (error) throw error;
            alert(`已將「${target.name}」的密碼重設為預設密碼（${DEFAULT_PASSWORD}），請通知該心理師登入後自行修改。`);
        } catch (error) {
            alert('重設失敗: ' + error.message);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-primary">心理服務人員維護</h3>
                <Button variant="primary" onClick={handleOpenAdd} className="flex items-center gap-1">
                    <Plus className="w-4 h-4" /> 新增心理師
                </Button>
            </div>

            {/* List View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
                            <th className="py-3 px-4">姓名</th>
                            <th className="py-3 px-4">身分別</th>
                            <th className="py-3 px-4">登入密碼</th>
                            <th className="py-3 px-4">聯繫方式</th>
                            <th className="py-3 px-4">狀態</th>
                            <th className="py-3 px-4 text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-700">
                        {loading ? (
                            <tr><td colSpan="5" className="py-8 text-center text-gray-400">載入中...</td></tr>
                        ) : psychologists.length === 0 ? (
                            <tr><td colSpan="5" className="py-8 text-center text-gray-400">目前尚無資料</td></tr>
                        ) : (
                            psychologists.map((p) => (
                                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                    <td className="py-3 px-4 font-medium">{p.name}</td>
                                    <td className="py-3 px-4">
                                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs">
                                            {p.qualification || '未設定'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 font-mono text-sm"><span className="text-gray-400">已加密</span></td>
                                    <td className="py-3 px-4">{p.contact_info || '-'}</td>
                                    <td className="py-3 px-4">
                                        <span className={`px-2 py-1 rounded-full text-xs ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {p.is_active ? '執業中' : '暫停執業'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 flex justify-center gap-3 items-center">
                                        <button
                                            onClick={() => handleOpenEdit(p)}
                                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                            title="編輯"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(p.id)}
                                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                            title="刪除"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {loading ? (
                    <div className="py-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">載入中...</div>
                ) : psychologists.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">目前尚無資料</div>
                ) : (
                    psychologists.map((p) => (
                        <div key={p.id} onClick={() => handleOpenEdit(p)} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm active:scale-[0.98] transition-transform">
                            <div className="flex justify-between items-start mb-2">
                                <div className="min-w-0">
                                    <div className="font-bold text-gray-800 text-lg truncate">{p.name}</div>
                                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg text-xs">
                                        {p.qualification || '未設定'}
                                    </span>
                                </div>
                                <span className={`flex-shrink-0 px-2 py-1 rounded-full text-xs ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {p.is_active ? '執業中' : '暫停執業'}
                                </span>
                            </div>
                            <div className="space-y-1 text-sm text-gray-600">
                                <div><span className="text-gray-400">聯繫方式：</span>{p.contact_info || '-'}</div>
                                <div><span className="text-gray-400">登入密碼：</span><span className="font-mono"><span className="text-gray-400">已加密</span></span></div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-50 flex justify-end gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenEdit(p); }}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="編輯"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="刪除"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 overflow-y-auto p-4 sm:p-10">
                    <div className="bg-white rounded-2xl p-5 sm:p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 mt-4 sm:mt-0 sm:my-auto mb-10 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-primary">
                                {isEditing ? '編輯心理師' : '新增心理師'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">心理師姓名</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">身分別</label>
                                <select
                                    className="w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none bg-white"
                                    value={formData.qualification}
                                    onChange={e => setFormData({ ...formData, qualification: e.target.value })}
                                >
                                    <option value="諮商心理師">諮商心理師</option>
                                    <option value="臨床心理師">臨床心理師</option>
                                    <option value="醫師">醫師</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {isEditing ? '重設密碼 (若不修改請留空)' : '登入密碼'}
                                </label>
                                <input
                                    type="text"
                                    required={!isEditing}
                                    className="w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none font-mono"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    placeholder={isEditing ? '輸入新密碼以重設' : ''}
                                />
                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={() => handleResetToDefault({ id: editingId, name: formData.name })}
                                    className="mt-2 inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-800 hover:underline"
                                >
                                    <KeyRound className="w-4 h-4" /> 一鍵重設為預設密碼（{DEFAULT_PASSWORD}）
                                </button>
                            )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">聯繫方式 (選填)</label>
                                <input
                                    type="text"
                                    className="w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none"
                                    value={formData.contact_info}
                                    placeholder="電話、Email 或其他備註"
                                    onChange={e => setFormData({ ...formData, contact_info: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">執業狀態</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={formData.is_active}
                                            onChange={() => setFormData({ ...formData, is_active: true })}
                                            className="w-5 h-5 sm:w-4 sm:h-4 text-secondary focus:ring-secondary"
                                        />
                                        <span>執業中</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={!formData.is_active}
                                            onChange={() => setFormData({ ...formData, is_active: false })}
                                            className="w-5 h-5 sm:w-4 sm:h-4 text-gray-500 focus:ring-gray-500"
                                        />
                                        <span>暫停執業</span>
                                    </label>
                                </div>
                            </div>

                            <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3">
                                <Button variant="outline" type="button" onClick={() => setShowModal(false)} className="w-full sm:w-auto">取消</Button>
                                <Button variant="primary" type="submit" className="w-full sm:w-auto">
                                    {isEditing ? '儲存變更' : '確認新增'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PsychologistDatabase;
