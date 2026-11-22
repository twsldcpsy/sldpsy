import React from 'react';
import { createPortal } from 'react-dom';
import { toROCDate } from '../../utils/dateUtils';
import { displayValue } from '../../utils/reviewFormUtils';

const Cell = ({ label, value }) => (
    <div className="flex border-b border-gray-300 last:border-b-0">
        <div className="w-28 shrink-0 bg-gray-50 px-3 py-2 text-sm text-gray-600 border-r border-gray-300">{label}</div>
        <div className="flex-1 px-3 py-2 text-sm text-gray-900 whitespace-pre-wrap">{value || '　'}</div>
    </div>
);

// 考核表的列印內容。payload = ex_review_get 的回傳（或預覽用的假資料）。
export const ReviewSheet = ({ payload }) => {
    const form = payload.form || { fields: [], print: {} };
    const print = form.print || {};
    const data = payload.data || {};
    const s = payload.session || {};
    const y = payload.youth || {};

    return (
        <div className="bg-white text-black p-8" style={{ fontFamily: 'inherit' }}>
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold">{print.title || '考核表'}</h1>
                {print.subtitle && <div className="text-sm text-gray-600 mt-1">{print.subtitle}</div>}
            </div>

            {print.show_session !== false && (
                <div className="border border-gray-300 mb-4">
                    <Cell label="活動場次" value={`${s.year ?? ''} 年度 第 ${s.session_no ?? ''} 場`} />
                    <Cell label="日期" value={s.session_date ? toROCDate(s.session_date) : ''} />
                    <Cell label="課程主題" value={s.topic} />
                    <Cell label="運動項目" value={s.sport} />
                    <Cell label="場地" value={s.venue} />
                </div>
            )}

            {print.show_youth !== false && (
                <div className="border border-gray-300 mb-4">
                    <Cell label="少年姓名" value={y.name} />
                    <Cell label="案號／編號" value={y.case_number} />
                    <Cell label="填寫人員" value={payload.filler_name} />
                    <Cell label="出席狀態" value={payload.attendance} />
                </div>
            )}

            <div className="border border-gray-300 mb-6">
                {(form.fields || []).map(f => (
                    f.type === 'section' ? (
                        <div key={f.id} className="bg-gray-100 px-3 py-2 text-sm font-bold border-b border-gray-300">{f.label}</div>
                    ) : (
                        <Cell key={f.id} label={f.label} value={displayValue(f, data[f.id])} />
                    )
                ))}
                {(form.fields || []).length === 0 && <div className="px-3 py-6 text-center text-sm text-gray-400">（尚未設定欄位）</div>}
            </div>

            {(print.signatures || []).length > 0 && (
                <div className="flex gap-4 mt-10">
                    {print.signatures.map((label, i) => (
                        <div key={i} className="flex-1 border border-gray-400">
                            <div className="text-center text-sm bg-gray-50 border-b border-gray-400 py-1">{label}</div>
                            <div className="h-20" />
                        </div>
                    ))}
                </div>
            )}

            {print.footer && <div className="text-xs text-gray-600 mt-6 whitespace-pre-wrap">{print.footer}</div>}
            {payload.stamped_at && <div className="text-xs text-gray-400 mt-4 text-right">核章日期：{toROCDate(payload.stamped_at)}</div>}
        </div>
    );
};

// 螢幕上的預覽視窗；同時用 portal 在 body 放一份只在列印時出現的內容，並自動開啟列印
const ExReviewPrint = ({ payload, onClose, autoPrint = true, notice = '' }) => {
    React.useEffect(() => {
        if (!autoPrint) return undefined;
        const t = setTimeout(() => window.print(), 400);
        return () => clearTimeout(t);
    }, [autoPrint]);

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-[70] overflow-y-auto p-4 sm:p-10 no-print">
                <div className="bg-gray-100 rounded-2xl w-full max-w-3xl mx-auto shadow-2xl mb-10">
                    <div className="flex flex-wrap justify-between items-center gap-3 p-4 border-b border-gray-200 bg-white rounded-t-2xl">
                        <div className="font-bold text-primary">列印預覽{notice && <span className="ml-3 text-xs font-normal text-green-600">{notice}</span>}</div>
                        <div className="flex gap-2">
                            <button onClick={() => window.print()} className="px-3 py-1.5 text-sm rounded-lg bg-secondary text-white">列印／另存 PDF</button>
                            <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600">關閉</button>
                        </div>
                    </div>
                    <div className="p-4"><ReviewSheet payload={payload} /></div>
                </div>
            </div>
            {createPortal(<div className="print-area print-only"><ReviewSheet payload={payload} /></div>, document.body)}
        </>
    );
};

export default ExReviewPrint;
