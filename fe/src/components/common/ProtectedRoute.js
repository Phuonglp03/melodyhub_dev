import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { Spin } from "antd";

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, isLoading } = useSelector((state) => state.auth);
  const location = useLocation();

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
        <Spin size="large" />
      </div>
    );
  }

  // Nếu chưa đăng nhập, chuyển hướng về trang đăng nhập
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Lấy roleId từ user (hỗ trợ cả user.user.roleId và user.roleId)
  const userRoleId = user?.user?.roleId || user?.roleId;

  // Chặn admin truy cập vào routes "/" - chỉ cho phép user role
  if (userRoleId === 'admin') {
    return <Navigate to="/admin/dashboard" state={{ from: location }} replace />;
  }

  // Nếu có yêu cầu role và user không có quyền
  if (requiredRole && userRoleId !== requiredRole) {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
