import React, { useState } from 'react';
import { Clock, DollarSign } from 'lucide-react';
import AdvancedStats from './AdvancedStats';
import ManagerStats from './ManagerStats';

// 心理服務專案的「進階統計」：原進階統計報表，加上審閱者權限中的統計（經費、人次、日費、各股別與各心理師個案數）。
// 審閱者權限仍保留原本的統計頁，兩邊共用同一個 ManagerStats 元件。
const PsyAdvancedStats = () => {
    const [subTab, setSubTab] = useState('report');

    const tabs = [
        { id: 'report', label: '服務概況報表', icon: Clock },
        { id: 'cost', label: '經費與個案統計', icon: DollarSign },
    ];

    return (
        <div>
            <div className="flex gap-3 mb-6">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${subTab === tab.id
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                            }`}
                        onClick={() => setSubTab(tab.id)}
                    >
                        <tab.icon className="w-4 h-4" /> {tab.label}
                    </button>
                ))}
            </div>
            {subTab === 'report' && <AdvancedStats />}
            {subTab === 'cost' && <ManagerStats />}
        </div>
    );
};

export default PsyAdvancedStats;
