import React, { useState } from 'react';
import { FileText, User, Settings, Database, Megaphone, ClipboardList, Users, ArrowLeft } from 'lucide-react';

import BookingManagement from './BookingManagementComponent';
import CaseDatabase from './CaseDatabaseComponent';
import PsychologistDatabase from './PsychologistDatabaseComponent';
import PsyAdvancedStats from './PsyAdvancedStats';
import WriteOffStats from './WriteOffStats';
import ProbationOfficerDatabase from './ProbationOfficerDatabaseComponent';
import BulletinBoardManagement from './BulletinBoardManagement';
import SurveyManagement from './SurveyManagement';

// 「心理服務專案」頁面：專案管理者（及系統管理者）使用。
// 前五項為完整功能；後三項對專案管理者是受限版（系統管理者在此仍是完整版）。
const PsyServiceProject = ({ project, officerId, isSystemAdmin, onBack }) => {
    const [subTab, setSubTab] = useState('bookings');

    const tabs = [
        { id: 'bookings', label: '預約管理', icon: FileText },
        { id: 'juveniles', label: '個案資料庫維護', icon: User },
        { id: 'psychologists', label: '心理服務人員維護', icon: User },
        { id: 'stats_adv', label: '進階統計', icon: Database },
        { id: 'writeoff', label: '核銷作業', icon: FileText },
        { id: 'staff', label: '工作人員維護', icon: Settings },
        { id: 'bulletins', label: '公告欄維護', icon: Megaphone },
        { id: 'surveys', label: '問卷管理', icon: ClipboardList },
    ];

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
            <div className="flex items-center gap-3 mb-6">
                {onBack && (
                    <button onClick={onBack} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="回到專案列表">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                )}
                <Users className="w-5 h-5 text-primary" />
                <h3 className="text-xl font-bold text-primary">{project.name}</h3>
            </div>

            <div className="flex overflow-x-auto gap-3 mb-8 border-b border-gray-100 pb-4">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        title={tab.label}
                        className={`flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${subTab === tab.id
                            ? 'bg-secondary text-white shadow-md'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                            }`}
                        onClick={() => setSubTab(tab.id)}
                    >
                        <tab.icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                {subTab === 'bookings' && <BookingManagement allowExport={true} showReimbursement={true} />}
                {subTab === 'juveniles' && <CaseDatabase />}
                {subTab === 'psychologists' && <PsychologistDatabase />}
                {subTab === 'stats_adv' && <PsyAdvancedStats />}
                {subTab === 'writeoff' && <WriteOffStats />}
                {subTab === 'staff' && <ProbationOfficerDatabase limited={!isSystemAdmin} />}
                {subTab === 'bulletins' && <BulletinBoardManagement projectId={project.id} ownerId={isSystemAdmin ? null : officerId} />}
                {subTab === 'surveys' && <SurveyManagement adminId={officerId} />}
            </div>
        </div>
    );
};

export default PsyServiceProject;
