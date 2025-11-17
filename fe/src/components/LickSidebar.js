import React, { useState } from "react";
import {
  Card,
  Input,
  Select,
  Button,
  Typography,
  Divider,
  Tag,
  Space,
  Collapse,
} from "antd";
import {
  SearchOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  TagOutlined,
  ClockCircleOutlined,
  HeartOutlined,
} from "@ant-design/icons";

const { Search } = Input;
const { Option } = Select;
const { Text, Title } = Typography;
const { Panel } = Collapse;

const LickSidebar = ({
  onSearch,
  onFilterChange,
  onSortChange,
  currentFilters = {},
  style = {},
}) => {
  const [searchValue, setSearchValue] = useState(currentFilters.search || "");
  const [selectedTags, setSelectedTags] = useState(currentFilters.tags || []);
  const [sortBy, setSortBy] = useState(currentFilters.sortBy || "newest");

  const handleSearch = (value) => {
    setSearchValue(value);
    if (onSearch) {
      onSearch(value);
    }
  };

  const handleTagChange = (value) => {
    setSelectedTags(value);
    if (onFilterChange) {
      onFilterChange({ tags: value });
    }
  };

  const handleSortChange = (value) => {
    setSortBy(value);
    if (onSortChange) {
      onSortChange(value);
    }
  };

  const popularTags = [
    "guitar",
    "blues",
    "rock",
    "jazz",
    "acoustic",
    "electric",
    "solo",
    "riff",
    "chord",
    "scale",
    "fingerstyle",
    "picking",
  ];

  const sortOptions = [
    { value: "newest", label: "Mới nhất" },
    { value: "oldest", label: "Cũ nhất" },
    { value: "popular", label: "Phổ biến" },
    { value: "likes", label: "Nhiều like" },
    { value: "views", label: "Nhiều view" },
    { value: "duration_asc", label: "Ngắn nhất" },
    { value: "duration_desc", label: "Dài nhất" },
  ];

  return (
    <div
      style={{
        backgroundColor: "#2a2a2a",
        border: "1px solid #333",
        borderRadius: "8px",
        padding: "16px",
        height: "fit-content",
        ...style,
      }}
    >
      <Title level={4} style={{ color: "white", marginBottom: "16px" }}>
        <FilterOutlined style={{ marginRight: "8px" }} />
        Bộ lọc
      </Title>

      {/* Search */}
      <div style={{ marginBottom: "16px" }}>
        <Text
          style={{
            color: "white",
            fontSize: "14px",
            display: "block",
            marginBottom: "8px",
          }}
        >
          Tìm kiếm
        </Text>
        <Search
          placeholder="Tìm kiếm licks..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onSearch={handleSearch}
          style={{
            backgroundColor: "#1a1a1a",
            border: "1px solid #333",
          }}
        />
      </div>

      <Divider style={{ borderColor: "#333" }} />

      {/* Sort */}
      <div style={{ marginBottom: "16px" }}>
        <Text
          style={{
            color: "white",
            fontSize: "14px",
            display: "block",
            marginBottom: "8px",
          }}
        >
          <SortAscendingOutlined style={{ marginRight: "8px" }} />
          Sắp xếp
        </Text>
        <Select
          value={sortBy}
          onChange={handleSortChange}
          style={{ width: "100%" }}
          placeholder="Chọn cách sắp xếp"
        >
          {sortOptions.map((option) => (
            <Option key={option.value} value={option.value}>
              {option.label}
            </Option>
          ))}
        </Select>
      </div>

      <Divider style={{ borderColor: "#333" }} />

      {/* Tags Filter */}
      <div style={{ marginBottom: "16px" }}>
        <Text
          style={{
            color: "white",
            fontSize: "14px",
            display: "block",
            marginBottom: "8px",
          }}
        >
          <TagOutlined style={{ marginRight: "8px" }} />
          Tags
        </Text>
        <Select
          mode="multiple"
          value={selectedTags}
          onChange={handleTagChange}
          style={{ width: "100%" }}
          placeholder="Chọn tags"
          maxTagCount={3}
        >
          {popularTags.map((tag) => (
            <Option key={tag} value={tag}>
              {tag}
            </Option>
          ))}
        </Select>
      </div>

      <Divider style={{ borderColor: "#333" }} />

      {/* Quick Stats */}
      <Collapse
        ghost
        style={{ backgroundColor: "transparent" }}
        expandIconPosition="right"
      >
        <Panel
          header={
            <Text style={{ color: "white", fontSize: "14px" }}>
              <ClockCircleOutlined style={{ marginRight: "8px" }} />
              Thống kê nhanh
            </Text>
          }
          key="1"
        >
          <div style={{ padding: "8px 0" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <Text style={{ color: "#ccc", fontSize: "12px" }}>
                Tổng licks:
              </Text>
              <Text style={{ color: "white", fontSize: "12px" }}>1,234</Text>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <Text style={{ color: "#ccc", fontSize: "12px" }}>
                Likes hôm nay:
              </Text>
              <Text style={{ color: "#ff6b35", fontSize: "12px" }}>56</Text>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Text style={{ color: "#ccc", fontSize: "12px" }}>
                Licks mới:
              </Text>
              <Text style={{ color: "#4CAF50", fontSize: "12px" }}>12</Text>
            </div>
          </div>
        </Panel>
      </Collapse>

      <Divider style={{ borderColor: "#333" }} />

      {/* Popular Tags */}
      <div>
        <Text
          style={{
            color: "white",
            fontSize: "14px",
            display: "block",
            marginBottom: "8px",
          }}
        >
          Tags phổ biến
        </Text>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {popularTags.slice(0, 8).map((tag) => (
            <Tag
              key={tag}
              style={{
                backgroundColor: "#1a1a1a",
                color: "#ff6b35",
                border: "1px solid #333",
                cursor: "pointer",
                fontSize: "10px",
              }}
              onClick={() => {
                const newTags = selectedTags.includes(tag)
                  ? selectedTags.filter((t) => t !== tag)
                  : [...selectedTags, tag];
                handleTagChange(newTags);
              }}
            >
              {tag}
            </Tag>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LickSidebar;
