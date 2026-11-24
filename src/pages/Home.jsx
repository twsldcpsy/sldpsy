import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Users, Megaphone, History, X, AlertOctagon } from 'lucide-react';
import Button from '../components/Button';

const Home = () => {
    const navigate = useNavigate();
    const [showWarningModal, setShowWarningModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-12">
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold text-primary tracking-wider">臺灣士林地方法院</h1>
                <h2 className="text-2xl font-bold text-secondary">心理諮商預約及專案管理系統</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-4">
                <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-transparent hover:border-secondary transition-all group cursor-pointer"
                    onClick={() => navigate('/psychologist/login')}>
                    <div className="flex flex-col items-center gap-6 text-center">
                        <div className="p-4 bg-secondary/10 rounded-full group-hover:bg-secondary/20 transition-colors">
                            <Brain className="w-16 h-16 text-secondary" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-primary mb-2">心理師頁面</h3>
                            <p className="text-gray-500">心理師登入、預約管理、個案紀錄</p>
                        </div>
                        <Button variant="primary" className="w-full text-lg">進入系統</Button>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-transparent hover:border-secondary transition-all group cursor-pointer"
                    onClick={() => navigate('/probation/login')}>
                    <div className="flex flex-col items-center gap-6 text-center">
                        <div className="p-4 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
                            <Users className="w-16 h-16 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-primary mb-2">保護官頁面</h3>
                            <p className="text-gray-500">保護官登入、個案申請、進度查詢</p>
                        </div>
                        <Button variant="secondary" className="w-full text-lg">進入系統</Button>
                    </div>
                </div>
            </div>

            <div className="flex gap-6 mt-8">
                <button
                    onClick={() => setShowWarningModal(true)}
                    className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors"
                >
                    <Megaphone className="w-5 h-5" />
                    <span>系統公告</span>
                </button>
                <button
                    onClick={() => setShowHistoryModal(true)}
                    className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors"
                >
                    <History className="w-5 h-5" />
                    <span>系統沿革</span>
                </button>
            </div>

            {/* Warning Modal */}
            {showWarningModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl relative text-center">
                        <button
                            onClick={() => setShowWarningModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div className="flex justify-center mb-6">
                            <div className="bg-red-100 p-4 rounded-full">
                                <AlertOctagon className="w-12 h-12 text-red-600" />
                            </div>
                        </div>

                        <h3 className="text-xl font-bold text-gray-900 mb-4">
                            ！請勿將系統連結提供給非工作人員！
                        </h3>

                        <div className="space-y-3 text-gray-600 text-left bg-gray-50 p-6 rounded-xl border border-gray-100">
                            <p>本系統由臺灣士林地方法院調查保護室維護。</p>
                            <p>目前維護者為耕股周官及心輔員，如有使用上問題及建議請聯繫維護者。</p>
                        </div>

                        <div className="mt-8">
                            <Button variant="primary" onClick={() => setShowWarningModal(false)} className="w-full">
                                我知道了
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {showHistoryModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl relative">
                        <button
                            onClick={() => setShowHistoryModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-blue-100 p-3 rounded-full">
                                <History className="w-6 h-6 text-blue-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">系統沿革</h3>
                        </div>

                        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                            <div className="relative pl-4 border-l-2 border-primary/20 space-y-6">
                                {/* v2.0.0 */}
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-primary border-2 border-white shadow-sm"></div>
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                        v2.0.0 <span className="text-sm font-normal text-gray-500">115/11/24</span>
                                    </h4>
                                    <div className="text-gray-600 mt-1 text-sm leading-relaxed space-y-1">
                                        <p>系統並未參選但仍改名為「臺灣士林地方法院心理諮商預約及專案管理系統」，大幅升級系統的資安結構，並且為使「運動戒癮團體」、「同理心訓練」順利嫁接實現管理一站化，重整系統架構，並順順順手修正了一些發展危機（BUG）。</p>
                                    </div>
                                </div>

                                {/* v1.5.0 */}
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-300 border-2 border-white shadow-sm"></div>
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                        v1.5.0 <span className="text-sm font-normal text-gray-500">115/11/7</span>
                                    </h4>
                                    <p className="text-gray-600 mt-1 text-sm leading-relaxed">
                                        系統實實將滿週歲，偷偷更新問卷功能，好蒐集更多資訊（和海水過濾器）來獨自升級！
                                    </p>
                                </div>

                                {/* v1.4.0 */}
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-300 border-2 border-white shadow-sm"></div>
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                        v1.4.0 <span className="text-sm font-normal text-gray-500">115/7/5</span>
                                    </h4>
                                    <div className="text-gray-600 mt-1 text-sm leading-relaxed space-y-1">
                                        <p>輔股心輔員持續發揮輔導知能及行政魔法，小耕同學持續喝茂昌草本茶含有粉角的飲品（非業配，而且微苦清仙涼茶比人生還苦），並在本次更新中調整及新增以下功能：</p>
                                        <ul className="list-disc list-inside pl-2 space-y-1">
                                            <li>爲符親職教育需要，新增「親職教育」類別，與少年資料庫並行管理家長資料，統計及核銷功能也同步調整</li>
                                            <li>修改所有權限者之篩選功能邏輯，讓複選成爲可能</li>
                                            <li>修正月曆視圖心理師顏色分配邏輯，確保不同心理師顏色不重複</li>
                                            <li>系統管理員工具升級，包含核銷（匯出日期格式調整）、公佈欄（個別化顯示）、預約管理（備忘功能），以期提升行政效率</li>
                                            <li>優化手機移動端使用體驗，提升 web app 適配性</li>
                                        </ul>
                                    </div>
                                </div>

                                {/* v1.1.9 */}
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-300 border-2 border-white shadow-sm"></div>
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                        v1.1.9 <span className="text-sm font-normal text-gray-500">115/3/22</span>
                                    </h4>
                                    <div className="text-gray-600 mt-1 text-sm leading-relaxed space-y-1">
                                        <p>小耕同學吃了餛飩乾麵和貢丸湯，陳姓心輔員吃了鹹水雞飯，然後系統就又成長了一些：</p>
                                        <ul className="list-disc list-inside pl-2 space-y-1">
                                            <li>優化移動裝置使用介面。</li>
                                        </ul>
                                    </div>
                                </div>

                                {/* v1.1.8 */}
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-300 border-2 border-white shadow-sm"></div>
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                        v1.1.8 <span className="text-sm font-normal text-gray-500">115/3/11</span>
                                    </h4>
                                    <p className="text-gray-600 mt-1 text-sm leading-relaxed">
                                        系統發展中的重要他人陳姓心輔員大發神威，讓系統愈臻成熟，掃蕩系統的發展危機(BUG)
                                    </p>
                                </div>

                                {/* v1.1.7 */}
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-300 border-2 border-white shadow-sm"></div>
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                        v1.1.7 <span className="text-sm font-normal text-gray-500">115/3/10</span>
                                    </h4>
                                    <div className="text-gray-600 mt-1 text-sm leading-relaxed space-y-1">
                                        <p>小耕同學發展出一個擁有社會共識的吃法，即在白蘭地雞湯火鍋中添加許多香菜提味，並吃飽喝足後更新：</p>
                                        <ul className="list-disc list-inside pl-2 space-y-1">
                                            <li>修復日曆視圖中心理師顏色重疊的問題</li>
                                            <li>優化智慧型裝置新增預約的介面</li>
                                            <li>讓系統管理員更加強大</li>
                                        </ul>
                                    </div>
                                </div>

                                {/* v1.1.1 */}
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-300 border-2 border-white shadow-sm"></div>
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                        v1.1.1 <span className="text-sm font-normal text-gray-500">115/2/5</span>
                                    </h4>
                                    <p className="text-gray-600 mt-1 text-sm leading-relaxed">
                                        小耕同學買了五個小海豹扭蛋，剛好把全系列完整收集，並修正系統「心理師在手機頁面中無法更新預約狀態」的發展危機（BUG）。
                                    </p>
                                </div>

                                {/* v1.1.0 */}
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-300 border-2 border-white shadow-sm"></div>
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                        v1.1.0 <span className="text-sm font-normal text-gray-500">115/2/4</span>
                                    </h4>
                                    <p className="text-gray-600 mt-1 text-sm leading-relaxed">
                                        為修復少年與股別對應問題，小耕同學忘我的嘗試不慎超過本月免費額度，在冷汗直流的情況下，緊急開啟備用網址，往後將同步更新，以確保類似狀況發生時有應變備案。
                                    </p>
                                </div>
                                {/* v1.0.0 */}
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-300 border-2 border-white shadow-sm"></div>
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                        v1.0.0 <span className="text-sm font-normal text-gray-500">115/2/1</span>
                                    </h4>
                                    <div className="text-gray-600 mt-1 text-sm leading-relaxed space-y-1">
                                        <p>系統再度邁向成熟發展，正式步入初顯成年期：</p>
                                        <ul className="list-disc list-inside pl-2 space-y-1">
                                            <li>優化核銷系統，以貼近實務使用</li>
                                            <li>修正系統生涯中的幾個發展危機（BUG）</li>
                                            <li>嘗試更新公告系統、調整篩選股別排序、雙向檢視核銷資訊，因系統對立反抗（數度崩潰），暫時擱置開發</li>
                                        </ul>
                                    </div>
                                </div>
                                {/* v0.9.2 */}
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-300 border-2 border-white shadow-sm"></div>
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                        v0.9.2 <span className="text-sm font-normal text-gray-500">115/1/26</span>
                                    </h4>
                                    <div className="text-gray-600 mt-1 text-sm leading-relaxed space-y-1">
                                        <p>前段時間因為小耕同學著涼導致本系統發展遲滯，現在正式進入青春期：</p>
                                        <ul className="list-disc list-inside pl-2 space-y-1">
                                            <li>改善網頁在移動裝置端難以操作的介面設計</li>
                                            <li>修正系統生涯中的幾個發展危機（BUG）</li>
                                            <li>提升系統管理員的核銷等管理功能</li>
                                            <li>優化數個介面的可讀性</li>
                                        </ul>
                                    </div>
                                </div>
                                {/* v0.8.1 */}
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-300 border-2 border-white shadow-sm"></div>
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                        v0.8.1 <span className="text-sm font-normal text-gray-500">115/1/20</span>
                                    </h4>
                                    <p className="text-gray-600 mt-1 text-sm leading-relaxed">
                                        建構統計、核銷功能，並提升網站之安全性。
                                    </p>
                                </div>

                                {/* v0.4.1 */}
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-300 border-2 border-white shadow-sm"></div>
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                        v0.4.1 <span className="text-sm font-normal text-gray-500">115/1/19</span>
                                    </h4>
                                    <p className="text-gray-600 mt-1 text-sm leading-relaxed">
                                        小耕同學感冒發燒，但仍修復管理員權限問題，敬業精神值得嘉獎。
                                    </p>
                                </div>

                                {/* v0.4.0 */}
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-300 border-2 border-white shadow-sm"></div>
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                        v0.4.0 <span className="text-sm font-normal text-gray-500">115/1/18</span>
                                    </h4>
                                    <p className="text-gray-600 mt-1 text-sm leading-relaxed">
                                        完成資料庫建置，並建構除了統計、核銷以外之相關功能。
                                    </p>
                                </div>

                                {/* v0.2.0 */}
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-300 border-2 border-white shadow-sm"></div>
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                        v0.2.0 <span className="text-sm font-normal text-gray-500">115/1/17</span>
                                    </h4>
                                    <p className="text-gray-600 mt-1 text-sm leading-relaxed">
                                        初步完成系統框架建置，完善登入頁面。
                                    </p>
                                </div>

                                {/* v0.1.0 */}
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-300 border-2 border-white shadow-sm"></div>
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                        v0.1.0 <span className="text-sm font-normal text-gray-500">115/1/16</span>
                                    </h4>
                                    <p className="text-gray-600 mt-1 text-sm leading-relaxed">
                                        依照「115年度工作計劃（耕股）」邀集心輔員共同構思，並由心輔員提出功能需求。
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8">
                            <Button variant="primary" onClick={() => setShowHistoryModal(false)} className="w-full">
                                關閉
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;
