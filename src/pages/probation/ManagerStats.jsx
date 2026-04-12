import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { Filter, DollarSign, Clock, Users, FileText, PieChart, BarChart } from 'lucide-react';
import { getCurrentROCYear, convertDateStringToROC } from '../../utils/dateUtils';

const ManagerStats = () => {
    const [loading, setLoading] = useState(true);
    const [bookings, setBookings] = useState([]);
    const [juvenilesList, setJuvenilesList] = useState([]);

    // Filters
    const currentROCYear = getCurrentROCYear();
    const [year, setYear] = useState(currentROCYear);
    const [month, setMonth] = useState('all'); // 'all' or 1-12
    const [department, setDepartment] = useState('');
    const [departments, setDepartments] = useState([]);

    // Stats State
    const [stats, setStats] = useState({
        totalSpending: 0,
        totalAttendees: 0,
        totalHours: 0,
        dailyFeeCount: 0,
        dailyFeeTotal: 0,
        deptCounts: {},
        psychCounts: {}
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
    }, [bookings, juvenilesList, year, month, department]);

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

            if (bookingsError) throw bookingsError;
            if (juvError) throw juvError;

            setBookings(bookingsData || []);

            // 3. Manually attach probation_officers info to juvenilesList
            const safeJuvList = juvData?.map(j => ({
                ...j,
                probation_officers: officerMap[j.probation_officer_id] || {}
            })) || [];

            setJuvenilesList(safeJuvList);
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
            if ((d.getFullYear() - 1911) !== parseInt(year)) return false;
            // Month Filter
            if (month !== 'all' && (d.getMonth() + 1) !== parseInt(month)) return false;
            // Department Filter (Use Map)
            if (department) {
                const rowDept = infoMap[b.juvenile_id]?.department;
                if (rowDept !== department) return false;
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

        // 5. Distributions (Active Case Load from Juveniles Table)
        const deptMap = {};
        const psychMap = {};

        // Use the fetched juveniles list directly
        juvenilesList.forEach(j => {
            // Apply Department Filter to Distribution Stats too
            if (department && j.probation_officers?.department !== department) return;

            const dept = j.probation_officers?.department || '未分配';
            const psychName = j.psychologists?.name || '未分配';

            deptMap[dept] = (deptMap[dept] || 0) + 1;
            psychMap[psychName] = (psychMap[psychName] || 0) + 1;
        });

        setStats({
            totalSpending,
            totalAttendees,
            totalHours,
            dailyFeeCount,
            dailyFeeTotal,
            deptCounts: deptMap,
            psychCounts: psychMap
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
                    <div className="w-40">
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
                    <div className="w-40">
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
                    <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-gray-600" />
                        <h3 className="font-bold text-gray-800">各股別少年數 (不重複)</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-600 text-sm">
                                <tr>
                                    <th className="py-3 px-4">股別</th>
                                    <th className="py-3 px-4 text-right">少年數 (人)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {Object.keys(stats.deptCounts).length === 0 ? (
                                    <tr><td colSpan="2" className="py-8 text-center text-gray-400">無資料</td></tr>
                                ) : (
                                    Object.entries(stats.deptCounts).map(([dept, count]) => (
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
                    <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                        <Users className="w-5 h-5 text-gray-600" />
                        <h3 className="font-bold text-gray-800">各心理師少年數 (不重複)</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-600 text-sm">
                                <tr>
                                    <th className="py-3 px-4">心理師</th>
                                    <th className="py-3 px-4 text-right">少年數 (人)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {Object.keys(stats.psychCounts).length === 0 ? (
                                    <tr><td colSpan="2" className="py-8 text-center text-gray-400">無資料</td></tr>
                                ) : (
                                    Object.entries(stats.psychCounts).map(([name, count]) => (
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
