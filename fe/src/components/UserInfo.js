import React from "react";
import { Avatar, Typography, Tag } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useSelector } from "react-redux";

const { Text } = Typography;

const UserInfo = ({ style = {} }) => {
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  if (!isAuthenticated || !user) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 12px",
          backgroundColor: "#2a2a2a",
          borderRadius: "6px",
          border: "1px solid #333",
          ...style,
        }}
      >
        <UserOutlined style={{ color: "#999", marginRight: "8px" }} />
        <Text style={{ color: "#999", fontSize: "12px" }}>Chưa đăng nhập</Text>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "8px 12px",
        backgroundColor: "#2a2a2a",
        borderRadius: "6px",
        border: "1px solid #333",
        ...style,
      }}
    >
      <Avatar
        src={user.avatar_url}
        size="small"
        style={{ marginRight: "8px" }}
      />
      <div>
        <Text style={{ color: "white", fontSize: "12px", display: "block" }}>
          {user.display_name}
        </Text>
        <Text style={{ color: "#999", fontSize: "10px" }}>{user.username}</Text>
      </div>
      <Tag
        color="green"
        style={{
          marginLeft: "8px",
          fontSize: "10px",
          padding: "2px 6px",
        }}
      >
        Mock User
      </Tag>
    </div>
  );
};

export default UserInfo;

