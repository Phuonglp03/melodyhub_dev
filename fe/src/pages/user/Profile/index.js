import React, { useEffect, useRef } from 'react';
import { Card, Form, Input, Button, Typography, message, Avatar, Space, Select, Upload, Modal } from 'antd';
import { ArrowLeftOutlined, UserOutlined, KeyOutlined, DeleteOutlined } from '@ant-design/icons';
import { getMyProfile, updateMyProfile, uploadMyAvatar, uploadMyCoverPhoto } from '../../../services/user/profile';
import { useNavigate } from 'react-router-dom';
import './profileResponsive.css';
import api from '../../../services/api';

const { Title, Text } = Typography;

const ProfilePage = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [profile, setProfile] = React.useState(null);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [uploadingCoverPhoto, setUploadingCoverPhoto] = React.useState(false);
  const [avatarPreview, setAvatarPreview] = React.useState('');
  const [coverPreview, setCoverPreview] = React.useState('');
  const [pendingAvatarFile, setPendingAvatarFile] = React.useState(null);
  const [pendingCoverFile, setPendingCoverFile] = React.useState(null);
  const avatarObjectUrlRef = useRef(null);
  const coverObjectUrlRef = useRef(null);
  const [addressLoading, setAddressLoading] = React.useState(false);
  const [provinces, setProvinces] = React.useState([]);
  const [districts, setDistricts] = React.useState([]);
  const [wards, setWards] = React.useState([]);
  const [selectedProvince, setSelectedProvince] = React.useState(null);
  const [selectedDistrict, setSelectedDistrict] = React.useState(null);

  const revokeAvatarPreview = () => {
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = null;
    }
  };

  const revokeCoverPreview = () => {
    if (coverObjectUrlRef.current) {
      URL.revokeObjectURL(coverObjectUrlRef.current);
      coverObjectUrlRef.current = null;
    }
  };

  const setAvatarPreviewValue = (url, { isObjectUrl = false } = {}) => {
    revokeAvatarPreview();
    if (isObjectUrl) {
      avatarObjectUrlRef.current = url;
    }
    setAvatarPreview(url || '');
    form.setFieldsValue({ avatarUrl: url || '' });
  };

  const setCoverPreviewValue = (url, { isObjectUrl = false } = {}) => {
    revokeCoverPreview();
    if (isObjectUrl) {
      coverObjectUrlRef.current = url;
    }
    setCoverPreview(url || '');
    form.setFieldsValue({ coverPhotoUrl: url || '' });
  };

  useEffect(() => {
    return () => {
      revokeAvatarPreview();
      revokeCoverPreview();
    };
  }, []);

  useEffect(() => {
    const fetchProvinces = async () => {
      setAddressLoading(true);
      try {
        const response = await api.get('/locations/provinces', {
          params: { depth: 3 }
        });
        setProvinces(response.data || []);
      } catch (error) {
        console.error('Failed to fetch provinces', error);
        messageApi.error('Không thể tải danh sách địa chỉ. Vui lòng thử lại sau.');
      } finally {
        setAddressLoading(false);
      }
    };

    fetchProvinces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getMyProfile();
      const u = res?.data?.user || {};
      setProfile(u);
      form.setFieldsValue({
        displayName: u.displayName,
        username: u.username,
        email: u.email,
        bio: u.bio,
        location: u.location,
        gender: u.gender,
        links: u.links && u.links.length > 0 ? u.links : ['', ''],
      });
      setAvatarPreviewValue(u.avatarUrl || '');
      setCoverPreviewValue(u.coverPhotoUrl || '');
      setPendingAvatarFile(null);
      setPendingCoverFile(null);
    } catch (e) {
      messageApi.error(e.message || 'Không tải được hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!profile || provinces.length === 0) return;

    const province = provinces.find(
      (item) => item.code.toString() === (profile.provinceCode || '').toString()
    );
    setSelectedProvince(province || null);
    const provinceDistricts = province?.districts || [];
    setDistricts(provinceDistricts);

    const district = provinceDistricts.find(
      (item) => item.code.toString() === (profile.districtCode || '').toString()
    );
    setSelectedDistrict(district || null);
    const districtWards = district?.wards || [];
    setWards(districtWards);

    form.setFieldsValue({
      addressLine: profile.addressLine || profile.location || '',
      province: profile.provinceCode ? profile.provinceCode.toString() : undefined,
      district: profile.districtCode ? profile.districtCode.toString() : undefined,
      ward: profile.wardCode ? profile.wardCode.toString() : undefined,
    });
  }, [profile, provinces, form]);

  const handleProvinceChange = (value) => {
    form.setFieldsValue({ district: undefined, ward: undefined });
    const province = provinces.find((item) => item.code.toString() === value);
    setSelectedProvince(province || null);
    setDistricts(province?.districts || []);
    setSelectedDistrict(null);
    setWards([]);
  };

  const handleDistrictChange = (value) => {
    form.setFieldsValue({ ward: undefined });
    const district = (selectedProvince?.districts || []).find((item) => item.code.toString() === value);
    setSelectedDistrict(district || null);
    setWards(district?.wards || []);
  };

  const handleWardChange = () => {
    // No additional logic needed for now, but function retained for clarity
  };

  const handleBackToProfile = () => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const obj = JSON.parse(raw);
        const u = obj?.user || obj;
        const userId = u?.id || u?.userId || u?._id;
        if (userId) {
          navigate(`/users/${userId}/newfeeds`);
          return;
        }
      }
    } catch (e) {
      // ignore and use fallback
    }
    navigate('/newfeeds');
  };

  const onFinish = async (values) => {
    setSaving(true);
    try {
      const payload = {};

      if (values.displayName) {
        payload.displayName = values.displayName.trim();
      }

      if (typeof values.bio === 'string') {
        payload.bio = values.bio.trim();
      }

      if (typeof values.location === 'string') {
        const trimmedLocation = values.location.trim();
        if (trimmedLocation) {
          payload.location = trimmedLocation;
        }
      }

      const addressLine = typeof values.addressLine === 'string' ? values.addressLine.trim() : '';
      const province = provinces.find((item) => item.code.toString() === values.province);
      const district = province?.districts?.find((item) => item.code.toString() === values.district);
      const ward = district?.wards?.find((item) => item.code.toString() === values.ward);

      if (addressLine) {
        payload.addressLine = addressLine;
      }

      if (province && district && ward) {
        payload.provinceCode = province.code.toString();
        payload.provinceName = province.name;
        payload.districtCode = district.code.toString();
        payload.districtName = district.name;
        payload.wardCode = ward.code.toString();
        payload.wardName = ward.name;

        const fullLocation = [
          addressLine || profile?.addressLine || '',
          ward.name,
          district.name,
          province.name
        ]
          .filter(Boolean)
          .join(', ');

        if (fullLocation) {
          payload.location = fullLocation;
        }
      }

      if (values.gender) {
        payload.gender = values.gender;
      }
      // Avatar và Cover Photo chỉ được upload qua file, không gửi trong JSON payload
      // Xử lý links: filter bỏ các link rỗng và trim
      if (values.links && Array.isArray(values.links)) {
        payload.links = values.links
          .map(link => typeof link === 'string' ? link.trim() : '')
          .filter(link => link !== '');
      }

      if (pendingAvatarFile) {
        setUploadingAvatar(true);
        try {
          await uploadMyAvatar(pendingAvatarFile);
          setPendingAvatarFile(null);
        } finally {
          setUploadingAvatar(false);
        }
      }

      if (pendingCoverFile) {
        setUploadingCoverPhoto(true);
        try {
          await uploadMyCoverPhoto(pendingCoverFile);
          setPendingCoverFile(null);
        } finally {
          setUploadingCoverPhoto(false);
        }
      }

      await updateMyProfile(payload);
      messageApi.success('Cập nhật hồ sơ thành công');
      modalApi.success({
        title: 'Update profile',
        content: 'Hồ sơ của bạn đã được cập nhật thành công.',
        centered: true
      });
      load();
    } catch (e) {
      messageApi.error(e.message || 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-settings-page">
      {messageContextHolder}
      {modalContextHolder}
      {/** unified input styles for dark theme */}
      {/** Using inline const to avoid external CSS edits */}
      {(() => {})()}
      <div className="profile-settings-layout">
        <div className="profile-settings-sider">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Button icon={<ArrowLeftOutlined />} style={{ height: 44 }} block onClick={handleBackToProfile}>
              Trở lại trang cá nhân 
            </Button>
            <Card style={{ background: '#0f0f10', borderColor: '#1f1f1f', padding: 0 }} bodyStyle={{ padding: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: '#151515', borderRadius: 8 }}>
                <UserOutlined style={{ fontSize: 20 }} />
                <div style={{ fontWeight: 600, color: '#e5e7eb' }}>Hồ sơ</div>
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, cursor: 'pointer' }}
                onClick={() => navigate('/change-password')}
              >
                <KeyOutlined style={{ fontSize: 20, color: '#fbbf24' }} />
                <div style={{ color: '#fbbf24', fontWeight: 600 }}>Thay đổi mật khẩu</div>
              </div>
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, cursor: 'pointer' }}
                onClick={() => navigate('/archived-posts')}
              >
                <DeleteOutlined style={{ fontSize: 20, color: '#9ca3af' }} />
                <div style={{ color: '#9ca3af' }}>Bài viết đã lưu trữ</div>
              </div>
            </Card>
          </Space>
        </div>
        <div className="profile-settings-content">
          <Title level={2} style={{ color: '#fff', marginBottom: 16 }}>Hồ sơ</Title>
          <Card loading={loading} style={{ background: '#0f0f10', borderColor: '#1f1f1f' }}>
            {/* Cover Photo Section */}
            <div style={{ marginBottom: 24 }}>
              <div className="profile-cover-wrapper">
                {coverPreview ? (
                  <img 
                    src={coverPreview} 
                    alt="Cover" 
                    className="profile-cover-wrapper__image"
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                    No cover photo
                  </div>
                )}
                <Upload
                  showUploadList={false}
                  accept="image/*"
                  beforeUpload={() => {
                    return false;
                  }}
                  onChange={async (info) => {
                    const { file } = info;
                    const fileToUpload = file?.originFileObj || file;

                    if (!fileToUpload) {
                      return;
                    }

                    if (file) {
                      file.status = 'done';
                    }

                    const previewUrl = URL.createObjectURL(fileToUpload);
                    setCoverPreviewValue(previewUrl, { isObjectUrl: true });
                    setPendingCoverFile(fileToUpload);
                    messageApi.info('Ảnh bìa mới sẽ được lưu sau khi bấm Save changes');
                  }}
                >
                  <Button 
                    loading={uploadingCoverPhoto && saving}
                    type="primary"
                    style={{ 
                      position: 'absolute', 
                      bottom: 16, 
                      right: 16,
                      background: 'rgba(0, 0, 0, 0.6)',
                      borderColor: '#fff',
                      color: '#fff'
                    }}
                  >
                    {coverPreview ? 'Đổi ảnh bìa' : 'Thêm ảnh bìa'}
                  </Button>
                </Upload>
                {pendingCoverFile && (
                  <div style={{ marginTop: 8, color: '#d1d5db' }}>
                    Ảnh bìa chờ lưu: <strong>{pendingCoverFile.name}</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="profile-form-grid">
              <div className="profile-avatar-block">
                <Avatar shape="square" size={160} src={avatarPreview} style={{ background: '#4b5563', borderRadius: 28 }}>
                  {((form.getFieldValue('displayName') || form.getFieldValue('username') || 'T')[0] || 'T')}
                </Avatar>
              </div>

        <Form form={form} layout="vertical" onFinish={onFinish} className="profile-settings-form">
          {/** common input style for consistency */}
          {(() => {})()}
          <Form.Item label={<Text style={{ color: '#e5e7eb', fontWeight: 700 }}>Tên hiển thị</Text>} name="displayName" rules={[{ required: true, message: 'Vui lòng nhập tên' }]}> 
            <Input placeholder="Tran Trong Quy( K17 HL )" style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }} />
          </Form.Item>

          {/* <Form.Item label={<span style={{ color: '#e5e7eb', fontWeight: 700 }}>Username <InfoCircleOutlined style={{ color: '#9ca3af' }} /></span>} name="username">
            <Input disabled style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }} />
          </Form.Item> */}

          <Form.Item label={<Text style={{ color: '#e5e7eb', fontWeight: 700 }}>Địa chỉ </Text>} name="location">
            <Input disabled placeholder="Search City" style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }} />
          </Form.Item>

          <Form.Item
            label={<Text style={{ color: '#e5e7eb', fontWeight: 700 }}>Địa chỉ cụ thể</Text>}
            name="addressLine"
          >
            <Input
               placeholder="House number, street name, etc."
              style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }}
            />
          </Form.Item>

          <Form.Item
            label={<Text style={{ color: '#e5e7eb', fontWeight: 700 }}>Thành phố</Text>}
            name="province"
          >
            <Select
              placeholder="Select province/city"
              style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }}
              loading={addressLoading && provinces.length === 0}
              options={provinces.map((province) => ({
                label: province.name,
                value: province.code.toString()
              }))}
              showSearch
              optionFilterProp="label"
              onChange={handleProvinceChange}
            />
          </Form.Item>

          <Form.Item
            label={<Text style={{ color: '#e5e7eb', fontWeight: 700 }}>Quận huyện</Text>}
            name="district"
          >
            <Select
              placeholder="Select district"
              style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }}
              disabled={!selectedProvince}
              loading={addressLoading && !!selectedProvince && districts.length === 0}
              options={districts.map((district) => ({
                label: district.name,
                value: district.code.toString()
              }))}
              showSearch
              optionFilterProp="label"
              onChange={handleDistrictChange}
            />
          </Form.Item>

          <Form.Item
            label={<Text style={{ color: '#e5e7eb', fontWeight: 700 }}>Xã/ phường</Text>}
            name="ward"
          >
            <Select
              placeholder="Select ward"
              style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }}
              disabled={!selectedDistrict}
              loading={addressLoading && !!selectedDistrict && wards.length === 0}
              options={wards.map((ward) => ({
                label: ward.name,
                value: ward.code.toString()
              }))}
              showSearch
              optionFilterProp="label"
              onChange={handleWardChange}
            />
          </Form.Item>

          <Form.Item label={<Text style={{ color: '#e5e7eb', fontWeight: 700 }}>Giới tính</Text>} name="gender">
            <Select
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
                { value: 'unspecified', label: 'Unspecified' },
              ]}
              style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }}
            />
          </Form.Item>

          <Form.Item label={<Text style={{ color: '#e5e7eb', fontWeight: 700 }}>Email</Text>} name="email">
            <Input disabled placeholder="Search City" style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }} />
          </Form.Item>
{/* 
          <div style={{ color: '#e5e7eb', fontWeight: 700, marginBottom: 8 }}>About</div>
          <div style={{ position: 'relative' }}>
            <Form.Item name="bio" style={{ marginBottom: 0 }}>
              <Input.TextArea rows={6} maxLength={250} onChange={(e) => setAboutCount(e.target.value.length)} placeholder="Describe yourself in a few words ..." style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }} />
            </Form.Item>
            <div style={{ position: 'absolute', right: 8, top: -24, color: '#9ca3af' }}>{aboutCount}/250</div>
            <SmileOutlined style={{ position: 'absolute', right: 12, bottom: 10, color: '#9ca3af' }} />
          </div> */}

          <Title level={4} style={{ color: '#fff', marginTop: 16 }}>Liên hệ</Title>
          <Form.List name="links">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <Form.Item key={field.key} name={[field.name]} style={{ marginBottom: 12 }}>
                    <Input 
                      placeholder={index === 0 ? "https://www.facebook.com/quy.trantrong.9862" : "https://www.example.com"} 
                      style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }} 
                    />
                  </Form.Item>
                ))}
                {fields.length < 2 && (
                  <Button 
                    type="dashed" 
                    onClick={() => add()} 
                    style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb', marginBottom: 12 }}
                  >
                    + Add Link
                  </Button>
                )}
              </>
            )}
          </Form.List>

          <Form.Item label={<Text style={{ color: '#e5e7eb', fontWeight: 700 }}>Ảnh đại diện</Text>}> 
            <Upload
              showUploadList={false}
              accept="image/*"
              beforeUpload={() => {
                // Prevent default upload
                return false;
              }}
              onChange={async (info) => {
                const { file } = info;
                const fileToUpload = file?.originFileObj || file;

                if (!fileToUpload) {
                  return;
                }

                if (file) {
                  file.status = 'done';
                }

                const previewUrl = URL.createObjectURL(fileToUpload);
                setAvatarPreviewValue(previewUrl, { isObjectUrl: true });
                setPendingAvatarFile(fileToUpload);
                messageApi.info('Ảnh đại diện mới sẽ được lưu sau khi bấm Save changes');
              }}
            >
              <Button 
                loading={uploadingAvatar && saving} 
                style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }}
              >
                Tải lên ảnh đại diện mới
              </Button>
            </Upload>
            {pendingAvatarFile && (
              <div style={{ marginTop: 8, color: '#9ca3af' }}>
                Ảnh chờ lưu: <strong>{pendingAvatarFile.name}</strong>
              </div>
            )}
          </Form.Item>
          <Form.Item name="avatarUrl" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="coverPhotoUrl" hidden>
            <Input />
          </Form.Item>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" htmlType="submit" loading={saving}>Thay đổi</Button>
            {/* <Button onClick={load}>Reset</Button> */}
          </div>
        </Form>
        </div>
      </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
