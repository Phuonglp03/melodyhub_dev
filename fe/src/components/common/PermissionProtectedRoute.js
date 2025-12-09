// src/components/common/PermissionProtectedRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import api from "../../services/api";

const PermissionProtectedRoute = ({ children, permission, fallbackPath = "/admin/dashboard" }) => {
  const { user: authUser, isLoading } = useSelector((state) => state.auth);
  const [hasPermission, setHasPermission] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      if (isLoading) return;

      if (!authUser?.user?.id) {
        setHasPermission(false);
        setChecking(false);
        return;
      }

      // Check permissions from Redux store first
      const userPermissions = authUser?.user?.permissions || [];
      
      if (userPermissions.length > 0) {
        // If permissions are in Redux store, check directly
        const hasPerm = userPermissions.includes(permission);
        setHasPermission(hasPerm);
        setChecking(false);
        return;
      }

      // If permissions not in Redux, fetch admin profile
      try {
        const response = await api.get('/admin/profile');
        const adminPermissions = response.data.data.user?.permissions || [];
        const hasPerm = adminPermissions.includes(permission);
        setHasPermission(hasPerm);
      } catch (error) {
        console.error('Failed to check permission:', error);
        setHasPermission(false);
      } finally {
        setChecking(false);
      }
    };

    checkPermission();
  }, [authUser, isLoading, permission]);

  if (isLoading || checking) {
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

  if (!authUser) {
    return <Navigate to="/login" replace />;
  }

  if (hasPermission === false) {
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
};

export default PermissionProtectedRoute;

