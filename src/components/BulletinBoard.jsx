import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import liff from '@line/liff';

export default function BulletinBoard() {
  const { isDark, staffData, liffProfile } = useApp();
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'history'
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isComposing, setIsComposing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [expireDays, setExpireDays] = useState('7');
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showAll, setShowAll] = useState(false); // ?ßÂà∂?ØÂê¶È°ØÁ§∫?Ä?âÂÖ¨??

  // Ê¨äÈ??§Êñ∑ÔºöÊ†°??1)?Å‰∏ª‰ª?2)?ÅÁ???3) ??ÁÆ°Á???0)
  const roleTags = staffData?.role_tags || '';
  const canPost = ['0', '1', '2', '3'].some(r => roleTags.includes(r));
  const currentUserUid = liffProfile?.userId || 'dev-admin';
  const currentUserName = staffData?.name || liffProfile?.displayName || '?™Áü•‰ΩøÁî®??;

  useEffect(() => {
    fetchAnnouncements();
  }, [activeTab]);

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const isArchived = activeTab === 'history';
      const res = await fetch(`/api/announcements?archived=${isArchived}`);
      const data = await res.json();
      if (res.ok) {
        setAnnouncements(data);
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // ?êÂà∂ 3MB
    if (file.size > 3 * 1024 * 1024) {
      alert('?∫‰?Á¢∫‰??≥Ëº∏Á©©Â?ÔºåÂñÆ?ãÊ?Ê°àË??øË???3MB');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64Data = evt.target.result.split(',')[1];
      // ?øÂ?‰∏≠Ê??ñÁâπÊÆäÂ??ÉÂ???Supabase Invalid keyÔºåÊîπ?®Á??±Êï∏‰ΩúÁÇ∫?üÂØ¶?≤Â?Ê™îÂ?
      const ext = file.name.split('.').pop() || '';
      const safeFilename = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext ? '.' + ext : ''}`;
      
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: safeFilename,
            contentType: file.type,
            base64Data
          })
        });
        
        const data = await res.json();
        if (res.ok) {
          // ?´Èù¢‰∏äË?Ë≥áÊ?Â∫´‰∏≠‰æùÁÑ∂‰øùÁ??üÂ??Ñ‰∏≠?áÊ???(file.name)
          setAttachments(prev => [...prev, { name: file.name, url: data.url }]);
        } else {
          alert('‰∏äÂÇ≥Â§±Ê?: ' + (data.error || '?™Áü•?ØË™§'));
        }
      } catch (err) {
        console.error(err);
        alert('‰∏äÂÇ≥?ºÁ?‰æãÂ??ØË™§');
      }
      setIsUploading(false);
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handlePost = async () => {
    if (!newTitle.trim()) return alert('Ë´ãÂ°´ÂØ´Ê?È°?);
    setIsLoading(true);
    
    let expire_at = null;
    if (expireDays !== 'never') {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(expireDays));
      expire_at = d.toISOString();
    }

    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          author_uid: currentUserUid,
          author_name: currentUserName,
          expire_at,
          attachments // ?≥ÈÄÅÈ?‰ª∂Èô£??
        })
      });
      if (res.ok) {
        setIsComposing(false);
        setNewTitle('');
        setNewContent('');
        setAttachments([]);
        fetchAnnouncements();
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  const handleArchive = async (id) => {
    if (!window.confirm('Á¢∫Â?Ë¶ÅÂ?Ê≠§ÂÖ¨?äÊ??ï‰??∂Ëá≥Ê≠∑Âè≤?Ä?éÔ?')) return;
    try {
      await fetch('/api/announcements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_archived: true })
      });
      fetchAnnouncements();
    } catch (err) {
      console.error(err);
    }
  };

  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const subTextColor = isDark ? 'text-gray-400' : 'text-gray-500';
  const cardBg = isDark ? 'bg-emerald-950/30' : 'bg-emerald-50/50';
  const borderColor = isDark ? 'border-emerald-900/50' : 'border-emerald-100';

  return (
    <div className="space-y-4">
      {/* ?ÇÈÉ®?áÊ??áÁôºÂ∏ÉÊ???*/}
      <div className="flex justify-between items-center mb-2">
        <div className={`flex rounded-lg overflow-hidden border ${borderColor}`}>
          <button 
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 text-sm font-bold transition-colors ${activeTab === 'active' ? 'bg-blue-600 text-white' : `${isDark ? 'bg-slate-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}`}
          >
            ?Ä?∞ÂÖ¨??
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-bold transition-colors ${activeTab === 'history' ? 'bg-gray-600 text-white' : `${isDark ? 'bg-slate-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}`}
          >
            Ê≠∑Âè≤?¨Â?
          </button>
        </div>
        
        {canPost && activeTab === 'active' && !isComposing && (
          <button 
            onClick={() => setIsComposing(true)}
            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-bold shadow-sm transition-transform active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            ÂºµË≤º?¨Â?
          </button>
        )}
      </div>

      {/* ?ºÂ??¨Â?Ë°®ÂñÆ */}
      {isComposing && (
        <div className={`p-4 rounded-xl shadow-sm border-l-4 border-emerald-500 ${cardBg}`}>
          <h3 className={`font-bold mb-3 ${textColor}`}>?? ÂºµË≤º?∞ÂÖ¨??/h3>
          <input 
            type="text" 
            placeholder="?¨Â?Ê®ôÈ?" 
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            className={`w-full p-2 mb-3 rounded border text-sm font-bold ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-stone-50 border-gray-300'}`}
          />
          <textarea 
            placeholder="?¨Â??ßÂÆπ (?ØË≤º‰∏äË????)" 
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            rows={4}
            className={`w-full p-2 mb-3 rounded border text-sm ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-stone-50 border-gray-300'}`}
          />
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${subTextColor}`}>?™Â?‰∏ãÊû∂Ôº?/span>
              <select 
                value={expireDays}
                onChange={e => setExpireDays(e.target.value)}
                className={`p-1.5 rounded border text-sm font-bold outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-stone-50 border-gray-300'}`}
              >
                <option value="3">3 Â§©Â?</option>
                <option value="7">7 Â§©Â?</option>
                <option value="14">14 Â§©Â?</option>
                <option value="30">30 Â§©Â?</option>
                <option value="never">?ãÂ?‰∏ãÊû∂ (Ê∞∏‰?)</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className={`flex items-center gap-2 text-sm font-bold cursor-pointer transition-colors px-3 py-1.5 rounded-lg border ${isUploading ? 'bg-gray-200 text-gray-500 border-transparent cursor-not-allowed' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 dark:bg-slate-700 dark:border-slate-600 dark:text-blue-400 dark:hover:bg-slate-600'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                {isUploading ? '‰∏äÂÇ≥‰∏?..' : '?†ÂÖ•?Ñ‰ª∂ (Max 3MB)'}
                <input type="file" className="sr-only" onChange={handleFileSelect} disabled={isUploading} />
              </label>
            </div>
          </div>

          {/* ?Ñ‰ª∂?óË°®?êË¶Ω */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {attachments.map((att, i) => (
                <div key={i} className={`flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 border border-gray-200 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-300`}>
                  <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  {att.name}
                  <button onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))} className="ml-1 text-red-500 hover:text-red-700 font-bold">?</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-3 dark:border-slate-700">
            <button onClick={() => { setIsComposing(false); setAttachments([]); }} className={`px-4 py-2 rounded-lg text-sm font-bold ${isDark ? 'bg-slate-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>?ñÊ?</button>
            <button onClick={handlePost} disabled={isLoading || isUploading} className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-400">{isLoading ? '?ºÂ?‰∏?..' : 'Á¢∫Ë??ºÂ?'}</button>
          </div>
        </div>
      )}

      {/* ?¨Â??óË°® */}
      {isLoading && !isComposing ? (
        <p className="text-center py-8 text-gray-500 font-bold animate-pulse">ËºâÂÖ•?¨Â?‰∏?..</p>
      ) : announcements.length === 0 ? (
        <div className={`p-8 text-center rounded-xl border border-dashed ${isDark ? 'border-slate-600' : 'border-gray-300'} ${cardBg}`}>
          <p className={subTextColor}>?ÆÂ?Ê≤íÊ?{activeTab === 'active' ? '?Ä?? : 'Ê≠∑Âè≤'}?¨Â?</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(showAll ? announcements : announcements.slice(0, 3)).map(ann => (
            <AnnouncementItem 
              key={ann.id} 
              ann={ann} 
              currentUserUid={currentUserUid} 
              currentUserName={currentUserName}
              canArchive={canPost && activeTab === 'active' && currentUserUid === ann.author_uid}
              onArchive={() => handleArchive(ann.id)}
            />
          ))}
          
          {/* È°ØÁ§∫?®ÈÉ® / ?∂Â??âÈ? */}
          {announcements.length > 3 && (
            <button 
              onClick={() => setShowAll(!showAll)}
              className={`w-full py-2.5 rounded-lg text-sm font-bold border transition-colors ${isDark ? 'border-slate-700 text-gray-400 hover:bg-slate-700/50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            >
              {showAll ? '?∂Ëµ∑?¨Â? (?ÖÈ°ØÁ§∫Ê???3 ??' : `?•Á??®ÈÉ®?¨Â? (??${announcements.length} ??`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AnnouncementItem({ ann, currentUserUid, currentUserName, canArchive, onArchive }) {
  const { isDark } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const cardBg = isDark ? 'bg-emerald-950/30' : 'bg-emerald-50/50';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const subTextColor = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-emerald-900/50' : 'border-emerald-100';

  const toggleExpand = () => {
    const nextState = !expanded;
    setExpanded(nextState);
    if (nextState && comments.length === 0) {
      loadComments();
    }
  };

  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/announcement_comments?announcement_id=${ann.id}`);
      if (res.ok) {
        setComments(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingComments(false);
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    try {
      const res = await fetch('/api/announcement_comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          announcement_id: ann.id,
          author_uid: currentUserUid,
          author_name: currentUserName,
          content: newComment
        })
      });
      if (res.ok) {
        const added = await res.json();
        setComments([...comments, added]);
        setNewComment('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // Ë∂ÖÈÄ???ïÁ?
  const renderContentWithLinks = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline break-all">{part}</a>;
      }
      return <span key={i} className="whitespace-pre-wrap">{part}</span>;
    });
  };

  return (
    <div className={`rounded-xl shadow-sm border ${borderColor} ${cardBg} overflow-hidden transition-all duration-300`}>
      {/* ÈªûÊ?Ê®ôÈ?Â±ïÈ? */}
      <div 
        onClick={toggleExpand}
        className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 flex flex-col gap-2`}
      >
        <div className="flex justify-between items-start gap-2">
          <h4 className={`font-bold text-lg leading-tight ${textColor}`}>{ann.title}</h4>
          <span className={`text-xs whitespace-nowrap bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded font-bold ${subTextColor}`}>
            {formatDate(ann.created_at)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
              {ann.author_name?.[0] || '??}
            </div>
            <span className={`text-sm font-bold ${subTextColor}`}>{ann.author_name}</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <svg className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      {/* Â±ïÈ?ÂæåÁ??ßÂÆπ?áÁ?Ë®Ä?Ä */}
      {expanded && (
        <div className={`border-t ${borderColor} animate-fade-in`}>
          {/* ?ßÊ? */}
          <div className={`p-4 text-sm leading-relaxed ${textColor}`}>
            {renderContentWithLinks(ann.content)}
          </div>
          
          {/* ?Ñ‰ª∂‰∏ãË??ÄÂ°?*/}
          {ann.attachments && ann.attachments.length > 0 && (
            <div className={`px-4 pb-4 flex flex-wrap gap-2`}>
              {ann.attachments.map((att, i) => (
                <a 
                  key={i} 
                  href={att.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  download={att.name}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${isDark ? 'bg-slate-700 border-slate-600 text-blue-400 hover:bg-slate-600' : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  {att.name}
                </a>
              ))}
            </div>
          )}
          
          {/* ‰∏ãÊû∂?âÈ? */}
          {canArchive && (
            <div className={`px-4 pb-4 flex justify-end`}>
              <button onClick={onArchive} className="text-xs text-red-500 font-bold hover:bg-red-50 dark:hover:bg-slate-700 px-2 py-1 rounded transition-colors">
                ?ãÂ?‰∏ãÊû∂Ê≠§ÂÖ¨??
              </button>
            </div>
          )}

          {/* ?ôË??Ä */}
          <div className={`bg-gray-50 dark:bg-slate-800/80 p-4 border-t ${borderColor}`}>
            <h5 className={`text-sm font-bold mb-3 ${subTextColor}`}>?ûÊ??Ä</h5>
            
            {loadingComments ? (
              <p className="text-xs text-center text-gray-400">ËÆÄ?ñ‰∏≠...</p>
            ) : (
              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto scrollbar-hide">
                {comments.length === 0 && <p className="text-xs text-gray-400 italic">Â∞öÁÑ°?ûÊ?Ôºå‰??∂È†≠È¶ôÂêßÔº?/p>}
                {comments.map(c => (
                  <div key={c.id} className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex-shrink-0 flex items-center justify-center text-emerald-700 font-bold text-xs mt-0.5">
                      {c.author_name?.[0]}
                    </div>
                    <div className={`flex-1 rounded-2xl rounded-tl-sm px-3 py-2 text-sm ${isDark ? 'bg-slate-700 text-gray-200' : 'bg-white border border-gray-200'}`}>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">{c.author_name}</span>
                        <span className="text-[10px] text-gray-400">{formatDate(c.created_at)}</span>
                      </div>
                      <p className="break-words">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* ?ôË?Ëº∏ÂÖ• */}
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="ÂØ´‰??ûÊ?..." 
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePostComment()}
                className={`flex-1 p-2 rounded-full border text-sm px-4 outline-none focus:border-emerald-500 ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300'}`}
              />
              <button 
                onClick={handlePostComment}
                disabled={!newComment.trim()}
                className="bg-emerald-600 disabled:bg-gray-400 text-white p-2 rounded-full w-9 h-9 flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
