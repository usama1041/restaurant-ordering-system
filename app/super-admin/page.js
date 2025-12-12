'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    restaurantName: '',
    restaurantPhone: '',
    restaurantEmail: '',
    restaurantAddress: '',
    ownerEmail: '',
    ownerPassword: ''
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const response = await fetch('/api/auth/session', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        router.push('/login');
        return;
      }

      const data = await response.json();
      
      if (data.user.role !== 'super_admin') {
        router.push('/dashboard');
        return;
      }

      setUser(data.user);
      await loadData();
    } catch (error) {
      console.error('Auth failed:', error);
      router.push('/login');
    }
  };

  const loadData = async () => {
    const token = localStorage.getItem('authToken');
    try {
      const [restaurantsRes, analyticsRes] = await Promise.all([
        fetch('/api/super-admin/restaurants', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/super-admin/analytics', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (restaurantsRes.ok) {
        const restaurantsData = await restaurantsRes.json();
        setRestaurants(restaurantsData.data || []);
      }

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRestaurant = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('authToken');

    try {
      const response = await fetch('/api/super-admin/restaurants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowCreateModal(false);
        setFormData({
          restaurantName: '',
          restaurantPhone: '',
          restaurantEmail: '',
          restaurantAddress: '',
          ownerEmail: '',
          ownerPassword: ''
        });
        await loadData();
      } else {
        const error = await response.json();
        alert('Failed to create restaurant: ' + error.error);
      }
    } catch (error) {
      console.error('Failed to create restaurant:', error);
      alert('Failed to create restaurant');
    }
  };

  const handleDeleteRestaurant = async (restaurantId) => {
    if (!confirm('Are you sure you want to delete this restaurant? This action cannot be undone.')) {
      return;
    }

    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(`/api/super-admin/restaurants/${restaurantId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await loadData();
      } else {
        alert('Failed to delete restaurant');
      }
    } catch (error) {
      console.error('Failed to delete restaurant:', error);
      alert('Failed to delete restaurant');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
            <p className="text-sm text-gray-600">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-sm font-medium text-gray-600 uppercase">Total Restaurants</h3>
            <p className="text-4xl font-bold text-blue-600 mt-2">
              {restaurants.filter(r => !r.isSystemRestaurant).length}
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-sm font-medium text-gray-600 uppercase">Total Orders</h3>
            <p className="text-4xl font-bold text-green-600 mt-2">{analytics?.totalOrders || 0}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-sm font-medium text-gray-600 uppercase">Total Revenue</h3>
            <p className="text-4xl font-bold text-purple-600 mt-2">
              £{analytics?.totalRevenue?.toFixed(2) || '0.00'}
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-sm font-medium text-gray-600 uppercase">Online Now</h3>
            <p className="text-4xl font-bold text-orange-600 mt-2">
              {restaurants.filter(r => r.isOnline && !r.isSystemRestaurant).length}
            </p>
          </div>
        </div>

        {/* Restaurants Management */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Restaurants</h2>
              <p className="text-gray-600">Manage all restaurant accounts</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              + Add Restaurant
            </button>
          </div>
          
          <div className="p-6">
            {restaurants.filter(r => !r.isSystemRestaurant).length === 0 ? (
              <p className="text-center text-gray-500 py-8">No restaurants yet. Create your first one!</p>
            ) : (
              <div className="space-y-4">
                {restaurants.filter(r => !r.isSystemRestaurant).map((restaurant) => (
                  <div
                    key={restaurant._id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{restaurant.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          restaurant.isOnline 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {restaurant.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{restaurant.email}</p>
                      <p className="text-sm text-gray-500">{restaurant.phone}</p>
                      <div className="flex gap-4 mt-2 text-sm">
                        <span className="text-gray-600">
                          <strong>{restaurant.stats?.totalOrders || 0}</strong> orders
                        </span>
                        <span className="text-gray-600">
                          <strong>£{restaurant.stats?.totalRevenue?.toFixed(2) || '0.00'}</strong> revenue
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteRestaurant(restaurant._id)}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Create Restaurant Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold mb-4">Create New Restaurant</h3>
              <form onSubmit={handleCreateRestaurant} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Restaurant Name</label>
                  <input
                    type="text"
                    required
                    value={formData.restaurantName}
                    onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Restaurant Email</label>
                  <input
                    type="email"
                    required
                    value={formData.restaurantEmail}
                    onChange={(e) => setFormData({ ...formData, restaurantEmail: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Restaurant Phone</label>
                  <input
                    type="tel"
                    required
                    value={formData.restaurantPhone}
                    onChange={(e) => setFormData({ ...formData, restaurantPhone: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Restaurant Address</label>
                  <input
                    type="text"
                    required
                    value={formData.restaurantAddress}
                    onChange={(e) => setFormData({ ...formData, restaurantAddress: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Owner Account</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">Owner Email (Login)</label>
                      <input
                        type="email"
                        required
                        value={formData.ownerEmail}
                        onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Owner Password</label>
                      <input
                        type="password"
                        required
                        value={formData.ownerPassword}
                        onChange={(e) => setFormData({ ...formData, ownerPassword: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
