import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaCamera, FaTimes, FaLock, FaGlobe } from "react-icons/fa";
import { createPlaylist } from "../services/user/playlistService";
import { uploadPlaylistCover } from "../services/cloudinaryService";

const CreatePlaylistModal = ({ isOpen, onClose, onSuccess }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isPublic: true,
    coverImageUrl: "",
  });
  const [coverImage, setCoverImage] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const descriptionMaxLength = 250;

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === "isPublic") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (name === "description") {
      if (value.length <= descriptionMaxLength) {
        setFormData((prev) => ({ ...prev, [name]: value }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleCoverImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB");
        return;
      }
      setCoverImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveCover = () => {
    setCoverImage(null);
    setCoverPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("Playlist name is required");
      return;
    }

    try {
      setSaving(true);

      // Upload cover image if provided
      let coverImageUrl = formData.coverImageUrl;
      if (coverImage) {
        const uploadRes = await uploadPlaylistCover(coverImage);
        if (!uploadRes.success) {
          throw new Error(uploadRes.error || "Failed to upload cover image");
        }
        coverImageUrl = uploadRes.data.secure_url;
        setCoverPreview(uploadRes.data.secure_url);
      }

      // Create playlist (empty playlist, user will add licks later)
      const playlistData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        isPublic: formData.isPublic,
        coverImageUrl: coverImageUrl,
        lickIds: [], // Empty playlist, user will add licks on detail page
      };

      const result = await createPlaylist(playlistData);

      if (result.success) {
        onSuccess?.(result.data);
        handleClose();
        // Redirect to playlist detail page with auto-open search
        navigate(`/playlists/${result.data.playlist_id}?new=true`);
      } else {
        setError(result.message || "Failed to create playlist");
      }
    } catch (err) {
      console.error("Error creating playlist:", err);
      setError(err.message || "Failed to create playlist");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: "",
      description: "",
      isPublic: true,
      coverImageUrl: "",
    });
    setCoverImage(null);
    setCoverPreview(null);
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative z-10 w-full max-w-4xl mx-4 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-white">New Playlist</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column - Cover Image */}
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cover Image
              </label>
              <div className="relative aspect-square bg-gray-800 border-2 border-dashed border-gray-700 rounded-lg overflow-hidden group hover:border-orange-500 transition-colors">
                {coverPreview ? (
                  <>
                    <img
                      src={coverPreview}
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveCover}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <FaTimes size={12} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full flex flex-col items-center justify-center text-gray-400 hover:text-white transition-colors"
                  >
                    <FaCamera size={32} className="mb-2" />
                    <span className="text-sm">Upload Cover</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Right Column - Form Fields */}
            <div className="md:col-span-2 space-y-4">
              {/* Playlist Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Playlist name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Playlist name"
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="e.g. 'Chilled Blues jams for your creative inspiration'"
                  rows={4}
                  maxLength={descriptionMaxLength}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500">
                    {formData.description.length}/{descriptionMaxLength}
                  </span>
                </div>
              </div>

              {/* Privacy Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Privacy
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="radio"
                        name="isPublic"
                        checked={formData.isPublic}
                        onChange={() =>
                          setFormData((prev) => ({ ...prev, isPublic: true }))
                        }
                        className="sr-only"
                      />
                      <div
                        className={`w-12 h-6 rounded-full transition-colors ${
                          formData.isPublic ? "bg-orange-500" : "bg-gray-700"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                            formData.isPublic
                              ? "translate-x-6"
                              : "translate-x-0.5"
                          } mt-0.5`}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <FaGlobe />
                      <span>Public</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="radio"
                        name="isPublic"
                        checked={!formData.isPublic}
                        onChange={() =>
                          setFormData((prev) => ({ ...prev, isPublic: false }))
                        }
                        className="sr-only"
                      />
                      <div
                        className={`w-12 h-6 rounded-full transition-colors ${
                          !formData.isPublic ? "bg-orange-500" : "bg-gray-700"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                            !formData.isPublic
                              ? "translate-x-6"
                              : "translate-x-0.5"
                          } mt-0.5`}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <FaLock />
                      <span>Private</span>
                    </div>
                  </label>
                </div>
                {formData.isPublic && (
                  <p className="text-xs text-yellow-400 mt-2">
                    ⚠️ Public playlists can only contain public licks
                  </p>
                )}
              </div>

              {/* Info message */}
              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3">
                <p className="text-blue-300 text-sm">
                  💡 Bạn sẽ có thể thêm licks vào playlist sau khi tạo xong
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  disabled={saving || !formData.name.trim()}
                >
                  {saving ? "Creating..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePlaylistModal;
