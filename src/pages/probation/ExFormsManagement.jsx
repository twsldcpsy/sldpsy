import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import ExReviewPrint from './ExReviewPrint';
import { Plus, Trash2, ArrowUp, ArrowDown, X } from 'lucide-react';
import { toROCDate } from '../../utils/dateUtils';
import { FIELD_TYPES, DEFAULT_PRINT, newField } from '../../utils/reviewFormUtils';

const inputCls = 'w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none';

// 運動戒癮團體專案：表單維護（考核表的欄位與匯出列印樣式）。專案成員、專案管理者與系統管理者皆可維護。
// 每次儲存若有變更就產生新版本；已填寫的資料永遠對應當時的版本。
const ExFormsManagement = () => {
    const [fields, setFields] = useState([]);
    const [print, setPrint] = useState(DEFAULT_PRINT);
    const [meta, setMeta] = useState(null);       // 目前版本資訊
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const load = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('ex_form_get');
            if (error) throw error;
            if (data) {
                setFields(data.fields || []);
                setPrint({ ...DEFAULT_PRINT, ...(data.print || {}) });
                setMeta({ version: data.version, created_at: data.created_at });
            } else {
                setMeta(null);
            }
        } catch (error) {
            console.error('Error loading form:', error);
            alert('載入失敗: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const patchField = (i, patch) => setFields(prev => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
    const removeField = (i) => setFields(prev => prev.filter((_, idx) => idx !== i));
    const moveField = (i, dir) => {
        const j = i + dir;
        if (j < 0 || j >= fields.length) return;
        setFields(prev => {
            const next = [...prev];
            [next[i], next[j]] = [next[j], next[i]];
            return next;
        });
    };
    const changeType = (i, type) => {
        const f = fields[i];
        const needsOptions = type === 'select' || type === 'checkbox';
        patchField(i, { type, options: needsOptions ? (f.options?.length ? f.options : ['選項一', '選項二']) : [] });
    };

    const handleSave = async () => {
        if (!window.confirm('儲存後會產生新版本，之後新填寫的考核表使用新版本；已填寫的資料保留當時的欄位與樣式。確定儲存？')) return;
        try {
            setSaving(true);
            const cleaned = fields.map(f => ({
                id: f.id, type: f.type, label: (f.label || '').trim(), required: !!f.required && f.type !== 'section',
                options: (f.options || []).map(o => o.trim()).filter(Boolean), scale_max: Number(f.scale_max) || 5
            }));
            const cleanedPrint = {
                ...print,
                signatures: (print.signatures || []).map(x => x.trim()).filter(Boolean)
            };
            const { error } = await supabase.rpc('ex_form_save', { p_fields: cleaned, p_print: cleanedPrint });
            if (error) throw error;
            await load();
            alert('已儲存');
        } catch (error) {
            alert('儲存失敗: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const sample = {
        session: { year: 115, session_no: 1, session_date: new Date().toISOString().slice(0, 10), topic: '（範例主題）', sport: '（範例運動）', venue: '（範例場地）' },
        youth: { name: '（範例少年）' },
        filler_name: '（範例填寫人員）', attendance: '出席',
        form: { fields, print }, data: {}
    };

    if (loading) return <div className="py-8 text-center text-gray-400">載入中...</div>;

    return (
        <div>
            <div className="flex flex-wrap justify-between items-center gap-3 mb-2">
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-primary">表單維護</h3>
                    {meta ? <span className="px-2 py-1 rounded-lg text-xs bg-indigo-100 text-indigo-700">目前版本 v{meta.version}</span>
                        : <span className="px-2 py-1 rounded-lg text-xs bg-gray-100 text-gray-600">尚未建立</span>}
                    {meta && <span className="text-xs text-gray-400">更新於 {toROCDate(meta.created_at)}</span>}
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowPreview(true)}>預覽列印樣式</Button>
                    <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? '儲存中...' : '儲存（產生新版本）'}</Button>
                </div>
            </div>
            <p className="text-xs text-gray-400 mb-5">這裡設定活動課程中「考核表」的欄位與匯出列印的樣式。已填寫的考核表保留當時的欄位與樣式，不受後續修改影響。</p>

            <div className="space-y-4">
                <div className="bg-white p-5 rounded-xl border border-gray-100">
                    <h4 className="font-bold text-primary mb-3">考核表欄位</h4>
                    <div className="space-y-3">
                        {fields.length === 0 && <div className="text-sm text-gray-400">尚無欄位，請按下方「新增欄位」。</div>}
                        {fields.map((f, i) => (
                            <div key={f.id} className="p-3 rounded-lg border border-gray-100 bg-gray-50 space-y-2">
                                <div className="flex flex-wrap gap-2 items-center">
                                    <select className={`${inputCls} bg-white sm:w-44`} value={f.type} onChange={e => changeType(i, e.target.value)}>
                                        {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                    <input type="text" className={`${inputCls} flex-1 min-w-[160px]`} placeholder={f.type === 'section' ? '分段標題' : '欄位名稱'}
                                        value={f.label} onChange={e => patchField(i, { label: e.target.value })} />
                                    {f.type !== 'section' && (
                                        <label className="flex items-center gap-1 text-sm text-gray-600 whitespace-nowrap">
                                            <input type="checkbox" checked={!!f.required} onChange={e => patchField(i, { required: e.target.checked })} /> 必填
                                        </label>
                                    )}
                                    <button onClick={() => moveField(i, -1)} disabled={i === 0} className="p-2 text-gray-400 hover:text-primary disabled:opacity-30" title="上移"><ArrowUp className="w-4 h-4" /></button>
                                    <button onClick={() => moveField(i, 1)} disabled={i === fields.length - 1} className="p-2 text-gray-400 hover:text-primary disabled:opacity-30" title="下移"><ArrowDown className="w-4 h-4" /></button>
                                    <button onClick={() => removeField(i)} className="p-2 text-gray-400 hover:text-red-600" title="刪除欄位"><Trash2 className="w-4 h-4" /></button>
                                </div>
                                {(f.type === 'select' || f.type === 'checkbox') && (
                                    <div className="space-y-2">
                                        <label className="block text-xs text-gray-500">
                                            選項（{f.type === 'select' ? '單選：填寫時一次只能選一個' : '多選：填寫時可複選'}）
                                        </label>
                                        {(f.options || []).map((o, oi) => (
                                            <div key={oi} className="flex items-center gap-2">
                                                <span className="text-gray-400 w-5 text-center select-none" aria-hidden="true">{f.type === 'select' ? '○' : '☐'}</span>
                                                <input type="text" className={inputCls} placeholder={`選項 ${oi + 1}`} value={o}
                                                    onChange={e => patchField(i, { options: f.options.map((x, xi) => (xi === oi ? e.target.value : x)) })} />
                                                <button type="button" onClick={() => patchField(i, { options: f.options.filter((_, xi) => xi !== oi) })}
                                                    className="p-1.5 text-gray-300 hover:text-red-600" title="刪除選項"><X className="w-4 h-4" /></button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => patchField(i, { options: [...(f.options || []), ''] })}
                                            className="flex items-center gap-1 text-sm text-primary hover:underline">
                                            <Plus className="w-4 h-4" /> 新增選項
                                        </button>
                                    </div>
                                )}
                                {f.type === 'scale' && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        評分範圍 1 到
                                        <select className="p-2 border border-gray-300 rounded-lg bg-white" value={f.scale_max || 5}
                                            onChange={e => patchField(i, { scale_max: Number(e.target.value) })}>
                                            {[3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                        ))}
                        <Button variant="outline" onClick={() => setFields(prev => [...prev, newField('text')])} className="flex items-center gap-1">
                            <Plus className="w-4 h-4" /> 新增欄位
                        </Button>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-100">
                    <h4 className="font-bold text-primary mb-3">匯出列印樣式</h4>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">標題</label>
                            <input type="text" className={inputCls} value={print.title || ''} onChange={e => setPrint({ ...print, title: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">副標題（選填）</label>
                            <input type="text" className={inputCls} value={print.subtitle || ''} onChange={e => setPrint({ ...print, subtitle: e.target.value })} />
                        </div>
                        <div className="flex flex-wrap gap-5 text-sm text-gray-700">
                            <label className="flex items-center gap-2"><input type="checkbox" checked={print.show_session !== false} onChange={e => setPrint({ ...print, show_session: e.target.checked })} /> 列印活動場次資訊（年度、場次、日期、主題、運動項目、場地）</label>
                            <label className="flex items-center gap-2"><input type="checkbox" checked={print.show_youth !== false} onChange={e => setPrint({ ...print, show_youth: e.target.checked })} /> 列印少年資訊（姓名、填寫人員、出席狀態）</label>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">核章欄位（一行一個，留空則不印）</label>
                            <textarea rows={3} className={inputCls} value={(print.signatures || []).join('\n')}
                                onChange={e => setPrint({ ...print, signatures: e.target.value.split('\n') })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">頁尾說明（選填）</label>
                            <textarea rows={2} className={inputCls} value={print.footer || ''} onChange={e => setPrint({ ...print, footer: e.target.value })} />
                        </div>
                    </div>
                </div>
            </div>

            {showPreview && <ExReviewPrint payload={sample} autoPrint={false} onClose={() => setShowPreview(false)} notice="（範例資料，未填寫內容）" />}
        </div>
    );
};

export default ExFormsManagement;
