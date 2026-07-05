import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Megaphone, ChevronDown, ChevronUp, Bell, Users } from 'lucide-react';
import { toROCDate } from '../utils/dateUtils';

const BulletinBoardWidget = ({
    viewerRole = null, // 'admin' | 'manager' | 'general' | 'psychologist'
    department = null, // Viewer's own department, for officer/manager audience matching
    psychologistId = null // Viewer's own psychologist id, for psychologist audience matching
}) => {
    const [allBulletins, setAllBulletins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        fetchBulletins();
    }, []);

    const fetchBulletins = async () => {
        try {
            const { data, error } = await supabase
                .from('bulletins')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAllBulletins(data || []);
        } catch (error) {
            console.error('Error fetching bulletins:', error);
        } finally {
            setLoading(false);
        }
    };

    // Admins manage bulletins directly, so they always see everything that's on-shelf
    const isWithinPublishPeriod = (b) => {
        const today = new Date().toISOString().split('T')[0];
        if (b.start_date && today < b.start_date) return false;
        if (b.end_date && today > b.end_date) return false;
        return true;
    };

    const matchesAudience = (b) => {
        if (viewerRole === 'admin') return true;
        if (viewerRole === 'psychologist') {
            return !!b.target_all_psychologists || !!b.target_psychologist_ids?.includes(psychologistId);
        }
        // 'manager' / 'general' (probation officers)
        return !!b.target_all_officers || !!(department && b.target_departments?.includes(department));
    };

    const bulletins = allBulletins.filter(b => isWithinPublishPeriod(b) && matchesAudience(b));

    // Only shown to the System Admin, so they can see who each bulletin is targeted at
    const getAudienceSummary = (b) => {
        const parts = [];
        if (b.target_all_psychologists) parts.push('心理師 (全部)');
        if (b.target_all_officers) parts.push('保護官 (全部)');
        if (b.target_psychologist_ids?.length > 0) parts.push(`個別心理師 (${b.target_psychologist_ids.length})`);
        if (b.target_departments?.length > 0) parts.push(`個別股別 (${b.target_departments.length})`);
        return parts.length > 0 ? parts.join('、') : '未設定';
    };

    return (
        <div className="bg-gradient-to-r from-blue-50 to-white rounded-xl shadow-sm border border-blue-100 overflow-hidden mb-6">
            <div
                className="px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-blue-50/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                        <Megaphone className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            系統公告
                            <span className={`${bulletins.length > 0 ? 'bg-red-500' : 'bg-gray-400'} text-white text-xs px-2 py-0.5 rounded-full`}>
                                {bulletins.length}
                            </span>
                        </h3>
                    </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>

            {isExpanded && (
                <div className="px-6 pb-4 cursor-default">
                    {loading ? (
                        <div className="text-gray-500 text-sm py-2">載入公告中...</div>
                    ) : bulletins.length === 0 ? (
                        <div className="text-gray-500 text-sm py-2 pl-2 border-l-2 border-gray-200">
                            目前尚無公告發布。
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {bulletins.map((b) => (
                                <div key={b.id} className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-gray-800 text-lg">{b.title}</h4>
                                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                            {toROCDate(b.created_at)}
                                        </span>
                                    </div>
                                    <p className="text-gray-600 text-sm whitespace-pre-wrap leading-relaxed">
                                        {b.content}
                                    </p>
                                    {viewerRole === 'admin' && (
                                        <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-1.5 text-xs text-gray-400">
                                            <Users className="w-3.5 h-3.5 flex-shrink-0" />
                                            投放對象：{getAudienceSummary(b)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default BulletinBoardWidget;
