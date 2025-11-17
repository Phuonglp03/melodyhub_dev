import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dm from '../services/dmService';
import { dmJoin, dmSend, dmSeen, dmTyping, onDmNew, onDmTyping, onDmSeen, offDmNew, offDmTyping, offDmSeen, getSocket } from '../services/user/socketService';

export default function useDMConversationMessages(conversationId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [peerTyping, setPeerTyping] = useState(false);
  const lastLoadBefore = useRef(null);

  const loadInitial = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await dm.listMessages(conversationId, { limit: 30 });
      setMessages(data);
      setHasMore(data.length >= 30);
      lastLoadBefore.current = data.length ? data[0].createdAt : null;
      // mark seen when first load
      await dm.markSeen(conversationId);
      dmSeen(conversationId);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const loadMore = useCallback(async () => {
    if (!conversationId || !hasMore || !lastLoadBefore.current) return;
    setLoading(true);
    try {
      const data = await dm.listMessages(conversationId, { before: lastLoadBefore.current, limit: 30 });
      setMessages((prev) => [...data, ...prev]);
      setHasMore(data.length >= 30);
      lastLoadBefore.current = data.length ? data[0].createdAt : lastLoadBefore.current;
    } finally {
      setLoading(false);
    }
  }, [conversationId, hasMore]);

  const send = useCallback(async (text) => {
    if (!conversationId || !text?.trim()) return;
    const s = getSocket();
    if (s && s.connected) {
      // Dùng socket: server sẽ emit dm:new cho cả hai phía → không gọi REST để tránh tạo trùng
      dmSend(conversationId, text.trim());
      return;
    }
    // Không có socket: dùng REST và append ngay
    try {
      const saved = await dm.sendMessage(conversationId, text.trim());
      setMessages((prev) => [...prev, saved]);
    } catch {}
  }, [conversationId]);

  const typing = useMemo(() => ({
    start: () => dmTyping(conversationId, true),
    stop: () => dmTyping(conversationId, false)
  }), [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    console.log('[DM] join conversation room', conversationId);
    dmJoin(conversationId);
    loadInitial();

    const handleNew = ({ conversationId: cid, message }) => {
      console.log('[DM] on dm:new', cid, message);
      if (cid !== conversationId) return;
      setMessages((prev) => {
        const exists = prev.some((m) => String(m._id) === String(message._id));
        return exists ? prev : [...prev, message];
      });
    };
    const handleTyping = ({ conversationId: cid, typing }) => {
      console.log('[DM] on dm:typing', cid, typing);
      if (cid !== conversationId) return;
      setPeerTyping(!!typing);
    };
    const handleSeen = ({ conversationId: cid }) => {
      console.log('[DM] on dm:seen', cid);
      if (cid !== conversationId) return;
      // could set message status to seen if you track ids
    };
    onDmNew(handleNew);
    onDmTyping(handleTyping);
    onDmSeen(handleSeen);

    return () => {
      offDmNew(handleNew);
      offDmTyping(handleTyping);
      offDmSeen(handleSeen);
    };
  }, [conversationId, loadInitial]);

  return { messages, loading, error, hasMore, loadMore, send, typing, peerTyping };
}





