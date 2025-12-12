'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.push('/login');
      return;
    }

    fetch('/api/sales/analytics', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setStats(data.data);
      }
      setLoading(false);
    })
    .catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Overview</h2>
          <p className="text-gray-600 mt-1">Welcome to your restaurant dashboard</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-sm font-medium text-gray-600 uppercase">Total Orders</h3>
            <p className="text-4xl font-bold text-blue-600 mt-2">{stats?.totalOrders || 0}</p>
            <p className="text-sm text-gray-500 mt-1">All time</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-sm font-medium text-gray-600 uppercase">Completed</h3>
            <p className="text-4xl font-bold text-green-600 mt-2">{stats?.completed?.count || 0}</p>
            <p className="text-sm text-gray-500 mt-1">
              £{stats?.completed?.revenue ? stats.completed.revenue.toFixed(2) : '0.00'} revenue
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-sm font-medium text-gray-600 uppercase">Pending</h3>
            <p className="text-4xl font-bold text-yellow-600 mt-2">{stats?.pending?.count || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Awaiting action</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg shadow-md text-white">
            <h3 className="text-sm font-medium uppercase opacity-90">Today</h3>
            <p className="text-3xl font-bold mt-2">£{stats?.today?.revenue?.toFixed(2) || '0.00'}</p>
            <p className="text-sm opacity-90 mt-1">{stats?.today?.orders || 0} orders</p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow-md text-white">
            <h3 className="text-sm font-medium uppercase opacity-90">This Week</h3>
            <p className="text-3xl font-bold mt-2">£{stats?.week?.revenue?.toFixed(2) || '0.00'}</p>
            <p className="text-sm opacity-90 mt-1">{stats?.week?.orders || 0} orders</p>
          </div>
          
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg shadow-md text-white">
            <h3 className="text-sm font-medium uppercase opacity-90">This Month</h3>
            <p className="text-3xl font-bold mt-2">£{stats?.month?.revenue?.toFixed(2) || '0.00'}</p>
            <p className="text-sm opacity-90 mt-1">{stats?.month?.orders || 0} orders</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
