import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { Filter, Calendar, Users, Clock, AlertCircle } from 'lucide-react';
import { getCurrentROCYear } from '../../utils/dateUtils';

const AdvancedStats = () => {
    const [loading, setLoading] = useState(true);
    const [bookings, setBookings] = useState([]);

    // Filters
    const currentROCYear = getCurrentROCYear();
    const [year, setYear] = useState(currentROCYear);
    const [month, setMonth] = useState('all'); // 'all' or 1-12
    const [department, setDepartment] = useState('');
    const [psychologistId, setPsychologistId] = useState('');

    // Dropdown Data
    const [departments, setDepartments] = useState([]);
    const [psychologists, setPsychologists] = useState([]);

    useEffect(() => {
        fetchData();
        fetchDropdowns();
    }, []);

    const fetchDropdowns = async () => {
        try {
            // Fetch Officers for Departments (Via RPC)
            const { data: officers } = await supabase.rpc('get_admin_view_officers');

            const depts = new Set();
            officers?.forEach(o => {
                if (o.department) depts.add(o.department);
            });
            setDepartments(Array.from(depts).sort());

            // Fetch Psychologists
            const { data: psychs } = await supabase.from('psychologists').select('id, name').eq('is_active', true);
            setPsychologists(psychs || []);
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
                        id, 
                        probation_officers (department)
                    ),
                    psychologists (id, name)
                `);

            if (error) throw error;
            setBookings(data || []);
        } catch (error) {
            console.error('Error fetching stats data:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- Calculation Logic ---

    // 1. Filter Data
    const filteredData = bookings.filter(b => {
        const d = new Date(b.booking_date);

        // Year Filter (Compare ROC Year)
        // b.booking_date is YYYY-MM-DD, d.getFullYear() is Gregorian
        // Selected 'year' is ROC (e.g. 115)
        if ((d.getFullYear() - 1911) !== parseInt(year)) return false;

        // Month Filter
        if (month !== 'all' && (d.getMonth() + 1) !== parseInt(month)) return false;

        // Department Filter
        if (department && b.juveniles?.probation_officers?.department !== department) return false;

        // Psychologist Filter
        if (psychologistId && b.psychologist_id !== psychologistId) return false;

        return true;
    });

    // 2. Calculate Metrics
    const calculateMetrics = () => {
        const metrics = {
            totalServiceCount: 0,
            totalServiceHours: 0,
            juvenileIndividualCount: 0,
            parentIndividualCount: 0,
            jointWithJuvenileCount: 0,
            jointWithJuvenileAttendees: 0,
            jointWithoutJuvenileCount: 0,
            jointWithoutJuvenileAttendees: 0,
            absentCount: 0
        };

        filteredData.forEach(b => {
            // Only count 'Confirmation of Absence' for Absent Count, ignore others?
            // "缺席總次數（確認缺席的總資料數）"
            if (b.status === '確認缺席') {
                metrics.absentCount++;
            }

            // For other metrics, status must be '完成'
            if (b.status === '完成') {
                metrics.totalServiceCount++;

                // Service Hours Calculation
                if (b.start_time && b.end_time) {
                    const start = new Date(`1970-01-01T${b.start_time}`);
                    const end = new Date(`1970-01-01T${b.end_time}`);
                    const diffHours = (end - start) / (1000 * 60 * 60); // Difference in hours

                    // Rule: 1.5 hours counts as 2 hours.
                    // Implementation: If hours > 0, Math.ceil(hours). 
                    // E.g. 1.1 -> 2, 1.5 -> 2, 0.5 -> 1.
                    const hoursToAdd = diffHours > 0 ? Math.ceil(diffHours) : 0;
                    metrics.totalServiceHours += hoursToAdd;
                }

                // Individual Counseling
                if (b.counseling_type === 'Individual') {
                    if (b.individual_subject === 'Juvenile' || !b.individual_subject) { // Default to Juvenile if null? Or strictly match? assuming null/default is Juvenile based on earlier logic
                        metrics.juvenileIndividualCount++;
                    } else if (b.individual_subject === 'Parent') {
                        metrics.parentIndividualCount++;
                    }
                }

                // Joint Counseling
                if (b.counseling_type === 'Joint') {
                    const attendees = parseInt(b.joint_attendees_count) || 0;
                    if (b.includes_juvenile) {
                        metrics.jointWithJuvenileCount++;
                        metrics.jointWithJuvenileAttendees += attendees;
                    } else {
                        metrics.jointWithoutJuvenileCount++;
                        metrics.jointWithoutJuvenileAttendees += attendees;
                    }
                }
            }
        });

        return metrics;
    };

    const metrics = calculateMetrics();

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                <Clock className="w-6 h-6" /> 進階統計報表
            </h3>

            {/* Filters */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-gray-700 font-bold mb-2">
                    <Filter className="w-5 h-5" /> 統計篩選
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                </div>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* General Stats */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-gray-500 mb-2">
                            <Users className="w-4 h-4" /> 服務概況
                        </div>
                        <div className="text-3xl font-bold text-gray-800">{metrics.totalServiceCount} <span className="text-sm font-normal text-gray-500">人次</span></div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-50">
                        <div className="text-sm text-gray-500">服務總時數</div>
                        <div className="text-xl font-bold text-primary">{metrics.totalServiceHours} <span className="text-sm font-normal text-gray-500">小時</span></div>
                    </div>
                </div>

                {/* Individual Counseling */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 text-gray-500 mb-4">
                        <Users className="w-4 h-4" /> 個別諮商
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <span className="text-gray-600">少年個別諮商</span>
                            <span className="text-xl font-bold text-gray-800">{metrics.juvenileIndividualCount} <span className="text-xs text-gray-400">次</span></span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-gray-600">家長個別諮商</span>
                            <span className="text-xl font-bold text-gray-800">{metrics.parentIndividualCount} <span className="text-xs text-gray-400">次</span></span>
                        </div>
                    </div>
                </div>

                {/* Joint Counseling (Includes Juvenile) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 bg-blue-50/30">
                    <div className="flex items-center gap-2 text-primary mb-4">
                        <Users className="w-4 h-4" /> 聯合諮商 (含少年)
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <span className="text-gray-600">總次數</span>
                            <span className="text-xl font-bold text-primary">{metrics.jointWithJuvenileCount} <span className="text-xs text-gray-400">次</span></span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-gray-600">參與總人次</span>
                            <span className="text-xl font-bold text-primary">{metrics.jointWithJuvenileAttendees} <span className="text-xs text-gray-400">人</span></span>
                        </div>
                    </div>
                </div>

                {/* Joint Counseling (No Juvenile) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 text-gray-500 mb-4">
                        <Users className="w-4 h-4" /> 聯合諮商 (不含少年)
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <span className="text-gray-600">總次數</span>
                            <span className="text-xl font-bold text-gray-800">{metrics.jointWithoutJuvenileCount} <span className="text-xs text-gray-400">次</span></span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-gray-600">參與總人次</span>
                            <span className="text-xl font-bold text-gray-800">{metrics.jointWithoutJuvenileAttendees} <span className="text-xs text-gray-400">人</span></span>
                        </div>
                    </div>
                </div>

                {/* Absence */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100 bg-red-50/30">
                    <div className="flex items-center gap-2 text-red-600 mb-4">
                        <AlertCircle className="w-4 h-4" /> 缺席狀況
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-gray-600">缺席總次數</span>
                        <span className="text-3xl font-bold text-red-600">{metrics.absentCount} <span className="text-sm font-normal text-gray-500">次</span></span>
                    </div>
                    <p className="text-xs text-red-400 mt-2">*僅計算狀態為「確認缺席」的紀錄</p>
                </div>
            </div>

            {loading && <div className="text-center py-10 text-gray-500">載入資料中...</div>}
        </div>
    );
};

export default AdvancedStats;
