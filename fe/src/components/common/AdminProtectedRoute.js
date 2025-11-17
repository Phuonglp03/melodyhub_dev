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
  // const isAdmin = user.role === "admin" || 
  //                user.role === "ADMIN" || 
  //                user.role === "Admin" || 
  //                (user.role && user.role.toLowerCase() === "admin");


  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default AdminProtectedRoute;