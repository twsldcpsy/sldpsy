import React from 'react';
import { Calendar, Users, Clock, TrendingUp } from 'lucide-react';
import Button from '../components/Button';

const StatCard = ({ icon: Icon, title, value, color }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-primary">{value}</p>
        </div>
    </div>
);

const Dashboard = () => {
    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-primary">管理後台</h1>
                <div className="flex gap-3">
                    <Button variant="outline">匯出報表</Button>
                    <Button variant="primary">新增個案</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={Calendar} title="本週預約" value="24" color="bg-secondary" />
                <StatCard icon={Users} title="活躍個案" value="156" color="bg-primary" />
                <StatCard icon={Clock} title="待處理申請" value="8" color="bg-accent" />
                <StatCard icon={TrendingUp} title="本月成長" value="+12%" color="bg-green-500" />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="font-bold text-lg text-primary">近期預約</h2>
                    <Button variant="outline" className="text-xs py-1 px-3">查看全部</Button>
                </div>
                <div className="p-0">
                    {/* Table skeleton */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-600 text-sm">
                                <tr>
                                    <th className="px-6 py-3">姓名</th>
                                    <th className="px-6 py-3">預約時間</th>
                                    <th className="px-6 py-3">諮商師</th>
                                    <th className="px-6 py-3">狀態</th>
                                    <th className="px-6 py-3">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {[1, 2, 3].map((i) => (
                                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 font-medium">王大明</td>
                                        <td className="px-6 py-4">2024-03-2{i} 14:00</td>
                                        <td className="px-6 py-4">李心理師</td>
                                        <td className="px-6 py-4">
                                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                                                已確認
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button className="text-secondary hover:underline text-sm font-medium">詳情</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
