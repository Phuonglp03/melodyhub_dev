// src/layouts/adminLayout.jsx
import React, { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../redux/authSlice";
import NotificationBell from "../components/NotificationBell";
import NotificationToastContainer from "../components/NotificationToastContainer";
import api from "../services/api";
import { 
  Home, 
  UserPlus, 
  Users, 
  BarChart3, 
  Video, 
  CheckSquare,
  Sliders,
  Bell,
  User,
  LogOut,
  Menu,
  X,
  ChevronRight
} from "lucide-react";

// Helper function to determine admin type from permissions
// Based on PERMISSIONS_MAP:
// - super_admin: ['manage_users', 'manage_content', 'manage_liverooms', 'handle_support', 'create_admin']
// - liveroom_admin: ['manage_liverooms', 'manage_content']
// - user_support: ['handle_support', 'manage_users']
const getAdminType = (permissions = []) => {
  if (!permissions || permissions.length === 0) {
    return { type: 'admin', label: 'Administrator', color: 'text-gray-400' };
  }
  
  // Super Admin: has 'create_admin' permission (unique to Super Admin)
  if (permissions.includes('create_admin')) {
    return { type: 'super_admin', label: 'Super Admin', color: 'text-purple-400' };
  }
  
  // Liveroom Admin: has 'manage_liverooms' but NOT 'create_admin'
  // Also has 'manage_content' typically
  if (permissions.includes('manage_liverooms') && !permissions.includes('create_admin')) {
    return { type: 'liveroom_admin', label: 'Liveroom Admin', color: 'text-blue-400' };
  }
  
  // User Support: has 'handle_support' and 'manage_users' but NOT 'create_admin' and NOT 'manage_liverooms'
  if (permissions.includes('handle_support') && 
      permissions.includes('manage_users') && 
      !permissions.includes('create_admin') && 
      !permissions.includes('manage_liverooms')) {
    return { type: 'user_support', label: 'User Support', color: 'text-green-400' };
  }
  
  // Fallback: Try to determine by available permissions
  // If has handle_support but not manage_liverooms -> likely User Support
  if (permissions.includes('handle_support') && !permissions.includes('manage_liverooms')) {
    return { type: 'user_support', label: 'User Support', color: 'text-green-400' };
  }
  
  // If has manage_liverooms -> likely Liveroom Admin
  if (permissions.includes('manage_liverooms')) {
    return { type: 'liveroom_admin', label: 'Liveroom Admin', color: 'text-blue-400' };
  }
  
  // Default fallback for admin without specific permissions
  return { type: 'admin', label: 'Administrator', color: 'text-gray-400' };
};

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user: authUser } = useSelector((state) => state.auth);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [adminProfile, setAdminProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  // Fetch admin profile
  useEffect(() => {
    const fetchAdminProfile = async () => {
      try {
        const response = await api.get('/admin/profile');
        const profileData = response.data.data.user;
        setAdminProfile(profileData);
      } catch (error) {
        console.error('Failed to fetch admin profile:', error);
        // Don't crash if it's just a permission error or network error
        // Fallback: use authUser data if available
        if (authUser?.user) {
          setAdminProfile({
            displayName: authUser.user.displayName,
            avatarUrl: authUser.user.avatarUrl,
            permissions: authUser.user.permissions || []
          });
        } else {
          // If no authUser, set empty profile to prevent infinite loop
          setAdminProfile({
            displayName: 'Admin',
            permissions: []
          });
        }
      } finally {
        setLoadingProfile(false);
      }
    };

    if (authUser?.user?.id) {
      fetchAdminProfile();
    } else {
      setLoadingProfile(false);
    }
  }, [authUser]);

  // Menu items với permissions required
  const allMenuItems = [
    { 
      path: "/admin/dashboard", 
      icon: Home, 
      label: "Dashboard", 
      color: "from-blue-500 to-cyan-500",
      permission: null // Tất cả admin đều có thể xem dashboard
    },
    { 
      path: "/admin/create-admin", 
      icon: UserPlus, 
      label: "Create Admin", 
      color: "from-purple-500 to-pink-500",
      permission: "create_admin" // Chỉ Super Admin
    },
    { 
      path: "/admin/user-management", 
      icon: Users, 
      label: "User List", 
      color: "from-green-500 to-emerald-500",
      permission: "manage_users" // Super Admin và User Support
    },
    { 
      path: "/admin/reports-management", 
      icon: BarChart3, 
      label: "Reports ", 
      color: "from-orange-500 to-red-500",
      permission: "handle_support" // Super Admin và User Support
    },
    { 
      path: "/admin/report-settings", 
      icon: Sliders, 
      label: "Report Settings", 
      color: "from-amber-500 to-rose-500",
      permission: "handle_support" // Super Admin và User Support
    },
    { 
      path: "/admin/liveroom-management", 
      icon: Video, 
      label: "Liverooms", 
      color: "from-violet-500 to-purple-500",
      permission: "manage_liverooms" // Super Admin và Liveroom Admin
    },
    { 
      path: "/admin/lick-approvement", 
      icon: CheckSquare, 
      label: "Lick Approvement", 
      color: "from-teal-500 to-cyan-500",
      permission: "manage_content" // Super Admin và Liveroom Admin
    }
  ];

  // Filter menu items based on permissions
  const menuItems = allMenuItems.filter(item => {
    if (!item.permission) return true; // No permission required
    if (!adminProfile?.permissions) return false; // No permissions = no access
    return adminProfile.permissions.includes(item.permission);
  });

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
            {loadingProfile ? (
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gray-700 animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-4 w-24 bg-gray-700 rounded animate-pulse mb-2"></div>
                  <div className="h-3 w-20 bg-gray-700 rounded animate-pulse"></div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <div className="relative">
                  {adminProfile?.avatarUrl ? (
                    <img 
                      src={adminProfile.avatarUrl} 
                      alt="Admin Avatar" 
                      className="w-10 h-10 rounded-full object-cover border-2 border-gray-600"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <User size={20} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {adminProfile?.displayName || authUser?.user?.username || "Admin"}
                  </p>
                  <p className={`text-xs truncate ${getAdminType(adminProfile?.permissions).color}`}>
                    {getAdminType(adminProfile?.permissions).label}
                  </p>
                </div>
              </div>
            )}
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
                {location.pathname === "/admin/profile" 
                  ? "Admin Profile"
                  : menuItems.find(item => item.path === location.pathname)?.label || "Dashboard"}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              {/* Notification bell giống phía user */}
              <NotificationBell />

              <button 
                onClick={() => navigate("/admin/profile")}
                className="p-2.5 hover:bg-gray-800/50 rounded-xl transition-all duration-200 group"
              >
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

      {/* Toast thông báo giống user layout */}
      <NotificationToastContainer />
    </div>
  );
};

export default AdminLayout;