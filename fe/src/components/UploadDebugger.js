import React, { useState } from "react";
import { Card, Button, Typography, Alert, Space, Divider, Tabs } from "antd";
import {
  BugOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { CLOUDINARY_CONFIG, UPLOAD_PRESETS } from "../config/cloudinary";
import { uploadAudio } from "../services/cloudinaryService";
import SimpleUploadTest from "./SimpleUploadTest";
import CloudinarySetupGuide from "./CloudinarySetupGuide";

const { Title, Text, Paragraph } = Typography;

const UploadDebugger = () => {
  const [debugResults, setDebugResults] = useState([]);
  const [testing, setTesting] = useState(false);

  const addResult = (test, status, message, details = null) => {
    setDebugResults((prev) => [
      ...prev,
      {
        test,
        status, // 'success', 'error', 'warning'
        message,
        details,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  const runDiagnostics = async () => {
    setTesting(true);
    setDebugResults([]);

    // Test 1: Check Cloudinary Config
    try {
      if (!CLOUDINARY_CONFIG.cloud_name) {
        addResult("Cloudinary Config", "error", "Cloud name is missing");
      } else if (!CLOUDINARY_CONFIG.api_key) {
        addResult("Cloudinary Config", "error", "API key is missing");
      } else if (!CLOUDINARY_CONFIG.api_secret) {
        addResult("Cloudinary Config", "error", "API secret is missing");
      } else {
        addResult("Cloudinary Config", "success", "Configuration looks good");
      }
    } catch (error) {
      addResult("Cloudinary Config", "error", "Config error: " + error.message);
    }

    // Test 2: Check Upload Presets
    try {
      const presets = Object.values(UPLOAD_PRESETS);
      if (presets.length === 0) {
        addResult("Upload Presets", "error", "No upload presets defined");
      } else {
        addResult(
          "Upload Presets",
          "success",
          `Found ${presets.length} presets: ${presets.join(", ")}`
        );
      }
    } catch (error) {
      addResult("Upload Presets", "error", "Preset error: " + error.message);
    }

    // Test 3: Test Cloudinary API Connection
    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/resources/image/upload?max_results=1`,
        {
          headers: {
            Authorization: `Basic ${btoa(
              `${CLOUDINARY_CONFIG.api_key}:${CLOUDINARY_CONFIG.api_secret}`
            )}`,
          },
        }
      );

      if (response.ok) {
        addResult("Cloudinary API", "success", "API connection successful");
      } else {
        addResult(
          "Cloudinary API",
          "error",
          `API error: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      addResult(
        "Cloudinary API",
        "error",
        "API connection failed: " + error.message
      );
    }

    // Test 4: Test Upload Preset
    try {
      const testFile = new File(["test"], "test.txt", { type: "text/plain" });
      const result = await uploadAudio(testFile);

      if (result.success) {
        addResult("Upload Test", "success", "Upload test successful");
      } else {
        addResult("Upload Test", "error", `Upload failed: ${result.error}`);
      }
    } catch (error) {
      addResult("Upload Test", "error", "Upload test failed: " + error.message);
    }

    setTesting(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
        return <CheckCircleOutlined style={{ color: "#52c41a" }} />;
      case "error":
        return <CloseCircleOutlined style={{ color: "#ff4d4f" }} />;
      case "warning":
        return <CloseCircleOutlined style={{ color: "#faad14" }} />;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "success":
        return "#52c41a";
      case "error":
        return "#ff4d4f";
      case "warning":
        return "#faad14";
      default:
        return "#666";
    }
  };

  return (
    <Card
      title={
        <Space>
          <BugOutlined />
          Upload Diagnostics
        </Space>
      }
      style={{
        backgroundColor: "#2a2a2a",
        border: "1px solid #333",
        borderRadius: "8px",
        marginBottom: "20px",
      }}
    >
      <Tabs
        defaultActiveKey="setup"
        items={[
          {
            key: "setup",
            label: "Setup Guide",
            children: <CloudinarySetupGuide />,
          },
          {
            key: "diagnostics",
            label: "System Diagnostics",
            children: (
              <div>
                <div style={{ marginBottom: "20px" }}>
                  <Paragraph style={{ color: "#ccc" }}>
                    This tool will help diagnose upload issues by testing
                    various components.
                  </Paragraph>

                  <Button
                    type="primary"
                    onClick={runDiagnostics}
                    loading={testing}
                    style={{
                      backgroundColor: "#ff6b35",
                      borderColor: "#ff6b35",
                    }}
                  >
                    Run Diagnostics
                  </Button>
                </div>

                <Divider style={{ borderColor: "#333" }} />

                {/* Results */}
                <div>
                  <Title
                    level={4}
                    style={{ color: "white", marginBottom: "16px" }}
                  >
                    Diagnostic Results
                  </Title>

                  {debugResults.length === 0 ? (
                    <Text style={{ color: "#999" }}>
                      Click "Run Diagnostics" to start
                    </Text>
                  ) : (
                    <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                      {debugResults.map((result, index) => (
                        <Alert
                          key={index}
                          message={
                            <div>
                              <Space>
                                {getStatusIcon(result.status)}
                                <Text
                                  style={{
                                    color: getStatusColor(result.status),
                                  }}
                                >
                                  {result.test}
                                </Text>
                                <Text
                                  style={{ color: "#999", fontSize: "12px" }}
                                >
                                  {result.timestamp}
                                </Text>
                              </Space>
                            </div>
                          }
                          description={
                            <div>
                              <Text style={{ color: "#ccc" }}>
                                {result.message}
                              </Text>
                              {result.details && (
                                <div style={{ marginTop: "8px" }}>
                                  <Text
                                    style={{ color: "#999", fontSize: "12px" }}
                                  >
                                    {result.details}
                                  </Text>
                                </div>
                              )}
                            </div>
                          }
                          type={
                            result.status === "success" ? "success" : "error"
                          }
                          style={{
                            marginBottom: "8px",
                            backgroundColor: "#1a1a1a",
                            border: "1px solid #333",
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: "test",
            label: "Upload Test",
            children: <SimpleUploadTest />,
          },
        ]}
        style={{ color: "white" }}
      />
    </Card>
  );
};

export default UploadDebugger;
