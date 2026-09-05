import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useApp } from '../App';
import { 
  Calendar, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  FileText,
  School,
  Sparkles,
  Layers
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function TimetableViewer({ pdfUrl = '/timetable.pdf' }) {
  const { isDark } = useApp();
  const [currentPage, setCurrentPage] = useState(1); // 1: 霧臺校區, 2: 勵古百合分校
  const [totalPages, setTotalPages] = useState(2);
  const [loading, setLoading] = useState(true);
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

  const campusNames = {
    1: '霧臺校區課表',
    2: '勵古百合分校課表'
  };

  // Load PDF document
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    pdfjsLib.getDocument(pdfUrl).promise
      .then(doc => {
        if (!isMounted) return;
        pdfDocRef.current = doc;
        setTotalPages(doc.numPages || 2);
        renderPage(currentPage, doc);
      })
      .catch(err => {
        console.error('PDF load error:', err);
        if (isMounted) {
          setError('課表 PDF 載入失敗，請確認檔案連結');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [pdfUrl]);

  // Re-render when page changes
  useEffect(() => {
    if (pdfDocRef.current) {
      renderPage(currentPage, pdfDocRef.current);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [currentPage]);

  const renderPage = async (pageNum, doc) => {
    setLoading(true);
    try {
      const page = await doc.getPage(pageNum);
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Higher render scale for sharp text rendering on mobile & Retina screens
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
  const textColor = isDark ? 'text-stone-100' : 'text-stone-900';
  const subTextColor = isDark ? 'text-stone-400' : 'text-stone-500';

  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-[100] flex flex-col bg-black/95 p-2 sm:p-4'
    : `rounded-2xl border shadow-sm flex flex-col overflow-hidden ${cardBg}`;

  return (
    <div className={containerClasses} ref={containerRef}>
      {/* ── 頂部工具列 ── */}
      <div className={`p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b ${
        isFullscreen 
          ? 'bg-slate-900/90 border-slate-800 text-stone-100' 
          : isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-stone-50/90 border-stone-200'
      }`}>
        {/* 校區切換膠囊按鈕群 */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-stone-200/70 dark:bg-slate-800/90 self-start sm:self-auto">
          <button
            onClick={() => setCurrentPage(1)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              currentPage === 1
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
            }`}
          >
            <School size={14} />
            霧臺校區課表
          </button>
          <button
            onClick={() => setCurrentPage(2)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              currentPage === 2
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
            }`}
          >
            <Layers size={14} />
            勵古百合分校課表
          </button>
        </div>

        {/* 縮放、重設與全螢幕操作群 */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5">
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-slate-800 p-1 rounded-xl border border-stone-200 dark:border-slate-700">
            <button
              onClick={handleZoomOut}
              title="縮小"
              className="p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-700 dark:text-stone-200 transition"
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-xs font-mono font-bold px-1.5 min-w-[42px] text-center text-stone-700 dark:text-stone-200">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              title="放大"
              className="p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-700 dark:text-stone-200 transition"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={handleReset}
              title="重設大小"
              className="p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-600 dark:text-stone-400 transition ml-0.5"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          {/* 全螢幕切換按鈕 */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? '退出全螢幕' : '全螢幕檢視'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 text-stone-800 dark:text-stone-200"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            <span className="hidden sm:inline">{isFullscreen ? '退出全螢幕' : '全螢幕檢視'}</span>
          </button>

          {/* 原始 PDF 下載按鈕 */}
          <a
            href={pdfUrl}
            download="霧臺國小全校課表.pdf"
            title="下載原始 PDF 檔案"
            className="p-2 rounded-xl border transition bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 dark:border-emerald-800 dark:text-emerald-300"
          >
            <Download size={16} />
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
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-stone-100/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">課表渲染中...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center">
            <p className="text-sm font-bold text-red-500 mb-2">{error}</p>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-emerald-700 underline font-bold"
            >
              直接在新分頁開啟原始 PDF
            </a>
          </div>
        )}

        {/* 畫布容器 */}
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

        {/* 底部浮動引導提示 */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-black/60 text-white/90 backdrop-blur-md shadow">
            💡 手機雙指可縮放滑動，點兩下可快速放大
          </span>
        </div>
      </div>
    </div>
  );
}
