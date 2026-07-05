import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { Filter, DollarSign, Clock, Users, FileText, PieChart, BarChart } from 'lucide-react';
import { getCurrentROCYear, convertDateStringToROC } from '../../utils/dateUtils';
import MultiSelectFilter from '../../components/MultiSelectFilter';

const CASE_STAT_TYPES = [
    { key: 'total', label: '總數' },
    { key: 'juvenile', label: '少年數' },
    { key: 'guardian', label: '家長數' }
];

const ManagerStats = () => {
    const [loading, setLoading] = useState(true);
    const [bookings, setBookings] = useState([]);
    const [juvenilesList, setJuvenilesList] = useState([]);
    const [guardiansList, setGuardiansList] = useState([]);

    // Filters
    const currentROCYear = getCurrentROCYear();
    const [year, setYear] = useState([currentROCYear]);
    const [month, setMonth] = useState([]); // [] means all months
    const [department, setDepartment] = useState([]);
    const [departments, setDepartments] = useState([]);

    // Distribution table view toggles
    const [deptStatType, setDeptStatType] = useState('total');
    const [psychStatType, setPsychStatType] = useState('total');

    // Stats State
    const [stats, setStats] = useState({
        totalSpending: 0,
        totalAttendees: 0,
        totalHours: 0,
        dailyFeeCount: 0,
        dailyFeeTotal: 0,
        deptCounts: { total: {}, juvenile: {}, guardian: {} },
        psychCounts: { total: {}, juvenile: {}, guardian: {} }
    });

    useEffect(() => {
        fetchData();
        fetchDropdowns();
    }, []);

    const fetchDropdowns = async () => {
        try {
            // Fetch Officers via RPC
            const { data: officers } = await supabase.rpc('get_admin_view_officers');
            const depts = new Set();
            officers?.forEach(o => {
                if (o.department) depts.add(o.department);
            });
            setDepartments(Array.from(depts).sort());
        } catch (error) {
            console.error('Error fetching dropdowns:', error);
        }
    };

    useEffect(() => {
        calculateStats();
    }, [bookings, juvenilesList, guardiansList, year, month, department]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: bookingsData, error: bookingsError } = await supabase
                .from('bookings')
                .select(`
                    *,
                    juveniles (
                        id,
                        name,
                        probation_officers (
                            department
                        )
                    ),
                    psychologists (
                        id, 
                        name
                    )
                `);

            // 1. Fetch Officers via RPC (for manual join)
            const { data: officers } = await supabase.rpc('get_admin_view_officers');
            const officerMap = {};
            officers?.forEach(o => officerMap[o.id] = o);

            // 2. Fetch Juveniles (No Join)
            const { data: juvData, error: juvError } = await supabase
                .from('juveniles')
                .select(`
                    id,
                    status,
                    probation_officer_id,
                    psychologists (name)
                `)
                .eq('status', '服務中');

            // 2b. Fetch Guardians (親職教育資料庫 cases), same shape as Juveniles
            const { data: guardianData, error: guardianError } = await supabase
                .from('guardians')
                .select(`
                    id,
                    status,
                    probation_officer_id,
                    psychologists (name)
                `)
                .eq('status', '服務中');

            if (bookingsError) throw bookingsError;
            if (juvError) throw juvError;
            if (guardianError) throw guardianError;

            setBookings(bookingsData || []);

            // 3. Manually attach probation_officers info to juvenilesList / guardiansList
            const safeJuvList = juvData?.map(j => ({
                ...j,
                probation_officers: officerMap[j.probation_officer_id] || {}
            })) || [];

            const safeGuardianList = guardianData?.map(g => ({
                ...g,
                probation_officers: officerMap[g.probation_officer_id] || {}
            })) || [];

            setJuvenilesList(safeJuvList);
            setGuardiansList(safeGuardianList);
        } catch (error) {
            console.error('Error fetching manager stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const getDurationHours = (start, end) => {
        if (!start || !end) return 0;
        const s = new Date(`1970-01-01T${start}`);
        const e = new Date(`1970-01-01T${end}`);
        const diffHours = (e - s) / (1000 * 60 * 60);
        return diffHours > 0 ? Math.ceil(diffHours) : 0;
    };

    const calculateStats = () => {
        // 0. Pre-process juvenile info map for filtering
        const infoMap = {};
        juvenilesList.forEach(j => {
            const dept = j.probation_officers?.department || '';
            infoMap[j.id] = { department: dept };
        });

        // 1. Filter Data
        const filtered = bookings.filter(b => {
            const d = new Date(b.booking_date);
            // Year Filter (Compare ROC Year)
            if (year.length > 0 && !year.includes(d.getFullYear() - 1911)) return false;
            // Month Filter
            if (month.length > 0 && !month.includes(d.getMonth() + 1)) return false;
            // Department Filter (Use Map)
            if (department.length > 0) {
                const rowDept = infoMap[b.juvenile_id]?.department;
                if (!department.includes(rowDept)) return false;
            }
            return true;
        });

        // 2. Metrics: Attendees (Total Completed Bookings) & Hours
        const completed = filtered.filter(b => b.status === '完成');
        const totalAttendees = completed.length;
        const totalHours = completed.reduce((sum, b) => sum + getDurationHours(b.start_time, b.end_time), 0);
        const hourlyFeeTotal = totalHours * 2000;

        // 3. Metrics: Daily Fees
        // Group by date_psych
        const dailyGroups = {};
        filtered.forEach(b => {
            const key = `${b.booking_date}_${b.psychologist_id}`;
            if (!dailyGroups[key]) dailyGroups[key] = [];
            dailyGroups[key].push(b);
        });

        const dailyFeeEntries = Object.values(dailyGroups).filter(group => {
            if (group.length === 0) return false;
            return group.every(b => b.status === '確認缺席');
        });

        const dailyFeeCount = dailyFeeEntries.length;
        const dailyFeeTotal = dailyFeeCount * 500;

        // 4. Total Spending
        const totalSpending = hourlyFeeTotal + dailyFeeTotal;

        // 5. Distributions (Active Case Load from Juveniles + Guardians Tables)
        const deptMapJuvenile = {};
        const psychMapJuvenile = {};
        const deptMapGuardian = {};
        const psychMapGuardian = {};

        juvenilesList.forEach(j => {
            // Apply Department Filter to Distribution Stats too
            if (department.length > 0 && !department.includes(j.probation_officers?.department)) return;

            const dept = j.probation_officers?.department || '未分配';
            const psychName = j.psychologists?.name || '未分配';

            deptMapJuvenile[dept] = (deptMapJuvenile[dept] || 0) + 1;
            psychMapJuvenile[psychName] = (psychMapJuvenile[psychName] || 0) + 1;
        });

        guardiansList.forEach(g => {
            if (department.length > 0 && !department.includes(g.probation_officers?.department)) return;

            const dept = g.probation_officers?.department || '未分配';
            const psychName = g.psychologists?.name || '未分配';

            deptMapGuardian[dept] = (deptMapGuardian[dept] || 0) + 1;
            psychMapGuardian[psychName] = (psychMapGuardian[psychName] || 0) + 1;
        });

        const mergeCounts = (...maps) => {
            const merged = {};
            maps.forEach(map => {
                Object.entries(map).forEach(([key, count]) => {
                    merged[key] = (merged[key] || 0) + count;
                });
            });
            return merged;
        };

        setStats({
            totalSpending,
            totalAttendees,
            totalHours,
            dailyFeeCount,
            dailyFeeTotal,
            deptCounts: {
                total: mergeCounts(deptMapJuvenile, deptMapGuardian),
                juvenile: deptMapJuvenile,
                guardian: deptMapGuardian
            },
            psychCounts: {
                total: mergeCounts(psychMapJuvenile, psychMapGuardian),
                juvenile: psychMapJuvenile,
                guardian: psychMapGuardian
            }
        });
    };

    return (
        <div className="space-y-6">

            {/* Filters */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 text-gray-700 font-bold mb-4">
                    <Filter className="w-5 h-5" /> 統計篩選
                </div>
                <div className="flex gap-4">
                    <div className="w-40">
                        <label className="block text-sm font-medium text-gray-700 mb-1">年度</label>
                        <MultiSelectFilter
                            label="所有年度"
                            options={[currentROCYear, currentROCYear - 1, currentROCYear - 2].map(y => ({ value: y, label: `${y}年` }))}
                            selected={year}
                            onChange={setYear}
                        />
                    </div>
                    <div className="w-40">
                        <label className="block text-sm font-medium text-gray-700 mb-1">月份</label>
                        <MultiSelectFilter
                            label="所有月份"
                            options={Array.from({ length: 12 }, (_, i) => i + 1).map(m => ({ value: m, label: `${m}月` }))}
                            selected={month}
                            onChange={setMonth}
                        />
                    </div>
                    <div className="w-40">
                        <label className="block text-sm font-medium text-gray-700 mb-1">股別</label>
                        <MultiSelectFilter
                            label="所有股別"
                            options={departments.map(d => ({ value: d, label: d }))}
                            selected={department}
                            onChange={setDepartment}
                        />
                    </div>
                </div>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign className="w-16 h-16 text-blue-600" />
                    </div>
                    <div className="text-gray-500 text-sm font-medium mb-1">經費花費總額</div>
                    <div className="text-2xl font-bold text-blue-600">${stats.totalSpending.toLocaleString()}</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-gray-500 text-sm font-medium mb-1">總人次</div>
                    <div className="text-2xl font-bold text-gray-800">{stats.totalAttendees} <span className="text-xs font-normal text-gray-400">人次</span></div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-gray-500 text-sm font-medium mb-1">總時數</div>
                    <div className="text-2xl font-bold text-gray-800">{stats.totalHours} <span className="text-xs font-normal text-gray-400">小時</span></div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-gray-500 text-sm font-medium mb-1">日費次數</div>
                    <div className="text-2xl font-bold text-gray-800">{stats.dailyFeeCount} <span className="text-xs font-normal text-gray-400">次</span></div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-gray-500 text-sm font-medium mb-1">總日費</div>
                    <div className="text-2xl font-bold text-orange-600">${stats.dailyFeeTotal.toLocaleString()}</div>
                </div>
            </div>

            {/* Distribution Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Dept Stats */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <PieChart className="w-5 h-5 text-gray-600" />
                            <h3 className="font-bold text-gray-800">各股別個案數 (不重複)</h3>
                        </div>
                        <div className="flex gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200 w-fit">
                            {CASE_STAT_TYPES.map(opt => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => setDeptStatType(opt.key)}
                                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${deptStatType === opt.key ? 'bg-secondary text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-600 text-sm">
                                <tr>
                                    <th className="py-3 px-4">股別</th>
                                    <th className="py-3 px-4 text-right">{CASE_STAT_TYPES.find(o => o.key === deptStatType)?.label} (人)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {Object.keys(stats.deptCounts[deptStatType]).length === 0 ? (
                                    <tr><td colSpan="2" className="py-8 text-center text-gray-400">無資料</td></tr>
                                ) : (
                                    Object.entries(stats.deptCounts[deptStatType]).map(([dept, count]) => (
                                        <tr key={dept} className="hover:bg-gray-50">
                                            <td className="py-3 px-4 font-medium">{dept}</td>
                                            <td className="py-3 px-4 text-right font-bold text-primary">{count}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Psych Stats */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-gray-600" />
                            <h3 className="font-bold text-gray-800">各心理師個案數 (不重複)</h3>
                        </div>
                        <div className="flex gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200 w-fit">
                            {CASE_STAT_TYPES.map(opt => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => setPsychStatType(opt.key)}
                                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${psychStatType === opt.key ? 'bg-secondary text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-600 text-sm">
                                <tr>
                                    <th className="py-3 px-4">心理師</th>
                                    <th className="py-3 px-4 text-right">{CASE_STAT_TYPES.find(o => o.key === psychStatType)?.label} (人)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {Object.keys(stats.psychCounts[psychStatType]).length === 0 ? (
                                    <tr><td colSpan="2" className="py-8 text-center text-gray-400">無資料</td></tr>
                                ) : (
                                    Object.entries(stats.psychCounts[psychStatType]).map(([name, count]) => (
                                        <tr key={name} className="hover:bg-gray-50">
                                            <td className="py-3 px-4 font-medium">{name}</td>
                                            <td className="py-3 px-4 text-right font-bold text-primary">{count}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {loading && <div className="text-center py-10 text-gray-500">載入資料中...</div>}
        </div>
    );
};

export default ManagerStats;
