import React, { useState } from 'react';
import { User, ArrowLeft, FolderKanban, CalendarDays, FileText, ClipboardList, Receipt, Megaphone, FileSpreadsheet } from 'lucide-react';
import ExParticipantsManagement from './ExParticipantsManagement';
import ExSessionsManagement from './ExSessionsManagement';
import ExGroupPageManagement from './ExGroupPageManagement';
import ExAssignmentsManagement from './ExAssignmentsManagement';
import BulletinBoardManagement from './BulletinBoardManagement';
import ExFormsManagement from './ExFormsManagement';

// 「運動戒癮團體專案」頁面：專案管理者與專案成員皆可進入。
// 各子頁逐頁加入；每頁自行決定專案管理者／專案成員的權限（資料庫也會驗證）。
const ExerciseProject = ({ project, isSystemAdmin, officerId, onBack }) => {
    const [subTab, setSubTab] = useState('sessions');

    // 專案管理者與系統管理者：可發布團體頁面、可編輯工作分配
    const canPublish = isSystemAdmin || project.my_role === 'manager';

    const tabs = [
        { id: 'sessions', label: '活動課程管理', icon: CalendarDays },
        { id: 'participants', label: '參與少年資料庫維護', icon: User },
        { id: 'group_page', label: '團體頁面維護', icon: FileText },
        { id: 'assignments', label: '工作分配維護', icon: ClipboardList },
        { id: 'writeoff', label: '核銷作業', icon: Receipt },
        // 公告欄維護：僅專案管理者（與系統管理者）
        { id: 'bulletins', label: '公告欄維護', icon: Megaphone, managerOnly: true },
        // 表單維護：專案成員、專案管理者與系統管理者皆可
        { id: 'forms', label: '表單維護', icon: FileSpreadsheet },
    ].filter(t => !t.managerOnly || canPublish);

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
                {subTab === 'sessions' && <ExSessionsManagement isManager={canPublish} officerId={officerId} />}
                {subTab === 'participants' && <ExParticipantsManagement />}
                {subTab === 'assignments' && <ExAssignmentsManagement canEdit={canPublish} />}
                {subTab === 'writeoff' && (
                    <div className="py-10 text-center text-gray-400">
                        <div className="text-lg font-bold text-gray-500 mb-1">核銷作業</div>
                        功能開發中
                    </div>
                )}
                {subTab === 'forms' && <ExFormsManagement />}
                {subTab === 'bulletins' && canPublish && (
                    <BulletinBoardManagement projectId={project.id} ownerId={isSystemAdmin ? null : officerId} staffOnly />
                )}
                {subTab === 'group_page' && <ExGroupPageManagement canPublish={canPublish} />}
            </div>
        </div>
    );
};

export default ExerciseProject;
