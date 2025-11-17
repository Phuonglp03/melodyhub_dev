import React from "react";
import { Tag, Tooltip } from "antd";
import { ApiOutlined, DatabaseOutlined } from "@ant-design/icons";
import { API_CONFIG } from "../config/api";

const DevStatus = ({ style = {} }) => {
  const isUsingMock = API_CONFIG.USE_MOCK_DATA;

  return (
    <div
      style={{
        position: "fixed",
        top: "10px",
        right: "10px",
        zIndex: 1000,
        ...style,
      }}
    >
      <Tooltip
        title={isUsingMock ? "Đang dùng Mock Data" : "Đang dùng Backend API"}
      >
        <Tag
          color={isUsingMock ? "orange" : "green"}
          icon={isUsingMock ? <DatabaseOutlined /> : <ApiOutlined />}
          style={{
            cursor: "pointer",
            fontSize: "12px",
            padding: "4px 8px",
          }}
        >
          {isUsingMock ? "MOCK" : "API"}
        </Tag>
      </Tooltip>
    </div>
  );
};

export default DevStatus;

