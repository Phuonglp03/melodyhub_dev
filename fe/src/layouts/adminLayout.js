// src/layouts/adminLayout.jsx
import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../redux/authSlice";
import { 
  Home, 
  UserPlus, 
  Users, 
  BarChart3, 
  Video, 
  CheckSquare,
  Bell,
  User,
  LogOut,
  Menu,
  X,
  ChevronRight
} from "lucide-react";

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notificationCount] = useState(3);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  const menuItems = [
    { path: "/admin/dashboard", icon: Home, label: "Dashboard", color: "from-blue-500 to-cyan-500" },
    { path: "/admin/create-admin", icon: UserPlus, label: "Create Admin", color: "from-purple-500 to-pink-500" },
    { path: "/admin/user-management", icon: Users, label: "User List", color: "from-green-500 to-emerald-500" },
    { path: "/admin/reports-management", icon: BarChart3, label: "Reports ", color: "from-orange-500 to-red-500" },
    { path: "/admin/liveroom-management", icon: Video, label: "Liverooms", color: "from-violet-500 to-purple-500" },
    { path: "/admin/lick-approvement", icon: CheckSquare, label: "Lick Approvement", color: "from-teal-500 to-cyan-500" }
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Sidebar */}
      <div 
        className={`${
          sidebarOpen ? "w-72" : "w-20"
        } bg-gray-900/50 backdrop-blur-xl border-r border-gray-700/50 transition-all duration-300 ease-in-out relative`}
      >
        {/* Logo & Toggle */}
        <div className="p-6 flex items-center justify-between border-b border-gray-700/50">
          {sidebarOpen && (
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-xl font-bold">M</span>
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  MelodyHub
                </h1>
                <p className="text-xs text-gray-400">Admin Panel</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-all duration-200"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center w-full p-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                  active
                    ? "bg-gradient-to-r " + item.color + " shadow-lg shadow-blue-500/20"
                    : "hover:bg-gray-800/50"
                }`}
              >
                {active && (
                  <div className="absolute inset-0 bg-white/10 animate-pulse" />
                )}
                <div className={`p-2 rounded-lg ${active ? "bg-white/20" : "bg-gray-800/50"} group-hover:scale-110 transition-transform duration-200`}>
                  <Icon size={20} />
                </div>
                {sidebarOpen && (
                  <>
                    <span className="ml-3 font-medium">{item.label}</span>
                    {active && (
                      <ChevronRight className="ml-auto" size={18} />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Info */}
        {sidebarOpen && (
          <div className="absolute bottom-6 left-4 right-4 p-4 bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl border border-gray-700/50 backdrop-blur-sm">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <User size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{user?.username || "Admin"}</p>
                <p className="text-xs text-gray-400">{user?.role || "Administrator"}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gray-900/30 backdrop-blur-xl border-b border-gray-700/50s p-4">
          <div className="flex justify-between items-center">
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-gray-400">Admin</span>
              <ChevronRight size={16} className="text-gray-600" />
              <span className="font-medium">
                {menuItems.find(item => item.path === location.pathname)?.label || "Dashboard"}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              <button className="relative p-2.5 hover:bg-gray-800/50 rounded-xl transition-all duration-200 group">
                <Bell size={20} className="group-hover:scale-110 transition-transform" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-pink-500 rounded-full text-xs flex items-center justify-center font-bold animate-pulse">
                    {notificationCount}
                  </span>
                )}
              </button>
              
              <button className="p-2.5 hover:bg-gray-800/50 rounded-xl transition-all duration-200 group">
                <User size={20} className="group-hover:scale-110 transition-transform" />
              </button>
              
              <div className="w-px h-6 bg-gray-700" />
              
              <button 
                onClick={handleLogout}
                className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 rounded-xl transition-all duration-200 flex items-center space-x-2 shadow-lg shadow-red-500/20 hover:shadow-red-500/40"
              >
                <LogOut size={18} />
                <span className="font-medium">Log out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-900/50 to-gray-800/50">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;