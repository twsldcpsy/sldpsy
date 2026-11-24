import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { User, FileText, Database, Settings, Search, Plus, X, Save, ClipboardList, FolderKanban } from 'lucide-react';
import Button from '../../components/Button';
import BulletinBoardWidget from '../../components/BulletinBoardWidget';

import ProbationOfficerDatabase from './ProbationOfficerDatabaseComponent';
import BookingManagement from './BookingManagementComponent';
import OfficerProfileComponent from './OfficerProfileComponent';
import BulletinBoardManagement from './BulletinBoardManagement';
import SurveyManagement from './SurveyManagement';
import ProjectManagement from './ProjectManagement';
import ProjectPermissionTab from './ProjectPermissionTab';
import ProjectIntroView from './ProjectIntroView';
import { PROJECT_ROLE_LABEL } from '../../utils/projectUtils';
import { supabase } from '../../supabase';
import ManagerStats from './ManagerStats';

// General Permissions Tab Content
const GeneralTab = ({ departmentName, officerId, introPages }) => {
    const [subTab, setSubTab] = useState('query');
    const [intro, setIntro] = useState({ key: null, data: null });
    const introKey = subTab.startsWith('intro:') ? subTab.slice(6) : null;

    // 已發布的專案介紹頁（例如運動戒癮團體）：點選子頁時才讀取內容
    useEffect(() => {
        if (!introKey) return;
        let alive = true;
        supabase.rpc('project_page_view', { p_key: introKey }).then(({ data, error }) => {
            if (!alive) return;
            if (error) console.error('Error loading intro page:', error);
            setIntro({ key: introKey, data: data || null });
        });
        return () => { alive = false; };
    }, [introKey]);
    const introLoading = !!introKey && intro.key !== introKey;
    const introData = intro.key === introKey ? intro.data : null;

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
                {(introPages || []).map(p => (
                    <button
                        key={p.key}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${subTab === `intro:${p.key}` ? 'bg-secondary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                        onClick={() => setSubTab(`intro:${p.key}`)}
                    >
                        <FileText className="w-4 h-4 inline-block mr-1" /> {p.title || p.name}
                    </button>
                ))}
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

            {subTab.startsWith('intro:') && (
                introLoading ? (
                    <div className="py-8 text-center text-gray-400">載入中...</div>
                ) : introData ? (
                    <ProjectIntroView data={introData} />
                ) : (
                    <div className="py-8 text-center text-gray-400">此介紹頁目前未開放</div>
                )
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
    const [subTab, setSubTab] = useState('officers');

    const tabs = [
        { id: 'officers', label: '工作人員維護', icon: Settings },
        { id: 'bulletins', label: '公告欄維護', icon: FileText },
        { id: 'surveys', label: '問卷管理', icon: ClipboardList },
        { id: 'projects', label: '專案管理', icon: FolderKanban },
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
                {subTab === 'officers' && <ProbationOfficerDatabase />}
                {subTab === 'bulletins' && <BulletinBoardManagement />}
                {subTab === 'surveys' && <SurveyManagement adminId={adminId} />}
                {subTab === 'projects' && <ProjectManagement />}
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

    // 專案身分：自己在各專案的角色（系統管理者會拿到全部專案，只取自己有角色的顯示於標籤）
    const [projects, setProjects] = useState([]);
    useEffect(() => {
        const load = async () => {
            const { data, error } = await supabase.rpc('project_list');
            if (error) {
                console.error('Error fetching projects:', error);
                return;
            }
            setProjects(data || []);
        };
        load();
    }, [officerId]);
    const myProjects = projects.filter(p => p.my_role);

    // 已發布的專案介紹頁（顯示在「普通權限」）
    const [introPages, setIntroPages] = useState([]);
    useEffect(() => {
        const loadIntro = async () => {
            const { data, error } = await supabase.rpc('project_page_published_list');
            if (error) {
                console.error('Error fetching intro pages:', error);
                return;
            }
            setIntroPages(data || []);
        };
        loadIntro();
    }, [officerId]);
    // 專案成員、專案管理者可進入「專案權限」；系統管理者可看到全部頁面
    const showProjectTab = isSystemAdmin || myProjects.length > 0;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
                <div>
                    <h1 className="text-3xl font-bold text-primary">保護官儀表板</h1>
                    <p className="text-gray-500 mt-1">目前身分: {departmentName} <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full ml-2">{role === 'admin' ? '系統管理者' : role === 'manager' ? '審閱者' : '一般權限'}</span>
                        {myProjects.map(p => (
                            <span key={p.id} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full ml-2">
                                {p.name}：{PROJECT_ROLE_LABEL[p.my_role]}
                            </span>
                        ))}
                    </p>
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

                {/* Project Tab - Available to project members, project managers and Admin */}
                {showProjectTab && (
                    <button
                        className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'project' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('project')}
                    >
                        <FolderKanban className="w-4 h-4" /> 專案權限
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
                {activeTab === 'cases' && <GeneralTab isAdmin={isSystemAdmin} departmentName={departmentName} officerId={officerId} introPages={introPages} />}
                {activeTab === 'stats' && isManager && <DepartmentStats isAdmin={isSystemAdmin} />}
                {activeTab === 'project' && showProjectTab && <ProjectPermissionTab projects={projects} isSystemAdmin={isSystemAdmin} officerId={officerId} />}
                {activeTab === 'admin' && isSystemAdmin && <Maintenance adminId={officerId} />}
            </div>
        </div>
    );
};

export default Dashboard;
