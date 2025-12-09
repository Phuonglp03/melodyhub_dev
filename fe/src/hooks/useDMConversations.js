import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import dm from '../services/dmService';
import {
  onDmBadge,
  offDmBadge,
  onDmNew,
  offDmNew,
  onDmConversationUpdated,
  offDmConversationUpdated,
  onDmRequestAccepted,
  offDmRequestAccepted,
  onDmRequestDeclined,
  offDmRequestDeclined,
} from '../services/user/socketService';

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
        const updated = prev.map((c) => {
          if (c._id !== conversationId) return c;

          // Giữ lại thông tin participants đã được populate (displayName, username)
          let mergedParticipants = conversation.participants;
          try {
            if (Array.isArray(c.participants) && Array.isArray(conversation.participants)) {
              mergedParticipants = conversation.participants.map((p, idx) => {
                const prevP = c.participants[idx];
                const hasName =
                  prevP &&
                  (prevP.displayName ||
                    prevP.username ||
                    (prevP.user && (prevP.user.displayName || prevP.user.username)));

                const newHasName =
                  p &&
                  (p.displayName ||
                    p.username ||
                    (p.user && (p.user.displayName || p.user.username)));

                // Nếu dữ liệu mới không có tên nhưng cũ có, ưu tiên dùng dữ liệu cũ
                if (!newHasName && hasName) {
                  return prevP;
                }
                return p || prevP;
              });
            }
          } catch (e) {
            // Nếu có lỗi merge thì fallback dùng participants cũ
            mergedParticipants = c.participants || conversation.participants;
          }

          return {
            ...c,
            ...conversation,
            participants: mergedParticipants || c.participants,
            status: conversation.status,
          };
        });
        // If conversation not in list, add it
        if (!updated.find(c => c._id === conversationId)) {
          return [...updated, conversation];
        }
        return updated;
      });
      // Also refresh to ensure consistency
      refresh();
    };
    const handleRequestAccepted = ({ conversationId }) => {
      console.log('[DM] request accepted for conversation', conversationId);
      try {
        message.success('Yêu cầu tin nhắn của bạn đã được chấp nhận', 3);
      } catch (e) {
        console.error('[DM] Error showing accept message:', e);
      }
      refresh();
    };
    const handleRequestDeclined = ({ conversationId }) => {
      console.log('[DM] request declined for conversation', conversationId);
      // Refresh để nhận status mới từ server
      // Conversation sẽ được update qua handleConversationUpdated khi nhận dm:conversation:updated
      refresh();
    };
    onDmBadge(handleRefresh);
    onDmNew(handleRefresh);
    onDmConversationUpdated(handleConversationUpdated);
    onDmRequestAccepted(handleRequestAccepted);
    onDmRequestDeclined(handleRequestDeclined);
    return () => {
      offDmBadge(handleRefresh);
      offDmNew(handleRefresh);
      offDmConversationUpdated(handleConversationUpdated);
      offDmRequestAccepted(handleRequestAccepted);
      offDmRequestDeclined(handleRequestDeclined);
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





