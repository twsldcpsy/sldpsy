import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import ProjectIntroView from './ProjectIntroView';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { toROCDate } from '../../utils/dateUtils';

const PROJECT_KEY = 'exercise_addiction';
const inputCls = 'w-full p-3 sm:p-2 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none';

const EMPTY = {
    intro_name: '', intro_text: '', organizer: '', goals: '', audience: '', sports: '', format: '',
    cycle: '', planned_sessions: '', referral: '', notes: '', contact_name: '', contact_phone: '',
    show_upcoming: true, custom: []
};

const Section = ({ title, children }) => (
    <div className="bg-white p-5 rounded-xl border border-gray-100">
        <h4 className="font-bold text-primary mb-3">{title}</h4>
        <div className="space-y-3">{children}</div>
    </div>
);

const Text = ({ label, value, onChange, rows = 0 }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {rows > 0
            ? <textarea rows={rows} className={inputCls} value={value} onChange={e => onChange(e.target.value)} />
            : <input type="text" className={inputCls} value={value} onChange={e => onChange(e.target.value)} />}
    </div>
);

// 運動戒癮團體專案：團體頁面維護（專案管理者與專案成員可編輯草稿；僅專案管理者／系統管理者可發布）
const ExGroupPageManagement = ({ canPublish }) => {
    const [form, setForm] = useState(EMPTY);
    const [status, setStatus] = useState({ is_published: false, published_at: null, has_unpublished_changes: false });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [preview, setPreview] = useState(false);

    const load = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('project_page_get', { p_key: PROJECT_KEY });
            if (error) throw error;
            setForm({ ...EMPTY, ...(data.draft || {}), custom: data.draft?.custom || [] });
            setStatus(data);
        } catch (error) {
            console.error('Error loading page:', error);
            alert('載入失敗: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const set = (patch) => setForm(prev => ({ ...prev, ...patch }));

    const saveDraft = async () => {
        const { error } = await supabase.rpc('project_page_save_draft', { p_key: PROJECT_KEY, p_content: form });
        if (error) throw error;
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await saveDraft();
            await load();
            alert('草稿已儲存');
        } catch (error) {
            alert('儲存失敗: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!window.confirm('確定要發布嗎？發布後保護官即可在「普通權限」看到這份介紹。')) return;
        try {
            setSaving(true);
            await saveDraft();
            const { error } = await supabase.rpc('project_page_publish', { p_key: PROJECT_KEY });
            if (error) throw error;
            await load();
            alert('已發布');
        } catch (error) {
            alert('發布失敗: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleUnpublish = async () => {
        if (!window.confirm('確定要取消發布嗎？保護官將看不到這份介紹，草稿會保留。')) return;
        try {
            setSaving(true);
            const { error } = await supabase.rpc('project_page_unpublish', { p_key: PROJECT_KEY });
            if (error) throw error;
            await load();
        } catch (error) {
            alert('取消發布失敗: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const addCustom = () => set({ custom: [...form.custom, { id: `c${Date.now()}`, title: '', body: '' }] });
    const updateCustom = (i, patch) => set({ custom: form.custom.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) });
    const removeCustom = (i) => set({ custom: form.custom.filter((_, idx) => idx !== i) });
    const moveCustom = (i, dir) => {
        const j = i + dir;
        if (j < 0 || j >= form.custom.length) return;
        const next = [...form.custom];
        [next[i], next[j]] = [next[j], next[i]];
        set({ custom: next });
    };

    if (loading) return <div className="py-8 text-center text-gray-400">載入中...</div>;

    const statusLabel = !status.is_published ? '尚未發布' : (status.has_unpublished_changes ? '已發布（有未發布的修改）' : '已發布');
    const statusStyle = !status.is_published ? 'bg-gray-100 text-gray-600' : (status.has_unpublished_changes ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700');

    return (
        <div>
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-primary">團體頁面維護</h3>
                    <span className={`px-2 py-1 rounded-lg text-xs ${statusStyle}`}>{statusLabel}</span>
                    {status.published_at && <span className="text-xs text-gray-400">發布於 {toROCDate(status.published_at)}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setPreview(!preview)}>{preview ? '回到編輯' : '預覽'}</Button>
                    <Button variant="outline" onClick={handleSave} disabled={saving}>儲存草稿</Button>
                    {canPublish && <Button variant="primary" onClick={handlePublish} disabled={saving}>發布</Button>}
                    {canPublish && status.is_published && <Button variant="outline" onClick={handleUnpublish} disabled={saving}>取消發布</Button>}
                </div>
            </div>
            {!canPublish && (
                <p className="text-xs text-gray-400 mb-4">專案成員可編輯並儲存草稿，發布需由專案管理者操作。</p>
            )}

            {preview ? (
                <ProjectIntroView data={{ name: '運動戒癮團體專案', content: form, published_at: null, upcoming: [] }} preview />
            ) : (
                <div className="space-y-4">
                    <Section title="團體簡介">
                        <Text label="團體名稱" value={form.intro_name} onChange={v => set({ intro_name: v })} />
                        <Text label="簡介說明" rows={4} value={form.intro_text} onChange={v => set({ intro_text: v })} />
                        <Text label="辦理單位" value={form.organizer} onChange={v => set({ organizer: v })} />
                    </Section>
                    <Section title="目標與對象">
                        <Text label="目標" rows={3} value={form.goals} onChange={v => set({ goals: v })} />
                        <Text label="適合對象" rows={3} value={form.audience} onChange={v => set({ audience: v })} />
                    </Section>
                    <Section title="課程內容">
                        <Text label="運動項目" rows={2} value={form.sports} onChange={v => set({ sports: v })} />
                        <Text label="進行方式" rows={3} value={form.format} onChange={v => set({ format: v })} />
                    </Section>
                    <Section title="時程">
                        <Text label="週期" value={form.cycle} onChange={v => set({ cycle: v })} />
                        <Text label="預計場次" value={form.planned_sessions} onChange={v => set({ planned_sessions: v })} />
                    </Section>
                    <Section title="轉介與參與方式">
                        <Text label="說明" rows={4} value={form.referral} onChange={v => set({ referral: v })} />
                    </Section>
                    <Section title="注意事項">
                        <Text label="說明" rows={4} value={form.notes} onChange={v => set({ notes: v })} />
                    </Section>
                    <Section title="聯繫窗口">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Text label="姓名" value={form.contact_name} onChange={v => set({ contact_name: v })} />
                            <Text label="電話／分機" value={form.contact_phone} onChange={v => set({ contact_phone: v })} />
                        </div>
                    </Section>
                    <Section title="近期活動">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input type="checkbox" checked={form.show_upcoming} onChange={e => set({ show_upcoming: e.target.checked })} />
                            在介紹頁自動顯示近期活動（只含日期、主題、運動項目、場地、狀態；不含少年與人員資料）
                        </label>
                    </Section>
                    <Section title="自訂章節">
                        {form.custom.length === 0 && <div className="text-sm text-gray-400">尚無自訂章節</div>}
                        {form.custom.map((x, i) => (
                            <div key={x.id} className="p-3 rounded-lg border border-gray-100 bg-gray-50 space-y-2">
                                <div className="flex gap-2">
                                    <input type="text" className={inputCls} placeholder="章節標題" value={x.title}
                                        onChange={e => updateCustom(i, { title: e.target.value })} />
                                    <button onClick={() => moveCustom(i, -1)} disabled={i === 0} className="p-2 text-gray-400 hover:text-primary disabled:opacity-30" title="上移"><ArrowUp className="w-4 h-4" /></button>
                                    <button onClick={() => moveCustom(i, 1)} disabled={i === form.custom.length - 1} className="p-2 text-gray-400 hover:text-primary disabled:opacity-30" title="下移"><ArrowDown className="w-4 h-4" /></button>
                                    <button onClick={() => removeCustom(i)} className="p-2 text-gray-400 hover:text-red-600" title="刪除章節"><Trash2 className="w-4 h-4" /></button>
                                </div>
                                <textarea rows={4} className={inputCls} placeholder="內文" value={x.body}
                                    onChange={e => updateCustom(i, { body: e.target.value })} />
                            </div>
                        ))}
                        <Button variant="outline" onClick={addCustom} className="flex items-center gap-1"><Plus className="w-4 h-4" /> 新增自訂章節</Button>
                    </Section>
                </div>
            )}
        </div>
    );
};

export default ExGroupPageManagement;
