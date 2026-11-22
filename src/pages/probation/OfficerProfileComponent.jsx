import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import { User, Save, Lock, Phone, Hash } from 'lucide-react';

const OfficerProfileComponent = ({ officerId }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        department: '',
        role: '',
        contact_info: '',
        extension_number: ''
    });

    // Password Change State
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [passwordData, setPasswordData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        if (officerId) {
            fetchOfficerData();
        }
    }, [officerId]);

    const fetchOfficerData = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('probation_officers')
                .select('name, department, role, contact_info, extension_number') // Don't fetch password
                .eq('id', officerId)
                .single();

            if (error) throw error;

            if (data) {
                setFormData({
                    name: data.name,
                    department: data.department,
                    role: data.role,
                    contact_info: data.contact_info || '',
                    extension_number: data.extension_number || ''
                });
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            alert('無法載入個人資料');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            // 1. Update Profile
            const { error } = await supabase
                .from('probation_officers')
                .update({
                    name: formData.name,
                    contact_info: formData.contact_info,
                    extension_number: formData.extension_number
                })
                .eq('id', officerId);

            if (error) throw error;

            // 2. Handle Password Change
            if (showPasswordChange) {
                if (passwordData.newPassword !== passwordData.confirmPassword) {
                    alert('新密碼與確認密碼不符');
                    return;
                }

                const { data: success, error: pwdError } = await supabase
                    .rpc('change_own_password_officer', {
                        old_password: passwordData.oldPassword,
                        new_password: passwordData.newPassword,
                        o_id: officerId
                    });

                if (pwdError) throw pwdError;
                if (!success) {
                    alert('舊密碼錯誤，密碼變更失敗');
                    return;
                }
            }

            alert('個人資料更新成功！');
            // Clear passwords after successful change
            if (showPasswordChange) {
                setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
                setShowPasswordChange(false);
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('更新失敗: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">載入中...</div>;

    return (
        <div className="max-w-2xl mx-auto bg-white p-5 sm:p-8 rounded-xl shadow-sm border border-gray-100 mt-4">
            <h3 className="text-xl font-bold text-primary mb-6 flex items-center gap-2">
                <User className="w-5 h-5" /> 個人資料維護
            </h3>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Read-Only Fields */}
                    <div className="bg-gray-50 p-4 rounded-lg md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">所屬股別</label>
                            <div className="font-bold text-gray-800">{formData.department}</div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">系統權限</label>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium
                                    ${formData.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                        formData.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                                    {formData.role === 'admin' ? '系統管理者' : formData.role === 'manager' ? '審閱者' : '一般權限'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Editable Fields */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                        <div className="relative">
                            <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                required
                                className="w-full pl-9 pr-3 py-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">分機號碼</label>
                        <div className="relative">
                            <Hash className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                className="w-full pl-9 pr-3 py-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                value={formData.extension_number}
                                onChange={e => setFormData({ ...formData, extension_number: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">聯繫方式</label>
                        <div className="relative">
                            <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                className="w-full pl-9 pr-3 py-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                value={formData.contact_info}
                                onChange={e => setFormData({ ...formData, contact_info: e.target.value })}
                            />
                            <p className="text-xs text-gray-500 mt-1 ml-1">歡迎填寫LINE ID或連結，供心理師或醫師聯繫討論！</p>
                        </div>
                    </div>

                    {/* Password Change Section */}
                    <div className="md:col-span-2 border-t border-gray-100 pt-4">
                        <div className="flex items-center gap-2 mb-4">
                            <input
                                type="checkbox"
                                id="changeOfficerPwd"
                                checked={showPasswordChange}
                                onChange={e => setShowPasswordChange(e.target.checked)}
                                className="w-5 h-5 sm:w-4 sm:h-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <label htmlFor="changeOfficerPwd" class="text-sm font-medium text-gray-700 cursor-pointer select-none">
                                變更登入密碼
                            </label>
                        </div>

                        {showPasswordChange && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">舊密碼</label>
                                    <div className="relative">
                                        <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2" />
                                        <input
                                            type="password"
                                            required={showPasswordChange}
                                            className="w-full pl-9 pr-3 py-2.5 sm:py-1.5 text-base sm:text-sm border border-gray-300 rounded bg-white"
                                            value={passwordData.oldPassword}
                                            onChange={e => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">新密碼</label>
                                    <div className="relative">
                                        <Lock className="w-4 h-4 text-blue-400 absolute left-3 top-2" />
                                        <input
                                            type="password"
                                            required={showPasswordChange}
                                            className="w-full pl-9 pr-3 py-2.5 sm:py-1.5 text-base sm:text-sm border border-blue-200 rounded bg-blue-50/20 focus:border-blue-400 outline-none"
                                            value={passwordData.newPassword}
                                            onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">確認新密碼</label>
                                    <div className="relative">
                                        <Lock className="w-4 h-4 text-blue-400 absolute left-3 top-2" />
                                        <input
                                            type="password"
                                            required={showPasswordChange}
                                            className="w-full pl-9 pr-3 py-2.5 sm:py-1.5 text-base sm:text-sm border border-blue-200 rounded bg-blue-50/20 focus:border-blue-400 outline-none"
                                            value={passwordData.confirmPassword}
                                            onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <Button variant="primary" type="submit" disabled={saving} className="min-w-[120px] w-full sm:w-auto">
                        {saving ? '儲存中...' : '儲存變更'}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default OfficerProfileComponent;
