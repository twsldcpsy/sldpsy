import React from 'react';
import { BookOpen, Home, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from './Button';

const Layout = ({ children }) => {
    const navigate = useNavigate();
    const isHome = useLocation().pathname === '/';

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-primary">
            <nav className="bg-white shadow-sm border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-3">
                            <BookOpen className="h-8 w-8 text-secondary" />
                            <span className="font-bold text-sm sm:text-xl tracking-wide leading-tight"><span className="block sm:inline">臺灣士林地方法院</span><span className="block sm:inline">心理諮商預約及專案管理系統</span></span>
                        </div>
                        {!isHome && (
                            <div>
                                <Button variant="outline" className="p-2 md:py-1 md:px-4 text-xs md:text-sm flex items-center" onClick={() => navigate('/')}>
                                    <Home className="w-5 h-5 md:w-4 md:h-4 md:mr-1" />
                                    <span className="hidden md:inline">回到首頁</span>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </nav>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
};

export default Layout;
