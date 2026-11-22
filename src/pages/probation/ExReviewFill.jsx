import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import { X } from 'lucide-react';

const inputCls = 'w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none disabled:bg-gray-100';

// 考核表填寫視窗（依表單維護設定的欄位顯示）
const ExReviewFill = ({ sessionId, participantId, onClose, onSaved }) => {
    const [payload, setPayload] = useState(null);
    const [values, setValues] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const { data, error } = await supabase.rpc('ex_review_get', { p_session_id: sessionId, p_participant_id: participantId });
                if (error) throw error;
                setPayload(data);
                setValues(data.data || {});
            } catch (error) {
                alert('載入失敗: ' + error.message);
                onClose();
            } finally {
                setLoading(false);
            }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, participantId]);

    const set = (id, v) => setValues(prev => ({ ...prev, [id]: v }));

    const handleSave = async () => {
        try {
            setSaving(true);
            const { error } = await supabase.rpc('ex_review_save', { p_session_id: sessionId, p_participant_id: participantId, p_data: values });
            if (error) throw error;
            onSaved && onSaved();
            onClose();
        } catch (error) {
            alert('儲存失敗: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const canFill = payload?.can_fill;
    const fields = payload?.form?.fields || [];

    const renderField = (f) => {
        const v = values[f.id];
        const disabled = !canFill;
        if (f.type === 'section') return <h4 key={f.id} className="font-bold text-primary border-l-4 border-secondary pl-3 pt-2">{f.label}</h4>;
        return (
            <div key={f.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}{f.required && <span className="text-red-500 ml-1">*</span>}</label>
                {f.type === 'text' && <input type="text" className={inputCls} disabled={disabled} value={v ?? ''} onChange={e => set(f.id, e.target.value)} />}
                {f.type === 'textarea' && <textarea rows={4} className={inputCls} disabled={disabled} value={v ?? ''} onChange={e => set(f.id, e.target.value)} />}
                {f.type === 'number' && <input type="number" className={inputCls} disabled={disabled} value={v ?? ''} onChange={e => set(f.id, e.target.value === '' ? '' : Number(e.target.value))} />}
                {f.type === 'select' && (
                    <select className={`${inputCls} bg-white`} disabled={disabled} value={v ?? ''} onChange={e => set(f.id, e.target.value)}>
                        <option value="">請選擇</option>
                        {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                )}
                {f.type === 'checkbox' && (
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                        {(f.options || []).map(o => (
                            <label key={o} className="flex items-center gap-2 text-sm text-gray-700">
                                <input type="checkbox" disabled={disabled} checked={Array.isArray(v) && v.includes(o)}
                                    onChange={e => set(f.id, e.target.checked ? [...(Array.isArray(v) ? v : []), o] : (Array.isArray(v) ? v : []).filter(x => x !== o))} />
                                {o}
                            </label>
                        ))}
                    </div>
                )}
                {f.type === 'scale' && (
                    <div className="flex flex-wrap gap-2">
                        {Array.from({ length: f.scale_max || 5 }, (_, i) => i + 1).map(n => (
                            <button key={n} type="button" disabled={disabled} onClick={() => set(f.id, v === n ? '' : n)}
                                className={`w-10 h-10 rounded-lg border text-sm ${v === n ? 'bg-secondary text-white border-secondary' : 'bg-white text-gray-700 border-gray-300'} disabled:opacity-60`}>
                                {n}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-[65] overflow-y-auto p-4 sm:p-10">
            <div className="bg-white rounded-2xl p-5 sm:p-8 w-full max-w-2xl shadow-2xl mt-4 sm:mt-0 sm:my-auto mb-10 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-primary">考核表填寫</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
                </div>
                {loading ? (
                    <div className="py-8 text-center text-gray-400">載入中...</div>
                ) : !payload?.form ? (
                    <div className="py-8 text-center text-gray-500">尚未設定考核表，請專案管理者先到「表單維護」設定欄位。</div>
                ) : (
                    <>
                        <div className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-lg">
                            {payload.session.year} 年度第 {payload.session.session_no} 場｜少年：<b>{payload.youth.name}</b>｜出席狀態：{payload.attendance}｜
                            填寫人員：{payload.filler_name || '未分配'}｜考核狀態：{payload.review_status}
                        </div>
                        {!canFill && (
                            <p className="text-xs text-amber-600 mb-3">
                                {payload.review_status === '已核章' ? '此考核表已核章，不可修改（需先將考核狀態改回）。' : '只有被分配的填寫人員或專案管理者可以填寫，您目前為唯讀。'}
                            </p>
                        )}
                        <div className="space-y-4">
                            {fields.length === 0 ? <div className="text-gray-400 text-sm">此考核表尚無欄位</div> : fields.map(renderField)}
                        </div>
                        <div className="pt-6 flex justify-end gap-3">
                            <Button variant="outline" type="button" onClick={onClose}>關閉</Button>
                            {canFill && <Button variant="primary" type="button" onClick={handleSave} disabled={saving}>{saving ? '儲存中...' : '儲存考核表'}</Button>}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ExReviewFill;
