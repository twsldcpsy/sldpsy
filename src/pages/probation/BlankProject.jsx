import React from 'react';
import { FolderKanban, ArrowLeft } from 'lucide-react';

// 尚未設計專屬頁面的專案：先提供空白的專案頁框架（專案管理者與系統管理者可進入）。
// 之後每個專案的功能會以子頁的形式加進來。
const BlankProject = ({ project, onBack }) => (
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
        <div className="p-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center text-gray-400">
            此專案的功能設計中，尚無可用的子頁
        </div>
    </div>
);

export default BlankProject;
