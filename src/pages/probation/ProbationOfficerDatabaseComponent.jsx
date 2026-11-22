import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import { Plus, X, Trash2, Edit } from 'lucide-react';

const ProbationOfficerDatabase = () => {
    const [officers, setOfficers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Form Data
    const [formData, setFormData] = useState({
        name: '',
        department: '',
        role: 'general',
        password: '',
        contact_info: '',
        extension_number: '',
        display_order: 0
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            // RPC should return display_order now
            const { data, error } = await supabase
                .rpc('get_admin_view_officers');

            if (error) throw error;
            setOfficers(data);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAdd = () => {
        setIsEditing(false);
        setEditingId(null);
        setFormData({
            name: '',
            department: '',
            role: 'general',
            password: '28312321',
            contact_info: '',
            extension_number: '',
            display_order: 0
        });
        setShowModal(true);
    };

    const handleOpenEdit = (officer) => {
        setIsEditing(true);
        setEditingId(officer.id);
        const currentDepartment = officer.department || (officer.departments && officer.departments.name) || '';

        setFormData({
            name: officer.name,
            department: currentDepartment,
            role: officer.role || 'general',
            password: '', // Hidden/Empty by default
            contact_info: officer.contact_info || '',
            extension_number: officer.extension_number || '',
            display_order: officer.display_order || 0
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                // Update basic info via RPC
                const { error: updateError } = await supabase
                    .rpc('admin_update_officer', {
                        target_id: editingId,
                        o_name: formData.name,
                        o_department: formData.department,
                        o_role: formData.role,
                        o_contact_info: formData.contact_info,
                        o_extension_number: formData.extension_number,
                        o_display_order: parseInt(formData.display_order) || 0
                    });

                if (updateError) throw updateError;

                // Handle Password Reset if provided
                if (formData.password) {
                    const { error: pwdError } = await supabase
                        .rpc('admin_reset_password_officer', {
                            target_id: editingId,
                            new_password: formData.password
                        });
                    if (pwdError) throw pwdError;
                }
            } else {
                // Insert New User via RPC
                const { error: insertError } = await supabase
                    .rpc('admin_create_officer', {
                        o_name: formData.name,
                        o_department: formData.department,
                        o_role: formData.role,
                        o_password: formData.password || '28312321',
                        o_contact_info: formData.contact_info,
                        o_extension_number: formData.extension_number,
                        o_display_order: parseInt(formData.display_order) || 0
                    });

                if (insertError) throw insertError;
            }

            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error('Update failed:', error);
            alert(isEditing ? '更新失敗: ' + error.message : '新增失敗: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('確定要刪除此保護官資料嗎？')) return;

        try {
            const { error } = await supabase
                .rpc('admin_delete_officer', { target_id: id });

            if (error) throw error;
            fetchData();
        } catch (error) {
            alert('刪除失敗: ' + error.message);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-primary">保護官資料庫</h3>
                <Button variant="primary" onClick={handleOpenAdd} className="flex items-center gap-1">
                    <Plus className="w-4 h-4" /> 新增保護官
                </Button>
            </div>

            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
                            <th className="py-3 px-4 w-20">排序</th>
                            <th className="py-3 px-4">股別</th>
                            <th className="py-3 px-4">保護官姓名</th>
                            <th className="py-3 px-4">權限別</th>
                            <th className="py-3 px-4">登入密碼</th>
                            <th className="py-3 px-4">聯繫方式</th>
                            <th className="py-3 px-4">分機號碼</th>
                            <th className="py-3 px-4 text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-700">
                        {loading ? (
                            <tr><td colSpan="8" className="py-8 text-center text-gray-400">載入中...</td></tr>
                        ) : officers.length === 0 ? (
                            <tr><td colSpan="8" className="py-8 text-center text-gray-400">目前尚無資料</td></tr>
                        ) : (
                            officers.map((o) => (
                                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                    <td className="py-3 px-4 text-gray-400 font-mono">{o.display_order ?? 0}</td>
                                    <td className="py-3 px-4 font-bold text-primary">{o.department || '-'}</td>
                                    <td className="py-3 px-4 font-medium">{o.name}</td>
                                    <td className="py-3 px-4">
                                        <span className={`px-2 py-1 rounded-lg text-xs 
                                            ${o.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                                o.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {o.role === 'admin' ? '系統管理員' : o.role === 'manager' ? '管理員' : '一般權限'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 font-mono text-sm"><span className="text-gray-400">已加密</span></td>
                                    <td className="py-3 px-4">{o.contact_info || '-'}</td>
                                    <td className="py-3 px-4">{o.extension_number || '-'}</td>
                                    <td className="py-3 px-4 flex justify-center gap-2">
                                        <button
                                            onClick={() => handleOpenEdit(o)}
                                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                            title="編輯"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(o.id)}
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
                ) : officers.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">目前尚無資料</div>
                ) : (
                    officers.map((o) => (
                        <div key={o.id} onClick={() => handleOpenEdit(o)} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm active:scale-[0.98] transition-transform">
                            <div className="flex justify-between items-start mb-2">
                                <div className="min-w-0">
                                    <div className="font-bold text-gray-800 text-lg truncate">{o.name}</div>
                                    <div className="text-xs text-primary font-medium">{o.department || '-'}</div>
                                </div>
                                <span className={`flex-shrink-0 px-2 py-1 rounded-lg text-xs
                                    ${o.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                        o.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {o.role === 'admin' ? '系統管理員' : o.role === 'manager' ? '管理員' : '一般權限'}
                                </span>
                            </div>
                            <div className="space-y-1 text-sm text-gray-600">
                                <div><span className="text-gray-400">聯繫方式：</span>{o.contact_info || '-'}</div>
                                <div><span className="text-gray-400">分機號碼：</span>{o.extension_number || '-'}</div>
                                <div><span className="text-gray-400">登入密碼：</span><span className="font-mono"><span className="text-gray-400">已加密</span></span></div>
                                <div><span className="text-gray-400">排序：</span><span className="font-mono">{o.display_order ?? 0}</span></div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-50 flex justify-end gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenEdit(o); }}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="編輯"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(o.id); }}
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
                    <div className="bg-white rounded-2xl p-5 sm:p-8 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 mt-4 sm:mt-0 sm:my-auto mb-10 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-primary">
                                {isEditing ? '編輯保護官資料' : '新增保護官資料'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">排序 (數字越小越前)</label>
                                    <input
                                        type="number"
                                        className="w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none"
                                        value={formData.display_order}
                                        onChange={e => setFormData({ ...formData, display_order: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">股別 (手動輸入)</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="例如：忠股"
                                        className="w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-blue-200 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none bg-blue-50/50"
                                        value={formData.department}
                                        onChange={e => setFormData({ ...formData, department: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">保護官姓名</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">權限別</label>
                                <select
                                    required
                                    className="w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none bg-white"
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="general">一般權限</option>
                                    <option value="manager">管理員</option>
                                    <option value="admin">系統管理員</option>
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
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">聯繫方式</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none"
                                        value={formData.contact_info}
                                        onChange={e => setFormData({ ...formData, contact_info: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">分機號碼</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none"
                                        value={formData.extension_number}
                                        onChange={e => setFormData({ ...formData, extension_number: e.target.value })}
                                    />
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
                </div >
            )}
        </div >
    );
};

export default ProbationOfficerDatabase;
