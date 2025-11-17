import React from "react";
import { Card, Typography, Steps, Alert, Button, Space } from "antd";
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

const CloudinarySetupGuide = () => {
  const openCloudinaryDashboard = () => {
    window.open("https://cloudinary.com/console", "_blank");
  };

  const openUploadPresets = () => {
    window.open("https://cloudinary.com/console/settings/upload", "_blank");
  };

  return (
    <Card
      title="Cloudinary Setup Guide"
      style={{
        backgroundColor: "#2a2a2a",
        border: "1px solid #333",
        borderRadius: "8px",
        marginBottom: "20px",
      }}
    >
      <Alert
        message="Upload Presets Required"
        description="You need to create upload presets in Cloudinary Dashboard before uploading files."
        type="warning"
        icon={<ExclamationCircleOutlined />}
        style={{
          backgroundColor: "#1a1a1a",
          border: "1px solid #333",
          marginBottom: "20px",
        }}
      />

      <Steps
        direction="vertical"
        current={-1}
        items={[
          {
            title: "Access Cloudinary Dashboard",
            description: (
              <div>
                <Paragraph style={{ color: "#ccc" }}>
                  Go to Cloudinary Dashboard to manage your cloud storage.
                </Paragraph>
                <Button
                  type="primary"
                  icon={<LinkOutlined />}
                  onClick={openCloudinaryDashboard}
                  style={{
                    backgroundColor: "#ff6b35",
                    borderColor: "#ff6b35",
                  }}
                >
                  Open Cloudinary Dashboard
                </Button>
              </div>
            ),
          },
          {
            title: "Create Upload Presets",
            description: (
              <div>
                <Paragraph style={{ color: "#ccc" }}>
                  Create the following upload presets in Settings → Upload:
                </Paragraph>
                <div style={{ marginLeft: "20px" }}>
                  <Text style={{ color: "white", display: "block" }}>
                    • <Text style={{ color: "#ff6b35" }}>melodyhub_audio</Text>{" "}
                    - For audio files
                  </Text>
                  <Text style={{ color: "white", display: "block" }}>
                    • <Text style={{ color: "#ff6b35" }}>melodyhub_images</Text>{" "}
                    - For image files
                  </Text>
                  <Text style={{ color: "white", display: "block" }}>
                    •{" "}
                    <Text style={{ color: "#ff6b35" }}>melodyhub_avatars</Text>{" "}
                    - For user avatars
                  </Text>
                </div>
                <Button
                  type="default"
                  icon={<LinkOutlined />}
                  onClick={openUploadPresets}
                  style={{
                    backgroundColor: "#1a1a1a",
                    borderColor: "#333",
                    color: "#ccc",
                    marginTop: "8px",
                  }}
                >
                  Open Upload Settings
                </Button>
              </div>
            ),
          },
          {
            title: "Configure Preset Settings",
            description: (
              <div>
                <Paragraph style={{ color: "#ccc" }}>
                  For each preset, configure these settings:
                </Paragraph>
                <div style={{ marginLeft: "20px" }}>
                  <Text style={{ color: "white", display: "block" }}>
                    • <Text style={{ color: "#4CAF50" }}>Signing Mode:</Text>{" "}
                    Unsigned
                  </Text>
                  <Text style={{ color: "white", display: "block" }}>
                    • <Text style={{ color: "#4CAF50" }}>Folder:</Text>{" "}
                    melodyhub/audio (or images/avatars)
                  </Text>
                  <Text style={{ color: "white", display: "block" }}>
                    • <Text style={{ color: "#4CAF50" }}>Resource Type:</Text>{" "}
                    Auto (for audio), Image (for images)
                  </Text>
                  <Text style={{ color: "white", display: "block" }}>
                    • <Text style={{ color: "#4CAF50" }}>Transformation:</Text>{" "}
                    None (or add quality settings)
                  </Text>
                </div>
              </div>
            ),
          },
          {
            title: "Test Upload",
            description: (
              <div>
                <Paragraph style={{ color: "#ccc" }}>
                  After creating presets, test the upload functionality using
                  the Upload Test tab.
                </Paragraph>
                <Alert
                  message="Important"
                  description="Make sure all three presets are created and configured correctly before testing."
                  type="info"
                  style={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                  }}
                />
              </div>
            ),
          },
        ]}
      />

      <div
        style={{
          marginTop: "20px",
          padding: "16px",
          backgroundColor: "#1a1a1a",
          borderRadius: "8px",
        }}
      >
        <Title level={5} style={{ color: "white", marginBottom: "12px" }}>
          Current Configuration
        </Title>
        <div style={{ marginBottom: "8px" }}>
          <Text style={{ color: "#ccc" }}>Cloud Name: </Text>
          <Text style={{ color: "white" }}>drjavmnsk</Text>
        </div>
        <div style={{ marginBottom: "8px" }}>
          <Text style={{ color: "#ccc" }}>API Key: </Text>
          <Text style={{ color: "white" }}>566469121428313</Text>
        </div>
        <div>
          <Text style={{ color: "#ccc" }}>Required Presets: </Text>
          <Text style={{ color: "#ff6b35" }}>
            melodyhub_audio, melodyhub_images, melodyhub_avatars
          </Text>
        </div>
      </div>
    </Card>
  );
};

export default CloudinarySetupGuide;





































