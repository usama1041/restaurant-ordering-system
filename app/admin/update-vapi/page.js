'use client';

import { useState } from 'react';

export default function UpdateVapiPage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const updateVapiNumber = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/admin/update-vapi-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          restaurantName: 'Pizza Palace',
          vapiPhoneNumber: '+12075075278',
          vapiPhoneNumberId: 'f11dcbc-d543-404f-8da5-e534f468668'
        })
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">Update Vapi Phone Number</h1>
        
        <div className="mb-6 space-y-2 text-sm text-gray-600">
          <p><strong>Restaurant:</strong> Pizza Palace</p>
          <p><strong>Phone:</strong> +1 (207) 507-5278</p>
          <p><strong>Phone ID:</strong> f11dcbc-d543-404f-8da5-e534f468668</p>
        </div>
        
        <button
          onClick={updateVapiNumber}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Updating...' : 'Update Vapi Number'}
        </button>
        
        {result && (
          <div className={`mt-6 p-4 rounded-lg ${
            result.success 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <h3 className={`font-semibold mb-2 ${
              result.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {result.success ? '✅ Success!' : '❌ Error'}
            </h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
