import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { User, FileText, Database, Settings, Search, Plus, X, Save, ClipboardList } from 'lucide-react';
import Button from '../../components/Button';
import BulletinBoardWidget from '../../components/BulletinBoardWidget';

import CaseDatabase from './CaseDatabaseComponent';
import PsychologistDatabase from './PsychologistDatabaseComponent';
import ProbationOfficerDatabase from './ProbationOfficerDatabaseComponent';
import BookingManagement from './BookingManagementComponent';
import OfficerProfileComponent from './OfficerProfileComponent';
import BulletinBoardManagement from './BulletinBoardManagement';
import SurveyManagement from './SurveyManagement';
import AdvancedStats from './AdvancedStats';
import WriteOffStats from './WriteOffStats';
import ManagerStats from './ManagerStats';

// General Permissions Tab Content
const GeneralTab = ({ departmentName, officerId }) => {
    const [subTab, setSubTab] = useState('query');

    // Default View (Shared by all roles including Admin)
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
            {/* Sub-tabs */}
            <div className="flex gap-4 mb-6 border-b border-gray-100 pb-2 overflow-x-auto">
                <button
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${subTab === 'query' ? 'bg-secondary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    onClick={() => setSubTab('query')}
                >
                    <Search className="w-4 h-4 inline-block mr-1" /> 查詢
                </button>
                <button
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${subTab === 'my_cases' ? 'bg-secondary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    onClick={() => setSubTab('my_cases')}
                >
                    <User className="w-4 h-4 inline-block mr-1" /> 個人資料維護
                </button>
            </div>

            {subTab === 'query' && (
                <div>
                    <BookingManagement
                        readOnly={true}
                        fixedDepartment={departmentName}
                        visibleFilters={['status', 'psychologist', 'date']}
                    />
                </div>
            )}

            {subTab === 'my_cases' && (
                <div>
                    <OfficerProfileComponent officerId={officerId} />
                </div>
            )}
        </div>
    );
};

const DepartmentStats = () => {
    const [subTab, setSubTab] = useState('all_query');

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
            {/* Manager Sub-tabs */}
            <div className="flex gap-4 mb-6 border-b border-gray-100 pb-2 overflow-x-auto">
                <button
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${subTab === 'all_query' ? 'bg-secondary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    onClick={() => setSubTab('all_query')}
                >
                    <Search className="w-4 h-4 inline-block mr-1" /> 全股別查詢
                </button>
                <button
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${subTab === 'stats' ? 'bg-secondary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    onClick={() => setSubTab('stats')}
                >
                    <Database className="w-4 h-4 inline-block mr-1" /> 統計
                </button>
            </div>

            {subTab === 'all_query' && (
                <div>
                    <BookingManagement readOnly={true} />
                </div>
            )}

            {subTab === 'stats' && (
                <div>
                    <ManagerStats />
                </div>
            )}
        </div>
    );
};

const Maintenance = ({ adminId }) => {
    const [subTab, setSubTab] = useState('bookings');

    const tabs = [
        { id: 'bookings', label: '預約管理', icon: FileText },
        { id: 'juveniles', label: '個案資料庫維護', icon: User },
        { id: 'psychologists', label: '心理師資料庫維護', icon: User },
        { id: 'officers', label: '工作人員資料庫維護', icon: Settings },
        { id: 'stats_adv', label: '進階統計', icon: Database },
        { id: 'writeoff', label: '核銷作業', icon: FileText },
        { id: 'bulletins', label: '公告欄維護', icon: FileText },
        { id: 'surveys', label: '問卷管理', icon: ClipboardList },
    ];

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">

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
                {subTab === 'officers' && <ProbationOfficerDatabase />}
                {subTab === 'stats_adv' && <AdvancedStats />}
                {subTab === 'writeoff' && <WriteOffStats />}
                {subTab === 'bulletins' && <BulletinBoardManagement />}
                {subTab === 'surveys' && <SurveyManagement adminId={adminId} />}
            </div>
        </div>
    );
};

const Dashboard = () => {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('cases');

    const departmentName = location.state?.departmentName || '未登入';
    // Get role from location state, default to 'general' if not found
    const role = location.state?.role || 'general';
    const officerId = location.state?.officerId; // Get officerId from login state
    const isSystemAdmin = role === 'admin';
    const isManager = role === 'manager' || role === 'admin';

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
                <div>
                    <h1 className="text-3xl font-bold text-primary">保護官儀表板</h1>
                    <p className="text-gray-500 mt-1">目前身分: {departmentName} <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full ml-2">{role === 'admin' ? '系統管理者' : role === 'manager' ? '審閱者' : '一般權限'}</span></p>
                </div>
            </div>

            {/* Public Bulletin Board */}
            <BulletinBoardWidget viewerRole={role} department={departmentName} officerId={officerId} />

            {/* Tabs */}
            <div className="flex border-b border-gray-200 overflow-x-auto">
                {/* General Tab - Available to everyone */}
                <button
                    className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'cases' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('cases')}
                >
                    <User className="w-4 h-4" /> 普通權限
                </button>

                {/* Reviewer (manager) Tab - Available to Reviewer and Admin */}
                {isManager && (
                    <button
                        className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'stats' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('stats')}
                    >
                        <Database className="w-4 h-4" /> 審閱者權限
                    </button>
                )}

                {/* Admin Tab - Available only to Admin */}
                {isSystemAdmin && (
                    <button
                        className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'admin' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('admin')}
                    >
                        <Settings className="w-4 h-4" /> 系統管理者
                    </button>
                )}
            </div>

            {/* Tab Content */}
            <div className="mt-6">
                {activeTab === 'cases' && <GeneralTab isAdmin={isSystemAdmin} departmentName={departmentName} officerId={officerId} />}
                {activeTab === 'stats' && isManager && <DepartmentStats isAdmin={isSystemAdmin} />}
                {activeTab === 'admin' && isSystemAdmin && <Maintenance adminId={officerId} />}
            </div>
        </div>
    );
};

export default Dashboard;
