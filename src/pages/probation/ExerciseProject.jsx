import React, { useState } from 'react';
import { User, ArrowLeft, FolderKanban, CalendarDays, FileText, ClipboardList } from 'lucide-react';
import ExParticipantsManagement from './ExParticipantsManagement';
import ExSessionsManagement from './ExSessionsManagement';
import ExGroupPageManagement from './ExGroupPageManagement';
import ExAssignmentsManagement from './ExAssignmentsManagement';

// 「運動戒癮團體專案」頁面：專案管理者與專案成員皆可進入。
// 各子頁逐頁加入；每頁自行決定專案管理者／專案成員的權限（資料庫也會驗證）。
const ExerciseProject = ({ project, isSystemAdmin, onBack }) => {
    const [subTab, setSubTab] = useState('sessions');

    // 專案管理者與系統管理者可發布團體頁面
    const canPublish = isSystemAdmin || project.my_role === 'manager';

    const tabs = [
        { id: 'sessions', label: '活動課程管理', icon: CalendarDays },
        { id: 'participants', label: '參與少年資料庫維護', icon: User },
        { id: 'group_page', label: '團體頁面維護', icon: FileText },
        { id: 'assignments', label: '工作分配維護', icon: ClipboardList },
    ];

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
            <div className="flex items-center gap-3 mb-6">
                {onBack && (
                    <button onClick={onBack} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="回到專案列表">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                )}
                <FolderKanban className="w-5 h-5 text-primary" />
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
                {subTab === 'sessions' && <ExSessionsManagement />}
                {subTab === 'participants' && <ExParticipantsManagement />}
                {subTab === 'assignments' && <ExAssignmentsManagement />}
                {subTab === 'group_page' && <ExGroupPageManagement canPublish={canPublish} />}
            </div>
        </div>
    );
};

export default ExerciseProject;
