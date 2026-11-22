import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle } from 'lucide-react';
import Button from '../../components/Button';
import { supabase, setSessionToken } from '../../supabase';

const PsychologistLogin = () => {
    const navigate = useNavigate();
    const [psychologists, setPsychologists] = useState([]);
    const [selectedName, setSelectedName] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPsychologists = async () => {
            try {
                const { data, error } = await supabase.rpc('get_login_psychologists');

                if (error) throw error;
                setPsychologists(data);
            } catch (err) {
                console.error('Error fetching psychologists:', err);
                setError('無法載入心理師列表，請稍後再試');
            } finally {
                setLoading(false);
            }
        };

        fetchPsychologists();
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(null);

        if (!selectedName) {
            setError('請選擇心理師姓名');
            return;
        }

        if (!password) {
            setError('請輸入密碼');
            return;
        }

        try {
            // Secure Login via RPC：成功時回傳 session token
            const { data, error } = await supabase
                .rpc('login_psychologist', {
                    p_id: selectedName,
                    p_password: password
                });

            if (error) throw error;

            if (data && data.token) {
                setSessionToken(data.token);
                navigate('/psychologist/dashboard', {
                    state: {
                        psychologistId: data.id,
                        psychologistName: data.name
                    }
                });
            } else {
                setError('密碼錯誤，請重試');
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('登入發生錯誤，請稍後再試');
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 sm:mt-20">
            <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-lg border border-gray-100">
                <h2 className="text-2xl font-bold text-center text-primary mb-8">心理師登入</h2>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">選擇心理師</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <select
                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all appearance-none bg-white"
                                value={selectedName}
                                onChange={(e) => setSelectedName(e.target.value)}
                                required
                                disabled={loading}
                            >
                                <option value="">{loading ? '載入中...' : '請選擇您的姓名'}</option>
                                {psychologists.map((psych) => (
                                    <option key={psych.id} value={psych.id}>{psych.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">密碼</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="password"
                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                                placeholder="請輸入密碼"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <Button variant="primary" className="w-full justify-center text-lg py-3 mt-4" disabled={loading}>
                        確認登入
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default PsychologistLogin;
