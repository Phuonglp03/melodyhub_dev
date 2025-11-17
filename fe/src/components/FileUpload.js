import React, { useState } from "react";
import { Upload, Button, Progress, message, Typography } from "antd";
import {
  UploadOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import {
  uploadAudio,
  uploadImage,
  uploadAvatar,
} from "../services/cloudinaryService";

const { Text } = Typography;
const { Dragger } = Upload;

const FileUpload = ({
  type = "image", // 'image', 'audio', 'avatar'
  onUploadSuccess,
  onUploadError,
  maxSize = 10, // MB
  accept,
  style = {},
  showPreview = true,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);

  const getUploadConfig = () => {
    switch (type) {
      case "audio":
        return {
          accept: "audio/*",
          maxSize: 50, // 50MB for audio
          uploadFunction: uploadAudio,
          icon: <PlayCircleOutlined />,
          title: "Upload Audio File",
          description: "Click or drag audio file to this area to upload",
        };
      case "avatar":
        return {
          accept: "image/*",
          maxSize: 5, // 5MB for avatar
          uploadFunction: uploadAvatar,
          icon: <UploadOutlined />,
          title: "Upload Avatar",
          description: "Click or drag image to this area to upload",
        };
      default:
        return {
          accept: "image/*",
          maxSize: 10, // 10MB for images
          uploadFunction: uploadImage,
          icon: <UploadOutlined />,
          title: "Upload Image",
          description: "Click or drag image to this area to upload",
        };
    }
  };

  const config = getUploadConfig();

  const handleUpload = async (file) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      // Check duration for audio files
      if (type === "audio") {
        const audio = new Audio();
        audio.src = URL.createObjectURL(file);

        await new Promise((resolve, reject) => {
          audio.addEventListener("loadedmetadata", () => {
            if (audio.duration > 15) {
              message.error("Audio duration must be 15 seconds or less!");
              setUploading(false);
              reject(new Error("Duration too long"));
              return;
            }
            resolve();
          });
          audio.addEventListener("error", reject);
        });
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const result = await config.uploadFunction(file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.success) {
        setUploadedFile(result.data);
        message.success("Upload successful!");
        if (onUploadSuccess) {
          onUploadSuccess(result.data);
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Upload error:", error);
      message.error(`Upload failed: ${error.message}`);
      if (onUploadError) {
        onUploadError(error);
      }
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleRemove = () => {
    setUploadedFile(null);
    if (onUploadSuccess) {
      onUploadSuccess(null);
    }
  };

  const uploadProps = {
    name: "file",
    multiple: false,
    beforeUpload: (file) => {
      // Check file size
      const isLtMaxSize = file.size / 1024 / 1024 < config.maxSize;
      if (!isLtMaxSize) {
        message.error(`File must be smaller than ${config.maxSize}MB!`);
        return false;
      }

      // Check file type
      if (type === "audio" && !file.type.startsWith("audio/")) {
        message.error("Please upload an audio file!");
        return false;
      }
      if (
        (type === "image" || type === "avatar") &&
        !file.type.startsWith("image/")
      ) {
        message.error("Please upload an image file!");
        return false;
      }

      handleUpload(file);
      return false; // Prevent default upload
    },
    showUploadList: false,
  };

  return (
    <div style={{ ...style }}>
      {!uploadedFile ? (
        <Dragger
          {...uploadProps}
          style={{
            backgroundColor: "#2a2a2a",
            border: "1px solid #333",
            borderRadius: "8px",
          }}
        >
          <p className="ant-upload-drag-icon" style={{ color: "#ff6b35" }}>
            {config.icon}
          </p>
          <p className="ant-upload-text" style={{ color: "white" }}>
            {config.title}
          </p>
          <p className="ant-upload-hint" style={{ color: "#ccc" }}>
            {config.description}
          </p>
          <p style={{ color: "#999", fontSize: "12px" }}>
            Max size: {config.maxSize}MB
            {type === "audio" && (
              <span style={{ color: "#ff6b35", marginLeft: "8px" }}>
                • Max duration: 15s
              </span>
            )}
          </p>
        </Dragger>
      ) : (
        <div
          style={{
            backgroundColor: "#2a2a2a",
            border: "1px solid #333",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              {type === "audio" ? (
                <PlayCircleOutlined
                  style={{ color: "#ff6b35", marginRight: "8px" }}
                />
              ) : (
                <img
                  src={uploadedFile.secure_url}
                  alt="Preview"
                  style={{
                    width: "40px",
                    height: "40px",
                    objectFit: "cover",
                    borderRadius: "4px",
                    marginRight: "8px",
                  }}
                />
              )}
              <div>
                <Text style={{ color: "white", display: "block" }}>
                  {uploadedFile.public_id.split("/").pop()}
                </Text>
                <Text style={{ color: "#ccc", fontSize: "12px" }}>
                  {(uploadedFile.bytes / 1024 / 1024).toFixed(2)} MB
                </Text>
              </div>
            </div>
            <Button
              type="text"
              icon={<DeleteOutlined />}
              onClick={handleRemove}
              style={{ color: "#ff4757" }}
            />
          </div>
        </div>
      )}

      {uploading && (
        <div style={{ marginTop: "16px" }}>
          <Text style={{ color: "#ccc", fontSize: "12px" }}>
            Uploading... {uploadProgress}%
          </Text>
          <Progress
            percent={uploadProgress}
            size="small"
            strokeColor="#ff6b35"
            style={{ marginTop: "8px" }}
          />
        </div>
      )}
    </div>
  );
};

export default FileUpload;
