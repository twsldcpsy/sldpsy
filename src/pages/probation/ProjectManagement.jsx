import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import { Plus, X, Edit, Users, Trash2 } from 'lucide-react';
import { PROJECT_ROLE_LABEL } from '../../utils/projectUtils';

const ROLE_LABEL = PROJECT_ROLE_LABEL;
const inputCls = 'w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none';

// 系統管理者專用：專案清單、新增／編輯／停用，以及專案成員（專案管理者、專案成員）指派
const ProjectManagement = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    // 專案新增／編輯視窗
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ name: '', description: '', is_active: true });

    // 成員視窗
    const [memberProject, setMemberProject] = useState(null);
    const [members, setMembers] = useState([]);
    const [officers, setOfficers] = useState([]);
    const [addOfficerId, setAddOfficerId] = useState('');
    const [addRole, setAddRole] = useState('member');

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('project_list');
            if (error) throw error;
            setProjects(data || []);
        } catch (error) {
            console.error('Error fetching projects:', error);
            alert('載入專案失敗: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const openAdd = () => {
        setEditingId(null);
        setForm({ name: '', description: '', is_active: true });
        setShowForm(true);
    };

    const openEdit = (p) => {
        setEditingId(p.id);
        setForm({ name: p.name, description: p.description || '', is_active: p.is_active });
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                const { error } = await supabase.rpc('project_update', {
                    p_id: editingId,
                    p_name: form.name,
                    p_description: form.description,
                    p_is_active: form.is_active
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.rpc('project_create', {
                    p_name: form.name,
                    p_description: form.description
                });
                if (error) throw error;
            }
            setShowForm(false);
            fetchProjects();
        } catch (error) {
            alert((editingId ? '更新失敗: ' : '新增失敗: ') + error.message);
        }
    };

    const toggleActive = async (p) => {
        const next = !p.is_active;
        if (!window.confirm(next ? `確定要重新啟用「${p.name}」嗎？` : `確定要停用「${p.name}」嗎？停用後成員指派會保留。`)) return;
        try {
            const { error } = await supabase.rpc('project_update', {
                p_id: p.id,
                p_name: p.name,
                p_description: p.description || '',
                p_is_active: next
            });
            if (error) throw error;
            fetchProjects();
        } catch (error) {
            alert('更新失敗: ' + error.message);
        }
    };

    const loadMembers = async (projectId) => {
        const { data, error } = await supabase.rpc('project_members_list', { p_project_id: projectId });
        if (error) throw error;
        setMembers(data || []);
    };

    const openMembers = async (p) => {
        try {
            setMemberProject(p);
            setMembers([]);
            setAddOfficerId('');
            setAddRole('member');
            const [, officersRes] = await Promise.all([
                loadMembers(p.id),
                supabase.rpc('get_admin_view_officers')
            ]);
            if (officersRes.error) throw officersRes.error;
            setOfficers(officersRes.data || []);
        } catch (error) {
            alert('載入成員失敗: ' + error.message);
            setMemberProject(null);
        }
    };

    const closeMembers = () => {
        setMemberProject(null);
        fetchProjects();
    };

    const setMember = async (officerId, role) => {
        try {
            const { error } = await supabase.rpc('project_member_set', {
                p_project_id: memberProject.id,
                p_officer_id: officerId,
                p_role: role
            });
            if (error) throw error;
            await loadMembers(memberProject.id);
        } catch (error) {
            alert('更新成員失敗: ' + error.message);
        }
    };

    const handleAddMember = async () => {
        if (!addOfficerId) return;
        await setMember(addOfficerId, addRole);
        setAddOfficerId('');
    };

    const removeMember = async (m) => {
        if (!window.confirm(`確定要將「${m.name}」從專案移除嗎？`)) return;
        try {
            const { error } = await supabase.rpc('project_member_remove', {
                p_project_id: memberProject.id,
                p_officer_id: m.officer_id
            });
            if (error) throw error;
            await loadMembers(memberProject.id);
        } catch (error) {
            alert('移除失敗: ' + error.message);
        }
    };

    const memberIds = new Set(members.map(m => m.officer_id));
    const candidates = officers.filter(o => !memberIds.has(o.id));

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-primary">專案管理</h3>
                <Button variant="primary" onClick={openAdd} className="flex items-center gap-1">
                    <Plus className="w-4 h-4" /> 新增專案
                </Button>
            </div>

            {loading ? (
                <div className="py-8 text-center text-gray-400">載入中...</div>
            ) : projects.length === 0 ? (
                <div className="py-8 text-center text-gray-400">目前尚無專案</div>
            ) : (
                <div className="space-y-3">
                    {projects.map(p => (
                        <div key={p.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="flex flex-wrap justify-between items-start gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-800 text-lg">{p.name}</span>
                                        <span className={`px-2 py-0.5 rounded-lg text-xs ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {p.is_active ? '啟用中' : '已停用'}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-500 mt-1">{p.description || '（無說明）'}</div>
                                    <div className="text-xs text-gray-400 mt-1">成員 {p.member_count} 人</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => openMembers(p)} className="px-3 py-1.5 text-sm rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center gap-1" title="成員管理">
                                        <Users className="w-4 h-4" /> 成員
                                    </button>
                                    <button onClick={() => openEdit(p)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="編輯">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => toggleActive(p)} className="px-3 py-1.5 text-sm rounded-lg text-amber-700 hover:bg-amber-50">
                                        {p.is_active ? '停用' : '啟用'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 專案新增／編輯視窗 */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 overflow-y-auto p-4 sm:p-10">
                    <div className="bg-white rounded-2xl p-5 sm:p-8 w-full max-w-lg shadow-2xl mt-4 sm:mt-0 sm:my-auto mb-10">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-primary">{editingId ? '編輯專案' : '新增專案'}</h3>
                            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">專案名稱</label>
                                <input type="text" required className={inputCls} value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">說明</label>
                                <textarea rows={3} className={inputCls} value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })} />
                            </div>
                            {editingId && (
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                    <input type="checkbox" checked={form.is_active}
                                        onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                                    啟用中
                                </label>
                            )}
                            <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3">
                                <Button variant="outline" type="button" onClick={() => setShowForm(false)} className="w-full sm:w-auto">取消</Button>
                                <Button variant="primary" type="submit" className="w-full sm:w-auto">{editingId ? '儲存變更' : '確認新增'}</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 成員管理視窗 */}
            {memberProject && (
                <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 overflow-y-auto p-4 sm:p-10">
                    <div className="bg-white rounded-2xl p-5 sm:p-8 w-full max-w-2xl shadow-2xl mt-4 sm:mt-0 sm:my-auto mb-10">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-primary">成員管理：{memberProject.name}</h3>
                            <button onClick={closeMembers} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 mb-6">
                            <select className={`${inputCls} bg-white`} value={addOfficerId} onChange={e => setAddOfficerId(e.target.value)}>
                                <option value="">選擇要加入的工作人員</option>
                                {candidates.map(o => (
                                    <option key={o.id} value={o.id}>{o.department || '-'}｜{o.name}（{o.staff_type || '保護官'}）</option>
                                ))}
                            </select>
                            <select className={`${inputCls} bg-white sm:w-40`} value={addRole} onChange={e => setAddRole(e.target.value)}>
                                <option value="member">{ROLE_LABEL.member}</option>
                                <option value="manager">{ROLE_LABEL.manager}</option>
                            </select>
                            <Button variant="primary" type="button" onClick={handleAddMember} disabled={!addOfficerId} className="whitespace-nowrap">加入</Button>
                        </div>

                        {members.length === 0 ? (
                            <div className="py-6 text-center text-gray-400">此專案尚無成員</div>
                        ) : (
                            <div className="space-y-2">
                                {members.map(m => (
                                    <div key={m.officer_id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-gray-100">
                                        <div>
                                            <div className="font-medium text-gray-800">{m.name}</div>
                                            <div className="text-xs text-gray-500">{m.department || '-'}｜{m.staff_type || '保護官'}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select className="p-2 text-sm border border-gray-300 rounded-lg bg-white" value={m.project_role}
                                                onChange={e => setMember(m.officer_id, e.target.value)}>
                                                <option value="member">{ROLE_LABEL.member}</option>
                                                <option value="manager">{ROLE_LABEL.manager}</option>
                                            </select>
                                            <button onClick={() => removeMember(m)} className="p-2 text-gray-400 hover:text-red-600 transition-colors" title="移除">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectManagement;
