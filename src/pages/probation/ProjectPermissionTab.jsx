import React, { useState } from 'react';
import { FolderKanban } from 'lucide-react';
import { PROJECT_ROLE_LABEL } from '../../utils/projectUtils';
import PsyServiceProject from './PsyServiceProject';
import BlankProject from './BlankProject';

// 「專案權限」分頁：專案成員、專案管理者（及系統管理者）可進入。
// 目前先列出自己參與的專案與專案身分；各專案的內容之後依專案逐一設計。
const ProjectPermissionTab = ({ projects, isSystemAdmin, officerId }) => {
    const [openId, setOpenId] = useState(null);
    // 一般使用者只會拿到自己參與的專案；系統管理者拿到全部，其中沒有專案身分的另外標示
    const list = projects || [];

    // 專案頁面：專案管理者與系統管理者可進入；尚無專屬頁面的專案先進入空白框架
    const canEnter = (p) => p.is_active && (isSystemAdmin || p.my_role === 'manager');

    // 只有一個專案、且可進入時，直接進入該專案，不需選擇（此時沒有「回到專案列表」）
    const onlyProject = list.length === 1 && canEnter(list[0]) ? list[0] : null;
    const openProject = onlyProject || list.find(p => p.id === openId && canEnter(p));
    if (openProject && openProject.key !== 'psy_service') {
        return <BlankProject project={openProject} onBack={onlyProject ? null : () => setOpenId(null)} />;
    }
    if (openProject) {
        return (
            <PsyServiceProject
                project={openProject}
                officerId={officerId}
                isSystemAdmin={isSystemAdmin}
                onBack={onlyProject ? null : () => setOpenId(null)}
            />
        );
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
            <div className="flex items-center gap-2 mb-6">
                <FolderKanban className="w-5 h-5 text-primary" />
                <h3 className="text-xl font-bold text-primary">專案權限</h3>
            </div>

            {list.length === 0 ? (
                <div className="py-8 text-center text-gray-400">目前尚未參與任何專案</div>
            ) : (
                <div className="space-y-3">
                    {list.map(p => (
                        <div key={p.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-gray-800 text-lg">{p.name}</span>
                                <span className={`px-2 py-0.5 rounded-lg text-xs ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {p.is_active ? '啟用中' : '已停用'}
                                </span>
                                {p.my_role ? (
                                    <span className="px-2 py-0.5 rounded-lg text-xs bg-indigo-100 text-indigo-700">
                                        {PROJECT_ROLE_LABEL[p.my_role]}
                                    </span>
                                ) : (isSystemAdmin && (
                                    <span className="px-2 py-0.5 rounded-lg text-xs bg-purple-100 text-purple-700">系統管理者檢視</span>
                                ))}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">{p.description || '（無說明）'}</div>
                            {canEnter(p) ? (
                                <button onClick={() => setOpenId(p.id)} className="mt-3 px-4 py-1.5 text-sm rounded-lg bg-secondary text-white hover:opacity-90">進入專案</button>
                            ) : (
                                <div className="text-xs text-gray-400 mt-3">
                                    專案成員目前沒有開放的功能
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <p className="text-xs text-gray-400 mt-6">各專案的功能將依專案逐步開放。</p>
        </div>
    );
};

export default ProjectPermissionTab;
