import express from 'express';
import axios from 'axios';

const router = express.Router();
const BASE_URL = 'https://provinces.open-api.vn/api/';

router.get('/provinces', async (req, res) => {
  try {
    const depth = req.query.depth || 2;
    const response = await axios.get(BASE_URL, {
      params: { depth },
      headers: {
        'User-Agent': 'melodyhub-be',
        Accept: 'application/json',
      },
      timeout: 10000,
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching provinces:', error.response?.status || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message:
        status === 404
          ? 'API tỉnh/thành không tồn tại hoặc đang bảo trì'
          : 'Không thể lấy danh sách tỉnh/thành từ API bên ngoài',
      error: error.response?.data || null,
    });
  }
});

export default router;

