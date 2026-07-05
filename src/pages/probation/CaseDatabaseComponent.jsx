import React, { useState } from 'react';
import { User, Users } from 'lucide-react';
import JuvenileDatabase from './JuvenileDatabaseComponent';
import GuardianDatabase from './GuardianDatabaseComponent';

const CaseDatabase = () => {
    const [subTab, setSubTab] = useState('juveniles');

    return (
        <div>
            <div className="flex gap-2 mb-6 border-b border-gray-100 pb-2 overflow-x-auto">
                <button
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${subTab === 'juveniles' ? 'bg-secondary text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                    onClick={() => setSubTab('juveniles')}
                >
                    <User className="w-4 h-4" /> 少年資料庫
                </button>
                <button
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${subTab === 'guardians' ? 'bg-secondary text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                    onClick={() => setSubTab('guardians')}
                >
                    <Users className="w-4 h-4" /> 親職教育資料庫
                </button>
            </div>

            {subTab === 'juveniles' && <JuvenileDatabase />}
            {subTab === 'guardians' && <GuardianDatabase />}
        </div>
    );
};

export default CaseDatabase;
