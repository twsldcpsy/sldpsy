import React from 'react';
import Button from '../components/Button';

const Booking = () => {
    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <h1 className="text-3xl font-bold text-primary mb-6">預約諮詢</h1>
                <p className="text-gray-600 mb-8">
                    請填寫以下資訊，我們將協助您安排合適的諮商心理師。
                </p>

                <form className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">姓名</label>
                            <input
                                type="text"
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                                placeholder="您的姓名"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">聯絡電話</label>
                            <input
                                type="tel"
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                                placeholder="09xx-xxx-xxx"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input
                            type="email"
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                            placeholder="example@email.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">希望諮商議題</label>
                        <select className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all bg-white">
                            <option>情緒困擾 (憂鬱、焦慮)</option>
                            <option>感情/婚姻議題</option>
                            <option>人際關係</option>
                            <option>生涯規劃</option>
                            <option>自我探索</option>
                            <option>其他</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">備註需求</label>
                        <textarea
                            rows="4"
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                            placeholder="有什麼想先讓我們知道的嗎？"
                        ></textarea>
                    </div>

                    <div className="pt-4">
                        <Button variant="primary" className="w-full justify-center text-lg py-3">
                            送出預約申請
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Booking;
