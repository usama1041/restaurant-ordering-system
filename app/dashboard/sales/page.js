'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';

export default function SalesPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch('/api/sales/analytics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAnalytics(data.data);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

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
          <h2 className="text-3xl font-bold text-gray-900">Sales Analytics</h2>
          <p className="text-gray-600 mt-1">Track your revenue and order statistics</p>
        </div>

        {/* Revenue Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
            <h3 className="text-sm font-medium text-gray-600 uppercase mb-2">Completed Revenue</h3>
            <p className="text-4xl font-bold text-green-600">
              £{analytics?.completed?.revenue?.toFixed(2) || '0.00'}
            </p>
            <p className="text-gray-600 mt-2">
              {analytics?.completed?.count || 0} completed orders
            </p>
            {analytics?.completed?.count > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                Avg: £{(analytics.completed.revenue / analytics.completed.count).toFixed(2)} per order
              </p>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500">
            <h3 className="text-sm font-medium text-gray-600 uppercase mb-2">Cancelled Revenue</h3>
            <p className="text-4xl font-bold text-red-600">
              £{analytics?.cancelled?.revenue?.toFixed(2) || '0.00'}
            </p>
            <p className="text-gray-600 mt-2">
              {analytics?.cancelled?.count || 0} cancelled orders
            </p>
            {analytics?.totalOrders > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                {((analytics.cancelled.count / analytics.totalOrders) * 100).toFixed(1)}% cancellation rate
              </p>
            )}
          </div>
        </div>

        {/* Time-based Revenue */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg shadow-md text-white">
            <h3 className="text-sm font-medium uppercase opacity-90">Today</h3>
            <p className="text-3xl font-bold mt-2">£{analytics?.today?.revenue?.toFixed(2) || '0.00'}</p>
            <p className="text-sm opacity-90 mt-1">{analytics?.today?.orders || 0} orders</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow-md text-white">
            <h3 className="text-sm font-medium uppercase opacity-90">This Week</h3>
            <p className="text-3xl font-bold mt-2">£{analytics?.week?.revenue?.toFixed(2) || '0.00'}</p>
            <p className="text-sm opacity-90 mt-1">{analytics?.week?.orders || 0} orders</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg shadow-md text-white">
            <h3 className="text-sm font-medium uppercase opacity-90">This Month</h3>
            <p className="text-3xl font-bold mt-2">£{analytics?.month?.revenue?.toFixed(2) || '0.00'}</p>
            <p className="text-sm opacity-90 mt-1">{analytics?.month?.orders || 0} orders</p>
          </div>
        </div>

        {/* Performance Insights */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Performance Insights</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="font-semibold text-green-900">Completion Rate</p>
                <p className="text-sm text-green-700">
                  {analytics?.totalOrders > 0 
                    ? ((analytics.completed.count / analytics.totalOrders) * 100).toFixed(1)
                    : '0'}% of orders successfully completed
                </p>
              </div>
              <div className="text-3xl font-bold text-green-600">
                {analytics?.totalOrders > 0 
                  ? ((analytics.completed.count / analytics.totalOrders) * 100).toFixed(0)
                  : '0'}%
              </div>
            </div>

            {analytics?.pending?.count > 0 && (
              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                <div>
                  <p className="font-semibold text-yellow-900">Pending Orders</p>
                  <p className="text-sm text-yellow-700">
                    {analytics.pending.count} orders awaiting completion
                  </p>
                </div>
                <div className="text-3xl font-bold text-yellow-600">
                  {analytics.pending.count}
                </div>
              </div>
            )}

            {analytics?.cancelled?.count > 0 && (
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                <div>
                  <p className="font-semibold text-red-900">Cancellation Alert</p>
                  <p className="text-sm text-red-700">
                    Review customer feedback to reduce cancellations
                  </p>
                </div>
                <div className="text-3xl font-bold text-red-600">
                  {analytics.cancelled.count}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
