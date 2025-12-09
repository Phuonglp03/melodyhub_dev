import React, { useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { refreshUser } from "../redux/authSlice";
import MainLayout from "../layouts/userLayout";
import AdminLayout from "../layouts/adminLayout";
// Removed duplicate Bootstrap CSS import - already imported in App.js
import "bootstrap-icons/font/bootstrap-icons.css";
import ProtectedRoute from "../components/common/ProtectedRoute";
import AdminProtectedRoute from "../components/common/AdminProtectedRoute";
import PermissionProtectedRoute from "../components/common/PermissionProtectedRoute";
// import LiveStreamCreate from "../pages/user/LiveRoomCreate";
// import LiveStreamLive from "../pages/user/LiveRoomLive";
import LiveListPage from "../pages/user/LiveListPage";
import LiveViewPage from "../pages/user/LiveViewPage";
import { initSocket } from "../services/user/socketService";
import LickLibraryLayout from "../layouts/LickLibraryLayout";

// Lazy load all page components for code splitting
const NewsFeed = lazy(() => import("../pages/user/NewFeed"));
// const PersonalFeed = lazy(() => import("../pages/user/NewFeed/Personal"));
const UserFeed = lazy(() => import("../pages/user/NewFeed/UserFeed"));
const ProfilePage = lazy(() => import("../pages/user/Profile"));
const ChangePasswordPage = lazy(() => import("../pages/user/ChangePassword"));
const ArchivedPosts = lazy(() => import("../pages/user/ArchivedPosts"));
const Login = lazy(() => import("../pages/auth/Login"));
const Register = lazy(() => import("../pages/auth/Register"));
const VerifyOTP = lazy(() => import("../pages/auth/VerifyOTP"));
const ForgotPassword = lazy(() => import("../pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("../pages/auth/ResetPassword"));
const LiveStreamCreate = lazy(() => import("../pages/user/LiveRoomCreate"));
const LiveStreamLive = lazy(() => import("../pages/user/LiveRoomLive"));
const MyLicksPage = lazy(() => import("../pages/user/MyLicks"));
const LickCommunityPage = lazy(() => import("../pages/user/LickCommunity"));
const LickUploadPage = lazy(() => import("../pages/user/LickUpload"));
const LickDetailPage = lazy(() => import("../pages/user/LickDetail"));
const ChatPage = lazy(() => import("../pages/user/Chat"));
const MyPlaylistsPage = lazy(() => import("../pages/user/MyPlaylists"));
const PlaylistDetailPage = lazy(() => import("../pages/user/PlaylistDetail"));
const PlaylistCommunityPage = lazy(() =>
  import("../pages/user/PlaylistCommunity")
);
const NotificationsPage = lazy(() => import("../pages/user/Notifications"));

// Lazy load project pages (using index.js which exports named exports)
const CreateProjectPage = lazy(() =>
  import("../pages/user/Projects").then((module) => ({
    default: module.CreateProjectPage,
  }))
);
const ProjectListPage = lazy(() =>
  import("../pages/user/Projects").then((module) => ({
    default: module.ProjectListPage,
  }))
);
const ProjectDetailPage = lazy(() =>
  import("../pages/user/Projects").then((module) => ({
    default: module.ProjectDetailPage,
  }))
);

// Lazy load admin pages
const AdminDashboard = lazy(() =>
  import("../pages/admin/AdminSite/AdminDashboard")
);
const AdminCreateAdmin = lazy(() =>
  import("../pages/admin/AdminSite/CreateAdmin")
);
const AdminUserManagement = lazy(() =>
  import("../pages/admin/AdminSite/UserManagement")
);
const AdminReportsManagement = lazy(() =>
  import("../pages/admin/AdminSite/ReportsManagement")
);
const AdminLiveroomManagement = lazy(() =>
  import("../pages/admin/AdminSite/LiveRoomManagement")
);
const AdminLickApprovement = lazy(() =>
  import("../pages/admin/AdminSite/LickApprovement")
);
const AdminReportSettings = lazy(() =>
  import("../pages/admin/AdminSite/ReportSettings")
);
const AdminProfile = lazy(() =>
  import("../pages/admin/AdminSite/AdminProfile")
);

// Loading component for Suspense fallback
const LoadingSpinner = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
    }}
  >
    <div className="spinner-border" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  </div>
);

const AppRoutes = () => {
  const dispatch = useDispatch();
  const { user, isLoading } = useSelector((state) => state.auth);

  useEffect(() => {
    // Try to refresh user session on app load
    dispatch(refreshUser());
  }, [dispatch]);

  // Khởi tạo Socket.IO khi đã có thông tin user để nhận thông báo realtime (like, comment, DM badge, ...)
  useEffect(() => {
    const userId = user?.user?.id;
    if (userId) {
      initSocket(userId);
    }
  }, [user?.user?.id]);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={!user ? <Login /> : <Navigate to="/" replace />}
          />
          <Route
            path="/register"
            element={!user ? <Register /> : <Navigate to="/" replace />}
          />
          <Route
            path="/verify-otp"
            element={!user ? <VerifyOTP /> : <Navigate to="/" replace />}
          />
          <Route
            path="/forgot-password"
            element={!user ? <ForgotPassword /> : <Navigate to="/" replace />}
          />
          <Route
            path="/reset-password"
            element={!user ? <ResetPassword /> : <Navigate to="/" replace />}
          />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <AdminProtectedRoute>
                <AdminLayout />
              </AdminProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="profile" element={<AdminProfile />} />
            <Route 
              path="create-admin" 
              element={
                <PermissionProtectedRoute permission="create_admin">
                  <AdminCreateAdmin />
                </PermissionProtectedRoute>
              } 
            />
            <Route 
              path="user-management" 
              element={
                <PermissionProtectedRoute permission="manage_users">
                  <AdminUserManagement />
                </PermissionProtectedRoute>
              } 
            />
            <Route
              path="reports-management"
              element={
                <PermissionProtectedRoute permission="handle_support">
                  <AdminReportsManagement />
                </PermissionProtectedRoute>
              }
            />
            <Route
              path="liveroom-management"
              element={
                <PermissionProtectedRoute permission="manage_liverooms">
                  <AdminLiveroomManagement />
                </PermissionProtectedRoute>
              }
            />
            <Route 
              path="lick-approvement" 
              element={
                <PermissionProtectedRoute permission="manage_content">
                  <AdminLickApprovement />
                </PermissionProtectedRoute>
              } 
            />
            <Route 
              path="report-settings" 
              element={
                <PermissionProtectedRoute permission="handle_support">
                  <AdminReportSettings />
                </PermissionProtectedRoute>
              } 
            />
          </Route>

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            {/* Nested routes accessible when authenticated */}
            <Route index element={<NewsFeed />} />
            <Route path="live/:roomId" element={<LiveViewPage />} />
            <Route path="live" element={<LiveListPage />} />
            <Route
              path="livestream/setup/:roomId"
              element={<LiveStreamCreate />}
            />
            <Route
              path="livestream/live/:roomId"
              element={<LiveStreamLive />}
            />
            {/* <Route path="newfeedspersonal" element={<PersonalFeed />} /> */}
            <Route path="users/:userId/newfeeds" element={<UserFeed />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="change-password" element={<ChangePasswordPage />} />
            <Route path="archived-posts" element={<ArchivedPosts />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            {/* Lick detail & upload */}
            <Route path="licks/upload" element={<LickUploadPage />} />
            <Route path="licks/:lickId" element={<LickDetailPage />} />
            {/* Lick Library */}
            <Route path="library" element={<LickLibraryLayout />}>
              <Route index element={<Navigate to="my-licks" replace />} />
              <Route path="my-licks" element={<MyLicksPage />} />
              <Route path="community" element={<LickCommunityPage />} />
            </Route>
            {/* Playlists */}
            <Route path="playlists" element={<LickLibraryLayout />}>
              <Route index element={<MyPlaylistsPage />} />
              <Route path="community" element={<PlaylistCommunityPage />} />
              <Route path=":playlistId" element={<PlaylistDetailPage />} />
            </Route>
            {/* Projects */}
            <Route path="projects" element={<LickLibraryLayout />}>
              <Route index element={<ProjectListPage />} />
              <Route path="create" element={<CreateProjectPage />} />
            </Route>
            {/* Project Detail - Isolated (no layout) */}
            <Route
              path="projects/:projectId"
              element={
                <ProtectedRoute>
                  <ProjectDetailPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* 404 - Not Found */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default AppRoutes;
