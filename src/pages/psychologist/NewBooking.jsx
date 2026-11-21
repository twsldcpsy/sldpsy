import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import Button from '../../components/Button';
import { supabase } from '../../supabase';

const NewBooking = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    // Mock user context (In a real app, use AuthContext)
    // For now, we'll fetch the first psychologist as the "current user" if not logged in
    const [currentUser, setCurrentUser] = useState(null);

    const [formData, setFormData] = useState({
        juvenile_id: '',
        status: '尚未開始', // Default status requirement
        counseling_type: 'Individual',
        individual_subject: 'Juvenile',
        joint_attendees_count: '',
        joint_details: '',
        booking_date: new Date().toISOString().split('T')[0],
        start_time: '09:00',
        duration: '60',
        location: '諮商室 1',
        notes: ''
    });

    const [juveniles, setJuveniles] = useState([]);

    // Auto-filled info
    const [selectedJuvenileInfo, setSelectedJuvenileInfo] = useState({
        gender: '',
        caseType: '',
        department: ''
    });

    useEffect(() => {
        fetchJuveniles();
        fetchCurrentUser();
    }, []);

    const fetchCurrentUser = async () => {
        // This is a placeholder
        const { data } = await supabase.from('psychologists').select('id').limit(1).single();
        if (data) setCurrentUser(data);
    };

    const fetchJuveniles = async () => {
        try {
            console.log('Fetching using Standard Foreign Key Join -> probation_officers(department)');

            // Replicate the working logic from JuvenileDatabaseComponent
            const { data, error } = await supabase
                .from('juveniles')
                .select(`
                    *,
                    probation_officers (
                        department
                    )
                `)
                .eq('status', '服務中')
                .order('name');

            if (error) {
                console.error('Fetch Error:', error);
                throw error;
            }

            console.log('Fetched data:', data);

            const enrichedJuveniles = data?.map(j => {
                // Handle Supabase join result (it comes as an object usually, or array if 1-many but this is many-1)
                // probation_officers should be an object here because juvenile has one PO.
                const dept = j.probation_officers?.department;
                return {
                    ...j,
                    department: dept || '未分股'
                };
            }) || [];

            setJuveniles(enrichedJuveniles);
        } catch (error) {
            console.error('Error fetching juveniles:', error);
            alert('無法讀取少年資料: ' + error.message);
        }
    };


    const handleJuvenileChange = (e) => {
        const id = e.target.value;
        setFormData(prev => ({ ...prev, juvenile_id: id }));

        const selected = juveniles.find(j => j.id === id);
        if (selected) {
            // Updated to be compatible if columns are added later
            setSelectedJuvenileInfo({
                gender: selected.gender || '-',
                caseType: selected.case_type || '-', // Assuming column name might be case_type
                department: selected.department || '-'
            });
        } else {
            setSelectedJuvenileInfo({ gender: '', caseType: '', department: '' });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Calculate end_time
            const [hours, mins] = formData.start_time.split(':').map(Number);
            const duration = parseInt(formData.duration);
            const endDate = new Date();
            endDate.setHours(hours);
            endDate.setMinutes(mins + duration);
            const end_time = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

            const payload = {
                juvenile_id: formData.juvenile_id,
                psychologist_id: currentUser?.id, // Use the fetched ID
                status: '尚未開始', // Explicitly set status
                counseling_type: formData.counseling_type,
                individual_subject: formData.counseling_type === 'Individual' ? formData.individual_subject : null,
                joint_attendees_count: formData.counseling_type === 'Joint' ? (parseInt(formData.joint_attendees_count) || 0) : null,
                joint_details: formData.counseling_type === 'Joint' ? formData.joint_details : null,
                booking_date: formData.booking_date,
                start_time: formData.start_time,
                end_time: end_time,
                location: formData.location,
                notes: formData.notes
            };

            const { error } = await supabase.from('bookings').insert([payload]);
            if (error) throw error;

            alert('預約成功！');
            navigate(-1);
        } catch (error) {
            console.error('Error submitting booking:', error);
            alert('預約失敗: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-10">


            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-primary">新增諮商預約</h1>
                <Button variant="outline" onClick={() => navigate(-1)}>
                    <X className="w-4 h-4 mr-1" /> 取消
                </Button>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-xl shadow-sm border border-gray-100">
                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Section 1: Juvenile Info */}
                    <section className="space-y-4">
                        <h3 className="text-lg font-bold text-secondary border-b border-gray-100 pb-2">個案資料</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-2">少年姓名</label>
                                <div className="relative">
                                    <select
                                        required
                                        className="w-full px-4 py-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm rounded-lg border border-gray-300 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all bg-white"
                                        value={formData.juvenile_id}
                                        onChange={handleJuvenileChange}
                                    >
                                        <option value="">選擇少年...</option>
                                        {juveniles.map(j => (
                                            <option key={j.id} value={j.id}>{j.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">性別 (自動帶入)</label>
                                <input
                                    type="text"
                                    readOnly
                                    className="w-full px-4 py-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm rounded-lg border border-gray-200 bg-gray-50 text-gray-500"
                                    value={selectedJuvenileInfo.gender}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">處遇類別 (自動帶入)</label>
                                <input
                                    type="text"
                                    readOnly
                                    className="w-full px-4 py-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm rounded-lg border border-gray-200 bg-gray-50 text-gray-500"
                                    value={selectedJuvenileInfo.caseType}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">所屬股別 (自動帶入)</label>
                                <input
                                    type="text"
                                    readOnly
                                    className="w-full px-4 py-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm rounded-lg border border-gray-200 bg-gray-50 text-gray-500"
                                    value={selectedJuvenileInfo.department}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Counseling Details */}
                    <section className="space-y-4">
                        <h3 className="text-lg font-bold text-secondary border-b border-gray-100 pb-2">諮商內容</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">諮商類別</label>
                                <div className="flex gap-4">
                                    {['Individual', 'Joint'].map((type) => (
                                        <label key={type} className={`flex-1 border rounded-lg p-3 text-center cursor-pointer transition-all ${formData.counseling_type === type ? 'bg-secondary text-white border-secondary' : 'hover:bg-gray-50'}`}>
                                            <input
                                                type="radio"
                                                name="counseling_type"
                                                className="hidden"
                                                checked={formData.counseling_type === type}
                                                onChange={() => setFormData(p => ({ ...p, counseling_type: type }))}
                                            />
                                            {type === 'Individual' && '個別諮商'}
                                            {type === 'Joint' && '聯合諮商'}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Conditional Logic Fields */}
                            {formData.counseling_type === 'Individual' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">諮商對象</label>
                                    <select
                                        className="w-full px-4 py-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm rounded-lg border border-gray-300 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none"
                                        value={formData.individual_subject}
                                        onChange={(e) => setFormData(p => ({ ...p, individual_subject: e.target.value }))}
                                    >
                                        <option value="Juvenile">少年本人</option>
                                        <option value="Parent">家長/監護人</option>
                                    </select>
                                </div>
                            )}

                            {formData.counseling_type === 'Joint' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">參與人數與細節</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            min="2"
                                            className="w-20 px-4 py-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm rounded-lg border border-gray-300 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none"
                                            value={formData.joint_attendees_count}
                                            onChange={(e) => setFormData(p => ({ ...p, joint_attendees_count: e.target.value }))}
                                        />
                                        <input
                                            type="text"
                                            placeholder="請註明參與者 (如: 父母、兄弟姊妹)"
                                            className="flex-1 px-4 py-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm rounded-lg border border-gray-300 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none"
                                            value={formData.joint_details}
                                            onChange={(e) => setFormData(p => ({ ...p, joint_details: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Section 3: Time & Location */}
                    <section className="space-y-4">
                        <h3 className="text-lg font-bold text-secondary border-b border-gray-100 pb-2">時間與地點</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="col-span-1 lg:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">日期 與 時間</label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="date"
                                        required
                                        className="flex-1 px-4 py-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm rounded-lg border border-gray-300 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none"
                                        value={formData.booking_date}
                                        onChange={(e) => setFormData(p => ({ ...p, booking_date: e.target.value }))}
                                    />
                                    <div className="flex gap-1 w-full sm:w-48">
                                        <select
                                            required
                                            className="flex-1 px-2 py-2.5 rounded-lg border border-gray-300 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none bg-white"
                                            value={formData.start_time.split(':')[0]}
                                            onChange={e => {
                                                const newHour = e.target.value;
                                                const minute = formData.start_time.split(':')[1] || '00';
                                                setFormData({ ...formData, start_time: `${newHour}:${minute}` });
                                            }}
                                        >
                                            {Array.from({ length: 14 }, (_, i) => i + 8).map(h => (
                                                <option key={h} value={String(h).padStart(2, '0')}>{String(h).padStart(2, '0')}</option>
                                            ))}
                                        </select>
                                        <span className="self-center">:</span>
                                        <select
                                            required
                                            className="w-20 px-2 py-2.5 rounded-lg border border-gray-300 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none bg-white"
                                            value={formData.start_time.split(':')[1]}
                                            onChange={e => {
                                                const newMinute = e.target.value;
                                                const hour = formData.start_time.split(':')[0] || '09';
                                                setFormData({ ...formData, start_time: `${hour}:${newMinute}` });
                                            }}
                                        >
                                            <option value="00">00</option>
                                            <option value="30">30</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">地點</label>
                                <select
                                    className="w-full px-4 py-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm rounded-lg border border-gray-300 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none"
                                    value={formData.location}
                                    onChange={(e) => setFormData(p => ({ ...p, location: e.target.value }))}
                                >
                                    <option>諮商室 1</option>
                                    <option>諮商室 2</option>
                                    <option>團體室</option>
                                    <option>沙遊治療室</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">時數 (分鐘)</label>
                                <select
                                    className="w-full px-4 py-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm rounded-lg border border-gray-300 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none"
                                    value={formData.duration}
                                    onChange={(e) => setFormData(p => ({ ...p, duration: e.target.value }))}
                                >
                                    <option value="30">30 分鐘</option>
                                    <option value="60">60 分鐘</option>
                                    <option value="90">90 分鐘</option>
                                    <option value="120">120 分鐘</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">備註</label>
                            <textarea
                                rows="3"
                                className="w-full px-4 py-2.5 min-h-[44px] sm:min-h-0 text-base sm:text-sm rounded-lg border border-gray-300 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none"
                                placeholder="其他需要注意的事項..."
                                value={formData.notes}
                                onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                            ></textarea>
                        </div>
                    </section>

                    <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row justify-end gap-4">
                        <Button variant="outline" type="button" onClick={() => navigate(-1)} className="w-full sm:w-auto">取消</Button>
                        <Button variant="primary" type="submit" className="px-8 w-full sm:w-auto" disabled={loading}>
                            <Save className="w-4 h-4 mr-2" />
                            {loading ? '處理中...' : '確認預約'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewBooking;
