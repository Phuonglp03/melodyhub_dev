import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaMusic } from "react-icons/fa";
import { createProject } from "../../../services/user/projectService";

const CreateProjectPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    tempo: 120,
    key: "",
    timeSignature: "4/4",
    isPublic: false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate required fields (BR-21)
    if (!formData.title.trim()) {
      setError("Project title is required");
      return;
    }

    try {
      setLoading(true);
      const response = await createProject(formData);

      if (response.success) {
        // Navigate to project detail page
        navigate(`/projects/${response.data._id}`);
      } else {
        setError(response.message || "Failed to create project");
      }
    } catch (err) {
      console.error("Error creating project:", err);
      setError(err.message || "Failed to create project. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Page Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate("/projects")}
          className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
        >
          <FaArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Create New Project</h1>
          <p className="text-gray-400">Start a new collaborative music project</p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg max-w-3xl">
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
                Project Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Enter project title"
                required
                maxLength={200}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe your project..."
                rows="4"
                maxLength={1000}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500">
                  {formData.description.length}/1000
                </span>
              </div>
            </div>

            {/* Project Settings Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tempo */}
              <div>
                <label htmlFor="tempo" className="block text-sm font-medium text-gray-300 mb-2">
                  Tempo (BPM)
                </label>
                <input
                  type="number"
                  id="tempo"
                  name="tempo"
                  value={formData.tempo}
                  onChange={handleChange}
                  min="20"
                  max="300"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              {/* Key */}
              <div>
                <label htmlFor="key" className="block text-sm font-medium text-gray-300 mb-2">
                  Key
                </label>
                <input
                  type="text"
                  id="key"
                  name="key"
                  value={formData.key}
                  onChange={handleChange}
                  placeholder="e.g., Am, C, G"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              {/* Time Signature */}
              <div>
                <label htmlFor="timeSignature" className="block text-sm font-medium text-gray-300 mb-2">
                  Time Signature
                </label>
                <select
                  id="timeSignature"
                  name="timeSignature"
                  value={formData.timeSignature}
                  onChange={handleChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="4/4">4/4</option>
                  <option value="3/4">3/4</option>
                  <option value="2/4">2/4</option>
                  <option value="6/8">6/8</option>
                  <option value="12/8">12/8</option>
                </select>
              </div>
            </div>

            {/* Public/Private Toggle */}
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
                    <span>Private</span>
                  </div>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {formData.isPublic
                  ? "Public projects can be viewed by anyone. Private projects are only visible to you and collaborators."
                  : "Private projects are only visible to you and collaborators."}
              </p>
            </div>

            {/* Info Message */}
            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3">
              <p className="text-blue-300 text-sm">
                💡 You'll be able to add licks, create tracks, and invite collaborators after creating the project.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/projects")}
              className="px-6 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              disabled={loading || !formData.title.trim()}
            >
              {loading ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  Creating...
                </>
              ) : (
                <>
                  <FaMusic className="inline mr-2" />
                  Create Project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectPage;
