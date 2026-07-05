import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, User, Users, FileText, CheckCircle, XCircle, AlertCircle, Search, Filter, Plus, Edit, Trash2, Eye, Minus, List as ListIcon, Download, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { convertDateStringToROC, toROCFullDate, getCurrentROCYear, getTimeOptions, getPsychologistColor } from '../../utils/dateUtils';

const BookingManagement = ({
    readOnly = false,
    fixedDepartment = null, // If set, only show bookings for this department
    fixedPsychologistId = null, // If set, only show bookings for this psychologist
    visibleFilters = ['search', 'status', 'department', 'psychologist', 'room', 'date'], // Control which filters to show
    allowExport = false, // Default to false, explicitly enable for Admin
    showReimbursement = false // Default to false, only enable for Admin
}) => {
    // Canvas & Data State
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [juvenileInfoMap, setJuvenileInfoMap] = useState({}); // Map juvenile_id -> { department, officerName, psychologistName }
    const [guardianInfoMap, setGuardianInfoMap] = useState({}); // Map guardian_id -> { department, officerName, psychologistName }


    // Contact Modal State
    const [contactModal, setContactModal] = useState({
        isOpen: false,
        title: '',
        items: [] // { label: '', value: ''}
    });

    // UI State
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Filter State
    const [filters, setFilters] = useState({
        searchQuery: '',
        status: '',
        juvenile_id: '',
        department: '',
        psychologist_id: '',
        room_number: '',
        startDate: '',
        endDate: '',
        showVerified: false,
        showConfirmedAbsent: false
    });

    // Form Data
    const [formData, setFormData] = useState({
        juvenile_id: '',
        guardian_id: '',
        case_type: 'juvenile', // 'juvenile' or 'guardian'
        juvenile_name: '', // Only used when case_type === 'guardian'
        psychologist_id: '',
        status: '尚未開始',
        counseling_type: 'Individual',
        individual_subject: 'Juvenile',
        joint_attendees_count: '',
        joint_details: '',
        includes_juvenile: false, // Default false for Joint
        booking_date: '',
        start_time: '',
        end_time: '',
        location: '諮商室',
        room_number: '',
        notes: '',
        is_verified: false
    });

    // Dropdown/Reference Data
    const [juveniles, setJuveniles] = useState([]);
    const [guardianCases, setGuardianCases] = useState([]);
    const [psychologists, setPsychologists] = useState([]);
    const [uniqueDepartments, setUniqueDepartments] = useState([]);

    // Auto-fill Display State
    const [selectedJuvenileInfo, setSelectedJuvenileInfo] = useState({
        department: '',
        officer: '',
        psychologistName: ''
    });

    const rooms = ['201', '202', '203', '204', '205', '206', '207', '208'];
    const statuses = ['尚未開始', '缺席', '等待報告', '完成', '確認缺席'];

    // Resolve the linked case for a booking, regardless of whether it's a juvenile or a guardian
    const getCaseDisplay = (b) => {
        const isGuardian = !!b.guardian_id;
        const caseRecord = isGuardian ? b.guardians : b.juveniles;
        return {
            isGuardian,
            name: caseRecord?.name || '-',
            case_number: caseRecord?.case_number || '',
            officer: caseRecord?.probation_officers || null,
            department: caseRecord?.probation_officers?.department || ''
        };
    };

    useEffect(() => {
        fetchBookings();
        fetchReferenceData();
    }, []);

    const handleOpenContact = (title, items) => {
        setContactModal({
            isOpen: true,
            title,
            items
        });
    };

    const fetchBookings = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('bookings')
                .select(`
    *,
    juveniles(
        id,
        name,
        case_number,
        birth_date,
        probation_officers(
            name,
            department,
            contact_info,
            extension_number
        )
    ),
    guardians(
        id,
        name,
        case_number,
        probation_officers(
            name,
            department,
            contact_info,
            extension_number
        ),
        psychologists(
            name
        )
    ),
    psychologists(
        name,
        contact_info
    )
        `)
                .order('booking_date', { ascending: false })
                .order('start_time', { ascending: false });

            if (error) throw error;
            setBookings(data);
        } catch (error) {
            console.error('Error fetching bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchReferenceData = async () => {
        try {
            // Fetch Juveniles with Officer Display Order
            // 1. Fetch Officers via RPC to bypass RLS
            const { data: officersData } = await supabase.rpc('get_admin_view_officers');
            const officerMap = {};
            officersData?.forEach(o => {
                officerMap[o.id] = o;
            });

            // 2. Fetch Juveniles (Use Foreign Key Join for Department)
            const { data: juvData } = await supabase
                .from('juveniles')
                .select(`
                    id, name,
                    probation_officer_id,
                    probation_officers (
                        name,
                        department
                    ),
                    psychologists(id, name)
                `)
                .eq('status', '服務中')
                .order('name');
            setJuveniles(juvData || []);

            // 3. Build Info Map manually
            const depts = new Set();
            const infoMap = {};

            juvData?.forEach(j => {
                // Use the joined data directly
                const po = j.probation_officers;
                const psy = j.psychologists;

                infoMap[j.id] = {
                    department: po?.department || '',
                    officerName: po?.name || '',
                    psychologistName: psy?.name || ''
                };

                if (po?.department) depts.add(po.department);
            });
            setJuvenileInfoMap(infoMap);

            // 4. Fetch Guardians (親職教育資料庫 cases), same shape as Juveniles
            const { data: guardianData } = await supabase
                .from('guardians')
                .select(`
                    id, name,
                    juvenile_name,
                    probation_officer_id,
                    probation_officers (
                        name,
                        department
                    ),
                    psychologists(id, name)
                `)
                .eq('status', '服務中')
                .order('name');
            setGuardianCases(guardianData || []);

            const guardianMap = {};
            guardianData?.forEach(g => {
                const po = g.probation_officers;
                const psy = g.psychologists;

                guardianMap[g.id] = {
                    department: po?.department || '',
                    officerName: po?.name || '',
                    psychologistName: psy?.name || ''
                };

                if (po?.department) depts.add(po.department);
            });
            setGuardianInfoMap(guardianMap);
            setUniqueDepartments(Array.from(depts).sort());

            // Fetch Psychologists
            const { data: psychData } = await supabase
                .from('psychologists')
                .select('id, name')
                .eq('is_active', true)
                .order('name');
            setPsychologists(psychData || []);

        } catch (error) {
            console.error('Error fetching reference data:', error);
        }
    };

    // --- Modal Handlers ---

    const handleOpenAdd = (dateOverride = null) => {
        setIsEditing(false);
        setEditingId(null);
        setFormData({
            juvenile_id: '',
            guardian_id: '',
            case_type: 'juvenile',
            juvenile_name: '',
            psychologist_id: fixedPsychologistId || '', // Auto-set if fixed
            status: '尚未開始',
            counseling_type: 'Individual',
            individual_subject: 'Juvenile',
            joint_attendees_count: '',
            joint_details: '',
            includes_juvenile: false,
            booking_date: dateOverride || new Date().toISOString().split('T')[0],
            start_time: '09:00',
            end_time: '10:00',
            location: '本院諮商室',
            room_number: '',
            notes: '',
            is_verified: false
        });
        setSelectedJuvenileInfo({ department: '', officer: '', psychologistName: '' });
        setShowModal(true);
    };

    const handleOpenEdit = (booking) => {
        setIsEditing(true);
        setEditingId(booking.id);

        const isGuardianBooking = !!booking.guardian_id;

        setFormData({
            juvenile_id: booking.juvenile_id || '',
            guardian_id: booking.guardian_id || '',
            case_type: isGuardianBooking ? 'guardian' : 'juvenile',
            juvenile_name: booking.juvenile_name || '',
            psychologist_id: booking.psychologist_id,
            status: booking.status || '尚未開始',
            counseling_type: booking.counseling_type,
            individual_subject: booking.individual_subject || 'Juvenile',
            joint_attendees_count: booking.joint_attendees_count || '',
            joint_details: booking.joint_details || '',
            includes_juvenile: booking.includes_juvenile || false,
            booking_date: booking.booking_date,
            start_time: booking.start_time,
            end_time: booking.end_time,
            location: booking.location || '',
            room_number: booking.room_number || '',
            notes: booking.notes || '',
            is_verified: booking.is_verified || false
        });

        if (isGuardianBooking && booking.guardians) {
            setSelectedJuvenileInfo({
                department: booking.guardians.probation_officers?.department || '-',
                officer: booking.guardians.probation_officers?.name || '-',
                psychologistName: booking.guardians.psychologists?.name || '-'
            });
        } else if (booking.juveniles) {
            setSelectedJuvenileInfo({
                department: booking.juveniles.probation_officers?.department || '-',
                officer: booking.juveniles.probation_officers?.name || '-',
                psychologistName: booking.juveniles.psychologists?.name || '-'
            });
        }
        setShowModal(true);
    };

    const handleCaseChange = (caseId) => {
        if (!caseId) {
            setFormData(prev => ({ ...prev, juvenile_id: '', guardian_id: '', case_type: 'juvenile', juvenile_name: '' }));
            setSelectedJuvenileInfo({ department: '', officer: '', psychologistName: '' });
            return;
        }

        const selectedJuv = juveniles.find(j => j.id === caseId);
        if (selectedJuv) {
            setFormData(prev => ({ ...prev, case_type: 'juvenile', juvenile_id: caseId, guardian_id: '', juvenile_name: '' }));
            setSelectedJuvenileInfo({
                department: selectedJuv.probation_officers?.department || '-',
                officer: selectedJuv.probation_officers?.name || '-',
                psychologistName: selectedJuv.psychologists?.name || '-'
            });
            if (selectedJuv.psychologists?.id) {
                setFormData(prev => ({ ...prev, psychologist_id: selectedJuv.psychologists.id }));
            }
            return;
        }

        const selectedGuardian = guardianCases.find(g => g.id === caseId);
        if (selectedGuardian) {
            setFormData(prev => ({ ...prev, case_type: 'guardian', guardian_id: caseId, juvenile_id: '', juvenile_name: selectedGuardian.juvenile_name || '' }));
            setSelectedJuvenileInfo({
                department: selectedGuardian.probation_officers?.department || '-',
                officer: selectedGuardian.probation_officers?.name || '-',
                psychologistName: selectedGuardian.psychologists?.name || '-'
            });
            if (selectedGuardian.psychologists?.id) {
                setFormData(prev => ({ ...prev, psychologist_id: selectedGuardian.psychologists.id }));
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let error;
            const payload = {
                juvenile_id: formData.case_type === 'juvenile' ? (formData.juvenile_id || null) : null,
                guardian_id: formData.case_type === 'guardian' ? (formData.guardian_id || null) : null,
                juvenile_name: formData.case_type === 'guardian' ? (formData.juvenile_name || null) : null,
                psychologist_id: formData.psychologist_id,
                status: formData.status,
                counseling_type: formData.counseling_type,
                individual_subject: formData.counseling_type === 'Individual' ? formData.individual_subject : null,
                joint_attendees_count: formData.counseling_type === 'Joint' ? (parseInt(formData.joint_attendees_count) || 0) : null,
                joint_details: formData.counseling_type === 'Joint' ? formData.joint_details : null,
                includes_juvenile: formData.counseling_type === 'Joint' ? formData.includes_juvenile : false,
                booking_date: formData.booking_date,
                start_time: formData.start_time,
                end_time: formData.end_time,
                location: formData.location,
                room_number: formData.room_number,
                notes: formData.notes,
                is_verified: formData.is_verified
            };

            if (isEditing) {
                const { error: updateError } = await supabase.from('bookings').update(payload).eq('id', editingId);
                error = updateError;
            } else {
                const { error: insertError } = await supabase.from('bookings').insert([payload]);
                error = insertError;
            }

            if (error) throw error;
            setShowModal(false);
            fetchBookings();
        } catch (error) {
            alert(isEditing ? '更新失敗: ' : '新增失敗: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('確定要刪除此預約嗎？')) return;
        try {
            const { error } = await supabase.from('bookings').delete().eq('id', id);
            if (error) throw error;
            fetchBookings();
        } catch (error) {
            alert('刪除失敗: ' + error.message);
        }
    };

    const handleExport = () => {
        try {
            // Prepare data for export
            const exportData = filteredBookings.map(b => {
                const caseDisplay = getCaseDisplay(b);
                return {
                    '日期': convertDateStringToROC(b.booking_date),
                    '時間': `${b.start_time?.slice(0, 5)} - ${b.end_time?.slice(0, 5)} `,
                    '狀態': b.status,
                    '個案姓名': caseDisplay.name,
                    '案號': caseDisplay.case_number,
                    '股別': caseDisplay.department,
                    '保護官': caseDisplay.officer?.name || '',
                    '心理師': b.psychologists?.name || '',
                    '諮商類別': b.counseling_type === 'Joint' ? `聯合(${b.joint_attendees_count}人)` : '個別',
                    '談話室': b.room_number || '',
                    '備註': b.notes || ''
                };
            });

            // Create worksheet
            const ws = XLSX.utils.json_to_sheet(exportData);

            // Create workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "預約資料");

            // Generate filename with date
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `諮商預約匯出_${dateStr}.xlsx`;

            // Export
            XLSX.writeFile(wb, fileName);
        } catch (error) {
            console.error('Export failed:', error);
            alert('匯出失敗: ' + error.message);
        }
    };

    const handleQuickUpdate = async (id, field, value) => {
        try {
            // Optimistic update locally
            setBookings(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));

            const { error } = await supabase.from('bookings').update({ [field]: value }).eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error('Quick update failed:', error);
            alert('更新失敗，請重新整理頁面');
            fetchBookings(); // Revert on error
        }
    };

    // --- Filter Logic ---

    const filteredBookings = bookings.filter(b => {
        // Search Query (Wildcard search)
        if (filters.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            const caseDisplay = getCaseDisplay(b);
            const name = caseDisplay.name?.toLowerCase() || '';
            const caseNum = caseDisplay.case_number?.toLowerCase() || '';
            const notes = b.notes?.toLowerCase() || '';
            const details = b.joint_details?.toLowerCase() || '';

            if (!name.includes(query) && !caseNum.includes(query) && !notes.includes(query) && !details.includes(query)) {
                return false;
            }
        }
        // Status
        if (filters.status && b.status !== filters.status) return false;
        // Juvenile
        if (filters.juvenile_id && b.juvenile_id !== filters.juvenile_id) return false;
        // Psychologist-Moved below to handle fixedPsychologistId priority check logic properly
        // if (filters.psychologist_id && b.psychologist_id !== filters.psychologist_id) return false;
        // Department (Deep check)
        // Department (Deep check using Map for reliability)
        if (fixedDepartment) {
            const rowDept = getCaseDisplay(b).department || (b.guardian_id ? guardianInfoMap[b.guardian_id]?.department : juvenileInfoMap[b.juvenile_id]?.department);
            if (rowDept !== fixedDepartment) return false;
        } else if (filters.department) {
            const rowDept = getCaseDisplay(b).department || (b.guardian_id ? guardianInfoMap[b.guardian_id]?.department : juvenileInfoMap[b.juvenile_id]?.department);
            if (rowDept !== filters.department) return false;
        }
        // Psychologist (Deep check)
        if (fixedPsychologistId) {
            if (b.psychologist_id !== fixedPsychologistId) return false;
        } else if (filters.psychologist_id && b.psychologist_id !== filters.psychologist_id) {
            return false;
        }
        // Room
        if (filters.room_number && b.room_number !== filters.room_number) return false;
        // Date Range (Only apply in List Mode primarily, Calendar handles its own month range)
        if (viewMode === 'list') {
            if (filters.startDate && b.booking_date < filters.startDate) return false;
            if (filters.endDate && b.booking_date > filters.endDate) return false;
        }

        // Verification Filter
        // Default: Show Unverified (Hide Verified)
        // Checked: Show Verified (Hide Unverified)
        // Verification Filter
        // Default: Show Unverified (Hide Verified)
        // Checked: Show Verified (Hide Unverified)
        if (filters.showVerified) {
            if (!b.is_verified) return false;
        } else {
            // General logic: Hide verified if not asking for them.
            if (b.is_verified) return false;
        }

        // PSYCHOLOGIST VIEW SPECIFIC:
        // 1. If logged in as Psychologist (fixedPsychologistId), ALWAYS hide verified bookings.
        if (fixedPsychologistId && b.is_verified) return false;
        // 2. Hide "Confirmed Absent" bookings for Psychologists (User Request)
        if (fixedPsychologistId && b.status === '確認缺席') return false;

        // ADMIN VIEW SPECIFIC (Confirmed Absent Filter)
        if (!fixedPsychologistId && !filters.showConfirmedAbsent && b.status === '確認缺席') {
            return false;
        }

        return true;
    });

    // --- Calendar Logic ---

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
        return { days, firstDay, year, month };
    };

    const { days, firstDay, year, month } = getDaysInMonth(currentMonth);

    const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

    const getMonthBookings = () => {
        // Filter derived filteredBookings further by current month view
        return filteredBookings.filter(b => {
            const d = new Date(b.booking_date);
            return d.getFullYear() === year && d.getMonth() === month;
        });
    };

    const monthBookings = getMonthBookings();

    const getStatusColor = (status) => {
        switch (status) {
            case '缺席':
            case '確認缺席':
                return 'bg-red-100 text-red-700 border-red-200';
            case '完成': return 'bg-green-100 text-green-700 border-green-200';
            case '等待報告': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200'; // 尚未開始
        }
    };


    const getCounselingTypeDisplay = (b) => {
        if (b.counseling_type === 'Joint') {
            return `聯合(${b.joint_attendees_count || 0}人${b.joint_details ? ' - ' + b.joint_details : ''})`;
        }
        // Individual
        let subject = '少年';
        if (b.individual_subject === 'Parent') subject = '家長';
        if (b.individual_subject === 'Other') subject = '其他';
        // Handle database values that might be English
        if (b.individual_subject === 'Juvenile') subject = '少年';

        return `個別(${subject})`;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                    <CalendarIcon className="w-6 h-6" /> 預約管理
                </h3>
                <div className="flex gap-2 w-full md:w-auto justify-end">
                    <div className="bg-white p-1 rounded-lg border border-gray-200 flex">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'} `}
                        >
                            <ListIcon className="w-4 h-4 inline mr-1" />列表
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'calendar' ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'} `}
                        >
                            <CalendarIcon className="w-4 h-4 inline mr-1" />月曆
                        </button>
                    </div>
                    {allowExport && (
                        <Button variant="outline" onClick={handleExport} className="hidden md:flex items-center gap-1">
                            <Download className="w-4 h-4" /> 匯出資料
                        </Button>
                    )}
                    {!readOnly && (
                        <Button variant="primary" onClick={handleOpenAdd} className="flex items-center gap-1">
                            <Plus className="w-4 h-4" /> 新增預約
                        </Button>
                    )}
                </div>
            </div>

            {/* Filter Section */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-gray-700 font-bold text-lg border-b border-gray-100 pb-2">
                    <Filter className="w-5 h-5" /> 篩選條件
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Row 1: Search & Date Range */}
                    <div className="lg:col-span-12 flex flex-col md:flex-row gap-3 md:gap-4">
                        {/* Search */}
                        {visibleFilters.includes('search') && (
                            <div className="relative flex-grow">
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                                    placeholder="搜尋姓名、案號、備註..."
                                    value={filters.searchQuery}
                                    onChange={e => setFilters({ ...filters, searchQuery: e.target.value })}
                                />
                                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                            </div>
                        )}

                        {/* Date Range */}
                        {visibleFilters.includes('date') && (
                            <div className="flex flex-col md:flex-row md:items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <span className="text-xs text-gray-500 font-medium px-1 flex-shrink-0">起</span>
                                    <input
                                        type="date"
                                        className="flex-grow md:w-auto p-1.5 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-primary/20 bg-white min-w-0"
                                        value={filters.startDate}
                                        onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                                    />
                                </div>
                                <span className="hidden md:inline text-gray-400">-</span>
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <span className="text-xs text-gray-500 font-medium px-1 flex-shrink-0">迄</span>
                                    <input
                                        type="date"
                                        className="flex-grow md:w-auto p-1.5 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-primary/20 bg-white min-w-0"
                                        value={filters.endDate}
                                        onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Row 2: Category Filters */}
                    <div className="lg:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                        {visibleFilters.includes('status') && (
                            <select
                                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 shadow-sm bg-white"
                                value={filters.status}
                                onChange={e => setFilters({ ...filters, status: e.target.value })}
                            >
                                <option value="">所有狀態</option>
                                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        )}
                        {visibleFilters.includes('department') && !fixedDepartment && (
                            <select
                                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 shadow-sm bg-white"
                                value={filters.department}
                                onChange={e => setFilters({ ...filters, department: e.target.value })}
                            >
                                <option value="">所有股別</option>
                                {uniqueDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        )}
                        {visibleFilters.includes('psychologist') && (
                            <select
                                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 shadow-sm bg-white"
                                value={filters.psychologist_id}
                                onChange={e => setFilters({ ...filters, psychologist_id: e.target.value })}
                            >
                                <option value="">所有心理師</option>
                                {psychologists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        )}
                        {visibleFilters.includes('room') && (
                            <select
                                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 shadow-sm bg-white"
                                value={filters.room_number}
                                onChange={e => setFilters({ ...filters, room_number: e.target.value })}
                            >
                                <option value="">所有談話室</option>
                                {rooms.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        )}
                        {showReimbursement && (
                            <div className="flex items-center">
                                <label className="flex items-center gap-2 cursor-pointer select-none text-gray-700 font-medium">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 text-primary rounded focus:ring-primary/20 border-gray-300"
                                        checked={filters.showVerified}
                                        onChange={e => setFilters({ ...filters, showVerified: e.target.checked })}
                                    />
                                    顯示已送核銷資料
                                </label>
                            </div>
                        )}
                        {!fixedPsychologistId && (
                            <div className="flex items-center">
                                <label className="flex items-center gap-2 cursor-pointer select-none text-gray-700 font-medium">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 text-primary rounded focus:ring-primary/20 border-gray-300"
                                        checked={filters.showConfirmedAbsent}
                                        onChange={e => setFilters({ ...filters, showConfirmedAbsent: e.target.checked })}
                                    />
                                    顯示確認缺席資料
                                </label>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            {
                viewMode === 'list' && (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
                                        <th className="py-3 px-4">狀態</th>
                                        {showReimbursement && <th className="py-3 px-4">核銷</th>}
                                        <th className="py-3 px-4">日期時間</th>
                                        <th className="py-3 px-4">個案姓名</th>
                                        <th className="py-3 px-4">股別</th>
                                        {!fixedPsychologistId && <th className="py-3 px-4">心理師</th>}
                                        <th className="py-3 px-4">諮商類別</th>
                                        <th className="py-3 px-4">談話室</th>
                                        <th className="py-3 px-4 text-center">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-700">
                                    {loading ? (
                                        <tr><td colSpan={fixedPsychologistId ? "9" : (showReimbursement ? "10" : "9")} className="py-8 text-center text-gray-400">載入中...</td></tr>
                                    ) : filteredBookings.length === 0 ? (
                                        <tr><td colSpan={readOnly ? (showReimbursement ? 9 : 8) : (showReimbursement ? 10 : 9)} className="py-8 text-center text-gray-400">沒有符合條件的預約</td></tr>
                                    ) : (
                                        filteredBookings.map((b) => (
                                            <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                                <td className="py-3 px-4">
                                                    {readOnly || fixedPsychologistId ? (
                                                        <div className="flex flex-col items-start gap-0.5">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(b.status || '尚未開始')} `}>
                                                                {b.status || '尚未開始'}
                                                            </span>
                                                            {/* Psychologist View: Show "Pending Reimbursement" if completed but not verified */}
                                                            {fixedPsychologistId && b.status === '完成' && !b.is_verified && (
                                                                <span className="text-[10px] text-blue-500 font-bold ml-1">
                                                                    (待核銷)
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <select
                                                            className={`px-2 py-1 rounded-full text-xs font-medium border outline-none cursor-pointer ${getStatusColor(b.status || '尚未開始')} `}
                                                            value={b.status || '尚未開始'}
                                                            onChange={(e) => handleQuickUpdate(b.id, 'status', e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                    )}
                                                </td>
                                                {showReimbursement && (
                                                    <td className="py-3 px-4 text-center">
                                                        {readOnly || fixedPsychologistId ? (
                                                            b.is_verified ? (
                                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600">
                                                                    <CheckCircle className="w-4 h-4" />
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-300">-</span>
                                                            )
                                                        ) : (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (b.status === '完成') {
                                                                        handleQuickUpdate(b.id, 'is_verified', !b.is_verified);
                                                                    }
                                                                }}
                                                                disabled={b.status !== '完成'}
                                                                className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all 
                                                                    ${b.status !== '完成'
                                                                        ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                                                                        : b.is_verified
                                                                            ? 'bg-green-500 border-green-500 text-white hover:bg-green-600'
                                                                            : 'bg-white border-gray-300 hover:border-green-500 text-transparent hover:text-green-200'
                                                                    } `}
                                                                title={b.status !== '完成' ? "需先完成諮商才能核銷" : (b.is_verified ? "取消核銷" : "標記為已核銷")}
                                                            >
                                                                {b.status !== '完成' ? <Minus className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                                            </button>
                                                        )}
                                                    </td>
                                                )}
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-col text-sm">
                                                        <span className="font-medium text-gray-800 flex items-center gap-1">
                                                            {convertDateStringToROC(b.booking_date)}
                                                            {b.notes && (
                                                                <FileText
                                                                    className="w-3.5 h-3.5 text-amber-500 cursor-help"
                                                                    title={`備註: ${b.notes} `}
                                                                />
                                                            )}
                                                        </span>
                                                        <span className="text-gray-500">{b.start_time?.slice(0, 5)} - {b.end_time?.slice(0, 5)}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 font-medium">
                                                    <span className="inline-flex items-center gap-1">
                                                        {getCaseDisplay(b).name}
                                                        {b.guardian_id && <Users className="w-3.5 h-3.5 text-purple-500 cursor-help" title="強制親職教育" />}
                                                    </span>
                                                </td>

                                                {/* Department / Officer Cell */}
                                                <td className="py-3 px-4">
                                                    {fixedPsychologistId ? (
                                                        <button
                                                            className="text-left hover:text-primary hover:underline decoration-dashed underline-offset-4 transition-all"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const officer = getCaseDisplay(b).officer;
                                                                if (officer) {
                                                                    handleOpenContact('保護官資訊', [
                                                                        { label: '姓名', value: officer.name },
                                                                        { label: '股別', value: officer.department },
                                                                        { label: '聯繫方式', value: officer.contact_info || '未填寫' },
                                                                        { label: '分機', value: officer.extension_number || '未填寫' }
                                                                    ]);
                                                                }
                                                            }}
                                                        >
                                                            {getCaseDisplay(b).department || '-'}
                                                        </button>
                                                    ) : (
                                                        <span>{getCaseDisplay(b).department || '-'}</span>
                                                    )}
                                                </td>

                                                {/* Psychologist Cell */}
                                                {!fixedPsychologistId && (
                                                    <td className="py-3 px-4">
                                                        <button
                                                            className="text-left hover:text-primary hover:underline decoration-dashed underline-offset-4 transition-all"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const psych = b.psychologists;
                                                                if (psych) {
                                                                    handleOpenContact('心理師資訊', [
                                                                        { label: '姓名', value: psych.name },
                                                                        { label: '聯繫方式', value: psych.contact_info || '未填寫' }
                                                                    ]);
                                                                }
                                                            }}
                                                        >
                                                            {b.psychologists?.name || '-'}
                                                        </button>
                                                    </td>
                                                )}

                                                <td className="py-3 px-4">{getCounselingTypeDisplay(b)}</td>
                                                <td className="py-3 px-4">
                                                    {readOnly || fixedPsychologistId ? (
                                                        b.room_number ? <span className="text-primary font-bold">{b.room_number}</span> : '-'
                                                    ) : (
                                                        <select
                                                            className="p-1 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-primary/50 text-gray-700 bg-white"
                                                            value={b.room_number || ''}
                                                            onChange={(e) => handleQuickUpdate(b.id, 'room_number', e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <option value="">未指派</option>
                                                            {rooms.map(r => <option key={r} value={r}>{r}</option>)}
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 flex justify-center gap-2">
                                                    {readOnly ? (
                                                        <button onClick={() => handleOpenEdit(b)} className="p-1 text-gray-400 hover:text-blue-600">
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                    ) : fixedPsychologistId ? (
                                                        // Psychologist View-Quick Actions
                                                        ['完成', '確認缺席'].includes(b.status) ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-green-600 border border-green-200 bg-green-50 px-2 py-0.5 rounded">已完成</span>
                                                                <button onClick={() => handleOpenEdit(b)} className="p-1 text-gray-400 hover:text-blue-600">
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1">
                                                                {/* Attend Button */}
                                                                <button
                                                                    onClick={() => handleQuickUpdate(b.id, 'status', b.status === '等待報告' ? '尚未開始' : '等待報告')}
                                                                    className={`px-2 py-1 rounded text-xs flex items-center gap-1 border transition-all ${b.status === '等待報告'
                                                                        ? 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200'
                                                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                                        } `}
                                                                    title="出席 (轉為等待報告)"
                                                                >
                                                                    <CheckCircle className="w-3 h-3" />
                                                                    出席
                                                                    {b.status === '等待報告' && <X className="w-3 h-3 ml-0.5" />}
                                                                </button>

                                                                {/* Absent Button */}
                                                                <button
                                                                    onClick={() => handleQuickUpdate(b.id, 'status', b.status === '缺席' ? '尚未開始' : '缺席')}
                                                                    className={`px-2 py-1 rounded text-xs flex items-center gap-1 border transition-all ${b.status === '缺席'
                                                                        ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
                                                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                                        } `}
                                                                    title="缺席"
                                                                >
                                                                    <XCircle className="w-3 h-3" />
                                                                    缺席
                                                                    {b.status === '缺席' && <X className="w-3 h-3 ml-0.5" />}
                                                                </button>

                                                                {/* Normal Edit Button for details (always allow editing details unless complete?) */}
                                                                <button onClick={() => handleOpenEdit(b)} className="p-1 text-gray-400 hover:text-blue-600 ml-1">
                                                                    <Edit className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => handleDelete(b.id)} className="p-1 text-gray-400 hover:text-red-600">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        )
                                                    ) : (
                                                        <>
                                                            <button onClick={() => handleOpenEdit(b)} className="p-1 text-gray-400 hover:text-blue-600">
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => handleDelete(b.id)} className="p-1 text-gray-400 hover:text-red-600">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden">
                            {loading ? (
                                <div className="p-8 text-center text-gray-400">載入中...</div>
                            ) : filteredBookings.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">沒有符合條件的預約</div>
                            ) : (
                                <div className="space-y-4 p-4 bg-gray-50">
                                    {filteredBookings.map((b) => (
                                        <div key={b.id} onClick={(e) => { e.stopPropagation(); handleOpenEdit(b); }} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm active:scale-[0.98] transition-transform">
                                            <div className="flex justify-between items-start mb-3 border-b border-gray-50 pb-2">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-800 text-lg flex items-center gap-1">
                                                        {getCaseDisplay(b).name}
                                                        {b.guardian_id && <Users className="w-4 h-4 text-purple-500" title="強制親職教育" />}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        {getCaseDisplay(b).department || '-'} / {getCaseDisplay(b).officer?.name || '-'}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    {readOnly || fixedPsychologistId ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(b.status || '尚未開始')} `}>
                                                                {b.status || '尚未開始'}
                                                            </span>
                                                            {fixedPsychologistId && b.status === '完成' && !b.is_verified && (
                                                                <span className="text-[10px] text-blue-500 font-bold mt-0.5">(待核銷)</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(b.status || '尚未開始')} `}>
                                                            {b.status || '尚未開始'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-2 text-sm text-gray-600">
                                                <div className="flex items-center gap-2">
                                                    <CalendarIcon className="w-4 h-4 text-gray-400" />
                                                    <div className="font-medium text-gray-800 flex items-center gap-2">
                                                        {convertDateStringToROC(b.booking_date)}
                                                        {b.notes && (
                                                            <FileText
                                                                className="w-3.5 h-3.5 text-amber-500"
                                                                title={`備註: ${b.notes} `}
                                                            />
                                                        )}
                                                    </div>
                                                    <span className="text-gray-500">{b.start_time?.slice(0, 5)}-{b.end_time?.slice(0, 5)}</span>
                                                </div>
                                                {!fixedPsychologistId && (
                                                    <div className="flex items-center gap-2">
                                                        <User className="w-4 h-4 text-gray-400" />
                                                        <span>{b.psychologists?.name || '-'}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2">
                                                    <span className="w-4 flex justify-center text-gray-400 text-xs py-0.5 border border-gray-200 rounded">R</span>
                                                    <span>{b.room_number || '未指定'}</span>
                                                </div>
                                                {/* Counseling Type Badge */}
                                                <div className="flex gap-2 mt-2">
                                                    <span className="px-2 py-0.5 bg-gray-50 text-gray-500 rounded text-xs border border-gray-100">
                                                        {b.counseling_type === 'Individual' ? (b.individual_subject === 'Parent' ? '親職諮商' : '個別諮商') : '聯合諮商'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action Footer */}
                                            {(!readOnly && !fixedPsychologistId) ? (
                                                <div className="mt-4 pt-3 border-t border-gray-50 flex justify-between items-center">
                                                    {/* Interactive Verification for Mobile Admin */}
                                                    <div className="flex items-center">
                                                        {showReimbursement && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (b.status === '完成') {
                                                                        handleQuickUpdate(b.id, 'is_verified', !b.is_verified);
                                                                    }
                                                                }}
                                                                disabled={b.status !== '完成'}
                                                                className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 text-xs transition-all 
                                                                    ${b.status !== '完成'
                                                                        ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                                                                        : b.is_verified
                                                                            ? 'bg-green-500 border-green-500 text-white'
                                                                            : 'bg-white border-gray-300 text-gray-700'
                                                                    } `}
                                                            >
                                                                {b.status !== '完成' ? <Minus className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                                                                {b.is_verified ? '已核銷' : '未核銷'}
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(b); }}
                                                            className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirm('確定刪除此預約？')) handleDelete(b.id);
                                                            }}
                                                            className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Psychologist Mobile Quick Actions */
                                                fixedPsychologistId && (
                                                    <div className="mt-4 pt-3 border-t border-gray-50 grid grid-cols-2 gap-3">
                                                        {['完成', '確認缺席'].includes(b.status) ? (
                                                            <div className="col-span-2 text-center py-2 text-sm font-medium text-gray-500 bg-gray-50 rounded-lg">
                                                                已{b.status}，無法變更
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {/* Attend Button */}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleQuickUpdate(b.id, 'status', b.status === '等待報告' ? '尚未開始' : '等待報告');
                                                                    }}
                                                                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${b.status === '等待報告'
                                                                        ? 'bg-green-500 text-white shadow-md'
                                                                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                                                                        }`}
                                                                >
                                                                    <CheckCircle className="w-4 h-4" />
                                                                    {b.status === '等待報告' ? '已出席 (撤回)' : '出席'}
                                                                </button>

                                                                {/* Absent Button */}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleQuickUpdate(b.id, 'status', b.status === '缺席' ? '尚未開始' : '缺席');
                                                                    }}
                                                                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${b.status === '缺席'
                                                                        ? 'bg-red-500 text-white shadow-md'
                                                                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                                                                        }`}
                                                                >
                                                                    <XCircle className="w-4 h-4" />
                                                                    {b.status === '缺席' ? '已缺席 (撤回)' : '缺席'}
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {
                viewMode === 'calendar' && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        {/* Calendar Header */}
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-gray-800">
                                    {year - 1911}年 {month + 1}月
                                </h2>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600"><ChevronLeft /></button>
                                <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600"><ChevronRight /></button>
                            </div>
                        </div>

                        <div className="overflow-x-auto pb-2">
                            <div className="min-w-[700px]">
                                {/* Weekday Header */}
                                <div className="grid grid-cols-7 mb-2 text-center text-sm font-medium text-gray-500">
                                    {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d} className="py-2">{d}</div>)}
                                </div>

                                {/* Days Grid */}
                                <div className="grid grid-cols-7 gap-1 bg-gray-100 rounded-lg p-1">
                                    {/* Empty cells for prev month */}
                                    {Array.from({ length: firstDay }).map((_, i) => (
                                        <div key={`empty - ${i} `} className="h-32 bg-gray-50/50 rounded-md"></div>
                                    ))}

                                    {/* Days */}
                                    {Array.from({ length: days }).map((_, i) => {
                                        const dayNum = i + 1;
                                        const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                        const dayBookings = monthBookings
                                            .filter(b => b.booking_date === currentDateStr)
                                            .sort((a, b) => a.start_time.localeCompare(b.start_time));
                                        const isToday = new Date().toISOString().split('T')[0] === currentDateStr;

                                        return (
                                            <div
                                                key={dayNum}
                                                onClick={() => !readOnly && handleOpenAdd(currentDateStr)}
                                                className={`h-32 bg-white rounded-md p-1 border ${isToday ? 'border-primary shadow-sm' : 'border-gray-100'} hover:border-primary/50 transition-colors cursor-pointer overflow-y-auto ${readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50'}`}
                                            >
                                                <div className={`text-center text-sm font-medium mb-1 ${isToday ? 'text-primary' : 'text-gray-700'} `}>
                                                    {dayNum}
                                                </div>
                                                <div className="space-y-1">
                                                    {dayBookings.map(b => {
                                                        const colorClass = getPsychologistColor(b.psychologist_id, psychologists);

                                                        // Status Indicator logic
                                                        const isAbsent = ['缺席', '確認缺席'].includes(b.status);
                                                        const isCompleted = b.status === '完成';
                                                        const caseDisplay = getCaseDisplay(b);

                                                        return (
                                                            <div
                                                                key={b.id}
                                                                onClick={(e) => { e.stopPropagation(); handleOpenEdit(b); }}
                                                                className={`text-xs p-1 rounded border truncate cursor-pointer ${colorClass} ${isAbsent ? 'opacity-60 line-through' : ''} ${isCompleted ? 'ring-1 ring-green-500' : ''} `}
                                                                title={`${b.start_time?.slice(0, 5)} ${caseDisplay.name} (${fixedPsychologistId ? (caseDisplay.department || '-') : (b.psychologists?.name || '-')}) - ${b.status}${caseDisplay.isGuardian ? ' - 強制親職教育' : ''} `}
                                                            >
                                                                <div className="flex justify-between items-center">
                                                                    <span className="font-bold">{b.start_time?.slice(0, 5)}</span>
                                                                    {/* Mini Status Icon */}
                                                                    {isCompleted && <CheckCircle className="w-3 h-3 text-green-600" />}
                                                                    {isAbsent && <XCircle className="w-3 h-3 text-red-600" />}
                                                                </div>
                                                                <div className="truncate flex items-center gap-1">
                                                                    {caseDisplay.name}
                                                                    {caseDisplay.isGuardian && <Users className="w-3 h-3 flex-shrink-0" title="強制親職教育" />}
                                                                    <span className="text-[10px] opacity-75 ml-1">
                                                                        ({fixedPsychologistId ? (caseDisplay.department || '-') : (b.psychologists?.name || '-')})
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Contact Info Modal */}
            {
                contactModal.isOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl relative">
                            <button
                                onClick={() => setContactModal({ ...contactModal, isOpen: false })}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-blue-100 p-2 rounded-full">
                                    <User className="w-5 h-5 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-800">{contactModal.title}</h3>
                            </div>

                            <div className="space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
                                {contactModal.items.map((item, idx) => (
                                    <div key={idx} className="flex flex-col">
                                        <span className="text-xs font-medium text-gray-500 mb-0.5">{item.label}</span>
                                        <span className="text-gray-800 font-medium">{item.value}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6">
                                <Button variant="primary" onClick={() => setContactModal({ ...contactModal, isOpen: false })} className="w-full">
                                    關閉
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Booking Modal Logic */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 overflow-y-auto p-4 sm:p-10">
                        <div className="bg-white rounded-2xl p-5 sm:p-8 w-full max-w-2xl shadow-2xl mt-4 sm:mt-0 sm:my-auto mb-10">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-bold text-primary">
                                    {readOnly ? '預約詳細資訊' : (isEditing ? '編輯預約' : '新增預約')}
                                </h3>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <fieldset disabled={readOnly || (fixedPsychologistId && ['完成', '確認缺席'].includes(formData.status))} className="flex flex-col gap-4 sm:block sm:space-y-4">
                                    {/* Status Row (Moved down on mobile) */}
                                    <div className="order-2 sm:order-none grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium mb-1">狀態</label>
                                            <select
                                                className={`w-full p-3 sm:p-2 border rounded min-h-[44px] sm:min-h-0 ${fixedPsychologistId ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''} `}
                                                value={formData.status}
                                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                                                disabled={!!fixedPsychologistId}
                                            >
                                                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                            {/* Verification Checkbox-Only Show if Status is Completed */}
                                            {formData.status === '完成' && (
                                                <div className="mt-2 text-sm">
                                                    <label className="flex items-center gap-3 sm:gap-2 cursor-pointer bg-green-50 p-3 sm:p-2 rounded-lg border border-green-200">
                                                        <input
                                                            type="checkbox"
                                                            className="w-5 h-5 sm:w-4 sm:h-4 text-green-600 rounded focus:ring-green-500 border-gray-300"
                                                            checked={formData.is_verified}
                                                            onChange={e => setFormData({ ...formData, is_verified: e.target.checked })}
                                                            disabled={readOnly}
                                                        />
                                                        <span className="font-bold text-green-700">已送核銷</span>
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Case & Psych Row (Moved to top on mobile) */}
                                    <div className="order-1 sm:order-none grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium mb-1">選擇個案</label>
                                            <select required className="w-full p-3 sm:p-2 border rounded min-h-[44px] sm:min-h-0 text-base sm:text-sm" value={formData.case_type === 'guardian' ? formData.guardian_id : formData.juvenile_id} onChange={e => handleCaseChange(e.target.value)}>
                                                <option value="">請選擇</option>
                                                <optgroup label="少年">
                                                    {juveniles
                                                        .filter(j => {
                                                            // 1. If fixedPsychologistId is present (Psychologist View), only show their juveniles
                                                            if (fixedPsychologistId && j.psychologists?.id !== fixedPsychologistId) return false;

                                                            // 2. If Admin selected a psychologist in the form, only show that psychologist's juveniles
                                                            // Note: We check if formData.psychologist_id is present AND not empty
                                                            if (formData.psychologist_id && j.psychologists?.id !== formData.psychologist_id) return false;

                                                            return true;
                                                        })
                                                        .map(j => <option key={j.id} value={j.id}>{j.name} ({j.probation_officers?.department || '未分股'})</option>)}
                                                </optgroup>
                                                <optgroup label="家長 (強制親職教育)">
                                                    {guardianCases
                                                        .filter(g => {
                                                            if (fixedPsychologistId && g.psychologists?.id !== fixedPsychologistId) return false;
                                                            if (formData.psychologist_id && g.psychologists?.id !== formData.psychologist_id) return false;
                                                            return true;
                                                        })
                                                        .map(g => <option key={g.id} value={g.id}>{g.name} ({g.probation_officers?.department || '未分股'})</option>)}
                                                </optgroup>
                                            </select></div>
                                        <div><label className="block text-sm font-medium mb-1">心理師</label>
                                            <select
                                                required
                                                className={`w-full p-3 sm:p-2 border rounded min-h-[44px] sm:min-h-0 text-base sm:text-sm ${fixedPsychologistId ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''} `}
                                                value={formData.psychologist_id}
                                                onChange={e => setFormData({ ...formData, psychologist_id: e.target.value })}
                                                disabled={!!fixedPsychologistId}
                                            >
                                                <option value="">請選擇</option>
                                                {psychologists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select></div>
                                    </div>

                                    {/* Auto-fill info */}
                                    <div className={`order-3 sm:order-none bg-gray-50 border p-3 sm:p-2 rounded grid ${formData.case_type === 'guardian' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-2 text-xs`}>
                                        <div><span className="text-gray-400">股別</span><div className="mt-1 font-medium text-sm sm:text-xs">{selectedJuvenileInfo.department}</div></div>
                                        <div><span className="text-gray-400">保護官</span><div className="mt-1 font-medium text-sm sm:text-xs">{selectedJuvenileInfo.officer}</div></div>
                                        <div><span className="text-gray-400">預設心理師</span><div className="mt-1 font-medium text-sm sm:text-xs">{selectedJuvenileInfo.psychologistName}</div></div>
                                        {formData.case_type === 'guardian' && (
                                            <div><span className="text-gray-400">少年姓名</span><div className="mt-1 font-medium text-sm sm:text-xs">{formData.juvenile_name || '-'}</div></div>
                                        )}
                                    </div>

                                    {/* Counseling Type */}
                                    <div className="order-4 sm:order-none bg-blue-50/50 p-4 border rounded-xl space-y-3">
                                        <div><label className="block text-sm font-medium mb-2 sm:mb-1">類別</label>
                                            <select className="w-full p-3 sm:p-2 border rounded min-h-[44px] sm:min-h-0 text-base sm:text-sm" value={formData.counseling_type} onChange={e => setFormData({ ...formData, counseling_type: e.target.value })}>
                                                <option value="Individual">個別諮商</option>
                                                <option value="Joint">聯合諮商</option>
                                            </select></div>
                                        {formData.counseling_type === 'Individual' ? (
                                            <div><label className="block text-sm font-medium mb-2 sm:mb-1">對象</label>
                                                <div className="flex gap-4 sm:gap-3">
                                                    <label className="flex items-center gap-2 py-1"><input type="radio" className="w-4 h-4 text-primary" value="Juvenile" checked={formData.individual_subject === 'Juvenile'} onChange={e => setFormData({ ...formData, individual_subject: e.target.value })} /><span className="text-base sm:text-sm">少年</span></label>
                                                    <label className="flex items-center gap-2 py-1"><input type="radio" className="w-4 h-4 text-primary" value="Parent" checked={formData.individual_subject === 'Parent'} onChange={e => setFormData({ ...formData, individual_subject: e.target.value })} /><span className="text-base sm:text-sm">家長</span></label>
                                                </div></div>
                                        ) : (
                                            <div className="space-y-4 sm:space-y-3">
                                                <div className="flex flex-col sm:flex-row gap-4">
                                                    <div className="flex-grow">
                                                        <label className="block text-sm font-medium text-gray-700 mb-2 sm:mb-1">人數 (不含心理師)</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            className="w-full p-3 sm:p-2 border border-gray-300 rounded-lg min-h-[44px] sm:min-h-0 text-base sm:text-sm focus:ring-2 focus:ring-secondary/20 outline-none"
                                                            value={formData.joint_attendees_count}
                                                            onChange={e => setFormData({ ...formData, joint_attendees_count: e.target.value })}
                                                            placeholder="例如: 3"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col justify-end">
                                                        <label className="flex items-center gap-3 sm:gap-2 cursor-pointer bg-gray-50 px-3 py-3 sm:py-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors h-auto sm:h-[42px]">
                                                            <input
                                                                type="checkbox"
                                                                className="w-5 h-5 text-primary rounded focus:ring-primary/20 border-gray-300"
                                                                checked={formData.includes_juvenile}
                                                                onChange={e => setFormData({ ...formData, includes_juvenile: e.target.checked })}
                                                            />
                                                            <span className="text-base sm:text-sm font-medium text-gray-700">是否包含少年</span>
                                                        </label>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium mb-2 sm:mb-1">說明</label>
                                                    <input
                                                        type="text"
                                                        className="w-full p-3 sm:p-2 border rounded min-h-[44px] sm:min-h-0 text-base sm:text-sm"
                                                        value={formData.joint_details}
                                                        onChange={e => setFormData({ ...formData, joint_details: e.target.value })}
                                                        placeholder="例如: 父母、社工"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="order-5 sm:order-none grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium mb-2 sm:mb-1">日期</label><input type="date" required className="w-full p-3 sm:p-2 border rounded min-h-[44px] sm:min-h-0 text-base sm:text-sm" value={formData.booking_date} onChange={e => setFormData({ ...formData, booking_date: e.target.value })} /></div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-2">
                                            {/* Start Time */}
                                            <div>
                                                <label className="block text-sm font-medium mb-2 sm:mb-1">開始</label>
                                                <div className="flex gap-2 sm:gap-1">
                                                    <select
                                                        required
                                                        className="flex-1 p-3 sm:p-2 border rounded min-h-[44px] sm:min-h-0 text-base sm:text-sm"
                                                        value={formData.start_time.split(':')[0]}
                                                        onChange={e => {
                                                            const newHour = e.target.value;
                                                            const minute = formData.start_time.split(':')[1] || '00';
                                                            setFormData({ ...formData, start_time: `${newHour}:${minute} ` });
                                                        }}
                                                    >
                                                        {Array.from({ length: 14 }, (_, i) => i + 8).map(h => (
                                                            <option key={h} value={String(h).padStart(2, '0')}>{String(h).padStart(2, '0')}</option>
                                                        ))}
                                                    </select>
                                                    <span className="self-center font-bold">:</span>
                                                    <select
                                                        required
                                                        className="w-24 sm:w-20 p-3 sm:p-2 border rounded min-h-[44px] sm:min-h-0 text-base sm:text-sm"
                                                        value={formData.start_time.split(':')[1]}
                                                        onChange={e => {
                                                            const newMinute = e.target.value;
                                                            const hour = formData.start_time.split(':')[0] || '09';
                                                            setFormData({ ...formData, start_time: `${hour}:${newMinute} ` });
                                                        }}
                                                    >
                                                        <option value="00">00</option>
                                                        <option value="30">30</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* End Time */}
                                            <div>
                                                <label className="block text-sm font-medium mb-2 sm:mb-1">結束</label>
                                                <div className="flex gap-2 sm:gap-1">
                                                    <select
                                                        required
                                                        className="flex-1 p-3 sm:p-2 border rounded min-h-[44px] sm:min-h-0 text-base sm:text-sm"
                                                        value={formData.end_time.split(':')[0]}
                                                        onChange={e => {
                                                            const newHour = e.target.value;
                                                            const minute = formData.end_time.split(':')[1] || '00';
                                                            setFormData({ ...formData, end_time: `${newHour}:${minute} ` });
                                                        }}
                                                    >
                                                        {Array.from({ length: 14 }, (_, i) => i + 8).map(h => (
                                                            <option key={h} value={String(h).padStart(2, '0')}>{String(h).padStart(2, '0')}</option>
                                                        ))}
                                                    </select>
                                                    <span className="self-center font-bold">:</span>
                                                    <select
                                                        required
                                                        className="w-24 sm:w-20 p-3 sm:p-2 border rounded min-h-[44px] sm:min-h-0 text-base sm:text-sm"
                                                        value={formData.end_time.split(':')[1]}
                                                        onChange={e => {
                                                            const newMinute = e.target.value;
                                                            const hour = formData.end_time.split(':')[0] || '10';
                                                            setFormData({ ...formData, end_time: `${hour}:${newMinute} ` });
                                                        }}
                                                    >
                                                        <option value="00">00</option>
                                                        <option value="30">30</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="order-6 sm:order-none grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium mb-2 sm:mb-1">地點</label><input type="text" className="w-full p-3 sm:p-2 border rounded min-h-[44px] sm:min-h-0 text-base sm:text-sm" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} /></div>
                                        <div><label className="block text-sm font-medium mb-2 sm:mb-1">談話室</label>
                                            <select
                                                className={`w-full p-3 sm:p-2 border rounded min-h-[44px] sm:min-h-0 text-base sm:text-sm ${fixedPsychologistId ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''} `}
                                                value={formData.room_number}
                                                onChange={e => setFormData({ ...formData, room_number: e.target.value })}
                                                disabled={!!fixedPsychologistId}
                                            >
                                                <option value="">未指派</option>
                                                {rooms.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select></div>
                                    </div>
                                    <div className="order-last sm:order-none"><label className="block text-sm font-medium mb-2 sm:mb-1">備註</label><textarea rows="3" className="w-full p-3 sm:p-2 border rounded text-base sm:text-sm" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
                                </fieldset>

                                <div className="flex justify-end gap-3 pt-2">
                                    <Button variant="outline" type="button" onClick={() => setShowModal(false)}>
                                        {readOnly || (fixedPsychologistId && ['完成', '確認缺席'].includes(formData.status)) ? '關閉' : '取消'}
                                    </Button>
                                    {!readOnly && !(fixedPsychologistId && ['完成', '確認缺席'].includes(formData.status)) && <Button variant="primary" type="submit">{isEditing ? '儲存' : '新增'}</Button>}
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default BookingManagement;
