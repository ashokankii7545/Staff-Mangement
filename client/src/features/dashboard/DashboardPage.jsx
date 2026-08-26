import React from 'react';
import { useAuth } from '../../shared/auth/AuthContext';
import AdminDashboard from '../admin/AdminDashboard';
import StaffDashboard from './StaffDashboard';

const DashboardPage = () => {
  const { user } = useAuth();

  if (user?.role === 'ADMIN') {
    return <AdminDashboard />;
  }

  return <StaffDashboard />;
};

export default DashboardPage;

