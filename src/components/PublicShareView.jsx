import React, { useState, useEffect } from 'react';
import { 
  Building2, Wrench, ShoppingCart, MapPin, Calendar, CheckCircle2, 
  AlertTriangle, FileText, Download, Sun, Moon, ArrowRight, Share2, 
  Check, Phone, ShieldCheck, X, Maximize2 
} from 'lucide-react';
import { copyToClipboard } from './CopyPublicLinkButton';

function parseCampus(location) {
  const loc = String(location || '');
  if (loc.includes('[勵古分校]') || loc.includes('勵古')) {
    return {
      label: '勵古分校',
      badgeClass: 'border-amber-500/40 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
      cleanLocation: loc.replace(/\[勵古分校\]\s*/g, '').trim() || loc
    };
  }
  if (loc.includes('[全校共通]') || loc.includes('全校')) {
    return {
      label: '全校共通',
      badgeClass: 'border-sky-500/40 bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200',
      cleanLocation: loc.replace(/\[全校共通\]\s*/g, '').trim() || loc
    };
  }
  return {
    label: '霧臺校區',
    badgeClass: 'border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
    cleanLocation: loc.replace(/\[霧臺校區\]\s*/g, '').trim() || loc
  };
}

export default function PublicShareView({ view, id, isDark, toggleTheme }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState(!id ? '缺少案件識別碼。' : null);
  const [copied, setCopied] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        let endpoint = '';
        if (view === 'repair') {
          endpoint = `/api/repairs?public_id=${encodeURIComponent(id)}`;
        } else if (view === 'announcement') {
          endpoint = `/api/announcements?id=${encodeURIComponent(id)}`;
        } else {
          throw new Error('不支援的查閱類型。');
        }

        const res = await fetch(endpoint);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || '無法取得該資料，可能已被移除或無效連結。');
        }
        if (isMounted) {
          setData(json);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || '連線錯誤');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [view, id]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(window.location.href);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const goToHome = () => {
    window.location.href = window.location.origin + window.location.pathname;
  };

  const renderContentWithLinks = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 dark:text-emerald-400 underline break-all font-semibold hover:text-emerald-700"
          >
            {part}
          </a>
        );
      }
      return <span key={i} className="whitespace-pre-wrap">{part}</span>;
    });
  };

  return (
    <div className={`min-h-[100dvh] flex flex-col ${isDark ? 'dark bg-slate-950 text-stone-100' : 'bg-stone-50 text-stone-900'}`}>
      {/* ── 頂部導覽列 (毛玻璃固定) ── */}
      <header className={`sticky top-0 z-40 h-16 flex items-center justify-between px-4 sm:px-8 border-b backdrop-blur-md transition-colors ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-stone-200'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-700 flex items-center justify-center flex-shrink-0 shadow-xs">
            <Building2 size={16} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm tracking-tight leading-tight">屏東縣霧臺國民小學</span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold leading-tight">
              官方公開查閱專頁 (免登入)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 日夜切換 */}
          <button
            onClick={toggleTheme}
            className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-colors ${
              isDark ? 'border-slate-700 text-amber-400 hover:bg-slate-800' : 'border-stone-200 text-stone-600 hover:bg-stone-100'
            }`}
            title="切換日夜模式"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* 前往校務系統 / 教職員登入按鈕 */}
          <button
            onClick={goToHome}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-transform active:scale-95"
          >
            <span>教職員登入</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </header>

      {/* ── 主內容區域 ── */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col justify-start">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-emerald-700 dark:text-emerald-400 font-bold text-sm">正在載入公開案件資訊...</p>
          </div>
        )}

        {!loading && error && (
          <div className={`p-8 rounded-2xl border text-center my-12 shadow-sm ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
          }`}>
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertTriangle size={24} />
            </div>
            <h2 className="text-lg font-black mb-1">查無案件或已失效</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto mb-6 leading-relaxed">
              {error}
            </p>
            <button
              onClick={goToHome}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition active:scale-95"
            >
              返回校務系統首頁
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-4 animate-fade-in">
            {/* 脫敏資訊提示標籤 */}
            <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-semibold ${
              isDark ? 'bg-slate-900/80 border-slate-800 text-stone-300' : 'bg-stone-100/90 border-stone-200 text-stone-700'
            }`}>
              <div className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span>此頁面已通過公務資訊脫敏審查，不含校內人員個資與經費金額。</span>
              </div>
              <button
                onClick={handleCopy}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : isDark
                      ? 'bg-slate-800 border-slate-700 text-stone-300 hover:bg-slate-700'
                      : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                {copied ? <Check size={11} /> : <Share2 size={11} />}
                <span>{copied ? '已複製' : '分享此頁'}</span>
              </button>
            </div>

            {/* ── 修繕或採購案件卡片 ── */}
            {view === 'repair' && (
              <article className={`rounded-2xl shadow-md border overflow-hidden ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
              }`}>
                {/* 狀態色條頭部 */}
                <div className={`p-6 border-b-4 ${
                  data.urgency === 'red'
                    ? 'border-b-rose-500'
                    : data.urgency === 'yellow'
                      ? 'border-b-amber-400'
                      : 'border-b-sky-500'
                }`}>
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* 類型標籤 */}
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                        data.type === 'purchase'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                      }`}>
                        {data.type === 'purchase' ? <ShoppingCart size={13} /> : <Wrench size={13} />}
                        {data.type === 'purchase' ? '採購需求' : '報修案件'}
                      </span>

                      {/* 校區標籤 */}
                      {(() => {
                        const campus = parseCampus(data.location);
                        return (
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${campus.badgeClass}`}>
                            {campus.label}
                          </span>
                        );
                      })()}

                      {/* 緊急程度標籤 */}
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        data.urgency === 'red'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          : data.urgency === 'yellow'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}>
                        {data.urgency === 'red' ? '緊急' : data.urgency === 'yellow' ? '一般' : '低優先'}
                      </span>
                    </div>

                    {/* 案件狀態 */}
                    <span className={`px-3 py-1 rounded-full text-xs font-black border flex items-center gap-1 shrink-0 ${
                      data.status === 'closed'
                        ? 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800'
                        : data.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}>
                      <CheckCircle2 size={13} />
                      {data.status === 'closed' ? '已結案' : data.status === 'completed' ? '施工完畢待驗' : '處理中 / 廠商派工中'}
                    </span>
                  </div>

                  {/* 標題 */}
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">
                    {data.target}
                  </h1>

                  {/* 位置與提報日期 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-xs font-semibold text-stone-600 dark:text-stone-300">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span><b>施工位置：</b>{parseCampus(data.location).cleanLocation}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span><b>提報日期：</b>{new Date(data.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* 內容詳情 */}
                <div className="p-6 space-y-5">
                  <div>
                    <h3 className="text-xs font-bold tracking-wider text-stone-400 uppercase mb-2">案況詳情與規格需求</h3>
                    <div className={`p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap font-medium ${
                      isDark ? 'bg-slate-800/70 text-stone-200' : 'bg-stone-50 text-stone-800'
                    }`}>
                      {data.description || '無詳細說明'}
                    </div>
                  </div>

                  {/* 現場照片展示區 */}
                  {data.media_urls && data.media_urls.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold tracking-wider text-stone-400 uppercase mb-2">現場照片 ({data.media_urls.length})</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {data.media_urls.map((url, i) => (
                          <div
                            key={i}
                            onClick={() => setPreviewPhoto(url)}
                            className="group relative aspect-video rounded-xl overflow-hidden border border-stone-200 dark:border-slate-700 cursor-pointer bg-stone-100 dark:bg-slate-800"
                          >
                            <img
                              src={url}
                              alt={`現場照片 ${i + 1}`}
                              className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <span className="text-white text-xs font-bold flex items-center gap-1 bg-black/60 px-2 py-1 rounded-md">
                                <Maximize2 size={12} /> 放大檢視
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            )}

            {/* ── 公告專頁卡片 ── */}
            {view === 'announcement' && (
              <article className={`rounded-2xl shadow-md border overflow-hidden ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'
              }`}>
                <div className="p-6 border-b border-stone-200 dark:border-slate-800">
                  <div className="flex justify-between items-center gap-2 mb-3">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      校務公告
                    </span>
                    <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                      {new Date(data.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">
                    {data.title}
                  </h1>
                  <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-stone-500 dark:text-stone-400">
                    <Building2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                    <span>發布單位：{data.author_name || '屏東縣霧臺國小'}</span>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* 公告內文 */}
                  <div className={`p-4 rounded-xl text-sm leading-relaxed ${
                    isDark ? 'bg-slate-800/70 text-stone-200' : 'bg-stone-50 text-stone-800'
                  }`}>
                    {renderContentWithLinks(data.content)}
                  </div>

                  {/* 附件清單 */}
                  {data.attachments && data.attachments.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold tracking-wider text-stone-400 uppercase mb-2">附件下載 ({data.attachments.length})</h3>
                      <div className="flex flex-wrap gap-2">
                        {data.attachments.map((att, i) => (
                          <a
                            key={i}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={att.name}
                            className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border transition-colors ${
                              isDark
                                ? 'bg-slate-800 border-slate-700 text-emerald-300 hover:bg-slate-700'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                            }`}
                          >
                            <Download size={14} />
                            <span>{att.name}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            )}

            {/* ── 底部公務聯絡資訊與說明 ── */}
            <footer className={`p-5 rounded-2xl border text-xs leading-relaxed space-y-2 ${
              isDark ? 'bg-slate-900/60 border-slate-800 text-stone-400' : 'bg-white border-stone-200 text-stone-600'
            }`}>
              <div className="flex items-center gap-2 font-bold text-stone-700 dark:text-stone-200">
                <Phone size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span>公務聯繫窗口</span>
              </div>
              <p>
                屏東縣霧臺國民小學（霧臺校區、勵古分校）<br />
                地址：922 屏東縣霧臺鄉霧臺村神山巷 73 號<br />
                總務處電話：<a href="tel:087902230" className="font-bold text-emerald-600 dark:text-emerald-400 underline">(08) 790-2230</a>
              </p>
              <p className="text-[11px] text-stone-400 pt-1 border-t border-stone-200 dark:border-slate-800">
                本系統由屏東縣霧臺國小提供。廠商施作報價或外賓公務洽詢，請逕洽學校總務處以確認細節。
              </p>
            </footer>
          </div>
        )}
      </main>

      {/* ── 照片燈箱全螢幕預覽 Modal ── */}
      {previewPhoto && (
        <div 
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-10 right-0 text-white hover:text-stone-300 p-1"
            >
              <X size={24} />
            </button>
            <img
              src={previewPhoto}
              alt="放大預覽"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
