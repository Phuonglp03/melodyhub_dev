import React, { useState, useEffect } from "react";
import { FaSearch, FaFilter } from "react-icons/fa";
import { getCommunityLicks } from "../../../services/user/lickService";
import LickCard from "../../../components/LickCard";

// --- Main Lick Community Page ---
const LickCommunityPage = () => {
  const [licks, setLicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  // Pagination
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  // Fetch licks from API
  const fetchLicks = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit: 20,
        sortBy,
      };

      if (searchTerm) {
        params.search = searchTerm;
      }

      if (selectedTags) {
        params.tags = selectedTags;
      }

      const response = await getCommunityLicks(params);

      if (response.success) {
        setLicks(response.data);
        setPagination(response.pagination);
      }
    } catch (err) {
      console.error("Error fetching licks:", err);
      setError(err.message || "Failed to load licks");
    } finally {
      setLoading(false);
    }
  };

  // Fetch licks when filters or page changes
  useEffect(() => {
    fetchLicks();
  }, [page, sortBy]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchLicks();
      } else {
        setPage(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, selectedTags]);

  // Handle lick click
  const handleLickClick = (lickId) => {
    window.location.href = `/licks/${lickId}`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Lick Community</h1>
        <p className="text-gray-400">
          Discover and explore licks from musicians around the world
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="newest">Newest First</option>
            <option value="popular">Most Popular</option>
          </select>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <FaSearch size={14} />
            </span>
            <input
              type="text"
              placeholder="Search licks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white w-full rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Tags Filter */}
          <div className="relative flex-1 min-w-[150px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <FaFilter size={12} />
            </span>
            <input
              type="text"
              placeholder="Filter by tags..."
              value={selectedTags}
              onChange={(e) => setSelectedTags(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white w-full rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Results Count */}
        {pagination && (
          <div className="text-sm text-gray-400">
            Showing {licks.length} of {pagination.totalItems} licks
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
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchLicks}
            className="mt-2 text-sm text-orange-400 hover:text-orange-300"
          >
            Try again
          </button>
        </div>
      )}

      {/* Lick Cards Grid (match My Licks grid) */}
      {!loading && !error && licks.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {licks.map((lick) => (
            <LickCard
              key={lick.lick_id}
              lick={lick}
              onClick={handleLickClick}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && licks.length === 0 && (
        <div className="text-center py-20">
          <div className="text-gray-500 mb-4">
            <FaSearch size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-xl font-semibold">No licks found</p>
            <p className="text-sm mt-2">Try adjusting your search or filters</p>
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
    </div>
  );
};

export default LickCommunityPage;
