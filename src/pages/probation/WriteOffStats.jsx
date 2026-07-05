import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { Filter, DollarSign, Clock, FileText, CheckCircle, XCircle, Copy, Check, Download, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getCurrentROCYear, convertDateStringToROC, toROCFullDate } from '../../utils/dateUtils';

const WriteOffStats = () => {
    const [loading, setLoading] = useState(true);
    const [bookings, setBookings] = useState([]);
    const [subTab, setSubTab] = useState('completed'); // 'completed' or 'daily_fee'
    const [copiedId, setCopiedId] = useState(null);

    // Filters
    const currentROCYear = getCurrentROCYear();
    const [year, setYear] = useState(currentROCYear);
    const [month, setMonth] = useState('all'); // 'all' or 1-12
    const [department, setDepartment] = useState('');
    const [psychologistId, setPsychologistId] = useState('');
    const [departments, setDepartments] = useState([]);

    // Dropdown Data
    const [psychologists, setPsychologists] = useState([]);
    // Cache for filtering
    const [juvenileInfoMap, setJuvenileInfoMap] = useState({});
    const [guardianInfoMap, setGuardianInfoMap] = useState({});

    useEffect(() => {
        fetchData();
        fetchDropdowns();
    }, []);

    const fetchDropdowns = async () => {
        try {
            const { data: psychs } = await supabase.from('psychologists').select('id, name').eq('is_active', true);
            setPsychologists(psychs || []);

            // 1. Fetch Officers via RPC
            const { data: officers } = await supabase.rpc('get_admin_view_officers');
            const officerMap = {};
            officers?.forEach(o => officerMap[o.id] = o);

            // 2. Fetch Juveniles (No Join)
            const { data: juvData } = await supabase
                .from('juveniles')
                .select('id, probation_officer_id');

            // 3. Build Info Map manually
            const depts = new Set();
            const infoMap = {};

            juvData?.forEach(j => {
                const po = officerMap[j.probation_officer_id]; // Manual Join
                const dept = po?.department || '';

                infoMap[j.id] = { department: dept };

                if (dept) depts.add(dept);
            });
            setJuvenileInfoMap(infoMap);

            // 4. Fetch Guardians (親職教育資料庫 cases), same shape as Juveniles
            const { data: guardianData } = await supabase
                .from('guardians')
                .select('id, probation_officer_id');

            const guardianMap = {};
            guardianData?.forEach(g => {
                const po = officerMap[g.probation_officer_id];
                const dept = po?.department || '';

                guardianMap[g.id] = { department: dept };

                if (dept) depts.add(dept);
            });
            setGuardianInfoMap(guardianMap);

            setDepartments(Array.from(depts).sort());
        } catch (error) {
            console.error('Error fetching dropdowns:', error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select(`
                    *,
                    juveniles (
                        name,
                        probation_officers (department)
                    ),
                    guardians (
                        name,
                        probation_officers (department)
                    ),
                    psychologists (id, name)
                `);

            if (error) throw error;
            setBookings(data || []);
        } catch (error) {
            console.error('Error fetching write-off data:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- Calculation Helpers ---
    // Same as toROCFullDate, but without zero-padding month/day (e.g. 115年1月1日)
    const toROCFullDateNoPad = (dateOrString) => {
        if (!dateOrString) return '';
        const date = new Date(dateOrString);
        if (isNaN(date.getTime())) return '';
        const rocYear = date.getFullYear() - 1911;
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${rocYear}年${month}月${day}日`;
    };

    // Resolve the linked case for a booking, regardless of whether it's a juvenile or a guardian
    const getCaseDisplay = (b) => {
        const isGuardian = !!b.guardian_id;
        const caseRecord = isGuardian ? b.guardians : b.juveniles;
        return {
            isGuardian,
            name: caseRecord?.name || '-',
            department: caseRecord?.probation_officers?.department || ''
        };
    };

    const getDurationHours = (start, end) => {
        if (!start || !end) return 0;
        const s = new Date(`1970-01-01T${start}`);
        const e = new Date(`1970-01-01T${end}`);
        const diffHours = (e - s) / (1000 * 60 * 60);
        return diffHours > 0 ? Math.ceil(diffHours) : 0;
    };

    const handleCopy = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleExportWord = () => {
        try {
            if (completedEntries.length === 0) {
                alert('目前無完成諮商資料可匯出');
                return;
            }

            let htmlContent = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head>
                    <meta charset='utf-8'>
                    <style>
                        body { font-family: 'BiauKai', 'DFKai-SB', serif; line-height: 1.5; }
                        p { margin-bottom: 0.5em; font-size: 14pt; }
                    </style>
                </head>
                <body>
            `;

            completedEntries.forEach(b => {
                const line = `時間：${toROCFullDateNoPad(b.booking_date)} ${b.start_time?.slice(0, 5)}～${b.end_time?.slice(0, 5)} 個案：${getCaseDisplay(b).name}`;
                htmlContent += `<p>${line}</p>`;
            });

            htmlContent += `</body></html>`;

            const blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');

            link.href = url;
            link.download = `完成諮商細目_${toROCFullDate(new Date())}.doc`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Export failed:', error);
            alert('匯出失敗: ' + error.message);
        }
    };

    // --- Core Logic ---
    // 1. Filter Data
    const filteredBookings = bookings.filter(b => {
        // '諮商提醒' bookings are never counted in write-off calculations
        if (b.status === '諮商提醒') return false;

        const d = new Date(b.booking_date);

        // Year Filter (Compare ROC Year)
        if ((d.getFullYear() - 1911) !== parseInt(year)) return false;

        // Month Filter
        if (month !== 'all' && (d.getMonth() + 1) !== parseInt(month)) return false;

        // Psychologist
        if (psychologistId && b.psychologist_id !== psychologistId) return false;

        // Department (Use Map)
        if (department) {
            const rowDept = getCaseDisplay(b).department || (b.guardian_id ? guardianInfoMap[b.guardian_id]?.department : juvenileInfoMap[b.juvenile_id]?.department);
            if (rowDept !== department) return false;
        }

        return true;
    });

    // 2. Derive Daily Fee Groups
    // Group by `${date}_${psychologist_id}`
    const dailyGroups = {};
    filteredBookings.forEach(b => {
        // We only care about groups for the Daily Fee logic check
        // But we must consider ALL bookings for that day/psych to determine eligibility
        const key = `${b.booking_date}_${b.psychologist_id}`;
        if (!dailyGroups[key]) {
            dailyGroups[key] = {
                date: b.booking_date,
                psychologist: b.psychologists,
                bookings: []
            };
        }
        dailyGroups[key].bookings.push(b);
    });

    // Determine Valid Daily Fee Entries
    const dailyFeeEntries = Object.values(dailyGroups)
        .filter(group => {
            if (group.bookings.length === 0) return false;
            // Condition: All bookings for this psych on this day must be '確認缺席'
            const allConfirmedAbsent = group.bookings.every(b => b.status === '確認缺席');
            return allConfirmedAbsent;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    // 3. Derive Completed Entries (Includes 'Waiting for Report')
    const completedEntries = filteredBookings
        .filter(b => b.status === '完成' || b.status === '等待報告')
        .sort((a, b) => {
            const dateA = new Date(a.booking_date + 'T' + a.start_time);
            const dateB = new Date(b.booking_date + 'T' + b.start_time);
            return dateA - dateB; // Ascending order
        });

    // 4. Calculate Final Stats
    const totalHours = completedEntries.reduce((sum, b) => sum + getDurationHours(b.start_time, b.end_time), 0);
    const hourlyFeeTotal = totalHours * 2000;

    const dailyFeeCount = dailyFeeEntries.length;
    const dailyFeeTotal = dailyFeeCount * 500;

    const grandTotal = hourlyFeeTotal + dailyFeeTotal;

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                <FileText className="w-6 h-6" /> 核銷作業
            </h3>

            {/* Filters */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-gray-700 font-bold mb-2">
                    <Filter className="w-5 h-5" /> 核銷篩選
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Year */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">年度</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                            value={year}
                            onChange={e => setYear(e.target.value)}
                        >
                            {[currentROCYear, currentROCYear - 1, currentROCYear - 2].map(y => (
                                <option key={y} value={y}>{y}年</option>
                            ))}
                        </select>
                    </div>

                    {/* Month */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">月份</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                            value={month}
                            onChange={e => setMonth(e.target.value)}
                        >
                            <option value="all">全年度</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>{m}月</option>
                            ))}
                        </select>
                    </div>

                    {/* Psychologist */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">心理師</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                            value={psychologistId}
                            onChange={e => setPsychologistId(e.target.value)}
                        >
                            <option value="">所有心理師</option>
                            {psychologists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    {/* Department */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">股別</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                            value={department}
                            onChange={e => setDepartment(e.target.value)}
                        >
                            <option value="">所有股別</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* STATS SECTION (TOP) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-xl shadow-sm border border-blue-100">
                    <div className="flex items-center gap-2 text-blue-600 mb-2 font-medium">
                        <DollarSign className="w-5 h-5" /> 經費花費總額
                    </div>
                    <div className="text-3xl font-bold text-gray-800">${grandTotal.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 mt-2">時數費 + 日費</div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 text-gray-500 mb-2 font-medium">
                        <Clock className="w-5 h-5" /> 總時數
                    </div>
                    <div className="text-3xl font-bold text-gray-800">{totalHours} <span className="text-sm font-normal text-gray-500">小時</span></div>
                    <div className="text-xs text-green-600 mt-2 font-medium">+ ${hourlyFeeTotal.toLocaleString()}</div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 text-gray-500 mb-2 font-medium">
                        <DollarSign className="w-5 h-5" /> 總日費
                    </div>
                    <div className="text-3xl font-bold text-gray-800">${dailyFeeTotal.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 mt-2">{dailyFeeCount} 次 x $500</div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 text-gray-500 mb-2 font-medium">
                        <FileText className="w-5 h-5" /> 日費次數
                    </div>
                    <div className="text-3xl font-bold text-gray-800">{dailyFeeCount} <span className="text-sm font-normal text-gray-500">次</span></div>
                    <div className="text-xs text-gray-400 mt-2">全日缺席計 1 次</div>
                </div>
            </div>

            {/* DETAILS SECTION (BOTTOM) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
                <div className="flex flex-wrap border-b border-gray-200 justify-between items-center pr-2">
                    <div className="flex flex-1 min-w-full sm:min-w-0">
                        <button
                            className={`flex-1 py-3 sm:py-4 text-xs sm:text-sm font-medium text-center transition-colors ${subTab === 'completed' ? 'bg-secondary/5 text-secondary border-b-2 border-secondary' : 'text-gray-500 hover:bg-gray-50'}`}
                            onClick={() => setSubTab('completed')}
                        >
                            <CheckCircle className="w-4 h-4 inline-block mr-1 sm:mr-2" />
                            完成諮商細目
                        </button>
                        <button
                            className={`flex-1 py-3 sm:py-4 text-xs sm:text-sm font-medium text-center transition-colors ${subTab === 'daily_fee' ? 'bg-secondary/5 text-secondary border-b-2 border-secondary' : 'text-gray-500 hover:bg-gray-50'}`}
                            onClick={() => setSubTab('daily_fee')}
                        >
                            <XCircle className="w-4 h-4 inline-block mr-1 sm:mr-2" />
                            日費細目 (全日缺席)
                        </button>
                    </div>
                    {subTab === 'completed' && (
                        <button
                            onClick={handleExportWord}
                            className="bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors mx-4 my-1"
                        >
                            <Download className="w-4 h-4" /> 匯出清單
                        </button>
                    )}
                </div>

                <div className="p-0">
                    {subTab === 'completed' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-600 text-sm">
                                    <tr>
                                        <th className="py-3 px-3 sm:px-6">日期時間</th>
                                        <th className="py-3 px-3 sm:px-6">心理師</th>
                                        <th className="py-3 px-3 sm:px-6">個案姓名</th>
                                        <th className="py-3 px-3 sm:px-6 text-right">核銷時數</th>
                                        <th className="py-3 px-3 sm:px-6 text-right">費用 ($2000/hr)</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-700 divide-y divide-gray-100">
                                    {completedEntries.length === 0 ? (
                                        <tr><td colSpan="5" className="py-8 text-center text-gray-400">無資料</td></tr>
                                    ) : (
                                        completedEntries.map(b => {
                                            const hours = getDurationHours(b.start_time, b.end_time);
                                            return (
                                                <tr key={b.id} className="hover:bg-gray-50">
                                                    <td className="py-3 px-3 sm:px-6">
                                                        <div className="font-medium flex items-center gap-2">
                                                            {convertDateStringToROC(b.booking_date)}
                                                            {b.status === '等待報告' && (
                                                                <span className="text-[10px] bg-yellow-100 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded">
                                                                    等待報告
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-500">{b.start_time?.slice(0, 5)} - {b.end_time?.slice(0, 5)}</div>
                                                    </td>
                                                    <td className="py-3 px-3 sm:px-6">{b.psychologists?.name}</td>
                                                    <td className="py-3 px-3 sm:px-6">
                                                        <span className="inline-flex items-center gap-1">
                                                            {getCaseDisplay(b).name}
                                                            {b.guardian_id && <Users className="w-3.5 h-3.5 text-purple-500" title="強制親職教育" />}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 sm:px-6 text-right font-bold">{hours} hr</td>
                                                    <td className="py-3 px-3 sm:px-6 text-right text-primary font-medium">${(hours * 2000).toLocaleString()}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {subTab === 'daily_fee' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-600 text-sm">
                                    <tr>
                                        <th className="py-3 px-3 sm:px-6">日期</th>
                                        <th className="py-3 px-3 sm:px-6">心理師</th>
                                        <th className="py-3 px-3 sm:px-6">缺席個案 (時間: 姓名)</th>
                                        <th className="py-3 px-3 sm:px-6 text-right">日費</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-700 divide-y divide-gray-100">
                                    {dailyFeeEntries.length === 0 ? (
                                        <tr><td colSpan="4" className="py-8 text-center text-gray-400">無資料</td></tr>
                                    ) : (
                                        dailyFeeEntries.map((group, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="py-3 px-3 sm:px-6 font-medium">{convertDateStringToROC(group.date)}</td>
                                                <td className="py-3 px-3 sm:px-6">{group.psychologist?.name}</td>
                                                <td className="py-3 px-3 sm:px-6">
                                                    <div className="space-y-1">
                                                        {group.bookings.map(b => {
                                                            const text = `時間：${toROCFullDateNoPad(b.booking_date)} ${b.start_time?.slice(0, 5)} 個案：${getCaseDisplay(b).name} 未到`;
                                                            return (
                                                                <div key={b.id} className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded w-fit mb-1 flex items-center gap-2 group">
                                                                    <span>{text}</span>
                                                                    <button
                                                                        onClick={() => handleCopy(text, b.id)}
                                                                        className="text-gray-400 hover:text-blue-600 p-0.5 rounded hover:bg-white transition-colors"
                                                                        title="複製"
                                                                    >
                                                                        {copiedId === b.id ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 sm:px-6 text-right text-orange-600 font-bold">$500</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {loading && <div className="text-center py-10 text-gray-500">載入資料中...</div>}
        </div>
    );
};

export default WriteOffStats;
