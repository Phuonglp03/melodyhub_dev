import React, { useEffect, useState } from 'react';
import { ShieldAlert, Settings, RefreshCw, Save, AlertCircle } from 'lucide-react';
import { getReportLimitSetting, updateReportLimitSetting } from '../../../services/user/reportService';

const MIN_LIMIT = 1;
const MAX_LIMIT = 20;

const ReportSettings = () => {
  const [limit, setLimit] = useState(2);
  const [initialLimit, setInitialLimit] = useState(2);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getReportLimitSetting();
      const currentLimit = response?.data?.limit ?? 2;
      setLimit(currentLimit);
      setInitialLimit(currentLimit);
    } catch (err) {
      setError(err.message || 'Không thể tải cấu hình báo cáo');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (saving || limit === initialLimit) return;

    try {
      setSaving(true);
      setError('');
      setMessage('');
      await updateReportLimitSetting(limit);
      setInitialLimit(limit);
      setMessage('Đã cập nhật giới hạn báo cáo thành công.');
    } catch (err) {
      setError(err.message || 'Cập nhật thất bại. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (event) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value)) {
      setLimit(MIN_LIMIT);
      return;
    }

    if (value < MIN_LIMIT) {
      setLimit(MIN_LIMIT);
    } else if (value > MAX_LIMIT) {
      setLimit(MAX_LIMIT);
    } else {
      setLimit(value);
    }
  };

  const dirty = limit !== initialLimit;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-3">
          <Settings size={32} className="text-orange-400" />
          Report Settings
        </h1>
        <p className="text-gray-400 mt-2 max-w-2xl">
          Thiết lập số lượng báo cáo cần thiết trước khi một bài viết bị ẩn tự động.
          Điều chỉnh thông số này để phù hợp với chính sách kiểm duyệt của bạn.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 shadow-xl shadow-black/20">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 text-orange-300">
              <ShieldAlert size={32} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Giới hạn báo cáo bài viết</h2>
              <p className="text-gray-400 text-sm">
                Khi số lượng báo cáo đạt giới hạn, bài viết sẽ bị ẩn cho đến khi admin xử lý.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm text-gray-400 font-medium">Số báo cáo tối thiểu</label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min={MIN_LIMIT}
                max={MAX_LIMIT}
                value={limit}
                onChange={handleInputChange}
                disabled={loading}
                className="w-32 px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30 outline-none text-lg font-semibold text-white"
              />
              <div className="text-sm text-gray-400">
                Giá trị cho phép từ <span className="text-white font-medium">{MIN_LIMIT}</span> đến{' '}
                <span className="text-white font-medium">{MAX_LIMIT}</span>.
              </div>
            </div>

            <div className="relative pt-8">
              <input
                type="range"
                min={MIN_LIMIT}
                max={MAX_LIMIT}
                value={limit}
                onChange={handleInputChange}
                disabled={loading}
                className="w-full accent-orange-400"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Thận trọng</span>
                <span>Cân bằng</span>
                <span>Nghiêm ngặt</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSave}
              disabled={loading || saving || !dirty}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all ${
                loading || !dirty
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:scale-105'
              }`}
            >
              {saving ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Lưu thay đổi
                </>
              )}
            </button>
            <button
              onClick={fetchSettings}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <RefreshCw size={16} />
              Tải lại
            </button>
            {dirty && !saving && (
              <span className="text-xs text-orange-300">Chưa lưu thay đổi</span>
            )}
          </div>

          {(message || error) && (
            <div
              className={`mt-4 p-3 rounded-xl text-sm flex items-center gap-2 ${
                error
                  ? 'bg-red-500/10 border border-red-500/40 text-red-200'
                  : 'bg-green-500/10 border border-green-500/40 text-green-200'
              }`}
            >
              <AlertCircle size={16} />
              {error || message}
            </div>
          )}
        </div>

        <div className="bg-gray-900/20 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4">Gợi ý thiết lập</h3>
          <ul className="space-y-3 text-sm text-gray-400">
            <li className="flex gap-3">
              <span className="text-orange-400 font-semibold">2 - 3</span>
              <span>Áp dụng cho cộng đồng nhỏ cần phản hồi nhanh.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-orange-400 font-semibold">4 - 6</span>
              <span>Cân bằng giữa tốc độ xử lý và độ chính xác.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-orange-400 font-semibold">7+</span>
              <span>Phù hợp với cộng đồng lớn, hạn chế báo cáo sai.</span>
            </li>
          </ul>

          <div className="mt-6 p-4 bg-gray-900/40 border border-gray-800 rounded-2xl">
            <p className="text-sm text-gray-300">
              Mỗi khi đạt giới hạn, bài viết sẽ bị đánh dấu <strong>archived</strong> và chủ bài viết
              sẽ nhận thông báo tự động.
            </p>
            <p className="text-xs text-gray-500 mt-3">
              Thay đổi có hiệu lực ngay lập tức cho các báo cáo tiếp theo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportSettings;


