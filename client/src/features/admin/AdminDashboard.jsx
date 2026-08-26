import React, { useState } from 'react';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid2';
import dayjs from 'dayjs';
import AdminHeader from './components/AdminHeader';
import PendingApprovalsCard from './components/PendingApprovalsCard';
import AdminStatCards from './components/AdminStatCards';
import WhosInTodayBoard from './components/WhosInTodayBoard';
import DashboardInsights from './components/DashboardInsights';
import QuickAddStaffModal from './components/QuickAddStaffModal';
import ApplyLeaveModal from '../leaves/components/ApplyLeaveModal';

const AdminDashboard = () => {
  const [selectedOffice, setSelectedOffice] = useState('ALL');
  const [dateRange, setDateRange] = useState({
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
    label: 'Today',
  });

  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [applyLeaveOpen, setApplyLeaveOpen] = useState(false);

  return (
    <Stack spacing={2}>
      {/* 1. Header with Live Site Switcher Dropdown & Custom Date Range Picker */}
      <AdminHeader
        selectedOffice={selectedOffice}
        onSelectOffice={setSelectedOffice}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onAddStaff={() => setAddStaffOpen(true)}
        onApplyLeave={() => setApplyLeaveOpen(true)}
      />

      {/* 2. Pending Approvals Triage Banner */}
      <PendingApprovalsCard />

      {/* 3. Real-Time Workforce Pulse KPI Metrics */}
      <AdminStatCards selectedOffice={selectedOffice} dateRange={dateRange} />

      {/* 4. Main Operational Layout */}
      <Grid container spacing={2}>
        {/* Left: Interactive Live Attendance Log */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <WhosInTodayBoard selectedOffice={selectedOffice} dateRange={dateRange} />
        </Grid>

        {/* Right: Trend & Upcoming Events Hub */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <DashboardInsights />
        </Grid>
      </Grid>

      {/* Action Modals */}
      <QuickAddStaffModal
        open={addStaffOpen}
        onClose={() => setAddStaffOpen(false)}
      />

      <ApplyLeaveModal
        open={applyLeaveOpen}
        onClose={() => setApplyLeaveOpen(false)}
      />
    </Stack>
  );
};

export default AdminDashboard;

