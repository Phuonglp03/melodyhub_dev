import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import CloudinaryExplorer from "../../../components/CloudinaryExplorer";

const CloudinaryExplorerPage = () => {
  const navigate = useNavigate();

  return (
    <div>
      {/* Back Button */}
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/")}
        style={{ marginBottom: "20px" }}
      >
        Back to Home
      </Button>

      {/* Cloudinary Explorer */}
      <CloudinaryExplorer />
    </div>
  );
};

export default CloudinaryExplorerPage;












