import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, Input, Button, Tag } from "antd";
import {
  FaSearch,
  FaPlus,
  FaFilter,
  FaLock,
  FaTimes,
  FaInfoCircle,
  FaCheckCircle,
} from "react-icons/fa";
import {
  deleteLick,
  updateLick as apiUpdateLick,
  getMyLicks,
} from "../../../services/user/lickService";
import {
  fetchTagsGrouped,
  upsertTags,
  replaceContentTags,
  searchTags,
} from "../../../services/user/tagService";
import { createPost as createPostApi } from "../../../services/user/post";
import MyLickCard from "../../../components/MyLickCard";
import TagFlowBoard from "../../../components/TagFlowBoard";

// --- Main My Licks Page ---
const MyLicksPage = () => {
  // userId is resolved server-side via JWT on /user/me

  const navigate = useNavigate();
  const [licks, setLicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Tag suggestions
  const [tagInput, setTagInput] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [loadingTagSuggestions, setLoadingTagSuggestions] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  // Edit modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingLick, setEditingLick] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    key: "",
    tempo: "",
    difficulty: "",
    status: "",
    isPublic: false,
    isFeatured: false,
    selectedTags: [],
    customTagInput: "",
  });
  const [saving, setSaving] = useState(false);
  const [tagGroups, setTagGroups] = useState({});
  const [tagLookup, setTagLookup] = useState({});
  const [tagLibraryLoaded, setTagLibraryLoaded] = useState(false);
  const [sharingLickId, setSharingLickId] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareLick, setShareLick] = useState(null);
  const [shareText, setShareText] = useState("");
  const [sharing, setSharing] = useState(false);

  // Delete confirmation modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  // Fetch user's licks from API
  const fetchMyLicks = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit: 20,
      };

      if (searchTerm) {
        params.search = searchTerm;
      }

      if (selectedTags) {
        params.tags = selectedTags;
      }

      if (statusFilter) {
        params.status = statusFilter;
      }

      const res = await getMyLicks(params);

      // Handle different response structures
      if (res?.success) {
        setLicks(res.data || []);
        setPagination(res.pagination || null);
      } else if (Array.isArray(res?.data)) {
        // Handle case where response is just data array
        setLicks(res.data);
        setPagination(res.pagination || null);
      } else if (Array.isArray(res)) {
        // Handle case where response is directly an array
        setLicks(res);
        setPagination(null);
      } else {
        setLicks([]);
        setPagination(null);
      }
    } catch (err) {
      console.error("Error fetching my licks:", err);
      const status = err?.response?.status;
      const rawMsg = err?.response?.data?.message || err?.message || "";
      const msg = String(rawMsg);
      const normalized = msg.toLowerCase();
      const isAuthError =
        status === 401 ||
        status === 403 ||
        normalized.includes("token") ||
        normalized.includes("expired") ||
        normalized.includes("unauthorized") ||
        normalized.includes("forbidden") ||
        normalized.includes("hết hạn");
      if (isAuthError) {
        setError("You must login to see your licks");
      } else {
        setError(msg || "Failed to load your licks");
      }
      // Reset to empty array on error
      setLicks([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch licks when filters or page changes
  useEffect(() => {
    fetchMyLicks();
  }, [page, statusFilter]);

  // Load available tags for selection in edit modal
  useEffect(() => {
    const loadTags = async () => {
      try {
        const res = await fetchTagsGrouped();
        if (res?.success && res.data) {
          const groups = {};
          const lookup = {};

          const mapGroupName = (type) => {
            const lower = String(type || "").toLowerCase();
            if (lower === "mood" || lower === "emotional") return "Emotional";
            if (lower === "genre") return "Genre";
            if (lower === "instrument") return "Type";
            if (lower === "character") return "Character";
            if (lower === "articulation") return "Articulation";
            if (lower === "timbre") return "Timbre";
            return type || "Other";
          };

          Object.entries(res.data).forEach(([type, arr]) => {
            const groupName = mapGroupName(type);
            const existingNames = new Set(groups[groupName] || []);
            const names = [];

            arr.forEach((tag) => {
              const display =
                tag?.tag_name || tag?.name || tag?.tagName || tag?.label || "";
              if (!display) return;
              const normalized = display.toLowerCase();
              lookup[normalized] = {
                name: display,
                type: tag?.tag_type || tag?.type || type || "user_defined",
              };
              if (!existingNames.has(display)) {
                existingNames.add(display);
                names.push(display);
              }
            });

            if (names.length > 0) {
              groups[groupName] = [...(groups[groupName] || []), ...names];
            }
          });

          setTagGroups(groups);
          setTagLookup(lookup);
        }
      } catch (err) {
        console.error("Error loading tag library:", err);
      } finally {
        setTagLibraryLoaded(true);
      }
    };

    loadTags();
  }, []);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchMyLicks();
      } else {
        setPage(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, selectedTags, statusFilter]);

  // Fetch tag suggestions when tag input changes
  useEffect(() => {
    const fetchTagSuggestions = async () => {
      if (!showTagSuggestions) return;

      try {
        setLoadingTagSuggestions(true);
        console.log(
          "[DEBUG] (IS $) Fetching tag suggestions for query:",
          tagInput
        );
        const res = await searchTags(tagInput);
        console.log("[DEBUG] (IS $) Tag search response:", {
          success: res?.success,
          dataLength: res?.data?.length,
          data: res?.data,
        });
        if (res?.success && Array.isArray(res.data)) {
          setTagSuggestions(res.data);
        } else {
          console.warn(
            "[DEBUG] (IS $) Invalid tag search response format:",
            res
          );
          setTagSuggestions([]);
        }
      } catch (err) {
        console.error("[DEBUG] (IS $) Error fetching tag suggestions:", {
          error: err,
          message: err?.message,
          response: err?.response?.data,
          status: err?.response?.status,
        });
        setTagSuggestions([]);
      } finally {
        setLoadingTagSuggestions(false);
      }
    };

    const timer = setTimeout(() => {
      fetchTagSuggestions();
    }, 300); // Debounce tag search

    return () => clearTimeout(timer);
  }, [tagInput, showTagSuggestions]);

  // Load all tags when tag input is focused and empty
  useEffect(() => {
    if (showTagSuggestions && tagInput === "") {
      const fetchAllTags = async () => {
        try {
          setLoadingTagSuggestions(true);
          console.log("[DEBUG] (IS $) Fetching all tags (empty query)");
          const res = await searchTags("");
          console.log("[DEBUG] (IS $) All tags response:", {
            success: res?.success,
            dataLength: res?.data?.length,
            data: res?.data,
          });
          if (res?.success && Array.isArray(res.data)) {
            setTagSuggestions(res.data);
          } else {
            console.warn(
              "[DEBUG] (IS $) Invalid all tags response format:",
              res
            );
            setTagSuggestions([]);
          }
        } catch (err) {
          console.error("[DEBUG] (IS $) Error fetching all tags:", {
            error: err,
            message: err?.message,
            response: err?.response?.data,
            status: err?.response?.status,
          });
          setTagSuggestions([]);
        } finally {
          setLoadingTagSuggestions(false);
        }
      };
      fetchAllTags();
    }
  }, [showTagSuggestions, tagInput]);

  // Handle lick click
  const handleLickClick = (lickId) => {
    navigate(`/licks/${lickId}`);
  };

  // Handle edit
  const handleEdit = (lickId) => {
    const lick = licks.find((l) => l.lick_id === lickId);
    if (!lick) return;

    const seen = new Set();
    const normalizedTags = (lick.tags || [])
      .map((tag) => tag.tag_name || tag.tagName || tag.name || "")
      .filter(Boolean)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .reduce((acc, tag) => {
        const lower = tag.toLowerCase();
        if (seen.has(lower)) {
          return acc;
        }
        seen.add(lower);
        const canonical = tagLookup[lower]?.name || tag;
        acc.push(canonical);
        return acc;
      }, []);

    setEditingLick(lick);
    setEditForm({
      title: lick.title || "",
      description: lick.description || "",
      key: lick.key || "",
      tempo: lick.tempo || "",
      difficulty: lick.difficulty || "",
      status: lick.status || "",
      isPublic: !!lick.is_public,
      isFeatured: !!lick.is_featured,
      selectedTags: normalizedTags,
      customTagInput: "",
    });
    setIsEditOpen(true);
  };

  // Handle delete
  const handleDelete = (lickId) => {
    setConfirmTargetId(lickId);
    setConfirmError("");
    setConfirmOpen(true);
  };

  const handleShare = (lickId) => {
    const lick = licks.find((l) => l.lick_id === lickId);
    if (!lick || sharing) return;
    if (!lick.is_public) {
      alert("Only public licks can be shared to your feed.");
      return;
    }

    const title = lick.title || "My new lick";
    const defaultText = `🎸 ${title}`;

    setShareLick(lick);
    setShareText(defaultText);
    setShareModalOpen(true);
  };

  const handleCloseShareModal = () => {
    if (!sharing) {
      setShareModalOpen(false);
      setShareLick(null);
      setShareText("");
    }
  };

  const handleConfirmShare = async () => {
    if (!shareLick?.lick_id) return;

    try {
      setSharing(true);
      setSharingLickId(shareLick.lick_id);

      // Generate lick preview URL
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const previewUrl = origin
        ? `${origin}/licks/${shareLick.lick_id}`
        : `/licks/${shareLick.lick_id}`;

      console.log('(NO $) [DEBUG][shareLick] Sharing with linkPreview:', {
        lickId: shareLick.lick_id,
        previewUrl,
        title: shareLick.title,
        linkPreview: {
          url: previewUrl,
          title: shareLick.title || "Lick Preview",
          description: shareLick.description || "",
        }
      });

      const response = await createPostApi({
        postType: "status_update",
        textContent: shareText,
        linkPreview: {
          url: previewUrl,
          title: shareLick.title || "Lick Preview",
          description: shareLick.description || "",
        },
      });

      console.log('(NO $) [DEBUG][shareLick] Post created response:', {
        response,
        hasLinkPreview: !!response?.data?.linkPreview,
        linkPreviewUrl: response?.data?.linkPreview?.url
      });

      alert("Shared to your feed!");
      setShareModalOpen(false);
      setShareLick(null);
      setShareText("");
    } catch (err) {
      console.error("Error sharing lick:", err);
      alert(err?.message || "Failed to share lick");
    } finally {
      setSharing(false);
      setSharingLickId(null);
    }
  };

  const performDelete = async () => {
    if (!confirmTargetId) return;
    try {
      setConfirmLoading(true);
      setConfirmError("");
      await deleteLick(confirmTargetId);
      setLicks((prevLicks) =>
        prevLicks.filter((lick) => lick.lick_id !== confirmTargetId)
      );
      setConfirmOpen(false);
      setConfirmTargetId(null);
    } catch (err) {
      console.error("Error deleting lick:", err);
      setConfirmError(err?.message || "Failed to delete lick");
    } finally {
      setConfirmLoading(false);
    }
  };

  // Handle upload
  const handleUpload = () => {
    navigate("/licks/upload");
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleToggleTag = (tagName) => {
    const trimmed = (tagName || "").trim();
    if (!trimmed) return;
    const normalized = trimmed.toLowerCase();
    const canonical = tagLookup[normalized]?.name || trimmed;

    setEditForm((prev) => {
      const exists = prev.selectedTags.some(
        (tag) => tag.toLowerCase() === normalized
      );
      const selectedTags = exists
        ? prev.selectedTags.filter((tag) => tag.toLowerCase() !== normalized)
        : [...prev.selectedTags, canonical];
      return {
        ...prev,
        selectedTags,
      };
    });
  };

  const handleRemoveTag = (tagName) => {
    const normalized = (tagName || "").trim().toLowerCase();
    if (!normalized) return;
    setEditForm((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.filter(
        (tag) => tag.toLowerCase() !== normalized
      ),
    }));
  };

  const handleAddCustomTags = () => {
    setEditForm((prev) => {
      const rawInput = prev.customTagInput || "";
      const parts = rawInput
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

      if (parts.length === 0) {
        if (!rawInput) return prev;
        return { ...prev, customTagInput: "" };
      }

      const existingSet = new Set(
        prev.selectedTags.map((tag) => tag.toLowerCase())
      );
      const additions = [];

      parts.forEach((part) => {
        const normalized = part.toLowerCase();
        const canonical = tagLookup[normalized]?.name || part;
        const canonicalLower = canonical.toLowerCase();
        if (!existingSet.has(canonicalLower)) {
          existingSet.add(canonicalLower);
          additions.push(canonical);
        }
      });

      if (additions.length === 0) {
        return { ...prev, customTagInput: "" };
      }

      return {
        ...prev,
        selectedTags: [...prev.selectedTags, ...additions],
        customTagInput: "",
      };
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingLick) return;
    setSaving(true);
    // ⭐ LOGIC: Chỉ cho phép gửi isPublic/isFeatured nếu đã active
    const canEditSettings = editingLick.status === "active";
    try {
      const payload = {
        title: editForm.title,
        description: editForm.description,
        key: editForm.key,
        tempo: editForm.tempo,
        difficulty: editForm.difficulty,
        status: editForm.status,
        // isPublic: editForm.isPublic,
        // isFeatured: editForm.isFeatured,
      };
      // ⭐ LOGIC: Chỉ gửi settings nếu được phép
      if (canEditSettings) {
        payload.isPublic = editForm.isPublic;
        payload.isFeatured = editForm.isFeatured;
      }

      const res = await apiUpdateLick(editingLick.lick_id, payload);
      let updatedTags = editingLick.tags || [];
      const seenTags = new Set();
      const collectedTags = [];

      const collectTag = (rawTag) => {
        const trimmed = (rawTag || "").trim();
        if (!trimmed) return;
        const normalized = trimmed.toLowerCase();
        if (seenTags.has(normalized)) return;
        seenTags.add(normalized);
        const lookupEntry = tagLookup[normalized];
        collectedTags.push({
          name: lookupEntry?.name || trimmed,
          lower: normalized,
          type: lookupEntry?.type,
        });
      };

      editForm.selectedTags.forEach(collectTag);
      if (editForm.customTagInput) {
        editForm.customTagInput
          .split(",")
          .map((tag) => tag.trim())
          .forEach(collectTag);
      }

      const existingTypeMap = {};
      (editingLick.tags || []).forEach((tag) => {
        const key = (
          tag.tag_name ||
          tag.tagName ||
          tag.name ||
          ""
        ).toLowerCase();
        if (key) {
          existingTypeMap[key] =
            tag.tag_type || tag.tagType || tag.type || "user_defined";
        }
      });

      if (collectedTags.length > 0) {
        const upsertPayload = collectedTags.map((tag) => ({
          name: tag.name,
          type: tag.type || existingTypeMap[tag.lower] || "user_defined",
        }));

        try {
          const upsertRes = await upsertTags(upsertPayload);
          const tagDocs = upsertRes?.data || [];
          const tagIds = tagDocs.map((doc) => doc._id);
          await replaceContentTags("lick", editingLick.lick_id, tagIds);
          updatedTags = tagDocs.map((doc) => ({
            tag_id: doc._id,
            tag_name: doc.name || doc.tag_name || "",
            tag_type: doc.type || doc.tag_type || "user_defined",
          }));
        } catch (tagError) {
          console.error("Error updating tags:", tagError);
          alert(tagError?.message || "Failed to update tags");
        }
      } else {
        try {
          await replaceContentTags("lick", editingLick.lick_id, []);
          updatedTags = [];
        } catch (tagError) {
          console.error("Error clearing tags:", tagError);
          alert(tagError?.message || "Failed to clear tags");
        }
      }

      if (res?.success) {
        const updated = res.data || {};
        setEditingLick((prev) =>
          prev ? { ...prev, tags: updatedTags } : prev
        );
        setLicks((prev) =>
          prev.map((l) =>
            l.lick_id === editingLick.lick_id
              ? {
                  ...l,
                  title: updated.title ?? editForm.title,
                  description: updated.description ?? editForm.description,
                  tab_notation: updated.tabNotation ?? l.tab_notation,
                  key: updated.key ?? editForm.key,
                  tempo: updated.tempo ?? editForm.tempo,
                  difficulty: updated.difficulty ?? editForm.difficulty,
                  status: updated.status ?? editForm.status,
                  is_public:
                    canEditSettings && typeof updated.isPublic === "boolean"
                      ? updated.isPublic
                      : l.is_public,
                  is_featured:
                    canEditSettings && typeof updated.isFeatured === "boolean"
                      ? updated.isFeatured
                      : l.is_featured,
                  tags: updatedTags,
                }
              : l
          )
        );
        setEditForm((prev) => ({
          ...prev,
          selectedTags: updatedTags
            .map(
              (tag) =>
                tag.tag_name || tag.tagName || tag.name || tag?.label || ""
            )
            .filter(Boolean),
          customTagInput: "",
        }));
        setIsEditOpen(false);
        setEditingLick(null);
      } else {
        alert(res?.message || "Failed to update lick");
      }
    } catch (err) {
      console.error("Error updating lick:", err);
      alert(err?.message || "Failed to update lick");
    } finally {
      setSaving(false);
    }
  };
  const canEditSettings = editingLick?.status === "active";

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Page Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My Licks</h1>
          <p className="text-gray-400">Manage your personal lick library</p>
        </div>
        <button
          onClick={handleUpload}
          className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-2 rounded-md text-sm font-semibold flex items-center hover:opacity-90 transition-opacity"
        >
          <FaPlus className="mr-2" /> Upload New Lick
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <FaSearch size={14} />
            </span>
            <input
              type="text"
              placeholder="Search your licks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white w-full rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Tags Filter */}
          <div className="relative flex-1 min-w-[150px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10">
              <FaFilter size={12} />
            </span>
            <input
              type="text"
              placeholder="Filter by tags..."
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                setShowTagSuggestions(true);
              }}
              onFocus={() => setShowTagSuggestions(true)}
              onBlur={() => {
                // Delay hiding to allow clicking on suggestions
                setTimeout(() => setShowTagSuggestions(false), 200);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && tagInput.trim()) {
                  e.preventDefault();
                  const trimmed = tagInput.trim();
                  if (selectedTags) {
                    const existingTags = selectedTags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean);
                    if (!existingTags.includes(trimmed)) {
                      setSelectedTags([...existingTags, trimmed].join(", "));
                    }
                  } else {
                    setSelectedTags(trimmed);
                  }
                  setTagInput("");
                  setShowTagSuggestions(false);
                }
              }}
              className="bg-gray-800 border border-gray-700 text-white w-full rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            {/* Tag Suggestions Dropdown */}
            {showTagSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                {loadingTagSuggestions ? (
                  <div className="px-4 py-3 text-sm text-gray-400 text-center">
                    Loading tags...
                  </div>
                ) : tagSuggestions.length > 0 ? (
                  <div className="py-1">
                    {tagSuggestions.map((tag) => (
                      <button
                        key={tag.tag_id}
                        type="button"
                        onClick={() => {
                          const tagName = tag.tag_name || tag.name || "";
                          if (selectedTags) {
                            // Add to existing tags (comma-separated)
                            const existingTags = selectedTags
                              .split(",")
                              .map((t) => t.trim())
                              .filter(Boolean);
                            if (!existingTags.includes(tagName)) {
                              setSelectedTags(
                                [...existingTags, tagName].join(", ")
                              );
                            }
                          } else {
                            setSelectedTags(tagName);
                          }
                          setTagInput("");
                          setShowTagSuggestions(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center justify-between"
                      >
                        <span>#{tag.tag_name || tag.name}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          {tag.tag_type || "tag"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : tagInput.trim() === "" ? (
                  <div className="px-4 py-3 text-sm text-gray-400 text-center">
                    No tags available. Start typing to search or create tags
                    when editing a lick.
                  </div>
                ) : (
                  <div className="px-4 py-3 text-sm text-gray-400 text-center">
                    No tags found matching "{tagInput}"
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Selected Tags Display */}
          {selectedTags && (
            <div className="flex flex-wrap gap-2 items-center">
              {selectedTags.split(",").map((tag, idx) => {
                const trimmed = tag.trim();
                if (!trimmed) return null;
                return (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-300"
                  >
                    #{trimmed}
                    <button
                      type="button"
                      onClick={() => {
                        const tags = selectedTags
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean);
                        tags.splice(idx, 1);
                        setSelectedTags(tags.join(", "));
                      }}
                      className="text-orange-300 hover:text-orange-200 transition-colors"
                      aria-label={`Remove ${trimmed}`}
                    >
                      <FaTimes size={10} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Results Count */}
        {pagination && (
          <div className="text-sm text-gray-400">
            {pagination.totalItems}{" "}
            {pagination.totalItems === 1 ? "lick" : "licks"}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
        </div>
      )}

      {/* Error State */}
      {error &&
        (() => {
          const normalizedError = error.toLowerCase();
          if (normalizedError.includes("login")) {
            return (
              <div className="max-w-xl mx-auto bg-gray-900/70 border border-gray-800 rounded-2xl p-10 text-center shadow-lg mb-6">
                <div className="mx-auto w-14 h-14 flex items-center justify-center rounded-full bg-orange-500/10 text-orange-400 mb-4">
                  <FaLock size={24} />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Sign in to see your licks
                </h2>
                <p className="text-gray-400 mb-6">
                  Your personal licks are protected. Please log in to continue
                  managing them.
                </p>
                <button
                  onClick={() => (window.location.href = "/login")}
                  className="px-6 py-2 rounded-md bg-gradient-to-r from-orange-500 to-red-600 text-white font-medium hover:opacity-90 transition"
                >
                  Go to login
                </button>
              </div>
            );
          }
          return (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
              <p className="text-red-400">{error}</p>
              <button
                onClick={fetchMyLicks}
                className="mt-2 text-sm text-orange-400 hover:text-orange-300"
              >
                Try again
              </button>
            </div>
          );
        })()}

      {/* Lick Cards Grid */}
      {!loading && !error && licks.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {licks.map((lick) => (
            <MyLickCard
              key={lick.lick_id}
              lick={lick}
              onClick={handleLickClick}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onShare={handleShare}
              shareLoading={sharing && shareLick?.lick_id === lick.lick_id}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && licks.length === 0 && (
        <div className="text-center py-20">
          <div className="text-gray-500 mb-4">
            <FaPlus size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-xl font-semibold">No licks yet</p>
            <p className="text-sm mt-2 mb-6">
              Start building your lick library by uploading your first lick
            </p>
            <button
              onClick={handleUpload}
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 py-3 rounded-md font-semibold hover:opacity-90 transition-opacity inline-flex items-center"
            >
              <FaPlus className="mr-2" /> Upload Your First Lick
            </button>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination && pagination.totalPages > 1 && (
        <div className="mt-8 flex justify-center items-center space-x-4">
          <button
            onClick={() => setPage(page - 1)}
            disabled={!pagination.hasPrevPage}
            className="px-4 py-2 bg-gray-800 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
          >
            Previous
          </button>

          <span className="text-gray-400">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>

          <button
            onClick={() => setPage(page + 1)}
            disabled={!pagination.hasNextPage}
            className="px-4 py-2 bg-gray-800 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => {
              if (!saving) {
                setIsEditOpen(false);
                setEditingLick(null);
              }
            }}
          />
          <div className="relative z-10 w-full max-w-2xl mx-4 my-8 bg-gray-900 border border-gray-800 rounded-lg shadow-xl max-h-[90vh] flex flex-col overflow-y-auto">
            <div className="px-5 py-3 border-t border-b border-gray-800 flex items-center justify-between flex-shrink-0 sticky top-4 bg-gray-900/95 backdrop-blur-sm rounded-t-lg">
              <h2 className="text-base font-semibold text-white tracking-wide">
                Edit Lick
              </h2>
              <button
                className="text-gray-400 hover:text-white"
                onClick={() => {
                  if (!saving) {
                    setIsEditOpen(false);
                    setEditingLick(null);
                  }
                }}
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={handleEditSubmit}
              className="px-5 py-4 space-y-6 overflow-y-auto"
            >
              {/* Basic info */}
              <div className="space-y-3">
                <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                  Basic Info
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">
                      Title
                    </label>
                    <input
                      name="title"
                      value={editForm.title}
                      onChange={handleEditChange}
                      className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Name this lick so you can find it later"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={editForm.description}
                      onChange={handleEditChange}
                      rows={3}
                      className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                      placeholder="Add context: where to use this lick, feel, or tips to play it..."
                    />
                  </div>
                </div>
              </div>

              {/* Tags section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                    Tags & Mood
                  </p>
                  <span className="text-[11px] text-gray-500">
                    Help you search and recommend this lick
                  </span>
                </div>
                {Object.keys(tagGroups).length > 0 ? (
                  <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4">
                    <TagFlowBoard
                      groups={tagGroups}
                      selected={editForm.selectedTags}
                      onToggle={handleToggleTag}
                      enableAudio={false}
                    />
                  </div>
                ) : (
                  <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4 text-sm text-gray-400">
                    {tagLibraryLoaded
                      ? "No preset tags available. Add your own below."
                      : "Loading preset tags…"}
                  </div>
                )}
                <div className="mt-3">
                  <label className="block text-xs text-gray-400 mb-1">
                    Custom tags
                  </label>
                  <div className="flex gap-2">
                    <input
                      name="customTagInput"
                      value={editForm.customTagInput}
                      onChange={handleEditChange}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="e.g. fusion, swing, upbeat"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomTags}
                      className="px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded-md transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Choose from the list or add your own tags. Separate multiple
                    tags with commas.
                  </p>
                </div>
                {editForm.selectedTags.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-400 mb-2">Selected tags:</p>
                    <div className="flex flex-wrap gap-2">
                      {editForm.selectedTags.map((tag) => (
                        <span
                          key={tag.toLowerCase()}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-200"
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="text-gray-400 hover:text-white transition-colors"
                            aria-label={`Remove ${tag}`}
                          >
                            <FaTimes size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* Technical details */}
              <div className="space-y-3">
                <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                  Technical Details
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">
                      Key
                    </label>
                    <input
                      name="key"
                      value={editForm.key}
                      onChange={handleEditChange}
                      className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">
                      Tempo (BPM)
                    </label>
                    <input
                      name="tempo"
                      value={editForm.tempo}
                      onChange={handleEditChange}
                      className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">
                      Difficulty
                    </label>
                    <select
                      name="difficulty"
                      value={editForm.difficulty}
                      onChange={handleEditChange}
                      className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">Select</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  {/* Status (Read-only) */}
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">
                      Status
                    </label>
                    <div
                      className={`w-full px-3 py-2 text-sm font-bold uppercase rounded-md border border-gray-700 ${
                        editingLick.status === "active"
                          ? "bg-green-900/30 text-green-400"
                          : editingLick.status === "pending"
                          ? "bg-yellow-900/30 text-yellow-400"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {editingLick.status}
                    </div>
                  </div>
                </div>
              </div>

              {/* ⭐ SETTINGS SECTION: PUBLIC & FEATURED ⭐ */}
              <div
                className={`mt-4 p-4 rounded-lg border ${
                  canEditSettings
                    ? "bg-gray-800/30 border-gray-700"
                    : "bg-gray-800/50 border-gray-700/50 opacity-75"
                }`}
              >
                <div className="flex items-center gap-6">
                  {/* Public Checkbox */}
                  <label
                    className={`inline-flex items-center gap-3 text-sm ${
                      canEditSettings
                        ? "text-gray-300 cursor-pointer"
                        : "text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="isPublic"
                      checked={editForm.isPublic}
                      onChange={handleEditChange}
                      disabled={!canEditSettings} // Disable nếu pending
                      className="form-checkbox h-5 w-5 text-orange-500 bg-gray-800 border-gray-600 rounded disabled:opacity-50"
                    />
                    <span className="font-medium">Public</span>
                  </label>

                  {/* Featured Checkbox */}
                  <label
                    className={`inline-flex items-center gap-3 text-sm ${
                      canEditSettings
                        ? "text-gray-300 cursor-pointer"
                        : "text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="isFeatured"
                      checked={editForm.isFeatured}
                      onChange={handleEditChange}
                      disabled={!canEditSettings} // Disable nếu pending
                      className="form-checkbox h-5 w-5 text-orange-500 bg-gray-800 border-gray-600 rounded disabled:opacity-50"
                    />
                    <span className="font-medium">Featured</span>
                  </label>
                </div>

                {/* Helper Text */}
                {!canEditSettings && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-yellow-500 bg-yellow-900/10 p-2 rounded">
                    <FaLock size={12} className="mt-0.5 flex-shrink-0" />
                    <span>
                      Visibility settings are locked while{" "}
                      <strong>Pending Approval</strong>. Once approved, you can
                      change these.
                    </span>
                  </div>
                )}
                {canEditSettings && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-green-400">
                    <FaCheckCircle size={12} />
                    <span>
                      Lick is active. You can update visibility settings.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-800 mt-4 bg-gray-900">
                <button
                  type="button"
                  className="px-4 py-1.5 text-sm bg-gray-800 text-white rounded-md hover:bg-gray-700"
                  onClick={() => !saving && setIsEditOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-sm bg-orange-600 hover:bg-orange-700 text-white rounded-md disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              if (!confirmLoading) {
                setConfirmOpen(false);
                setConfirmTargetId(null);
              }
            }}
          />
          <div className="relative z-10 w-full max-w-md mx-4 bg-gray-900 border border-gray-800 rounded-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Delete Lick</h2>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-gray-300 text-sm">
                Are you sure you want to delete this lick? This action cannot be
                undone.
              </p>
              {confirmError && (
                <div className="text-red-400 text-sm">{confirmError}</div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700"
                onClick={() => {
                  if (!confirmLoading) {
                    setConfirmOpen(false);
                    setConfirmTargetId(null);
                  }
                }}
                disabled={confirmLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
                onClick={performDelete}
                disabled={confirmLoading}
              >
                {confirmLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Lick Modal */}
      <Modal
        open={shareModalOpen}
        title={
          <span style={{ color: "#fff", fontWeight: 600 }}>Chia sẻ lick</span>
        }
        onCancel={handleCloseShareModal}
        footer={
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Button
              shape="round"
              onClick={handleCloseShareModal}
              disabled={sharing}
              style={{
                height: 44,
                borderRadius: 22,
                padding: 0,
                width: 108,
                background: "#1f1f1f",
                color: "#e5e7eb",
                borderColor: "#303030",
              }}
            >
              Hủy
            </Button>
            <Button
              shape="round"
              type="primary"
              loading={sharing}
              onClick={handleConfirmShare}
              disabled={sharing || !shareText.trim()}
              style={{
                height: 44,
                borderRadius: 22,
                padding: 0,
                width: 108,
                background: "#7c3aed",
                borderColor: "#7c3aed",
              }}
            >
              Chia sẻ
            </Button>
          </div>
        }
        styles={{
          content: { background: "#0f0f10" },
          header: {
            background: "#0f0f10",
            borderBottom: "1px solid #1f1f1f",
          },
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input.TextArea
            placeholder="Chia sẻ điều gì đó..."
            autoSize={{ minRows: 6, maxRows: 16 }}
            value={shareText}
            onChange={(e) => setShareText(e.target.value)}
            maxLength={300}
            showCount
            style={{
              background: "#1a1a1a",
              color: "#e5e7eb",
              borderColor: "#3a3a3a",
            }}
          />

          {/* Lick Preview Link Section */}
          {shareLick && (
            <div
              style={{
                background: "#141414",
                border: "1px solid #262626",
                borderRadius: 16,
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 4,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      color: "#f8fafc",
                      fontWeight: 600,
                      fontSize: 16,
                      marginBottom: 6,
                    }}
                  >
                    Link preview lick
                  </div>
                  <div
                    style={{
                      color: "#9ca3af",
                      fontSize: 13,
                      lineHeight: "1.5",
                    }}
                  >
                    Link này sẽ hiển thị preview của lick trong bài đăng.
                  </div>
                </div>
                <Tag
                  color="#1f1f1f"
                  style={{
                    borderRadius: 999,
                    color: "#9ca3af",
                    border: "none",
                    marginLeft: 12,
                  }}
                >
                  Tự động
                </Tag>
              </div>
              <Input
                value={
                  typeof window !== "undefined"
                    ? `${window.location.origin}/licks/${shareLick.lick_id}`
                    : `/licks/${shareLick.lick_id}`
                }
                readOnly
                style={{
                  width: "100%",
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #3a3a3a",
                  borderRadius: 8,
                  color: "#9ca3af",
                  cursor: "text",
                }}
                onFocus={(e) => e.target.select()}
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default MyLicksPage;
