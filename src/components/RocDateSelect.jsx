import React, { useState } from 'react';
import { getCurrentROCYear } from '../utils/dateUtils';

const selCls = 'p-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-secondary/20 outline-none';

// 以民國年顯示的日期選擇（民國年／月／日三個下拉）。value 與 onChange 都是西元 'YYYY-MM-DD'（未選完整則為空字串）。
const RocDateSelect = ({ value, onChange, onIncomplete, yearsBack = 40 }) => {
    const initial = (() => {
        if (!value) return { y: '', m: '', d: '' };
        const [yy, mm, dd] = String(value).slice(0, 10).split('-').map(Number);
        return { y: yy - 1911, m: mm, d: dd };
    })();
    const [parts, setParts] = useState(initial);

    const cur = getCurrentROCYear();
    const years = Array.from({ length: yearsBack + 1 }, (_, i) => cur - i);
    const maxDay = parts.y && parts.m ? new Date(Number(parts.y) + 1911, Number(parts.m), 0).getDate() : 31;
    const days = Array.from({ length: maxDay }, (_, i) => i + 1);

    const update = (patch) => {
        const next = { ...parts, ...patch };
        // 月份天數較少時，自動修正日
        if (next.y && next.m && next.d) {
            const md = new Date(Number(next.y) + 1911, Number(next.m), 0).getDate();
            if (Number(next.d) > md) next.d = md;
        }
        setParts(next);
        if (next.y && next.m && next.d) {
            const pad = (n) => String(n).padStart(2, '0');
            onChange(`${Number(next.y) + 1911}-${pad(next.m)}-${pad(next.d)}`);
        } else {
            onChange('');
        }
        // 只選了一部分：通知外層（外層可據此阻擋儲存，避免悄悄清掉原本的日期）
        if (onIncomplete) onIncomplete(!!(next.y || next.m || next.d) && !(next.y && next.m && next.d));
    };

    return (
        <div className="flex items-center gap-2">
            <select className={`${selCls} flex-1`} value={parts.y} onChange={e => update({ y: e.target.value ? Number(e.target.value) : '' })} aria-label="民國年">
                <option value="">民國年</option>
                {years.map(y => <option key={y} value={y}>民國 {y} 年</option>)}
            </select>
            <select className={`${selCls} w-24`} value={parts.m} onChange={e => update({ m: e.target.value ? Number(e.target.value) : '' })} aria-label="月">
                <option value="">月</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m} 月</option>)}
            </select>
            <select className={`${selCls} w-24`} value={parts.d} onChange={e => update({ d: e.target.value ? Number(e.target.value) : '' })} aria-label="日">
                <option value="">日</option>
                {days.map(d => <option key={d} value={d}>{d} 日</option>)}
            </select>
        </div>
    );
};

export default RocDateSelect;
