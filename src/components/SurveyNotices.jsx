import React, { useState } from 'react';
import { ClipboardList, AlertTriangle, X } from 'lucide-react';
import Button from './Button';
import {
    getMySurveyState, getUrgency, getDeadlineText, hasSeenSurveyPopup, markSurveyPopupSeen
} from '../utils/surveyUtils';

const URGENCY_STYLES = {
    today: { card: 'border-red-300 bg-red-50', tag: 'bg-red-500 text-white' },
    soon: { card: 'border-orange-300 bg-orange-50', tag: 'bg-orange-500 text-white' },
    normal: { card: 'border-blue-100 bg-white', tag: 'bg-gray-100 text-gray-600' }
};

// 公告欄中的問卷卡片
export const SurveyCards = ({ surveys, onOpen }) => (
    <div className="space-y-3">
        {surveys.map((s) => {
            const state = getMySurveyState(s);
            const urgency = getUrgency(s, state.pending);
            const style = URGENCY_STYLES[urgency];
            return (
                <div key={s.id} className={`p-4 rounded-lg border shadow-sm ${style.card}`}>
                    <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <ClipboardList className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                <h4 className="font-bold text-gray-800 break-words">{s.title}</h4>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">問卷</span>
                            </div>
                            <p className="text-sm mt-1.5 text-gray-700">{state.text}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded flex-shrink-0 whitespace-nowrap ${style.tag}`}>{getDeadlineText(s)}</span>
                    </div>
                    {state.actionLabel && (
                        <div className="mt-3 flex justify-end">
                            <Button variant={state.canAct ? 'primary' : 'outline'} onClick={() => onOpen(s.id)} className="!py-1.5 !px-4 text-sm min-h-[40px]">
                                {state.actionLabel}
                            </Button>
                        </div>
                    )}
                </div>
            );
        })}
    </div>
);

// 登入後第一次看到尚未填寫的問卷時彈出，每份問卷只彈一次
export const SurveyReminderPopup = ({ surveys, viewer, onOpen }) => {
    const [dismissed, setDismissed] = useState(false);
    const unseen = surveys.filter(s => getMySurveyState(s).pending && !hasSeenSurveyPopup(viewer, s.id));
    if (dismissed || unseen.length === 0) return null;

    const close = () => {
        unseen.forEach(s => markSurveyPopupSeen(viewer, s.id));
        setDismissed(true);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500" /> 您有 {unseen.length} 份問卷待填寫
                    </h3>
                    <button onClick={close} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <ul className="space-y-2 mb-5">
                    {unseen.map(s => (
                        <li key={s.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800 break-words">{s.title}</p>
                                <p className={`text-xs mt-0.5 ${s.days_left <= 0 ? 'text-red-600' : s.days_left <= 3 ? 'text-orange-600' : 'text-gray-500'}`}>{getDeadlineText(s)}</p>
                            </div>
                            <button
                                onClick={() => { close(); onOpen(s.id); }}
                                className="text-sm text-blue-600 hover:underline flex-shrink-0 min-h-[40px] px-2"
                            >前往填寫</button>
                        </li>
                    ))}
                </ul>
                <Button variant="outline" onClick={close} className="w-full">稍後再填</Button>
            </div>
        </div>
    );
};
