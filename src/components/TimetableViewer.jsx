import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useApp } from '../App';
import { 
  ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2, Download, 
  School, Layers, FileText, ExternalLink, History, Sparkles, 
  CheckCircle2, X 
} from 'lucide-react';

// Polyfill for Uint8Array toHex / fromHex for older Safari / Android WebViews / LINE browser
if (typeof Uint8Array !== 'undefined') {
  if (!Uint8Array.prototype.toHex) {
    Uint8Array.prototype.toHex = function() {
      return Array.from(this).map(b => b.toString(16).padStart(2, '0')).join('');
    };
  }
  if (!Uint8Array.fromHex) {
    Uint8Array.fromHex = function(hexString) {
      const clean = hexString.trim();
      const bytes = new Uint8Array(Math.ceil(clean.length / 2));
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(clean.substr(i * 2, 2), 16) || 0;
      }
      return bytes;
    };
  }
}

try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
} catch (e) {
  console.warn('Worker setup notice:', e);
}

// 歷程課表資料清單（當更換新學期課表時，自動封存舊課表供隨時查閱）
const HISTORICAL_TIMETABLES = [
  {
    id: '113-2',
    name: '113學年度第二學期課表',
    pdfUrl: '/timetable.pdf',
    page1Snapshot: '/timetable_page_1.webp',
    page2Snapshot: '/timetable_page_2.webp',
    campuses: ['霧臺國小本校', '勵古百合分校'],
    active: true,
    updatedAt: '2025/02/10'
  },
  {
    id: '113-1',
    name: '113學年度第一學期課表 (存檔)',
    pdfUrl: '/timetable.pdf',
    page1Snapshot: '/timetable_page_1.webp',
    page2Snapshot: '/timetable_page_2.webp',
    campuses: ['霧臺國小本校', '勵古百合分校'],
    active: false,
    updatedAt: '2024/09/01'
  }
];

export default function TimetableViewer({ pdfUrl = '/timetable.pdf' }) {
  const { isDark } = useApp();
  const [selectedTimetable, setSelectedTimetable] = useState(HISTORICAL_TIMETABLES[0]);
  const [viewMode, setViewMode] = useState('snapshot'); // 'snapshot' (WebP秒開) 或 'pdf' (向量畫布)
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [currentPage, setCurrentPage] = useState(1); // 1: 霧臺校區, 2: 勵古百合分校
  const [totalPages, setTotalPages] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Zoom and Pan states
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const touchDistanceRef = useRef(null);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const pdfDocRef = useRef(null);

  // 當切換為 PDF 向量模式時，才動態載入 PDF 檔案，達成極致秒開
  useEffect(() => {
    if (viewMode !== 'pdf') return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadPDF = async () => {
      try {
        const targetUrl = selectedTimetable.pdfUrl || pdfUrl;
        const response = await fetch(targetUrl);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        if (!isMounted) return;

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          disableRange: true,
          disableStream: true
        });

        const doc = await loadingTask.promise;
        if (!isMounted) return;

        pdfDocRef.current = doc;
        setTotalPages(doc.numPages || 2);
        await renderPage(currentPage, doc);
      } catch (err) {
        console.error('PDF fetch / render error:', err);
        if (isMounted) {
          setError(err.message || '課表載入異常');
          setLoading(false);
        }
      }
    };

    loadPDF();

    return () => {
      isMounted = false;
    };
  }, [viewMode, selectedTimetable, pdfUrl]);

  // Re-render when page changes in PDF mode
  useEffect(() => {
    if (viewMode === 'pdf' && pdfDocRef.current) {
      renderPage(currentPage, pdfDocRef.current);
    }
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentPage, viewMode]);

  const renderPage = async (pageNum, doc) => {
    setLoading(true);
    try {
      const page = await doc.getPage(pageNum);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const viewport = page.getViewport({ scale: 2.2 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport
      }).promise;

      setLoading(false);
    } catch (err) {
      console.error('Page render error:', err);
      setError('頁面渲染錯誤');
      setLoading(false);
    }
  };

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.3, 3.5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.3, 0.7));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Mouse pan handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch handlers for mobile pan & pinch-to-zoom
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartRef.current = { ...pan };
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistanceRef.current = dist;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setPan({
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy
      });
    } else if (e.touches.length === 2 && touchDistanceRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchDistanceRef.current;
      setZoom(prev => Math.min(Math.max(prev * ratio, 0.8), 3.5));
      touchDistanceRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchDistanceRef.current = null;
  };

  // Double tap to zoom
  const handleDoubleClick = () => {
    if (zoom > 1.2) {
      handleReset();
    } else {
      setZoom(2.0);
    }
  };

  const cardBg = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200';

  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-[100] flex flex-col bg-black/95 p-2 sm:p-4'
    : `rounded-2xl border shadow-sm flex flex-col overflow-hidden ${cardBg}`;

  return (
    <div className={containerClasses} ref={containerRef}>
      {/* ── 頂部工具列 ── */}
      <div className={`p-2.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-b ${
        isFullscreen 
          ? 'bg-slate-900/90 border-slate-800 text-stone-100' 
          : isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-stone-50/90 border-stone-200'
      }`}>
        {/* 校區切換膠囊按鈕群 */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-stone-200/70 dark:bg-slate-800/90 self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setCurrentPage(1)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
              currentPage === 1
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
            }`}
          >
            <School size={14} />
            <span>霧臺校區</span>
          </button>
          <button
            onClick={() => setCurrentPage(2)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
              currentPage === 2
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
            }`}
          >
            <Layers size={14} />
            <span>勵古百合</span>
          </button>
        </div>

        {/* 模式切換、歷程課表、縮放與全螢幕操作群 */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 flex-wrap">
          {/* 檢視模式切換：快照秒開 vs 向量高清 */}
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-slate-800 p-0.5 rounded-xl border border-stone-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('snapshot')}
              title="秒開快照模式 (0.05s 極速)"
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition ${
                viewMode === 'snapshot'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <Sparkles size={13} />
              <span className="hidden sm:inline">秒開快照</span>
              <span className="sm:hidden">快照</span>
            </button>
            <button
              onClick={() => setViewMode('pdf')}
              title="向量高清模式 (PDF Canvas)"
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition ${
                viewMode === 'pdf'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <Layers size={13} />
              <span className="hidden sm:inline">向量高清</span>
              <span className="sm:hidden">向量</span>
            </button>
          </div>

          {/* 歷程課表彈窗按鈕 */}
          <button
            onClick={() => setShowHistoryModal(true)}
            title="查看學期歷程課表"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 dark:border-amber-800 dark:text-amber-300"
          >
            <History size={14} />
            <span className="hidden sm:inline">歷程課表</span>
          </button>

          {/* 縮放與重設 */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-stone-100 dark:bg-slate-800 p-1 rounded-xl border border-stone-200 dark:border-slate-700">
            <button
              onClick={handleZoomOut}
              title="縮小"
              className="p-1 sm:p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-700 dark:text-stone-200 transition"
            >
              <ZoomOut size={15} />
            </button>
            <span className="text-[11px] sm:text-xs font-mono font-bold px-1 min-w-[36px] sm:min-w-[42px] text-center text-stone-700 dark:text-stone-200">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              title="放大"
              className="p-1 sm:p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-700 dark:text-stone-200 transition"
            >
              <ZoomIn size={15} />
            </button>
            <button
              onClick={handleReset}
              title="重設大小"
              className="p-1 sm:p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-600 dark:text-stone-400 transition"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          {/* 全螢幕切換按鈕 */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? '退出全螢幕' : '全螢幕檢視'}
            className="flex items-center gap-1 p-2 rounded-xl text-xs font-bold border transition bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 text-stone-800 dark:text-stone-200"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          {/* 原始 PDF 下載按鈕 */}
          <a
            href={selectedTimetable.pdfUrl || pdfUrl}
            download={`${selectedTimetable.name}.pdf`}
            title="下載原始 PDF 檔案"
            className="p-2 rounded-xl border transition bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:hover:bg-teal-900/80 dark:border-teal-800 dark:text-teal-300"
          >
            <Download size={15} />
          </a>
        </div>
      </div>

      {/* ── 課表檢視視窗 (支援雙指縮放與拖曳) ── */}
      <div
        className="relative flex-1 min-h-[460px] sm:min-h-[580px] overflow-hidden select-none bg-stone-200/50 dark:bg-slate-950 flex items-center justify-center cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
      >
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-stone-100/80 dark:bg-slate-900/80 backdrop-blur-xs">
            <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 text-xs font-bold text-teal-700 dark:text-teal-400">課表載入中...</p>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-stone-50 dark:bg-slate-900">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3">
              <FileText size={24} />
            </div>
            <p className="text-sm font-extrabold text-stone-800 dark:text-stone-200 mb-1">
              課表原生檢視模式
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mb-4">
              因行動端瀏覽器限制，您可點擊下方按鈕直接預覽或開啟官方 PDF：
            </p>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <a
                href={selectedTimetable.pdfUrl || pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-sm transition"
              >
                <ExternalLink size={14} />
                在新視窗開啟 PDF
              </a>
              <button
                onClick={() => {
                  setError(null);
                  setViewMode('snapshot');
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border bg-white dark:bg-slate-800 text-stone-700 dark:text-stone-200 border-stone-300 dark:border-slate-700 hover:bg-stone-100 transition"
              >
                切換回快照模式
              </button>
            </div>
          </div>
        ) : viewMode === 'snapshot' ? (
          /* WebP 秒開快照：0.05 秒極速呈現，支援手勢縮放與拖曳 */
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out'
            }}
            className="flex items-center justify-center max-w-none"
          >
            <img
              src={currentPage === 1 ? selectedTimetable.page1Snapshot : selectedTimetable.page2Snapshot}
              alt={`${selectedTimetable.name} - 第 ${currentPage} 頁`}
              onLoad={() => setLoading(false)}
              onError={() => {
                console.warn('Snapshot load failed, falling back to PDF canvas');
                setViewMode('pdf');
              }}
              className="shadow-2xl rounded-sm max-w-full h-auto bg-white pointer-events-none select-none max-h-[85vh] object-contain"
              draggable={false}
            />
          </div>
        ) : (
          /* 向量 PDF Canvas 畫布 */
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out'
            }}
            className="flex items-center justify-center max-w-none"
          >
            <canvas
              ref={canvasRef}
              className="shadow-2xl rounded-sm max-w-full h-auto bg-white"
            />
          </div>
        )}

        {/* 底部浮動引導提示 */}
        {!error && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-black/60 text-white/90 backdrop-blur-md shadow">
              {viewMode === 'snapshot' ? '⚡ 秒開快照模式：雙指滑動縮放' : '🔍 向量模式：點兩下快速放大'}
            </span>
          </div>
        )}
      </div>

      {/* 歷程課表抽屜面板 (Modal) */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className={`w-full max-w-lg rounded-2xl border shadow-xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
            <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <History size={18} className="text-amber-600 dark:text-amber-400" />
                <h3 className={`text-base font-extrabold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                  學期歷程課表存檔
                </h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 text-stone-400 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                系統自動封存各學期課表紀錄，供行政調閱與歷史查詢；若有更新課表，舊版自動歸檔。
              </p>

              {HISTORICAL_TIMETABLES.map((item) => {
                const isCurrent = selectedTimetable.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-teal-50/70 dark:bg-teal-950/40 border-teal-300 dark:border-teal-800'
                        : isDark
                          ? 'bg-slate-800/60 border-slate-800 hover:border-slate-700'
                          : 'bg-stone-50 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`text-sm font-extrabold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                          {item.name}
                        </h4>
                        {item.active ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                            <CheckCircle2 size={10} />
                            當前生效
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-200 text-stone-600 dark:bg-slate-700 dark:text-stone-300">
                            歷史存檔
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-stone-400 mt-1">
                        校區：{item.campuses.join('、')} ｜ 更新日期：{item.updatedAt}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setSelectedTimetable(item);
                          handleReset();
                          setShowHistoryModal(false);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs ${
                          isCurrent
                            ? 'bg-teal-700 text-white cursor-default'
                            : 'bg-white dark:bg-slate-800 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-slate-700 hover:bg-stone-100'
                        }`}
                      >
                        {isCurrent ? '正在檢視' : '切換檢視'}
                      </button>
                      <a
                        href={item.pdfUrl}
                        download={`${item.name}.pdf`}
                        className="p-1.5 rounded-lg border text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 border-stone-200 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 transition"
                        title="下載完整版 PDF"
                      >
                        <Download size={14} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-stone-50 dark:bg-slate-800/50 border-t border-stone-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-stone-200 dark:bg-slate-700 text-stone-800 dark:text-stone-200 hover:bg-stone-300 transition"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
