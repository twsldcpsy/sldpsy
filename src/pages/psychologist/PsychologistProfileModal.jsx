import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import { X, User } from 'lucide-react';

const PsychologistProfileModal = ({ psychologistId, onClose, onUpdate }) => {
    const [formData, setFormData] = useState({
        name: '',
        qualification: '諮商心理師',
        contact_info: ''
    });

    // Password Change State
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [passwordData, setPasswordData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProfile();
    }, [psychologistId]);

    const fetchProfile = async () => {
        try {
            // Use RPC to bypass RLS for "anon" user (Custom Auth)
            const { data, error } = await supabase
                .rpc('get_psychologist_profile_self', { p_id: psychologistId })
                .single();

            if (error) throw error;
            if (data) {
                setFormData({
                    name: data.name,
                    qualification: data.qualification || '諮商心理師',
                    contact_info: data.contact_info || ''
                });
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            // alert('無法載入個人資料'); // Silent fail or toast in future
        } finally {
            setLoading(false);
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        try {
            // 1. Update Profile Info via RPC
            const { error: updateError } = await supabase
                .rpc('update_psychologist_profile_self', {
                    p_id: psychologistId,
                    p_name: formData.name,
                    p_qualification: formData.qualification,
                    p_contact_info: formData.contact_info
                });

            if (updateError) throw updateError;

            // 2. Handle Password Change (if requested)
            if (showPasswordChange) {
                if (passwordData.newPassword !== passwordData.confirmPassword) {
                    alert('新密碼與確認密碼不符');
                    return;
                }

                const { data: success, error: pwdError } = await supabase
                    .rpc('change_own_password_psychologist', {
                        old_password: passwordData.oldPassword,
                        new_password: passwordData.newPassword,
                        p_id: psychologistId
                    });

                if (pwdError) throw pwdError;
                if (!success) {
                    alert('舊密碼錯誤，密碼變更失敗');
                    return;
                }
            }

            alert('資料更新成功！');
            if (onUpdate) onUpdate(formData.name);
            onClose();
        } catch (error) {
            console.error('Update error:', error);
            alert('更新失敗: ' + error.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4 sm:p-10 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-5 sm:p-8 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                    <div className="bg-blue-100 p-2 rounded-full">
                        <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">個人資料維護</h3>
                        <p className="text-sm text-gray-500">修改您的基本資料與登入密碼</p>
                    </div>
                </div>

                {loading ? (
                    <div className="py-10 text-center text-gray-500">載入中...</div>
                ) : (
                    <form onSubmit={handleProfileUpdate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                            <input
                                type="text"
                                required
                                className="w-full p-3 sm:p-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">身分別</label>
                            <select
                                className="w-full p-3 sm:p-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white transition-all"
                                value={formData.qualification}
                                onChange={e => setFormData({ ...formData, qualification: e.target.value })}
                            >
                                <option value="諮商心理師">諮商心理師</option>
                                <option value="臨床心理師">臨床心理師</option>
                                <option value="醫師">醫師</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">聯繫方式 (選填)</label>
                            <input
                                type="text"
                                className="w-full p-3 sm:p-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                value={formData.contact_info}
                                placeholder="電話、Email 或其他備註"
                                onChange={e => setFormData({ ...formData, contact_info: e.target.value })}
                            />
                            <p className="text-xs text-gray-500 mt-1">歡迎填寫LINE ID或連結，供保護官聯繫討論！</p>
                        </div>

                        {/* Password Change Section */}
                        <div className="border-t border-gray-100 pt-4 mt-4">
                            <div className="flex items-center gap-2 mb-4">
                                <input
                                    type="checkbox"
                                    id="changePwd"
                                    checked={showPasswordChange}
                                    onChange={e => setShowPasswordChange(e.target.checked)}
                                    className="w-5 h-5 sm:w-4 sm:h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <label htmlFor="changePwd" class="text-sm font-medium text-gray-700 cursor-pointer select-none">
                                    變更登入密碼
                                </label>
                            </div>

                            {showPasswordChange && (
                                <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">舊密碼</label>
                                        <input
                                            type="password"
                                            required={showPasswordChange}
                                            className="w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded bg-white"
                                            value={passwordData.oldPassword}
                                            onChange={e => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">新密碼</label>
                                        <input
                                            type="password"
                                            required={showPasswordChange}
                                            className="w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-blue-200 rounded bg-blue-50/20 focus:border-blue-400 outline-none"
                                            value={passwordData.newPassword}
                                            onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">確認新密碼</label>
                                        <input
                                            type="password"
                                            required={showPasswordChange}
                                            className="w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-blue-200 rounded bg-blue-50/20 focus:border-blue-400 outline-none"
                                            value={passwordData.confirmPassword}
                                            onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        />
                                    </div>
                                    <p className="text-xs text-red-500 mt-1">請設定您容易記住的密碼，並定期更換！</p>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3">
                            <Button variant="outline" type="button" onClick={onClose} className="w-full sm:w-auto">取消</Button>
                            <Button variant="primary" type="submit" className="w-full sm:w-auto">儲存變更</Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default PsychologistProfileModal;
