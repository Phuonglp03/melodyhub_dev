import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";

const LickLibraryLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("licks"); // Default to 'licks' tab

  useEffect(() => {
    if (location.pathname.startsWith("/library/my-licks")) {
      setActiveTab("licks");
    } else if (location.pathname.startsWith("/library/community")) {
      setActiveTab("licks");
    } else if (location.pathname.startsWith("/projects")) {
      setActiveTab("projects");
    } else if (location.pathname.startsWith("/playlists")) {
      setActiveTab("playlists");
    }
  }, [location.pathname]);

  const isActive = (path) => {
    return location.pathname === path;
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    switch (tab) {
      case "projects":
        navigate("/projects");
        break;
      case "licks":
        navigate("/library/my-licks");
        break;
      case "playlists":
        navigate("/playlists");
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white pt-16">
      {/* Horizontal Tabs */}
      <div className="bg-gray-950 border-b border-gray-800">
        <div className="flex items-center px-6 space-x-8">
          <button
            onClick={() => handleTabChange("projects")}
            className={`py-4 px-2 text-base font-medium transition-all relative ${
              activeTab === "projects"
                ? "text-white"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            Projects
            {activeTab === "projects" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
            )}
          </button>
          <button
            onClick={() => handleTabChange("licks")}
            className={`py-4 px-2 text-base font-medium transition-all relative ${
              activeTab === "licks"
                ? "text-white"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            Licks
            {activeTab === "licks" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
            )}
          </button>
          <button
            onClick={() => handleTabChange("playlists")}
            className={`py-4 px-2 text-base font-medium transition-all relative ${
              activeTab === "playlists"
                ? "text-white"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            Playlists
            {activeTab === "playlists" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
            )}
          </button>
        </div>
      </div>

      {/* Content Area with Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 bg-gray-950 p-4 border-r border-gray-800 flex-shrink-0 overflow-y-auto">
          <div className="space-y-2">
            {activeTab === "licks" && (
              <>
                <button
                  onClick={() => navigate("/library/my-licks")}
                  className={`w-full text-left px-4 py-2.5 rounded-md text-sm transition-all ${
                    isActive("/library/my-licks")
                      ? "bg-gray-800 text-white font-semibold"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  My Licks
                </button>
                <button
                  onClick={() => navigate("/library/community")}
                  className={`w-full text-left px-4 py-2.5 rounded-md text-sm transition-all ${
                    isActive("/library/community")
                      ? "bg-gray-800 text-white font-semibold"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  Lick Community
                </button>
              </>
            )}
            {activeTab === "playlists" && (
              <>
                <button
                  onClick={() => navigate("/playlists")}
                  className={`w-full text-left px-4 py-2.5 rounded-md text-sm transition-all ${
                    location.pathname === "/playlists" &&
                    !location.pathname.includes("/community")
                      ? "bg-gray-800 text-white font-semibold"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  My Playlists
                </button>
                <button
                  onClick={() => navigate("/playlists/community")}
                  className={`w-full text-left px-4 py-2.5 rounded-md text-sm transition-all ${
                    location.pathname === "/playlists/community"
                      ? "bg-gray-800 text-white font-semibold"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  Playlist Community
                </button>
              </>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default LickLibraryLayout;
