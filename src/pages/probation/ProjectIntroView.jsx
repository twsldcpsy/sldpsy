import React from 'react';
import { Printer } from 'lucide-react';
import { toROCDate } from '../../utils/dateUtils';

const Block = ({ title, children }) => (
    <section className="mb-6">
        <h4 className="text-lg font-bold text-primary border-l-4 border-secondary pl-3 mb-2">{title}</h4>
        {children}
    </section>
);

const Field = ({ label, value }) => (value ? (
    <div className="mb-2">
        {label && <div className="text-xs text-gray-400 mb-0.5">{label}</div>}
        <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">{value}</div>
    </div>
) : null);

const has = (...vals) => vals.some(v => v && String(v).trim() !== '');

// 專案介紹頁（一頁式的計畫書／介紹）：保護官閱讀與管理端預覽共用。
// data = { name, content, published_at, upcoming }；preview 為 true 時顯示預覽提示。
const ProjectIntroView = ({ data, preview = false }) => {
    if (!data) return null;
    const c = data.content || {};
    const upcoming = data.upcoming || [];
    const custom = (c.custom || []).filter(x => has(x.title, x.body));

    return (
        <div className="print-area bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
                <div>
                    <h3 className="text-2xl font-bold text-primary">{c.intro_name || data.name}</h3>
                    {data.published_at && (
                        <div className="text-xs text-gray-400 mt-1">最後更新：{toROCDate(data.published_at)}</div>
                    )}
                    {preview && <div className="text-xs text-amber-600 mt-1">預覽（草稿內容，尚未發布）</div>}
                </div>
                <button onClick={() => window.print()} className="no-print px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                    <Printer className="w-4 h-4" /> 列印／另存 PDF
                </button>
            </div>

            {has(c.intro_text, c.organizer) && (
                <Block title="團體簡介">
                    <Field value={c.intro_text} />
                    <Field label="辦理單位" value={c.organizer} />
                </Block>
            )}
            {has(c.goals, c.audience) && (
                <Block title="目標與對象">
                    <Field label="目標" value={c.goals} />
                    <Field label="適合對象" value={c.audience} />
                </Block>
            )}
            {has(c.sports, c.format) && (
                <Block title="課程內容">
                    <Field label="運動項目" value={c.sports} />
                    <Field label="進行方式" value={c.format} />
                </Block>
            )}
            {has(c.cycle, c.planned_sessions) && (
                <Block title="時程">
                    <Field label="週期" value={c.cycle} />
                    <Field label="預計場次" value={c.planned_sessions} />
                </Block>
            )}
            {has(c.referral) && (
                <Block title="轉介與參與方式"><Field value={c.referral} /></Block>
            )}
            {has(c.notes) && (
                <Block title="注意事項"><Field value={c.notes} /></Block>
            )}
            {has(c.contact_name, c.contact_phone) && (
                <Block title="聯繫窗口">
                    <Field label="姓名" value={c.contact_name} />
                    <Field label="電話／分機" value={c.contact_phone} />
                </Block>
            )}

            {c.show_upcoming && (
                <Block title="近期活動">
                    {preview ? (
                        <div className="text-sm text-gray-400">發布後會自動帶入尚未到期的活動（日期、主題、運動項目、場地、狀態）。</div>
                    ) : upcoming.length === 0 ? (
                        <div className="text-sm text-gray-400">目前沒有已排定的活動</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
                                        <th className="py-2 px-3">日期</th>
                                        <th className="py-2 px-3">主題</th>
                                        <th className="py-2 px-3">運動項目</th>
                                        <th className="py-2 px-3">場地</th>
                                        <th className="py-2 px-3">狀態</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-700">
                                    {upcoming.map((s, i) => (
                                        <tr key={`${s.year}-${s.session_no}-${i}`} className="border-b border-gray-50">
                                            <td className="py-2 px-3 whitespace-nowrap">{toROCDate(s.session_date)}</td>
                                            <td className="py-2 px-3">{s.topic || '-'}</td>
                                            <td className="py-2 px-3">{s.sport || '-'}</td>
                                            <td className="py-2 px-3">{s.venue || '-'}</td>
                                            <td className="py-2 px-3">{s.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Block>
            )}

            {custom.map((x, i) => (
                <Block key={x.id || i} title={x.title || '（未命名）'}><Field value={x.body} /></Block>
            ))}
        </div>
    );
};

export default ProjectIntroView;
