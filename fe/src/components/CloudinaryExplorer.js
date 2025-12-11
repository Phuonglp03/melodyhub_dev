import React, { useState, useEffect } from "react";
import {
  Card,
  Button,
  Table,
  Tag,
  Image,
  Typography,
  Space,
  message,
} from "antd";
import {
  EyeOutlined,
  DownloadOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { CLOUDINARY_CONFIG } from "../utils/cloudinaryConfig";

const { Title, Text } = Typography;

const CloudinaryExplorer = () => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState("melodyhub");

  const folders = [
    { name: "melodyhub", label: "All Files" },
    { name: "melodyhub/audio", label: "Audio Files" },
    { name: "melodyhub/images", label: "Images" },
    { name: "melodyhub/avatars", label: "Avatars" },
  ];

  const fetchResources = async (folder = "melodyhub") => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/resources/image/upload?prefix=${folder}/&max_results=50`,
        {
          headers: {
            Authorization: `Basic ${btoa(
              `${CLOUDINARY_CONFIG.api_key}:${CLOUDINARY_CONFIG.api_secret}`
            )}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch resources");
      }

      const data = await response.json();
      setResources(data.resources || []);
    } catch (error) {
      console.error("Error fetching resources:", error);
      message.error("Failed to fetch Cloudinary resources");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources(selectedFolder);
  }, [selectedFolder]);

  const columns = [
    {
      title: "Preview",
      dataIndex: "secure_url",
      key: "preview",
      width: 100,
      render: (url, record) => (
        <Image
          src={url}
          alt={record.public_id}
          style={{ width: 50, height: 50, objectFit: "cover" }}
          fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+kmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN"
        />
      ),
    },
    {
      title: "File Name",
      dataIndex: "public_id",
      key: "public_id",
      render: (publicId) => (
        <Text style={{ fontSize: "12px" }}>{publicId.split("/").pop()}</Text>
      ),
    },
    {
      title: "Type",
      dataIndex: "resource_type",
      key: "resource_type",
      render: (type) => (
        <Tag color={type === "video" ? "blue" : "green"}>{type}</Tag>
      ),
    },
    {
      title: "Size",
      dataIndex: "bytes",
      key: "bytes",
      render: (bytes) => (
        <Text style={{ fontSize: "12px" }}>
          {(bytes / 1024 / 1024).toFixed(2)} MB
        </Text>
      ),
    },
    {
      title: "Format",
      dataIndex: "format",
      key: "format",
      render: (format) => <Tag color="orange">{format}</Tag>,
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      render: (date) => (
        <Text style={{ fontSize: "12px" }}>
          {new Date(date).toLocaleDateString()}
        </Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => window.open(record.secure_url, "_blank")}
          />
          <Button
            type="text"
            icon={<DownloadOutlined />}
            size="small"
            onClick={() => {
              const link = document.createElement("a");
              link.href = record.secure_url;
              link.download = record.public_id.split("/").pop();
              link.click();
            }}
          />
        </Space>
      ),
    },
  ];

  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: "#1a1a1a",
        minHeight: "100vh",
      }}
    >
      <Card
        title="Cloudinary Explorer"
        style={{
          backgroundColor: "#2a2a2a",
          border: "1px solid #333",
          borderRadius: "8px",
        }}
      >
        {/* Folder Selector */}
        <div style={{ marginBottom: "20px" }}>
          <Text style={{ color: "white", marginRight: "12px" }}>Folder:</Text>
          <Space wrap>
            {folders.map((folder) => (
              <Button
                key={folder.name}
                type={selectedFolder === folder.name ? "primary" : "default"}
                onClick={() => setSelectedFolder(folder.name)}
                style={{
                  backgroundColor:
                    selectedFolder === folder.name ? "#ff6b35" : "#1a1a1a",
                  borderColor: "#333",
                }}
              >
                {folder.label}
              </Button>
            ))}
          </Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchResources(selectedFolder)}
            loading={loading}
            style={{ marginLeft: "12px" }}
          >
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div style={{ marginBottom: "20px", display: "flex", gap: "20px" }}>
          <div>
            <Text style={{ color: "#ccc" }}>Total Files: </Text>
            <Text style={{ color: "white" }}>{resources.length}</Text>
          </div>
          <div>
            <Text style={{ color: "#ccc" }}>Total Size: </Text>
            <Text style={{ color: "white" }}>
              {(
                resources.reduce((sum, r) => sum + r.bytes, 0) /
                1024 /
                1024
              ).toFixed(2)}{" "}
              MB
            </Text>
          </div>
        </div>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={resources}
          loading={loading}
          rowKey="public_id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} files`,
          }}
          style={{
            backgroundColor: "#1a1a1a",
          }}
        />
      </Card>
    </div>
  );
};

export default CloudinaryExplorer;











