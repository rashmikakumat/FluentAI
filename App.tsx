import React, { useState, useEffect } from 'react';
import { AssessmentMode, AssessmentReport, HistoryItem, SessionStatus, Topic } from './types';
import { SAMPLE_TOPICS } from './constants';
import SessionManager from './components/SessionManager';
import AssessmentView from './components/AssessmentView';
import HistoryChart from './components/HistoryChart';
import { getHistory, saveHistoryItem } from './services/storageService';

const App: React.FC = () => {
  const [view, setView] = useState<'HOME' | 'SESSION' | 'REPORT'>('HOME');
  const [selectedMode, setSelectedMode] = useState<AssessmentMode>(AssessmentMode.EXTEMPORE);
  const [selectedTopic, setSelectedTopic] = useState<Topic>(SAMPLE_TOPICS[0]);
  const [currentReport, setCurrentReport] = useState<AssessmentReport | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleStartSession = () => {
    setView('SESSION');
    setErrorMsg(null);
  };

  const handleSessionComplete = (report: AssessmentReport) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      mode: selectedMode,
      topic: selectedTopic.title,
      report
    };
    saveHistoryItem(newItem);
    setHistory(getHistory());
    setCurrentReport(report);
    setView('REPORT');
  };

  const handleSessionError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
    setView('HOME');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">F</div>
             <span className="font-bold text-lg tracking-tight">FluentAI</span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 pt-8">
        
        {errorMsg && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg relative flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            {errorMsg}
          </div>
        )}

        {view === 'HOME' && (
          <div className="space-y-12 animate-fade-in">
            {/* Hero / Setup */}
            <section className="grid md:grid-cols-12 gap-12">
              <div className="md:col-span-7 space-y-8">
                <div>
                   <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight leading-tight">
                     Speak Confidently with a <span className="text-blue-600">Live AI Coach</span>
                   </h1>
                   <p className="text-lg text-slate-600 leading-relaxed">
                     Practice extempore or natural conversations, get CEFR-aligned scores, and hear instant coaching on pronunciation, grammar, and fluency—so you can sound confident in every situation.
                   </p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
                   <div>
                     <label className="block text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">1. Choose Mode</label>
                     <div className="grid grid-cols-2 gap-4">
                       <button 
                         onClick={() => setSelectedMode(AssessmentMode.EXTEMPORE)}
                         className={`p-4 rounded-xl border-2 text-left transition-all ${selectedMode === AssessmentMode.EXTEMPORE ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-100 hover:border-slate-300'}`}
                       >
                         <div className="font-bold text-slate-900 mb-1">Extempore</div>
                         <div className="text-xs text-slate-500">Monologue practice. AI analyzes your structured speech.</div>
                       </button>
                       <button 
                         onClick={() => setSelectedMode(AssessmentMode.CONVERSATION)}
                         className={`p-4 rounded-xl border-2 text-left transition-all ${selectedMode === AssessmentMode.CONVERSATION ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-600' : 'border-slate-100 hover:border-slate-300'}`}
                       >
                         <div className="font-bold text-slate-900 mb-1">Conversation</div>
                         <div className="text-xs text-slate-500">Interactive chat. AI Tutor talks back in real-time.</div>
                       </button>
                     </div>
                   </div>

                   <div>
                     <label className="block text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">2. Select Topic</label>
                     <div className="grid sm:grid-cols-2 gap-3">
                        {SAMPLE_TOPICS.map(t => (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTopic(t)}
                            className={`px-4 py-3 rounded-lg text-sm font-medium text-left transition-colors ${selectedTopic.id === t.id ? 'bg-slate-800 text-white shadow-lg' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
                          >
                            {t.title}
                          </button>
                        ))}
                     </div>
                   </div>

                   <button 
                     onClick={handleStartSession}
                     className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg hover:shadow-xl hover:shadow-blue-200 transition-all transform active:scale-[0.99]"
                   >
                     Start Assessment
                   </button>
                </div>
              </div>

              {/* History Dashboard */}
              <div className="md:col-span-5 space-y-6">
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-full">
                    <div className="flex justify-between items-center mb-6">
                       <h2 className="font-bold text-slate-800">Your Progress</h2>
                       <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">Last 3 Attempts</span>
                    </div>
                    
                    <HistoryChart history={history} />

                    <div className="mt-8 space-y-4">
                       {history.slice(0, 3).map((item) => (
                         <div key={item.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors cursor-pointer group" onClick={() => { setCurrentReport(item.report); setView('REPORT'); }}>
                            <div className="flex justify-between items-start mb-2">
                               <div>
                                  <div className="font-semibold text-sm text-slate-900">{item.topic}</div>
                                  <div className="text-xs text-slate-500">{new Date(item.date).toLocaleDateString()} • {item.mode}</div>
                               </div>
                               <div className="bg-white px-2 py-1 rounded border border-slate-200 text-sm font-bold text-blue-600">
                                 {item.report.overallScore}
                               </div>
                            </div>
                            <div className="flex gap-2">
                               <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold group-hover:text-blue-500 transition-colors">View Report &rarr;</span>
                            </div>
                         </div>
                       ))}
                       {history.length === 0 && (
                         <div className="text-center py-8 text-slate-400 text-sm">
                           Complete your first session to see analytics.
                         </div>
                       )}
                    </div>
                 </div>
              </div>
            </section>
          </div>
        )}

        {view === 'SESSION' && (
          <SessionManager 
            mode={selectedMode}
            topic={selectedTopic}
            onComplete={handleSessionComplete}
            onCancel={() => setView('HOME')}
            onError={handleSessionError}
          />
        )}

        {view === 'REPORT' && currentReport && (
          <AssessmentView 
            report={currentReport} 
            onClose={() => setView('HOME')}
          />
        )}

      </main>
    </div>
  );
};

export default App;
