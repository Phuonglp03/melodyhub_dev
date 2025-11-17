import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import {
  getLickComments,
  addLickComment,
  updateLickComment,
  deleteLickComment,
} from "../services/user/lickService";
import { useNavigate } from "react-router-dom";

const CommentSection = ({ lickId, currentUser, onCountChange }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const authUser = useSelector((s) => s.auth.user);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const response = await getLickComments(lickId);
        if (response.success) {
          setComments(response.data);
          if (typeof onCountChange === "function") {
            onCountChange(
              Array.isArray(response.data) ? response.data.length : 0
            );
          }
        } else {
          setError("Failed to fetch comments");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [lickId]);

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const userId = authUser?.user?.id || authUser?.id || currentUser?.id;
    const tokenFromStorage = (() => {
      try {
        return (
          localStorage.getItem("token") ||
          JSON.parse(localStorage.getItem("user") || "{}").token
        );
      } catch {
        return undefined;
      }
    })();
    const hasToken = Boolean(authUser?.token || tokenFromStorage);
    if (!hasToken && !userId) {
      // Redirect to login if not authenticated
      navigate("/login");
      return;
    }

    try {
      const response = await addLickComment(lickId, { comment: newComment });

      if (response.success) {
        setComments((prev) => [response.data, ...prev]);
        setNewComment("");
        if (typeof onCountChange === "function") {
          onCountChange((c) => (typeof c === "number" ? c + 1 : 1));
        }
      } else {
        setError("Failed to post comment");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (c) => {
    setEditingId(c.comment_id);
    setEditValue(c.comment);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async (commentId) => {
    if (!editValue.trim()) return;
    try {
      const res = await updateLickComment(lickId, commentId, editValue);
      if (res.success) {
        setComments((prev) =>
          prev.map((c) =>
            c.comment_id === commentId
              ? {
                  ...c,
                  comment: res.data.comment,
                  updated_at: res.data.updated_at,
                }
              : c
          )
        );
        cancelEdit();
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (commentId) => {
    try {
      const res = await deleteLickComment(lickId, commentId);
      if (res.success) {
        setComments((prev) => prev.filter((c) => c.comment_id !== commentId));
        if (typeof onCountChange === "function") {
          onCountChange((c) => (typeof c === "number" && c > 0 ? c - 1 : 0));
        }
      }
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) {
    return <div>Loading comments...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h3 className="text-xl font-semibold text-white mb-4">Comments</h3>
      <form onSubmit={handleCommentSubmit} className="mb-6">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-white"
        />
        <button
          type="submit"
          className="mt-2 bg-orange-600 text-white px-4 py-2 rounded-md"
        >
          Post Comment
        </button>
      </form>
      <div className="space-y-4">
        {comments.map((comment) => {
          const canModify =
            String(authUser?.user?.id || authUser?.id || "") ===
            String(comment.user_id || "");
          return (
            <div key={comment.comment_id} className="flex space-x-4">
              {comment.avatar_url ? (
                <img
                  src={comment.avatar_url}
                  alt={comment.display_name}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-700" />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white">
                    {comment.display_name || "Unknown User"}
                  </p>
                  {canModify && (
                    <div className="space-x-2 text-sm">
                      {editingId === comment.comment_id ? (
                        <>
                          <button
                            onClick={() => saveEdit(comment.comment_id)}
                            className="text-green-400"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-gray-400"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(comment)}
                            className="text-blue-400"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(comment.comment_id)}
                            className="text-red-400"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {editingId === comment.comment_id ? (
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white mt-2"
                  />
                ) : (
                  <p className="text-gray-400 mt-1">{comment.comment}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CommentSection;
