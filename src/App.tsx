import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Image as ImageIcon, 
  History, 
  Plus, 
  ChevronLeft, 
  Loader2, 
  Printer, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Question, AppView, SimilarQuestion } from './types';
import { recognizeQuestion, generateSimilarQuestions } from './services/gemini';
import { cn } from './lib/utils';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [history, setHistory] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Partial<Question>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('wrong_questions_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load history', e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('wrong_questions_history', JSON.stringify(history));
  }, [history]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      processImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    setView('scan');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("无法访问摄像头，请检查权限设置。");
      setView('home');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg');
      
      // Stop camera
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      
      processImage(base64);
    }
  };

  const processImage = async (base64: string) => {
    setLoading(true);
    setLoadingMessage('正在识别错题内容...');
    setView('edit');
    try {
      const result = await recognizeQuestion(base64);
      setCurrentQuestion({
        ...result,
        originalImage: base64,
        id: Date.now().toString(),
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error("OCR failed:", err);
      alert("识别失败，请重试。");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!currentQuestion.knowledgePoint || !currentQuestion.content) return;
    
    setLoading(true);
    setLoadingMessage('正在基于知识点生成举一反三题目...');
    try {
      const similar = await generateSimilarQuestions(
        currentQuestion.knowledgePoint, 
        currentQuestion.content
      );
      const fullQuestion = { ...currentQuestion, similarQuestions: similar } as Question;
      setCurrentQuestion(fullQuestion);
      setHistory(prev => [fullQuestion, ...prev]);
      setView('analysis');
    } catch (err) {
      console.error("Generation failed:", err);
      alert("生成失败，请重试。");
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    if (!printRef.current) return;
    setLoading(true);
    setLoadingMessage('正在生成PDF...');
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`错题集_${new Date().toLocaleDateString()}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {view !== 'home' && (
            <button onClick={() => setView('home')} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <h1 className="text-xl font-bold tracking-tight text-indigo-600">错题举一反三</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setView('history')}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors relative"
          >
            <History className="w-6 h-6 text-slate-600" />
            {history.length > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 pb-24">
        <AnimatePresence mode="wait">
          {/* Home View */}
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8 pt-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-extrabold text-slate-900">智能错题学习助手</h2>
                <p className="text-slate-500">拍照识别错题，智能生成同类题，深度解析易错点</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={startCamera}
                  className="flex flex-col items-center justify-center p-8 bg-indigo-600 text-white rounded-3xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all group"
                >
                  <div className="bg-white/20 p-4 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                    <Camera className="w-10 h-10" />
                  </div>
                  <span className="text-lg font-bold">拍照识题</span>
                  <span className="text-indigo-100 text-sm mt-1">支持全科题目识别</span>
                </button>

                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-200 text-slate-700 rounded-3xl hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
                >
                  <div className="bg-slate-100 p-4 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-10 h-10 text-indigo-600" />
                  </div>
                  <span className="text-lg font-bold">相册导入</span>
                  <span className="text-slate-400 text-sm mt-1">选择本地图片上传</span>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileUpload}
                  />
                </button>
              </div>

              {history.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <History className="w-5 h-5 text-indigo-500" />
                      最近记录
                    </h3>
                    <button onClick={() => setView('history')} className="text-indigo-600 text-sm font-medium">查看全部</button>
                  </div>
                  <div className="space-y-3">
                    {history.slice(0, 3).map(item => (
                      <div 
                        key={item.id} 
                        onClick={() => { setCurrentQuestion(item); setView('analysis'); }}
                        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{item.content}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{item.knowledgePoint}</span>
                            <span className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Scan View */}
          {view === 'scan' && (
            <motion.div 
              key="scan"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-50 flex flex-col"
            >
              <div className="flex-1 relative overflow-hidden">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                  <div className="w-full h-full border-2 border-white/50 rounded-lg relative">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 -mt-1 -ml-1"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 -mt-1 -mr-1"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 -mb-1 -ml-1"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 -mb-1 -mr-1"></div>
                  </div>
                </div>
              </div>
              <div className="bg-black p-8 flex items-center justify-around">
                <button onClick={() => {
                  const stream = videoRef.current?.srcObject as MediaStream;
                  stream?.getTracks().forEach(t => t.stop());
                  setView('home');
                }} className="text-white">取消</button>
                <button 
                  onClick={capturePhoto}
                  className="w-20 h-20 bg-white rounded-full border-8 border-white/20 flex items-center justify-center active:scale-90 transition-transform"
                >
                  <div className="w-14 h-14 bg-indigo-600 rounded-full"></div>
                </button>
                <div className="w-10"></div>
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </motion.div>
          )}

          {/* Edit View */}
          {view === 'edit' && (
            <motion.div 
              key="edit"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  识别结果确认
                </h3>
                
                {currentQuestion.originalImage && (
                  <div className="rounded-xl overflow-hidden border border-slate-100 max-h-48">
                    <img src={currentQuestion.originalImage} alt="Original" className="w-full h-full object-contain bg-slate-50" />
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">题目内容</label>
                    <textarea 
                      value={currentQuestion.content || ''} 
                      onChange={e => setCurrentQuestion(prev => ({ ...prev, content: e.target.value }))}
                      className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 min-h-[120px] text-slate-700"
                      placeholder="请输入题目内容..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">知识点</label>
                      <input 
                        type="text"
                        value={currentQuestion.knowledgePoint || ''} 
                        onChange={e => setCurrentQuestion(prev => ({ ...prev, knowledgePoint: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">科目</label>
                      <input 
                        type="text"
                        value={currentQuestion.subject || ''} 
                        onChange={e => setCurrentQuestion(prev => ({ ...prev, subject: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">我的答案</label>
                      <input 
                        type="text"
                        value={currentQuestion.userAnswer || ''} 
                        onChange={e => setCurrentQuestion(prev => ({ ...prev, userAnswer: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">标准答案</label>
                      <input 
                        type="text"
                        value={currentQuestion.standardAnswer || ''} 
                        onChange={e => setCurrentQuestion(prev => ({ ...prev, standardAnswer: e.target.value }))}
                        className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleGenerate}
                  disabled={!currentQuestion.content || !currentQuestion.knowledgePoint}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  生成举一反三题目
                </button>
              </div>
            </motion.div>
          )}

          {/* Analysis View */}
          {view === 'analysis' && currentQuestion.similarQuestions && (
            <motion.div 
              key="analysis"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xl text-slate-800">学习分析报告</h3>
                <button 
                  onClick={exportPDF}
                  className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl font-bold hover:bg-indigo-100 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  打印 PDF
                </button>
              </div>

              <div ref={printRef} className="space-y-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                {/* Original Question Summary */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="font-bold text-slate-800">原错题回顾</span>
                    <span className="ml-auto text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg font-bold">{currentQuestion.knowledgePoint}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{currentQuestion.content}</p>
                  <div className="mt-3 flex gap-4 text-sm">
                    <span className="text-slate-500">我的答案: <span className="text-red-500 font-medium">{currentQuestion.userAnswer || '未填'}</span></span>
                    <span className="text-slate-500">正确答案: <span className="text-green-600 font-medium">{currentQuestion.standardAnswer || '未填'}</span></span>
                  </div>
                </div>

                {/* Similar Questions */}
                <div className="space-y-8">
                  <h4 className="font-bold text-lg border-l-4 border-indigo-500 pl-3">举一反三练习</h4>
                  {currentQuestion.similarQuestions.map((q, idx) => (
                    <div key={idx} className="space-y-4 border-b border-slate-100 pb-8 last:border-0">
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1">{idx + 1}</span>
                        <div className="space-y-3 flex-1">
                          <p className="text-slate-800 font-medium leading-relaxed">{q.content}</p>
                          {q.options && q.options.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {q.options.map((opt, i) => (
                                <div key={i} className="p-3 bg-slate-50 rounded-xl text-sm text-slate-600 border border-slate-100">
                                  {opt}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="mt-4 p-4 bg-indigo-50/50 rounded-2xl space-y-3">
                            <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                              <CheckCircle2 className="w-4 h-4" />
                              答案与解析
                            </div>
                            <p className="text-sm font-bold text-green-700">正确答案: {q.answer}</p>
                            <div className="text-sm text-slate-600 leading-relaxed">
                              <span className="font-bold block mb-1">【解析】</span>
                              <ReactMarkdown>{q.explanation}</ReactMarkdown>
                            </div>
                            <div className="text-sm bg-red-50 p-3 rounded-xl border border-red-100">
                              <span className="font-bold text-red-700 block mb-1">【易错点分析】</span>
                              <p className="text-red-600">{q.commonMistakes}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* History View */}
          {view === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xl text-slate-800">历史错题本</h3>
                <span className="text-sm text-slate-400">共 {history.length} 条记录</span>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                  <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                    <History className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="text-slate-400">暂无历史记录</p>
                  <button onClick={() => setView('home')} className="text-indigo-600 font-bold">去添加第一道错题</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map(item => (
                    <div 
                      key={item.id}
                      className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group relative"
                    >
                      <div 
                        onClick={() => { setCurrentQuestion(item); setView('analysis'); }}
                        className="cursor-pointer space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg">{item.subject || '全科'}</span>
                          <span className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-800 font-medium line-clamp-2 leading-relaxed">{item.content}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">知识点:</span>
                          <span className="text-xs font-bold text-indigo-600">{item.knowledgePoint}</span>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id); }}
                        className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-6 text-center"
          >
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
            <p className="text-lg font-bold text-slate-800">{loadingMessage}</p>
            <p className="text-sm text-slate-500 mt-2">AI 正在为您全力加速中...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button for Home */}
      {view === 'home' && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
          <button 
            onClick={startCamera}
            className="bg-indigo-600 text-white px-8 py-4 rounded-full font-bold shadow-2xl shadow-indigo-200 flex items-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all"
          >
            <Plus className="w-6 h-6" />
            添加新错题
          </button>
        </div>
      )}
    </div>
  );
}
