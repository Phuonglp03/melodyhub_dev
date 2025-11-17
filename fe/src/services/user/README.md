# Lick Service - API Integration

## Cách sử dụng Mock Data vs Backend

### 1. Chuyển đổi giữa Mock Data và Backend

Để chuyển đổi giữa mock data và backend thật, chỉ cần thay đổi trong file `fe/src/config/api.js`:

```javascript
export const API_CONFIG = {
  // Đặt true để dùng mock data, false để dùng backend thật
  USE_MOCK_DATA: false,  // ← Thay đổi giá trị này
  
  // Backend API URL
  API_BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  
  // Mock data delay (ms) - để giả lập độ trễ mạng
  MOCK_DELAY: 500,
};
```

### 2. Khi nào dùng Mock Data

- **Development**: Khi đang phát triển frontend mà backend chưa sẵn sàng
- **Testing**: Để test UI/UX mà không cần backend
- **Demo**: Để demo cho client mà không cần setup backend

### 3. Khi nào dùng Backend

- **Production**: Khi deploy lên production
- **Integration Testing**: Khi test tích hợp frontend-backend
- **Real Data**: Khi cần dữ liệu thật từ database

### 4. Cách chuyển đổi

#### Để dùng Mock Data:
```javascript
// fe/src/config/api.js
export const API_CONFIG = {
  USE_MOCK_DATA: true,  // ← Đặt true
  // ... rest of config
};
```

#### Để dùng Backend:
```javascript
// fe/src/config/api.js
export const API_CONFIG = {
  USE_MOCK_DATA: false,  // ← Đặt false
  API_BASE_URL: 'http://localhost:5000/api',  // ← Đảm bảo URL đúng
  // ... rest of config
};
```

### 5. Environment Variables

Có thể dùng environment variables để config:

```bash
# .env file
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_USE_MOCK_DATA=false
```

```javascript
// fe/src/config/api.js
export const API_CONFIG = {
  USE_MOCK_DATA: process.env.REACT_APP_USE_MOCK_DATA === 'true',
  API_BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  MOCK_DELAY: 500,
};
```

### 6. Backend Requirements

Khi chuyển sang backend thật, đảm bảo backend có các endpoints:

- `GET /api/licks/community` - Lấy danh sách licks cộng đồng
- `GET /api/licks/:lickId` - Lấy chi tiết lick
- `POST /api/licks/:lickId/like` - Like/unlike lick
- `GET /api/licks/:lickId/comments` - Lấy comments
- `POST /api/licks/:lickId/comments` - Thêm comment

### 7. Mock Data Structure

Mock data được định nghĩa trong `fe/src/services/user/mockData.js` và có cấu trúc giống với response từ backend thật.

### 8. Testing

```bash
# Test với mock data
npm start

# Test với backend (cần chạy backend trước)
# 1. Start backend: cd ../be && npm start
# 2. Start frontend: npm start
```

## Lưu ý

- Mock data chỉ để development, không dùng cho production
- Luôn test với backend thật trước khi deploy
- Đảm bảo API endpoints match với backend implementation

