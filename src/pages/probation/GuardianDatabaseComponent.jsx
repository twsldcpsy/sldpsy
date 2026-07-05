import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import Button from '../../components/Button';
import MultiSelectFilter from '../../components/MultiSelectFilter';
import { Plus, X, Edit, Trash2, Search, Filter, Download, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { convertDateStringToROC, toROCDate } from '../../utils/dateUtils';

const GuardianDatabase = () => {
    const [guardians, setGuardians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Form Data
    const [formData, setFormData] = useState({
        name: '',
        juvenile_name: '',
        case_number: '',
        case_type: '強制親職教育', // Default case type
        status: '服務中', // Default status
        closure_reason: '',
        selected_department: '', // UI State for Dropdown
        probation_officer_id: '', // Actual Foreign Key
        psychologist_id: ''
    });

    // Filter State
    const [filters, setFilters] = useState({
        searchQuery: '',
        status: [],
        department: [],
        psychologist_id: []
    });

    // Data for Dropdowns
    const [officers, setOfficers] = useState([]); // All officers with {id, name, department}
    const [uniqueDepartments, setUniqueDepartments] = useState([]);
    const [psychologists, setPsychologists] = useState([]);

    // Fetch initial data
    useEffect(() => {
        fetchGuardians();
        fetchDropdowns();
    }, []);

    const fetchGuardians = async () => {
        try {
            const { data, error } = await supabase
                .from('guardians')
                .select(`
                    *,
                    probation_officers (id, name, department),
                    psychologists (name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setGuardians(data);
        } catch (error) {
            console.error('Error fetching guardians:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDropdowns = async () => {
        try {
            // 1. Fetch Officers (to get Departments and Names)
            const { data: officersData } = await supabase
                .from('probation_officers')
                .select('id, name, department')
                .neq('department', null)
                .order('department');

            setOfficers(officersData || []);

            // Extract unique departments for the dropdown
            const depts = [...new Set(officersData?.map(o => o.department))];
            setUniqueDepartments(depts);

            // 2. Fetch Psychologists
            const { data: psychs } = await supabase
                .from('psychologists')
                .select('id, name');
            setPsychologists(psychs || []);

        } catch (error) {
            console.error('Error fetching dropdowns:', error);
        }
    };

    const handleOpenAdd = () => {
        setIsEditing(false);
        setEditingId(null);
        setFormData({
            name: '',
            juvenile_name: '',
            case_number: '',
            case_type: '強制親職教育',
            status: '服務中',
            closure_reason: '',
            selected_department: '',
            probation_officer_id: '',
            psychologist_id: ''
        });
        setShowModal(true);
    };

    const handleOpenEdit = (guardian) => {
        setIsEditing(true);
        setEditingId(guardian.id);

        // Determine existing department from the joined PO data
        const existDept = guardian.probation_officers?.department || '';

        setFormData({
            name: guardian.name,
            juvenile_name: guardian.juvenile_name || '',
            case_number: guardian.case_number,
            case_type: '強制親職教育',
            status: guardian.status || '服務中',
            closure_reason: guardian.closure_reason || '',
            selected_department: existDept,
            probation_officer_id: guardian.probation_officer_id || '',
            psychologist_id: guardian.psychologist_id || ''
        });
        setShowModal(true);
    };

    // When Department changes, auto-select the PO
    const handleDepartmentChange = (deptName) => {
        const matchedOfficer = officers.find(o => o.department === deptName);
        setFormData(prev => ({
            ...prev,
            selected_department: deptName,
            probation_officer_id: matchedOfficer ? matchedOfficer.id : ''
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let error;
            const payload = {
                name: formData.name,
                juvenile_name: formData.juvenile_name,
                case_number: formData.case_number,
                case_type: formData.case_type,
                status: formData.status,
                closure_reason: formData.status === '已結案' ? (formData.closure_reason || null) : null,
                probation_officer_id: formData.probation_officer_id || null,
                psychologist_id: formData.psychologist_id || null
            };

            if (isEditing) {
                const { error: updateError } = await supabase
                    .from('guardians')
                    .update(payload)
                    .eq('id', editingId);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('guardians')
                    .insert([payload]);
                error = insertError;
            }

            if (error) throw error;

            setShowModal(false);
            fetchGuardians();
        } catch (error) {
            alert(isEditing ? '更新失敗: ' : '新增失敗: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('確定要刪除此筆家長資料嗎？此操作無法復原。')) return;

        try {
            const { error } = await supabase
                .from('guardians')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchGuardians();
        } catch (error) {
            if (error?.code === '23503' || (error?.message && error.message.includes('foreign key constraint'))) {
                alert('無法刪除：此家長有相關的「預約或諮商紀錄」。\n\n基於資料完整性，系統不允許直接刪除。請先刪除其相關紀錄，或將該名家長狀態改為「已結案」。');
            } else {
                alert('刪除失敗: ' + (error?.message || '未知錯誤'));
            }
        }
    };

    const selectedOfficerName = officers.find(o => o.id === formData.probation_officer_id)?.name || '';

    // Filter Logic
    const filteredGuardians = guardians.filter(g => {
        // Search Query
        if (filters.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            const name = g.name?.toLowerCase() || '';
            const caseNum = g.case_number?.toLowerCase() || '';
            if (!name.includes(query) && !caseNum.includes(query)) return false;
        }
        // Status
        if (filters.status.length > 0 && !filters.status.includes(g.status)) return false;
        // Department
        if (filters.department.length > 0 && !filters.department.includes(g.probation_officers?.department)) return false;
        // Psychologist
        if (filters.psychologist_id.length > 0 && !filters.psychologist_id.includes(g.psychologist_id)) return false;

        return true;
    });

    const handleExport = () => {
        try {
            // Prepare data for export
            const exportData = filteredGuardians.map(g => ({
                '狀態': g.status || '服務中',
                '家長姓名': g.name,
                '案號': g.case_number,
                '所屬股別': g.probation_officers?.department || '',
                '保護官': g.probation_officers?.name || '',
                '負責心理師': g.psychologists?.name || '',
                '建檔時間': toROCDate(g.created_at)
            }));

            // Create worksheet
            const ws = XLSX.utils.json_to_sheet(exportData);

            // Create workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "家長資料");

            // Generate filename with date
            const fileName = `家長資料庫匯出_${toROCDate(new Date())}.xlsx`;

            // Export
            XLSX.writeFile(wb, fileName);
        } catch (error) {
            console.error('Export failed:', error);
            alert('匯出失敗: ' + error.message);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-primary">家長資料庫</h3>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExport} className="flex items-center gap-1">
                        <Download className="w-4 h-4" /> 匯出資料
                    </Button>
                    <Button variant="primary" onClick={handleOpenAdd} className="flex items-center gap-1">
                        <Plus className="w-4 h-4" /> 新增家長
                    </Button>
                </div>
            </div>

            {/* Filter Section */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3 mb-6">
                <div className="flex items-center gap-2 text-gray-700 font-medium mb-1">
                    <Filter className="w-4 h-4" /> 篩選條件
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    <div className="col-span-2 relative">
                        <input
                            type="text"
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder="搜尋姓名、案號..."
                            value={filters.searchQuery}
                            onChange={e => setFilters({ ...filters, searchQuery: e.target.value })}
                        />
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    </div>
                    <MultiSelectFilter
                        label="所有狀態"
                        options={[{ value: '服務中', label: '服務中' }, { value: '已結案', label: '已結案' }]}
                        selected={filters.status}
                        onChange={vals => setFilters({ ...filters, status: vals })}
                    />
                    <MultiSelectFilter
                        label="所有股別"
                        options={uniqueDepartments.map(d => ({ value: d, label: d }))}
                        selected={filters.department}
                        onChange={vals => setFilters({ ...filters, department: vals })}
                    />
                    <MultiSelectFilter
                        label="所有心理師"
                        options={psychologists.map(p => ({ value: p.id, label: p.name }))}
                        selected={filters.psychologist_id}
                        onChange={vals => setFilters({ ...filters, psychologist_id: vals })}
                    />
                </div>
            </div>

            {/* List View */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
                            <th className="py-3 px-4">狀態</th>
                            <th className="py-3 px-4">家長姓名</th>
                            <th className="py-3 px-4">案號</th>
                            <th className="py-3 px-4">所屬股別</th>
                            <th className="py-3 px-4">保護官</th>
                            <th className="py-3 px-4">負責心理師</th>
                            <th className="py-3 px-4">建檔時間</th>
                            <th className="py-3 px-4 text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-700">
                        {loading ? (
                            <tr><td colSpan="8" className="py-8 text-center text-gray-400">載入中...</td></tr>
                        ) : filteredGuardians.length === 0 ? (
                            <tr><td colSpan="8" className="py-8 text-center text-gray-400">沒有符合條件的資料</td></tr>
                        ) : (
                            filteredGuardians.map((g) => (
                                <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                    <td className="py-3 px-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${g.status === '已結案' ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'
                                            }`}>
                                            {g.status || '服務中'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 font-medium">{g.name}</td>
                                    <td className="py-3 px-4">{g.case_number}</td>
                                    <td className="py-3 px-4 text-primary font-medium">{g.probation_officers?.department || '-'}</td>
                                    <td className="py-3 px-4">{g.probation_officers?.name || '-'}</td>
                                    <td className="py-3 px-4">{g.psychologists?.name || '-'}</td>
                                    <td className="py-3 px-4 text-sm text-gray-400">{toROCDate(g.created_at)}</td>
                                    <td className="py-3 px-4 flex justify-center gap-2">
                                        <button
                                            onClick={() => handleOpenEdit(g)}
                                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                            title="編輯"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(g.id)}
                                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                            title="刪除"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-primary">
                                {isEditing ? '編輯家長資料' : '新增家長資料'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">家長姓名</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                    <p className="text-xs text-orange-600 mt-1">請適度隱蔽家長姓名，例如：周小耕改為「周Ｏ耕」，以保障家長隱私！</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">狀態</label>
                                    <select
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none bg-white"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="服務中">服務中</option>
                                        <option value="已結案">已結案</option>
                                    </select>
                                    {formData.status === '已結案' && (
                                        <div className="mt-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">結案原因</label>
                                            <select
                                                required
                                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none bg-white"
                                                value={formData.closure_reason}
                                                onChange={e => setFormData({ ...formData, closure_reason: e.target.value })}
                                            >
                                                <option value="">請選擇</option>
                                                <option value="期滿">期滿</option>
                                                <option value="處分轉換">處分轉換</option>
                                                <option value="已無需求">已無需求</option>
                                                <option value="更換心理師">更換心理師</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">案號</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none"
                                    value={formData.case_number}
                                    onChange={e => setFormData({ ...formData, case_number: e.target.value })}
                                />
                                <p className="text-xs text-gray-500 mt-1">統一案號書寫方式，例如：115年度觀少護字第118號改為「115,觀少護,118」</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">少年姓名</label>
                                <div className="bg-orange-50 text-orange-700 border border-orange-200 p-2 rounded-lg mb-2 text-xs font-medium flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    請適度隱蔽少年姓名，例如：周小耕改為「周Ｏ耕」，以保障少年隱私！
                                </div>
                                <input
                                    type="text"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none"
                                    value={formData.juvenile_name}
                                    onChange={e => setFormData({ ...formData, juvenile_name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">案件類型</label>
                                <select
                                    disabled
                                    className="w-full p-2 border border-gray-300 rounded-lg outline-none bg-gray-100 text-gray-500 cursor-not-allowed"
                                    value={formData.case_type}
                                    onChange={e => setFormData({ ...formData, case_type: e.target.value })}
                                >
                                    <option value="強制親職教育">強制親職教育</option>
                                </select>
                            </div>

                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
                                <h4 className="text-sm font-bold text-gray-700">歸屬設定</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">所屬股別</label>
                                        <select
                                            required
                                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none bg-white"
                                            value={formData.selected_department}
                                            onChange={e => handleDepartmentChange(e.target.value)}
                                        >
                                            <option value="">請選擇股別</option>
                                            {uniqueDepartments.map((dept, idx) => (
                                                <option key={idx} value={dept}>{dept}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">保護官 (自動帶入)</label>
                                        <input
                                            type="text"
                                            readOnly
                                            className="w-full p-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
                                            value={selectedOfficerName || '---'}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">負責心理師</label>
                                <select
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary/20 outline-none bg-white"
                                    value={formData.psychologist_id}
                                    onChange={e => setFormData({ ...formData, psychologist_id: e.target.value })}
                                >
                                    <option value="">請選擇(選填)</option>
                                    {psychologists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <Button variant="outline" type="button" onClick={() => setShowModal(false)}>取消</Button>
                                <Button variant="primary" type="submit">
                                    {isEditing ? '儲存變更' : '確認新增'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GuardianDatabase;
