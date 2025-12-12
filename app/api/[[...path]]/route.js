Perfect! Now the most important file - the **API routes** that handle all backend logic.

---

## **FILE 11: app/api/[[...path]]/route.js**

**Filename:** `app/api/[[...path]]/route.js`

This is a large file - copy it carefully:

```javascript
import { MongoClient } from 'mongodb';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

const uri = process.env.MONGO_URL || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function connectDB() {
  if (!client.topology || !client.topology.isConnected()) {
    await client.connect();
  }
  return client.db('restaurant_system');
}

async function verifyAuth(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) throw new Error('No auth token');
  
  const token = authHeader.replace('Bearer ', '');
  const db = await connectDB();
  const session = await db.collection('sessions').findOne({ token });
  if (!session) throw new Error('Invalid token');
  
  const user = await db.collection('users').findOne({ _id: session.userId });
  if (!user) throw new Error('User not found');
  
  return user;
}

function getRestaurantContext(user) {
  if (user.role === 'super_admin') return null;
  return user.restaurantId;
}

export async function GET(request) {
  const db = await connectDB();
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', '');

  try {
    // Public health check
    if (path === 'health') {
      return NextResponse.json({ status: 'ok' });
    }

    // Auth session check
    if (path === 'auth/session') {
      const user = await verifyAuth(request);
      return NextResponse.json({ success: true, user });
    }

    // All other routes require authentication
    const user = await verifyAuth(request);
    const restaurantId = getRestaurantContext(user);

    // Get menu categories
    if (path === 'menu/categories') {
      const categories = await db.collection('menuCategories')
        .find({ ...(restaurantId && { restaurantId }) })
        .sort({ displayOrder: 1 })
        .toArray();
      return NextResponse.json({ success: true, data: categories });
    }

    // Get menu items
    if (path === 'menu/items') {
      const items = await db.collection('menuItems')
        .find({ ...(restaurantId && { restaurantId }) })
        .toArray();
      return NextResponse.json({ success: true, data: items });
    }

    // Get orders
    if (path === 'orders') {
      const orders = await db.collection('orders')
        .find({ ...(restaurantId && { restaurantId }) })
        .sort({ createdAt: -1 })
        .toArray();
      return NextResponse.json({ success: true, data: orders });
    }

    // Sales analytics
    if (path === 'sales/analytics') {
      const orders = await db.collection('orders')
        .find({ ...(restaurantId && { restaurantId }) })
        .toArray();
      
      const completed = orders.filter(o => o.orderStatus === 'completed');
      const cancelled = orders.filter(o => o.orderStatus === 'cancelled');
      const pending = orders.filter(o => o.orderStatus === 'pending');
      
      const completedRevenue = completed.reduce((sum, o) => sum + (o.total || 0), 0);
      const cancelledRevenue = cancelled.reduce((sum, o) => sum + (o.total || 0), 0);
      
      // Time-based stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayCompleted = completed.filter(o => new Date(o.createdAt) >= today);
      const todayRevenue = todayCompleted.reduce((sum, o) => sum + (o.total || 0), 0);
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekCompleted = completed.filter(o => new Date(o.createdAt) >= weekAgo);
      const weekRevenue = weekCompleted.reduce((sum, o) => sum + (o.total || 0), 0);
      
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const monthCompleted = completed.filter(o => new Date(o.createdAt) >= monthAgo);
      const monthRevenue = monthCompleted.reduce((sum, o) => sum + (o.total || 0), 0);
      
      return NextResponse.json({
        success: true,
        data: {
          totalOrders: orders.length,
          completed: { count: completed.length, revenue: completedRevenue },
          cancelled: { count: cancelled.length, revenue: cancelledRevenue },
          pending: { count: pending.length },
          today: { orders: todayCompleted.length, revenue: todayRevenue },
          week: { orders: weekCompleted.length, revenue: weekRevenue },
          month: { orders: monthCompleted.length, revenue: monthRevenue }
        }
      });
    }

    // Super admin routes
    if (path === 'super-admin/restaurants') {
      if (user.role !== 'super_admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      const restaurants = await db.collection('restaurants').find({}).toArray();
      
      // Get stats for each
      for (let restaurant of restaurants) {
        const orders = await db.collection('orders').find({ restaurantId: restaurant._id }).toArray();
        const completedOrders = orders.filter(o => o.orderStatus === 'completed');
        restaurant.stats = {
          totalOrders: orders.length,
          totalRevenue: completedOrders.reduce((sum, o) => sum + (o.total || 0), 0)
        };
      }
      
      return NextResponse.json({ success: true, data: restaurants });
    }

    if (path === 'super-admin/analytics') {
      if (user.role !== 'super_admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      
      const orders = await db.collection('orders').find({}).toArray();
      const completed = orders.filter(o => o.orderStatus === 'completed');
      const cancelled = orders.filter(o => o.orderStatus === 'cancelled');
      const pending = orders.filter(o => o.orderStatus === 'pending');
      
      return NextResponse.json({
        success: true,
        data: {
          totalOrders: orders.length,
          completedOrders: completed.length,
          cancelledOrders: cancelled.length,
          pendingOrders: pending.length,
          totalRevenue: completed.reduce((sum, o) => sum + (o.total || 0), 0),
          completedRevenue: completed.reduce((sum, o) => sum + (o.total || 0), 0),
          cancelledRevenue: cancelled.reduce((sum, o) => sum + (o.total || 0), 0)
        }
      });
    }

    return NextResponse.json({ error: 'Route not found' }, { status: 404 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const db = await connectDB();
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', '');
  const body = await request.json();

  try {
    // Login
    if (path === 'auth/login') {
      const { email, password } = body;
      const user = await db.collection('users').findOne({ email, password });
      
      if (!user) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      const token = uuidv4();
      await db.collection('sessions').insertOne({
        _id: uuidv4(),
        token,
        userId: user._id,
        createdAt: new Date()
      });

      // Mark restaurant online
      if (user.restaurantId && user.role === 'restaurant_owner') {
        await db.collection('restaurants').updateOne(
          { _id: user.restaurantId },
          { $set: { isOnline: true, lastLoginAt: new Date() } }
        );
      }

      return NextResponse.json({ success: true, token, user });
    }

    // Vapi webhook
    if (path === 'vapi/tools') {
      const { message, call } = body;
      const toolCall = message?.toolCalls?.[0];
      
      if (!toolCall) {
        return NextResponse.json({ error: 'No tool call' }, { status: 400 });
      }

      const functionName = toolCall.function?.name;
      
      if (functionName === 'get_menu') {
        const restaurant = await db.collection('restaurants')
          .findOne({ vapiPhoneNumberId: call?.phoneNumberId });
        
        const items = await db.collection('menuItems')
          .find({ restaurantId: restaurant?._id })
          .toArray();
        
        return NextResponse.json({
          results: [{
            toolCallId: toolCall.id,
            result: { success: true, menu: items }
          }]
        });
      }

      if (functionName === 'create_order') {
        const args = JSON.parse(toolCall.function.arguments);
        const restaurant = await db.collection('restaurants')
          .findOne({ vapiPhoneNumberId: call?.phoneNumberId });
        
        const subtotal = args.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * 0.08;
        const deliveryFee = args.orderType === 'delivery' ? 5.00 : 0;
        const total = subtotal + tax + deliveryFee;
        
        const order = {
          _id: uuidv4(),
          restaurantId: restaurant?._id,
          orderNumber: `PHONE-${Date.now()}`,
          customerName: args.customerName,
          customerPhone: args.customerPhone,
          deliveryAddress: args.address || '',
          orderType: args.orderType,
          items: args.items,
          subtotal,
          tax,
          deliveryFee,
          total,
          paymentMethod: 'card',
          paymentStatus: 'pending',
          orderStatus: 'pending',
          source: 'phone',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await db.collection('orders').insertOne(order);
        
        return NextResponse.json({
          results: [{
            toolCallId: toolCall.id,
            result: { success: true, orderId: order._id, total }
          }]
        });
      }
    }

    // Create menu item
    if (path === 'menu/items') {
      const user = await verifyAuth(request);
      const restaurantId = getRestaurantContext(user);
      
      const item = {
        _id: uuidv4(),
        restaurantId,
        ...body,
        createdAt: new Date()
      };
      
      await db.collection('menuItems').insertOne(item);
      return NextResponse.json({ success: true, data: item });
    }

    // Create restaurant (super admin)
    if (path === 'super-admin/restaurants') {
      const user = await verifyAuth(request);
      if (user.role !== 'super_admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      const { restaurantName, restaurantEmail, restaurantPhone, restaurantAddress, ownerEmail, ownerPassword } = body;

      const restaurantId = uuidv4();
      const restaurant = {
        _id: restaurantId,
        name: restaurantName,
        email: restaurantEmail,
        phone: restaurantPhone,
        address: restaurantAddress,
        isOnline: false,
        createdAt: new Date()
      };

      await db.collection('restaurants').insertOne(restaurant);

      const owner = {
        _id: uuidv4(),
        email: ownerEmail,
        password: ownerPassword,
        role: 'restaurant_owner',
        restaurantId,
        createdAt: new Date()
      };

      await db.collection('users').insertOne(owner);

      return NextResponse.json({ success: true, data: { restaurant, owner } });
    }

    return NextResponse.json({ error: 'Route not found' }, { status: 404 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const db = await connectDB();
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', '');
  const body = await request.json();

  try {
    const user = await verifyAuth(request);
    const restaurantId = getRestaurantContext(user);

    // Update order status
    if (path.match(/\/orders\/[^\/]+\/status/)) {
      const id = path.split('/')[2];
      const { status } = body;
      
      await db.collection('orders').updateOne(
        { _id: id, ...(restaurantId && { restaurantId }) },
        { $set: { orderStatus: status, updatedAt: new Date() } }
      );
      
      const order = await db.collection('orders').findOne({ _id: id });
      return NextResponse.json({ success: true, data: order });
    }

    // Update menu item
    if (path.match(/\/menu\/items\/[^\/]+/)) {
      const id = path.split('/').pop();
      
      await db.collection('menuItems').updateOne(
        { _id: id, ...(restaurantId && { restaurantId }) },
        { $set: { ...body, updatedAt: new Date() } }
      );
      
      const item = await db.collection('menuItems').findOne({ _id: id });
      return NextResponse.json({ success: true, data: item });
    }

    return NextResponse.json({ error: 'Route not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const db = await connectDB();
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', '');

  try {
    const user = await verifyAuth(request);
    const restaurantId = getRestaurantContext(user);

    // Delete menu item
    if (path.match(/\/menu\/items\/[^\/]+/)) {
      const id = path.split('/').pop();
      await db.collection('menuItems').deleteOne({ _id: id, ...(restaurantId && { restaurantId }) });
      return NextResponse.json({ success: true });
    }

    // Delete restaurant (super admin)
    if (path.match(/\/super-admin\/restaurants\/[^\/]+/)) {
      if (user.role !== 'super_admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      const restaurantIdToDelete = path.split('/').pop();
      
      await db.collection('menuItems').deleteMany({ restaurantId: restaurantIdToDelete });
      await db.collection('orders').deleteMany({ restaurantId: restaurantIdToDelete });
      await db.collection('users').deleteMany({ restaurantId: restaurantIdToDelete });
      await db.collection('restaurants').deleteOne({ _id: restaurantIdToDelete });
      
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Route not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


**Create this file, then say "done" and I'll give you the remaining dashboard pages!** 🚀
