import React, { useState } from 'react';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid2';
import dayjs from 'dayjs';
import AdminHeader from './components/AdminHeader';
import ActionCenter from './components/ActionCenter';
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
    <Stack spacing={2} sx={{ pb: { xs: 4, sm: 2 } }}>
      {/* 1. Header with Live Site Switcher Dropdown & Custom Date Range Picker */}
      <AdminHeader
        selectedOffice={selectedOffice}
        onSelectOffice={setSelectedOffice}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onAddStaff={() => setAddStaffOpen(true)}
        onApplyLeave={() => setApplyLeaveOpen(true)}
      />

      {/* 2. KPIs – glanceable, clickable, deep-link to their page */}
      <AdminStatCards selectedOffice={selectedOffice} dateRange={dateRange} />

      {/* 3. Command layout: Action Center (what to do next) is the priority
             panel top-left along the reading path; insights sit to the right. */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <ActionCenter />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <DashboardInsights />
        </Grid>
      </Grid>

      {/* 4. Today at a glance – the live attendance board (full width) */}
      <WhosInTodayBoard selectedOffice={selectedOffice} dateRange={dateRange} />

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

