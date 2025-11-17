import { useCallback, useEffect, useState } from 'react';
import dm from '../services/dmService';
import { onDmBadge, offDmBadge, onDmNew, offDmNew, onDmConversationUpdated, offDmConversationUpdated } from '../services/user/socketService';

export default function useDMConversations() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dm.listConversations();
      console.log('[useDMConversations] Received conversations:', data);
      if (data && data.length > 0) {
        console.log('[useDMConversations] First conversation participants:', data[0]?.participants);
      }
      setConversations(data);
    } catch (e) {
      console.error('[useDMConversations] Error:', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleRefresh = (payload) => {
      console.log('[DM] conversations refresh on event', payload);
      refresh();
    };
    const handleConversationUpdated = ({ conversationId, conversation }) => {
      console.log('[DM] conversation updated', conversationId, conversation);
      // Update the specific conversation in the list
      setConversations((prev) => {
        const updated = prev.map((c) => 
          c._id === conversationId ? { ...c, ...conversation, status: conversation.status } : c
        );
        // If conversation not in list, add it
        if (!updated.find(c => c._id === conversationId)) {
          return [...updated, conversation];
        }
        return updated;
      });
      // Also refresh to ensure consistency
      refresh();
    };
    onDmBadge(handleRefresh);
    onDmNew(handleRefresh);
    onDmConversationUpdated(handleConversationUpdated);
    return () => {
      offDmBadge(handleRefresh);
      offDmNew(handleRefresh);
      offDmConversationUpdated(handleConversationUpdated);
    };
  }, [refresh]);

  return {
    conversations,
    loading,
    error,
    refresh,
    accept: async (id) => {
      const updated = await dm.acceptConversation(id);
      setConversations((prev) => prev.map((c) => (c._id === id ? updated : c)));
      return updated;
    },
    decline: async (id) => {
      await dm.declineConversation(id);
      setConversations((prev) => prev.filter((c) => c._id !== id));
    },
    ensureWith: async (peerId) => {
      const conv = await dm.ensureConversationWith(peerId);
      await refresh();
      return conv;
    },
  };
}





