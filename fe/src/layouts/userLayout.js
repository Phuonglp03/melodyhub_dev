import React from 'react';
import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';

import AppHeader from '../components/header';
import NotificationToastContainer from '../components/NotificationToastContainer';

const { Content } = Layout;

const MainLayout = () => {
  return (
    <div className="main-layout" style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <Layout style={{ background: '#0a0a0a' }}>
        <AppHeader />
        <Content style={{ marginTop: 72, minHeight: 'calc(100vh - 72px - 100px)', background: '#0a0a0a' }}>
          <Outlet />
        </Content>
      </Layout>
      <NotificationToastContainer />
    </div>
  );
};

export default MainLayout;