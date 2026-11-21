import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Users, AlertCircle } from 'lucide-react';
import Button from '../../components/Button';
import { supabase } from '../../supabase';

const ProbationLogin = () => {
    const navigate = useNavigate();
    const [departmentOptions, setDepartmentOptions] = useState([]);
    const [selectedDept, setSelectedDept] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch Unique Departments from probation_officers
    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                // Use the same RPC as the database view to ensure consistent sorting
                const { data, error } = await supabase
                    .rpc('get_admin_view_officers');

                if (error) throw error;

                // Extract unique departments, maintaining the order from the RPC result
                // RPC likely returns flat object with 'department' or 'departments' json? 
                // Previous code assumed 'department' column. officer component uses 'officer.department || officer.departments?.name'.
                // Let's check RPC return in officer component: `const { data } = await supabase.rpc('get_admin_view_officers'); setOfficers(data);`
                // And render uses `officer.department || (officer.departments && officer.departments.name)`.
                // Let's safe guard map:
                const deptList = data
                    .map(o => o.department || (typeof o.departments === 'object' ? o.departments?.name : o.departments))
                    .filter(d => d); // remove null/empty
                const uniqueDeptsClean = [...new Set(deptList)];

                setDepartmentOptions(uniqueDeptsClean);

            } catch (err) {
                console.error('Error fetching departments:', err);
                setError('無法載入股別列表');
            } finally {
                setLoading(false);
            }
        };

        fetchDepartments();
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(null);

        if (!selectedDept || !password) {
            setError('請完整填寫所有欄位');
            return;
        }

        try {
            // Secure Login via RPC
            const { data, error } = await supabase
                .rpc('verify_probation_login', {
                    input_department: selectedDept,
                    input_password: password
                });

            if (error) throw error;

            if (!data || data.length === 0) {
                setError('密碼錯誤，或該股別無此密碼使用者');
                return;
            }

            const officer = data[0]; // RPC returns a table/array

            // Success
            navigate('/probation/dashboard', {
                state: {
                    departmentName: officer.department,
                    officerId: officer.id,
                    officerName: officer.name,
                    role: officer.role
                }
            });

        } catch (err) {
            console.error('Login error:', err);
            setError('發生錯誤，請稍後再試');
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 sm:mt-20">
            <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-lg border-2 border-primary/10">
                <h2 className="text-2xl font-bold text-center text-primary mb-8">保護官登入</h2>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    {/* Department Select (Dynamic from existing officers) */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">選擇股別</label>
                        <div className="relative">
                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <select
                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none bg-white"
                                value={selectedDept}
                                onChange={(e) => setSelectedDept(e.target.value)}
                                required
                                disabled={loading}
                            >
                                <option value="">{loading ? '載入中...' : '請選擇股別'}</option>
                                {departmentOptions.map((deptName, index) => (
                                    <option key={index} value={deptName}>{deptName}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">密碼</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="password"
                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                placeholder="請輸入密碼"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <Button variant="secondary" className="w-full justify-center text-lg py-3 mt-4" disabled={loading}>
                        確認登入
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default ProbationLogin;
