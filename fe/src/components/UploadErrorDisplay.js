import React from "react";
import { Alert, Typography, Space, Button } from "antd";
import {
  ExclamationCircleOutlined,
  BugOutlined,
  LinkOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

const UploadErrorDisplay = ({ error, onShowDebugger }) => {
  const getErrorType = (error) => {
    if (error?.includes("preset")) return "preset";
    if (error?.includes("duration")) return "duration";
    if (error?.includes("size")) return "size";
    if (error?.includes("format")) return "format";
    if (error?.includes("network")) return "network";
    return "unknown";
  };

  const getErrorSolution = (errorType) => {
    switch (errorType) {
      case "preset":
        return {
          title: "Upload Preset Missing",
          description:
            "The required Cloudinary upload presets are not configured.",
          solution:
            "Go to Cloudinary Dashboard and create the required upload presets.",
          action: "Open Setup Guide",
        };
      case "duration":
        return {
          title: "Audio Duration Too Long",
          description: "The audio file is longer than 15 seconds.",
          solution:
            "Please select an audio file that is 15 seconds or shorter.",
          action: "Try Again",
        };
      case "size":
        return {
          title: "File Too Large",
          description: "The file size exceeds the maximum allowed limit.",
          solution: "Please select a smaller file (max 10MB).",
          action: "Try Again",
        };
      case "format":
        return {
          title: "Unsupported Format",
          description: "The file format is not supported.",
          solution: "Please select a supported audio format (MP3, WAV, etc.).",
          action: "Try Again",
        };
      case "network":
        return {
          title: "Network Error",
          description: "Failed to connect to Cloudinary servers.",
          solution: "Check your internet connection and try again.",
          action: "Retry",
        };
      default:
        return {
          title: "Upload Failed",
          description: "An unexpected error occurred during upload.",
          solution:
            "Please try again or contact support if the problem persists.",
          action: "Show Debugger",
        };
    }
  };

  const errorType = getErrorType(error);
  const errorInfo = getErrorSolution(errorType);

  return (
    <Alert
      message={
        <Space>
          <ExclamationCircleOutlined />
          <Text style={{ color: "white" }}>{errorInfo.title}</Text>
        </Space>
      }
      description={
        <div>
          <Text
            style={{ color: "#ccc", display: "block", marginBottom: "8px" }}
          >
            {errorInfo.description}
          </Text>
          <Text
            style={{
              color: "#999",
              fontSize: "12px",
              display: "block",
              marginBottom: "12px",
            }}
          >
            {errorInfo.solution}
          </Text>
          <Space>
            {errorType === "preset" && (
              <Button
                type="primary"
                icon={<BugOutlined />}
                onClick={onShowDebugger}
                style={{
                  backgroundColor: "#ff6b35",
                  borderColor: "#ff6b35",
                }}
              >
                {errorInfo.action}
              </Button>
            )}
            {errorType === "duration" && (
              <Button
                type="default"
                onClick={() => window.location.reload()}
                style={{
                  backgroundColor: "#1a1a1a",
                  borderColor: "#333",
                  color: "#ccc",
                }}
              >
                {errorInfo.action}
              </Button>
            )}
            {errorType === "network" && (
              <Button
                type="default"
                onClick={() => window.location.reload()}
                style={{
                  backgroundColor: "#1a1a1a",
                  borderColor: "#333",
                  color: "#ccc",
                }}
              >
                {errorInfo.action}
              </Button>
            )}
            {errorType === "unknown" && (
              <Button
                type="default"
                icon={<BugOutlined />}
                onClick={onShowDebugger}
                style={{
                  backgroundColor: "#1a1a1a",
                  borderColor: "#333",
                  color: "#ccc",
                }}
              >
                {errorInfo.action}
              </Button>
            )}
          </Space>
        </div>
      }
      type="error"
      style={{
        backgroundColor: "#2a2a2a",
        border: "1px solid #ff4d4f",
        borderRadius: "8px",
        marginBottom: "16px",
      }}
    />
  );
};

export default UploadErrorDisplay;





































