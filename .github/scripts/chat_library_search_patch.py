from pathlib import Path
import re

path = Path('web/src/app/chat/page.tsx')
text = path.read_text()

state_anchor = "  const [messageSearchResults, setMessageSearchResults] = useState<Message[]>([]);\n"
if 'const [chatSearchOpen' not in text:
    if state_anchor not in text:
        raise SystemExit('search state anchor missing')
    text = text.replace(state_anchor, state_anchor + "  const [chatSearchOpen, setChatSearchOpen] = useState(false);\n  const [chatSearchIndex, setChatSearchIndex] = useState(0);\n  const [conversationLibraryMessages, setConversationLibraryMessages] = useState<Message[]>([]);\n  const [conversationLibraryLoading, setConversationLibraryLoading] = useState(false);\n", 1)

reset_old = "    setMessageSearch('');\n    setMessageSearchResults([]);\n"
if 'setConversationLibraryMessages([]);' not in text:
    if reset_old not in text:
        raise SystemExit('reset anchor missing')
    text = text.replace(reset_old, reset_old + "    setChatSearchOpen(false);\n    setChatSearchIndex(0);\n    setConversationLibraryMessages([]);\n", 1)

start = text.find("  const searchInsideConversation = async () => {")
if start < 0:
    raise SystemExit('search function start missing')
end = text.find("\n  const filteredConversations", start)
if end < 0:
    raise SystemExit('search function end anchor missing')
new_block = r'''  const loadAllConversationMessages = useCallback(async (conversationId: string) => {
    const pageSize = 100;
    let page = 0;
    let all: Message[] = [];
    while (page < 100) {
      const response = await api.get(`/chat/conversations/${conversationId}/messages`, { params: { page, size: pageSize } });
      const chunk: Message[] = response.data?.content || response.data || [];
      all = [...chunk, ...all];
      if (chunk.length < pageSize) break;
      page += 1;
    }
    return all;
  }, []);

  const loadConversationLibrary = useCallback(async () => {
    const conversationId = activeConversation?.conversationId;
    if (!conversationId || activeConversation?.isDraft) {
      setConversationLibraryMessages([]);
      return;
    }
    setConversationLibraryLoading(true);
    try {
      setConversationLibraryMessages(await loadAllConversationMessages(conversationId));
    } catch {
      setConversationLibraryMessages([]);
      setChatError('No se pudo cargar el historial de multimedia y enlaces.');
    } finally {
      setConversationLibraryLoading(false);
    }
  }, [activeConversation?.conversationId, activeConversation?.isDraft, loadAllConversationMessages]);

  useEffect(() => {
    if (showRightPanel && activeConversation?.conversationId && !activeConversation?.isDraft) void loadConversationLibrary();
  }, [showRightPanel, activeConversation?.conversationId, activeConversation?.isDraft, loadConversationLibrary]);

  const scrollToSearchResult = useCallback((index: number, results: Message[] = messageSearchResults) => {
    if (!results.length) return;
    const normalized = ((index % results.length) + results.length) % results.length;
    setChatSearchIndex(normalized);
    const id = results[normalized].messageId;
    window.setTimeout(() => {
      document.querySelector(`[data-message-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }, [messageSearchResults]);

  const searchInsideConversation = async () => {
    const conversationId = activeConversation?.conversationId;
    const query = messageSearch.trim();
    if (!conversationId || query.length < 2) return;
    try {
      const all = await loadAllConversationMessages(conversationId);
      const normalized = query.toLocaleLowerCase('es');
      const results = all.filter(message => (message.content || '').toLocaleLowerCase('es').includes(normalized));
      setMessages(all);
      setMessageSearchResults(results);
      setChatSearchIndex(0);
      setChatSearchOpen(true);
      setShowRightPanel(false);
      if (results.length) scrollToSearchResult(0, results);
      else setChatError(`No se encontraron mensajes con “${query}”.`);
    } catch {
      setChatError('No se pudo buscar en la conversación.');
    }
  };
'''
text = text[:start] + new_block + text[end:]

old_search_ui = '''<div className="space-y-2"><label className="text-[10px] font-extrabold uppercase text-slate-400">Buscar mensajes</label><div className="flex gap-2"><input value={messageSearch} onChange={event => setMessageSearch(event.target.value)} placeholder="Buscar texto…" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-[#26364c] dark:bg-[#0d1522]"/><button onClick={() => void searchInsideConversation()} className="rounded-xl bg-[#7c3aed] px-3 text-white"><Search className="h-4 w-4"/></button></div>{messageSearchResults.map(result => <div key={result.messageId} className="rounded-xl bg-slate-100 px-3 py-2 text-[10px] dark:bg-[#162033]"><strong>@{result.senderUsername}</strong> {result.content}</div>)}</div>'''
new_search_ui = '''<div className="space-y-2"><label className="text-[10px] font-extrabold uppercase text-slate-400">Buscar mensajes</label><div className="flex gap-2"><input value={messageSearch} onChange={event => setMessageSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void searchInsideConversation(); }} placeholder="Buscar texto…" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-[#26364c] dark:bg-[#0d1522]"/><button onClick={() => void searchInsideConversation()} className="rounded-xl bg-[#7c3aed] px-3 text-white" title="Buscar en el chat"><Search className="h-4 w-4"/></button></div></div>'''
if old_search_ui in text:
    text = text.replace(old_search_ui, new_search_ui, 1)
else:
    # Fallback: only remove inline result cards if spacing changed.
    text = re.sub(r'\{messageSearchResults\.map\(result => <div key=\{result\.messageId\}.*?</div>\)\}', '', text, count=1)

old_media = '''<div><p className="mb-2 text-[10px] font-extrabold uppercase text-slate-400">Multimedia, enlaces y archivos</p><div className="grid grid-cols-3 gap-2">{messages.flatMap(message => message.attachments || []).filter(attachment => !attachment.fileType.startsWith('VIEW_ONCE_')).slice(0,9).map(attachment => attachment.fileType === 'IMAGE' ? <button key={attachment.id} onClick={() => setFullscreenImageUrl(attachment.fileUrl)}><img src={attachment.fileUrl} alt={attachment.fileName} className="aspect-square w-full rounded-xl object-cover"/></button> : <div key={attachment.id} className="flex aspect-square items-center justify-center rounded-xl bg-slate-100 text-[9px] font-bold dark:bg-[#162033]">{attachment.fileType}</div>)}</div></div>'''
new_media = '''<div><p className="mb-2 text-[10px] font-extrabold uppercase text-slate-400">Multimedia, enlaces y archivos ({conversationLibraryMessages.reduce((total, message) => total + (message.attachments || []).filter(attachment => !attachment.fileType.startsWith('VIEW_ONCE_')).length + ((message.content || '').match(/https?:\\/\\/[^\\s]+/g)?.length || 0), 0)})</p>{conversationLibraryLoading ? <p className="py-4 text-center text-[10px] text-slate-400">Cargando historial…</p> : <div className="grid max-h-[420px] grid-cols-3 gap-2 overflow-y-auto pr-1">{[...conversationLibraryMessages].reverse().flatMap(message => { const attachments = (message.attachments || []).filter(attachment => !attachment.fileType.startsWith('VIEW_ONCE_')).map(attachment => ({ key: `a-${attachment.id}`, type: attachment.fileType, url: attachment.fileUrl, label: attachment.fileName || attachment.fileType })); const links = ((message.content || '').match(/https?:\\/\\/[^\\s]+/g) || []).map((raw, index) => { const url = raw.replace(/[),.!?]+$/, ''); return { key: `l-${message.messageId}-${index}`, type: 'LINK', url, label: (() => { try { return new URL(url).hostname.replace(/^www\\./, ''); } catch { return 'Enlace'; } })() }; }); return [...attachments, ...links]; }).map(item => item.type === 'IMAGE' ? <button key={item.key} onClick={() => setFullscreenImageUrl(item.url)} className="overflow-hidden rounded-xl"><img src={item.url} alt={item.label} className="aspect-square w-full object-cover"/></button> : item.type === 'VIDEO' ? <a key={item.key} href={item.url} target="_blank" rel="noreferrer" className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-[#162033]"><video src={item.url} muted playsInline preload="metadata" className="h-full w-full object-cover"/><span className="absolute rounded-full bg-black/60 px-2 py-1 text-[8px] font-bold text-white">VIDEO</span></a> : <a key={item.key} href={item.url} target="_blank" rel="noreferrer" className="flex aspect-square min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-slate-100 p-2 text-center dark:bg-[#162033]"><span className="text-[9px] font-extrabold">{item.type === 'LINK' ? 'ENLACE' : item.type}</span><span className="line-clamp-2 break-all text-[8px] text-slate-500">{item.label}</span></a>)}</div>}</div>'''
if old_media not in text:
    raise SystemExit('media block anchor missing')
text = text.replace(old_media, new_media, 1)

message_area_anchor = '            <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_80%_8%,rgba(124,58,237,.08),transparent_26%),radial-gradient(circle_at_18%_70%,rgba(139,92,246,.06),transparent_30%)] p-4 dark:bg-[radial-gradient(circle_at_82%_8%,rgba(139,92,246,.10),transparent_26%),radial-gradient(circle_at_12%_75%,rgba(91,33,182,.24),transparent_32%),linear-gradient(155deg,#0a0714,#100c1f_56%,#0c0a19)] md:p-6"'
toolbar = '''            {chatSearchOpen && <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-[#223047] dark:bg-[#0d1522]"><Search className="h-4 w-4 shrink-0 text-[#7c3aed]"/><input autoFocus value={messageSearch} onChange={event => setMessageSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { if (event.shiftKey) scrollToSearchResult(chatSearchIndex - 1); else scrollToSearchResult(chatSearchIndex + 1); } if (event.key === 'Escape') { setChatSearchOpen(false); setMessageSearchResults([]); } }} className="min-w-0 flex-1 bg-transparent text-xs outline-none" placeholder="Buscar en la conversación…"/><span className="shrink-0 text-[10px] font-bold text-slate-500">{messageSearchResults.length ? `${chatSearchIndex + 1} de ${messageSearchResults.length}` : '0 de 0'}</span><button disabled={!messageSearchResults.length} onClick={() => scrollToSearchResult(chatSearchIndex - 1)} className="rounded-lg px-2 py-1 text-sm font-bold disabled:opacity-30" title="Coincidencia anterior">↑</button><button disabled={!messageSearchResults.length} onClick={() => scrollToSearchResult(chatSearchIndex + 1)} className="rounded-lg px-2 py-1 text-sm font-bold disabled:opacity-30" title="Siguiente coincidencia">↓</button><button onClick={() => { setChatSearchOpen(false); setMessageSearchResults([]); }} className="rounded-lg p-1 text-slate-500" title="Cerrar búsqueda"><X className="h-4 w-4"/></button></div>}\n'''
if 'chatSearchOpen && <div className="flex items-center gap-2 border-b' not in text:
    if message_area_anchor not in text:
        raise SystemExit('message area anchor missing')
    text = text.replace(message_area_anchor, toolbar + message_area_anchor, 1)

old_wrapper = "return <div key={message.messageId} className={`flex max-w-[82%] flex-col ${isOwn ? 'ml-auto items-end' : 'items-start'} md:max-w-[75%]`}>"
new_wrapper = "return <div key={message.messageId} data-message-id={message.messageId} className={`flex max-w-[82%] flex-col ${isOwn ? 'ml-auto items-end' : 'items-start'} md:max-w-[75%] ${chatSearchOpen && messageSearchResults[chatSearchIndex]?.messageId === message.messageId ? 'rounded-2xl ring-2 ring-[#C97B63] ring-offset-4 ring-offset-transparent' : ''}`}>"
if old_wrapper in text:
    text = text.replace(old_wrapper, new_wrapper, 1)
elif 'data-message-id={message.messageId}' not in text:
    raise SystemExit('message wrapper anchor missing')

path.write_text(text)
