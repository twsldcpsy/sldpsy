import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BookingManagement from '../probation/BookingManagementComponent';
import PsychologistProfileModal from './PsychologistProfileModal';
import BulletinBoardWidget from '../../components/BulletinBoardWidget';
import { Settings } from 'lucide-react';

const Dashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Fallback if no state (e.g. direct access), simpler handling for now
    const initialName = location.state?.psychologistName || '心理師';
    const [currentName, setCurrentName] = useState(initialName);
    const psychologistId = location.state?.psychologistId;
    const [showProfileModal, setShowProfileModal] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
                <div>
                    <h1 className="text-3xl font-bold text-primary">心理師儀表板</h1>
                    <p className="text-gray-500 mt-1">歡迎回來，{currentName}</p>
                </div>
                <button
                    onClick={() => setShowProfileModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:text-primary transition-all shadow-sm"
                >
                    <Settings className="w-4 h-4" />
                    個人資料維護
                </button>
            </div>

            {/* Public Bulletin Board */}
            <BulletinBoardWidget viewerRole="psychologist" psychologistId={psychologistId} />

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[500px]">
                {psychologistId ? (
                    <BookingManagement
                        readOnly={false}
                        fixedPsychologistId={psychologistId}
                        visibleFilters={['search', 'status', 'department', 'date']}
                    />
                ) : (
                    <div className="text-center text-gray-400 py-10">
                        無法載入預約資料：未偵測到登入身分。
                    </div>
                )}
            </div>

            {showProfileModal && (
                <PsychologistProfileModal
                    psychologistId={psychologistId}
                    onClose={() => setShowProfileModal(false)}
                    onUpdate={(newName) => setCurrentName(newName)}
                />
            )}
        </div>
    );
};

export default Dashboard;
