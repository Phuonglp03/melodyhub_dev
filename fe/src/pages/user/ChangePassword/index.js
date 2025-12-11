import React, { useState } from 'react';
import { Form, Input, Button, Typography, message, Card, Divider } from 'antd';
import { ArrowLeftOutlined, KeyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../../../services/authService';

const { Title, Text } = Typography;

const ChangePasswordPage = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [changingPassword, setChangingPassword] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleChangePassword = async (values) => {
    try {
      setChangingPassword(true);
      await changePassword(values.currentPassword, values.newPassword);
      messageApi.success('Đổi mật khẩu thành công');
      form.resetFields();
    } catch (error) {
      messageApi.error(error.message || 'Đổi mật khẩu thất bại');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="profile-settings-page">
      {contextHolder}
      <div className="profile-settings-layout">
        <div className="profile-settings-sider">
          <Button
            icon={<ArrowLeftOutlined />}
            style={{ height: 44, marginBottom: 16 }}
            block
            onClick={() => navigate('/profile')}
          >
            Trở lại Hồ sơ
          </Button>
          <Card
            style={{ background: '#0f0f10', borderColor: '#1f1f1f', padding: 0 }}
            styles={{ body: { padding: 16 } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <KeyOutlined style={{ fontSize: 20, color: '#fbbf24' }} />
              <div style={{ color: '#fbbf24', fontWeight: 600 }}>Thay đổi mật khẩu</div>
            </div>
          </Card>
        </div>
        <div className="profile-settings-content">
          <Title level={2} style={{ color: '#fff', marginBottom: 16 }}>
            Thay đổi mật khẩu
          </Title>
          <Card style={{ background: '#0f0f10', borderColor: '#1f1f1f' }}>
            <Text style={{ color: '#9ca3af' }}>
              Cập nhật mật khẩu đăng nhập tài khoản MelodyHub của bạn.
            </Text>
            <Divider style={{ borderColor: '#1f2937', margin: '12px 0 16px' }} />
            <Form
              form={form}
              layout="vertical"
              onFinish={handleChangePassword}
              style={{ maxWidth: 480 }}
            >
              <Form.Item
                label={<Text style={{ color: '#e5e7eb', fontWeight: 700 }}>Mật khẩu hiện tại</Text>}
                name="currentPassword"
                rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}
              >
                <Input.Password
                  placeholder="Nhập mật khẩu hiện tại"
                  style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }}
                />
              </Form.Item>
              <Form.Item
                label={<Text style={{ color: '#e5e7eb', fontWeight: 700 }}>Mật khẩu mới</Text>}
                name="newPassword"
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                  { min: 6, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' },
                ]}
                hasFeedback
              >
                <Input.Password
                  placeholder="Nhập mật khẩu mới"
                  style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }}
                />
              </Form.Item>
              <Form.Item
                label={<Text style={{ color: '#e5e7eb', fontWeight: 700 }}>Xác nhận mật khẩu mới</Text>}
                name="confirmNewPassword"
                dependencies={['newPassword']}
                hasFeedback
                rules={[
                  { required: true, message: 'Vui lòng xác nhận mật khẩu mới' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
                    },
                  }),
                ]}
              >
                <Input.Password
                  placeholder="Nhập lại mật khẩu mới"
                  style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }}
                />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={changingPassword}
                >
                  Đổi mật khẩu
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordPage;









