// src/components/common/AdminProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
const AdminProtectedRoute = ({ children }) => {
  const { user, isLoading } = useSelector((state) => state.auth);
  
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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Lấy roleId từ user (hỗ trợ cả user.user.roleId và user.roleId)
  const userRoleId = user?.user?.roleId || user?.roleId;

  // Chặn user role truy cập vào routes "/admin" - chỉ cho phép admin role
  if (userRoleId !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminProtectedRoute;