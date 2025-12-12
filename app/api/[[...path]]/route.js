import { MongoClient } from 'mongodb';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

const uri = process.env.MONGO_URL;
let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient;
  }
  const client = new MongoClient(uri);
  await client.connect();
  cachedClient = client;
  return client;
}

// Mocked Stripe Payment Link Generation
function mockStripePaymentLink(orderId, amount) {
  const mockUrl = `https://checkout.stripe.com/pay/mock_${orderId}`;
  return {
    url: mockUrl,
    id: `plink_mock_${uuidv4()}`,
    amount: amount,
    status: 'active'
  };
}

// Mocked SMS Sending
function mockSendSMS(phone, message) {
  console.log(`[MOCKED SMS] To: ${phone}`);
  console.log(`[MOCKED SMS] Message: ${message}`);
  return {
    sid: `SM${uuidv4()}`,
    status: 'sent',
    to: phone,
    mocked: true
  };
}

// Mocked Print Job
function mockPrintOrder(orderId) {
  console.log(`[MOCKED PRINT] Printing order: ${orderId}`);
  return {
    success: true,
    printJobId: uuidv4(),
    mocked: true
  };
}

// Helper function to verify authentication
async function verifyAuth(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  
  const client = await connectToDatabase();
  const db = client.db('restaurant_system');
  const session = await db.collection('sessions').findOne({ token });
  
  if (!session) return null;
  
  const user = await db.collection('users').findOne({ _id: session.userId });
  return user;
}

// Helper to get restaurant context
function getRestaurantContext(user) {
  if (user.role === 'super_admin') {
    return null; // Can access all
  }
  return user.restaurantId;
}

// Check if restaurant is in busy mode
function isInBusyMode(restaurant) {
  // Manual override
  if (restaurant.busyModeEnabled) {
    return true;
  }
  
  // Check scheduled busy hours
  if (!restaurant.busyHours || restaurant.busyHours.length === 0) {
    return false;
  }
  
  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const todayHours = restaurant.busyHours.find(h => h.day.toLowerCase() === currentDay);
  
  if (!todayHours || !todayHours.enabled) {
    return false;
  }
  
  return currentTime >= todayHours.start && currentTime <= todayHours.end;
}

export async function GET(request) {
  const { pathname, searchParams } = new URL(request.url);
  const path = pathname.replace('/api', '');

  try {
    const client = await connectToDatabase();
    const db = client.db('restaurant_system');

    // Auth endpoints
    if (path === '/auth/session') {
      const user = await verifyAuth(request);
      if (!user) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }
      
      // Get restaurant details if user has one
      let restaurantData = null;
      if (user.restaurantId) {
        restaurantData = await db.collection('restaurants').findOne({ _id: user.restaurantId });
      }
      
      return NextResponse.json({ 
        authenticated: true, 
        user: { 
          id: user._id, 
          email: user.email, 
          role: user.role,
          restaurantId: user.restaurantId,
          restaurantName: restaurantData?.name
        } 
      });
    }

    // Menu Categories
    if (path === '/menu/categories') {
      const user = await verifyAuth(request);
      const restaurantId = getRestaurantContext(user);
      const query = restaurantId ? { restaurantId } : {};
      
      const categories = await db.collection('menuCategories')
        .find(query)
        .sort({ displayOrder: 1 })
        .toArray();
      return NextResponse.json({ success: true, data: categories });
    }

    // Menu Items
    if (path === '/menu/items') {
      const user = await verifyAuth(request);
      const restaurantId = searchParams.get('restaurantId') || getRestaurantContext(user);
      const categoryId = searchParams.get('categoryId');
      
      const query = {};
      if (restaurantId) query.restaurantId = restaurantId;
      if (categoryId) query.categoryId = categoryId;
      
      const items = await db.collection('menuItems')
        .find(query)
        .sort({ name: 1 })
        .toArray();
      return NextResponse.json({ success: true, data: items });
    }

    // Get single menu item
    if (path.startsWith('/menu/items/')) {
      const id = path.split('/').pop();
      const item = await db.collection('menuItems').findOne({ _id: id });
      if (!item) {
        return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: item });
    }

    // Orders
    if (path === '/orders') {
      const user = await verifyAuth(request);
      const restaurantId = getRestaurantContext(user);
      
      const status = searchParams.get('status');
      const date = searchParams.get('date');
      const query = {};
      
      if (restaurantId) query.restaurantId = restaurantId;
      if (status) query.orderStatus = status;
      if (date) {
        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);
        query.createdAt = { $gte: startDate, $lt: endDate };
      }
      
      const orders = await db.collection('orders')
        .find(query)
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();
      
      return NextResponse.json({ success: true, data: orders });
    }

    // Get single order
    if (path.startsWith('/orders/')) {
      const id = path.split('/').pop();
      const order = await db.collection('orders').findOne({ _id: id });
      if (!order) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: order });
    }

    // Analytics
    if (path === '/analytics/summary') {
      const user = await verifyAuth(request);
      const restaurantId = getRestaurantContext(user);
      const query = restaurantId ? { restaurantId } : {};
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayOrders = await db.collection('orders')
        .find({ ...query, createdAt: { $gte: today } })
        .toArray();
      
      const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      const todayCount = todayOrders.length;
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekOrders = await db.collection('orders')
        .find({ ...query, createdAt: { $gte: weekAgo } })
        .toArray();
      
      const weekRevenue = weekOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      
      const allOrders = await db.collection('orders').find(query).toArray();
      const itemCounts = {};
      allOrders.forEach(order => {
        order.items?.forEach(item => {
          itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
        });
      });
      
      const popularItems = Object.entries(itemCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      return NextResponse.json({
        success: true,
        data: {
          today: { revenue: todayRevenue, orders: todayCount },
          week: { revenue: weekRevenue, orders: weekOrders.length },
          popularItems,
          totalOrders: allOrders.length
        }
      });
    }

    // Restaurant Settings
    if (path === '/settings') {
      const user = await verifyAuth(request);
      const restaurantId = getRestaurantContext(user);
      
      if (!restaurantId) {
        return NextResponse.json({ success: false, error: 'No restaurant context' }, { status: 400 });
      }
      
      const settings = await db.collection('restaurants').findOne({ _id: restaurantId });
      if (!settings) {
        return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
      }
      
      return NextResponse.json({ success: true, data: settings });
    }

    // Get Restaurant Status (for dashboard widget)
    if (path === '/restaurant/status') {
      const user = await verifyAuth(request);
      const restaurantId = getRestaurantContext(user);
      
      if (!restaurantId) {
        return NextResponse.json({ success: false, error: 'No restaurant context' }, { status: 400 });
      }
      
      const restaurant = await db.collection('restaurants').findOne({ _id: restaurantId });
      if (!restaurant) {
        return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
      }
      
      const busyMode = isInBusyMode(restaurant);
      
      return NextResponse.json({
        success: true,
        data: {
          busyModeEnabled: restaurant.busyModeEnabled || false,
          aiEnabled: restaurant.aiEnabled !== false,
          inBusyPeriod: busyMode,
          twilioForwardNumber: restaurant.twilioForwardNumber,
          hasForwardingSetup: !!restaurant.forwardingSetup
        }
      });
    }

    // Super Admin: Get All Restaurants
    if (path === '/super-admin/restaurants') {
      const user = await verifyAuth(request);
      if (user.role !== 'super_admin') {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
      }

      const restaurants = await db.collection('restaurants').find({}).toArray();
      
      // Get stats for each restaurant
      for (let restaurant of restaurants) {
        const orders = await db.collection('orders').find({ restaurantId: restaurant._id }).toArray();
        const completedOrders = orders.filter(o => o.orderStatus === 'completed');
        const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
        
        restaurant.stats = {
          totalOrders: orders.length,
          totalRevenue: totalRevenue
        };
      }
      
      return NextResponse.json({ success: true, data: restaurants });
    }

    // Super Admin: Get Analytics
    if (path === '/super-admin/analytics') {
      const user = await verifyAuth(request);
      if (user.role !== 'super_admin') {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
      }

      const orders = await db.collection('orders').find({}).toArray();
      
      const completedOrders = orders.filter(o => o.orderStatus === 'completed');
      const cancelledOrders = orders.filter(o => o.orderStatus === 'cancelled');
      const pendingOrders = orders.filter(o => o.orderStatus === 'pending');
      
      const completedRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const cancelledRevenue = cancelledOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const totalRevenue = completedRevenue;
      
      return NextResponse.json({
        success: true,
        data: {
          totalOrders: orders.length,
          completedOrders: completedOrders.length,
          cancelledOrders: cancelledOrders.length,
          pendingOrders: pendingOrders.length,
          totalRevenue,
          completedRevenue,
          cancelledRevenue
        }
      });
    }

    // Restaurant Sales Analytics
    if (path === '/sales/analytics') {
      const user = await verifyAuth(request);
      const restaurantId = getRestaurantContext(user);
      
      if (!restaurantId) {
        return NextResponse.json({ success: false, error: 'No restaurant context' }, { status: 400 });
      }

      const orders = await db.collection('orders').find({ restaurantId }).toArray();
      
      const completedOrders = orders.filter(o => o.orderStatus === 'completed');
      const cancelledOrders = orders.filter(o => o.orderStatus === 'cancelled');
      const pendingOrders = orders.filter(o => o.orderStatus === 'pending');
      
      const completedRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const cancelledRevenue = cancelledOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      
      // Calculate today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = orders.filter(o => new Date(o.createdAt) >= today);
      const todayCompleted = todayOrders.filter(o => o.orderStatus === 'completed');
      const todayRevenue = todayCompleted.reduce((sum, o) => sum + (o.total || 0), 0);
      
      // Calculate week's stats
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekOrders = orders.filter(o => new Date(o.createdAt) >= weekAgo);
      const weekCompleted = weekOrders.filter(o => o.orderStatus === 'completed');
      const weekRevenue = weekCompleted.reduce((sum, o) => sum + (o.total || 0), 0);
      
      // Calculate month's stats
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const monthOrders = orders.filter(o => new Date(o.createdAt) >= monthAgo);
      const monthCompleted = monthOrders.filter(o => o.orderStatus === 'completed');
      const monthRevenue = monthCompleted.reduce((sum, o) => sum + (o.total || 0), 0);
      
      return NextResponse.json({
        success: true,
        data: {
          totalOrders: orders.length,
          completed: {
            count: completedOrders.length,
            revenue: completedRevenue
          },
          cancelled: {
            count: cancelledOrders.length,
            revenue: cancelledRevenue
          },
          pending: {
            count: pendingOrders.length
          },
          today: {
            orders: todayCompleted.length,
            revenue: todayRevenue
          },
          week: {
            orders: weekCompleted.length,
            revenue: weekRevenue
          },
          month: {
            orders: monthCompleted.length,
            revenue: monthRevenue
          }
        }
      });
    }

    return NextResponse.json({ error: 'Route not found' }, { status: 404 });

  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { pathname } = new URL(request.url);
  const path = pathname.replace('/api', '');

  try {
    const body = await request.json();
    const client = await connectToDatabase();
    const db = client.db('restaurant_system');

    // Auth - Login
    if (path === '/auth/login') {
      const { email, password } = body;
      
      let user = await db.collection('users').findOne({ email });
      
      if (!user) {
        const userCount = await db.collection('users').countDocuments();
        if (userCount === 0) {
          user = {
            _id: uuidv4(),
            email,
            password,
            role: 'super_admin',
            createdAt: new Date()
          };
          await db.collection('users').insertOne(user);
        } else {
          return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
        }
      }
      
      if (user.password !== password) {
        return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
      }
      
      const token = uuidv4();
      await db.collection('sessions').insertOne({
        _id: uuidv4(),
        token,
        userId: user._id,
        createdAt: new Date()
      });
      
      let restaurantData = null;
      if (user.restaurantId) {
        restaurantData = await db.collection('restaurants').findOne({ _id: user.restaurantId });
        
        // Mark restaurant as online
        if (user.role === 'restaurant_owner' && !restaurantData?.isSystemRestaurant) {
          await db.collection('restaurants').updateOne(
            { _id: user.restaurantId },
            { 
              $set: { 
                isOnline: true,
                lastLoginAt: new Date()
              } 
            }
          );
        }
      }
      
      return NextResponse.json({
        success: true,
        token,
        user: { 
          id: user._id, 
          email: user.email, 
          role: user.role,
          restaurantId: user.restaurantId,
          restaurantName: restaurantData?.name
        }
      });
    }

    // Auth - Logout
    if (path === '/auth/logout') {
      const authHeader = request.headers.get('authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const session = await db.collection('sessions').findOne({ token });
        
        if (session) {
          const user = await db.collection('users').findOne({ _id: session.userId });
          
          // Mark restaurant as offline
          if (user && user.restaurantId && user.role === 'restaurant_owner') {
            await db.collection('restaurants').updateOne(
              { _id: user.restaurantId },
              { 
                $set: { 
                  isOnline: false,
                  lastLogoutAt: new Date()
                } 
              }
            );
          }
        }
        
        await db.collection('sessions').deleteOne({ token });
      }
      return NextResponse.json({ success: true });
    }

    // Toggle Busy Mode
    if (path === '/restaurant/toggle-busy-mode') {
      const user = await verifyAuth(request);
      const restaurantId = getRestaurantContext(user);
      
      if (!restaurantId) {
        return NextResponse.json({ success: false, error: 'No restaurant context' }, { status: 400 });
      }
      
      const { enabled } = body;
      
      await db.collection('restaurants').updateOne(
        { _id: restaurantId },
        { 
          $set: { 
            busyModeEnabled: enabled,
            busyModeUpdatedAt: new Date()
          } 
        }
      );
      
      console.log(`[BUSY MODE] Restaurant ${restaurantId} busy mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
      
      return NextResponse.json({ 
        success: true, 
        data: { busyModeEnabled: enabled }
      });
    }

    // Twilio Voice Webhook (Call Routing)
    if (path === '/twilio/voice') {
      const { To, From, CallSid } = body;
      
      console.log(`[TWILIO CALL] From: ${From}, To: ${To}, CallSid: ${CallSid}`);
      
      // Find restaurant by Twilio forwarding number
      const restaurant = await db.collection('restaurants')
        .findOne({ twilioForwardNumber: To });
      
      if (!restaurant) {
        console.error(`[TWILIO] No restaurant found for number: ${To}`);
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say>Sorry, this restaurant is not configured yet.</Say>
          </Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        );
      }
      
      // Check if should use AI
      const useAI = restaurant.aiEnabled !== false && isInBusyMode(restaurant);
      
      console.log(`[ROUTING] Restaurant: ${restaurant.name}, Use AI: ${useAI}`);
      
      if (useAI) {
        // Route to Vapi AI (mocked for now)
        console.log(`[AI ROUTING] Connecting to Vapi AI for restaurant ${restaurant._id}`);
        
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say>Thank you for calling ${restaurant.name}. Connecting you to our AI assistant.</Say>
            <Pause length="1"/>
            <Say>This is a mocked AI response. In production, Vapi AI would handle this call.</Say>
          </Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        );
      } else {
        // Forward to staff phone
        const staffPhone = restaurant.staffPhone || restaurant.phone;
        console.log(`[STAFF ROUTING] Forwarding to staff: ${staffPhone}`);
        
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Dial timeout="20" action="${process.env.NEXT_PUBLIC_BASE_URL}/api/twilio/voice-fallback">
              <Number>${staffPhone}</Number>
            </Dial>
          </Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        );
      }
    }

    // Twilio Voice Fallback (if staff doesn't answer)
    if (path === '/twilio/voice-fallback') {
      console.log('[FALLBACK] Staff did not answer, routing to AI');
      
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>Our staff is currently busy. Connecting you to our AI assistant.</Say>
          <Pause length="1"/>
          <Say>This is a mocked AI response. In production, Vapi AI would handle this call.</Say>
        </Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Super Admin: Create Restaurant
    if (path === '/super-admin/restaurants') {
      const user = await verifyAuth(request);
      if (user.role !== 'super_admin') {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
      }

      const { restaurantName, restaurantPhone, restaurantEmail, restaurantAddress, ownerEmail, ownerPassword } = body;

      // Check if email already exists
      const existingUser = await db.collection('users').findOne({ email: ownerEmail });
      if (existingUser) {
        return NextResponse.json({ success: false, error: 'Email already in use' }, { status: 400 });
      }

      // Create restaurant
      const restaurantId = uuidv4();
      const restaurant = {
        _id: restaurantId,
        name: restaurantName,
        phone: restaurantPhone,
        email: restaurantEmail,
        address: restaurantAddress,
        taxRate: 0.08,
        deliveryFee: 5.00,
        minimumOrder: 10.00,
        isOnline: false,
        busyModeEnabled: false,
        operatingHours: {
          monday: { open: '09:00', close: '22:00', closed: false },
          tuesday: { open: '09:00', close: '22:00', closed: false },
          wednesday: { open: '09:00', close: '22:00', closed: false },
          thursday: { open: '09:00', close: '22:00', closed: false },
          friday: { open: '09:00', close: '23:00', closed: false },
          saturday: { open: '09:00', close: '23:00', closed: false },
          sunday: { open: '10:00', close: '21:00', closed: false }
        },
        createdAt: new Date()
      };

      await db.collection('restaurants').insertOne(restaurant);

      // Create owner user
      const ownerId = uuidv4();
      const owner = {
        _id: ownerId,
        email: ownerEmail,
        password: ownerPassword, // In production, hash this!
        role: 'restaurant_owner',
        restaurantId: restaurantId,
        createdAt: new Date()
      };

      await db.collection('users').insertOne(owner);

      console.log(`[SUPER ADMIN] Created restaurant ${restaurantName} with owner ${ownerEmail}`);

      return NextResponse.json({ 
        success: true, 
        data: { restaurant, owner: { id: ownerId, email: ownerEmail } }
      });
    }

    // Menu Categories
    if (path === '/menu/categories') {
      const user = await verifyAuth(request);
      const restaurantId = getRestaurantContext(user);
      
      const category = {
        _id: uuidv4(),
        restaurantId,
        name: body.name,
        displayOrder: body.displayOrder || 0,
        createdAt: new Date()
      };
      await db.collection('menuCategories').insertOne(category);
      return NextResponse.json({ success: true, data: category });
    }

    // Menu Items
    if (path === '/menu/items') {
      const user = await verifyAuth(request);
      const restaurantId = getRestaurantContext(user);
      
      const item = {
        _id: uuidv4(),
        restaurantId,
        categoryId: body.categoryId,
        name: body.name,
        description: body.description || '',
        price: parseFloat(body.price),
        imageUrl: body.imageUrl || '',
        available: body.available !== false,
        customizations: body.customizations || [],
        createdAt: new Date()
      };
      await db.collection('menuItems').insertOne(item);
      return NextResponse.json({ success: true, data: item });
    }

    // Create Order
    if (path === '/orders') {
      const user = await verifyAuth(request);
      const restaurantId = body.restaurantId || getRestaurantContext(user);
      
      const orderNumber = `ORD-${Date.now()}`;
      const order = {
        _id: uuidv4(),
        restaurantId,
        orderNumber,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        deliveryAddress: body.deliveryAddress || '',
        orderType: body.orderType || 'delivery',
        items: body.items,
        subtotal: parseFloat(body.subtotal),
        tax: parseFloat(body.tax),
        deliveryFee: parseFloat(body.deliveryFee || 0),
        total: parseFloat(body.total),
        paymentMethod: body.paymentMethod || 'card',
        paymentStatus: 'pending',
        orderStatus: 'new',
        notes: body.notes || '',
        source: body.source || 'dashboard',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.collection('orders').insertOne(order);
      
      if (order.paymentMethod === 'card') {
        const paymentLink = mockStripePaymentLink(order._id, order.total);
        const smsResult = mockSendSMS(
          order.customerPhone,
          `Hi ${order.customerName}! Complete your order payment: ${paymentLink.url}`
        );
        
        await db.collection('orders').updateOne(
          { _id: order._id },
          { $set: { paymentLinkUrl: paymentLink.url, paymentLinkId: paymentLink.id } }
        );
        
        return NextResponse.json({
          success: true,
          data: order,
          paymentLink: paymentLink.url,
          smsStatus: smsResult,
          mocked: true
        });
      }
      
      return NextResponse.json({ success: true, data: order });
    }

    // Vapi Tools Webhook Handler
    if (path === '/vapi/tools') {
      console.log('[VAPI TOOLS] Received webhook:', JSON.stringify(body, null, 2));
      
      const { message, call } = body;
      const toolCall = message?.toolCalls?.[0];
      
      // Detect restaurant from call metadata or use default
      let restaurantId = 'rest_001'; // Default
      
      // Option 1: From tool arguments
      if (toolCall?.function?.arguments?.restaurantId) {
        restaurantId = toolCall.function.arguments.restaurantId;
      }
      // Option 2: From call customer number (phone number called)
      else if (call?.phoneNumberId) {
        // Look up restaurant by Vapi phone number
        const restaurant = await db.collection('restaurants')
          .findOne({ vapiPhoneNumberId: call.phoneNumberId });
        if (restaurant) {
          restaurantId = restaurant._id;
        }
      }
      
      console.log(`[VAPI] Restaurant detected: ${restaurantId}`);
      
      if (!toolCall) {
        const response = NextResponse.json({
          error: 'No tool call found'
        }, { status: 400 });
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      }
      
      const functionName = toolCall.function?.name;
      const args = toolCall.function?.arguments;
      
      console.log(`[VAPI] Function called: ${functionName}`, args);
      
      // Handle get_menu function
      if (functionName === 'get_menu') {
        // Use detected restaurantId or from arguments
        const menuRestaurantId = args?.restaurantId || restaurantId;
        
        const categories = await db.collection('menuCategories')
          .find({ restaurantId: menuRestaurantId })
          .sort({ displayOrder: 1 })
          .toArray();
        
        const items = await db.collection('menuItems')
          .find({ restaurantId: menuRestaurantId, available: true })
          .toArray();
        
        // Group items by category
        const menuByCategory = categories.map(cat => ({
          category: cat.name,
          items: items
            .filter(item => item.categoryId === cat._id)
            .map(item => ({
              name: item.name,
              description: item.description,
              price: item.price
            }))
        }));
        
        const response = NextResponse.json({
          results: [{
            toolCallId: toolCall.id,
            result: {
              success: true,
              menu: menuByCategory
            }
          }]
        });
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      }
      
      // Handle create_order function
      if (functionName === 'create_order') {
        try {
          // Parse args if it's a string
          let parsedArgs = args;
          if (typeof args === 'string') {
            parsedArgs = JSON.parse(args);
          }
          
          console.log('[VAPI] Parsed arguments:', JSON.stringify(parsedArgs, null, 2));
          
          // Use detected restaurantId or from arguments
          let orderRestaurantId = parsedArgs.restaurantId || restaurantId;
          
          // If still default, try to get Pizza Palace
          if (orderRestaurantId === 'rest_001') {
            const pizzaPalace = await db.collection('restaurants').findOne({ name: 'Pizza Palace' });
            if (pizzaPalace) {
              orderRestaurantId = pizzaPalace._id;
              console.log('[VAPI] Using Pizza Palace as default restaurant:', orderRestaurantId);
            }
          }
          
          // Validate required fields
          if (!parsedArgs.customerName || !parsedArgs.items || !Array.isArray(parsedArgs.items)) {
            throw new Error('Missing required fields: customerName, items');
          }
          
          // Calculate totals
          const subtotal = parsedArgs.items.reduce((sum, item) => 
            sum + (item.price * item.quantity), 0
          );
          
          const restaurant = await db.collection('restaurants').findOne({ _id: orderRestaurantId });
          const tax = subtotal * (restaurant?.taxRate || 0.08);
          const deliveryFee = parsedArgs.orderType === 'delivery' ? (restaurant?.deliveryFee || 5.00) : 0;
          const total = subtotal + tax + deliveryFee;
          
          const order = {
            _id: uuidv4(),
            restaurantId: orderRestaurantId,
            orderNumber: `PHONE-${Date.now()}`,
            customerName: parsedArgs.customerName,
            customerPhone: parsedArgs.customerPhone || 'N/A',
            deliveryAddress: parsedArgs.address || parsedArgs.deliveryAddress || '',
            orderType: parsedArgs.orderType,
            items: parsedArgs.items,
            subtotal,
            tax,
            deliveryFee,
            total,
            paymentMethod: 'card',
            paymentStatus: 'pending',
            orderStatus: 'pending',
            source: 'phone',
            notes: '',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          await db.collection('orders').insertOne(order);
          
          console.log(`[VAPI] Order created successfully: ${order.orderNumber}`);
          
          const response = NextResponse.json({
            results: [{
              toolCallId: toolCall.id,
              result: {
                success: true,
                orderNumber: order.orderNumber,
                total: total.toFixed(2),
                message: `Order placed successfully! Order number ${order.orderNumber}. Total is £${total.toFixed(2)} including tax${deliveryFee > 0 ? ' and delivery' : ''}. You can pay by card or cash.`
              }
            }]
          });
          response.headers.set('Access-Control-Allow-Origin', '*');
          return response;
        } catch (error) {
          console.error('[VAPI] Error creating order:', error);
          const errorResponse = NextResponse.json({
            results: [{
              toolCallId: toolCall.id,
              result: {
                error: `Failed to create order: ${error.message}`
              }
            }]
          });
          errorResponse.headers.set('Access-Control-Allow-Origin', '*');
          return errorResponse;
        }
      }
      
      const errorResponse = NextResponse.json({
        results: [{
          toolCallId: toolCall.id,
          result: {
            error: `Unknown function: ${functionName}`
          }
        }]
      });
      errorResponse.headers.set('Access-Control-Allow-Origin', '*');
      return errorResponse;
    }
    
    // Legacy phone webhook (for demo page)
    if (path === '/phone/webhook') {
      const restaurantId = body.restaurantId;
      console.log('[LEGACY PHONE] Phone call received:', body);
      
      const mockOrder = {
        _id: uuidv4(),
        restaurantId,
        orderNumber: `PHONE-${Date.now()}`,
        customerName: body.customerName || 'Phone Customer',
        customerPhone: body.customerPhone || '+1234567890',
        deliveryAddress: body.address || '123 Test St',
        orderType: body.orderType || 'delivery',
        items: body.items || [
          { name: 'Large Pizza', quantity: 1, price: 15.99 }
        ],
        subtotal: 15.99,
        tax: 1.28,
        deliveryFee: 5.00,
        total: 22.27,
        paymentMethod: 'card',
        paymentStatus: 'pending',
        orderStatus: 'pending',
        source: 'phone',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.collection('orders').insertOne(mockOrder);
      
      return NextResponse.json({
        success: true,
        order: mockOrder,
        mocked: true,
        message: '⚠️ MOCKED: In production, this will receive real Vapi.ai webhooks'
      });
    }

    // Other endpoints (payment, SMS, print) remain the same...
    if (path === '/payment/create-link') {
      const { orderId, amount, customerPhone } = body;
      const paymentLink = mockStripePaymentLink(orderId, amount);
      const smsResult = mockSendSMS(customerPhone, `Payment link: ${paymentLink.url}`);
      
      return NextResponse.json({
        success: true,
        paymentLink: paymentLink.url,
        smsStatus: smsResult,
        mocked: true
      });
    }

    if (path === '/webhooks/stripe') {
      console.log('[MOCKED WEBHOOK] Stripe payment confirmed:', body);
      const orderId = body.orderId || body.metadata?.orderId;
      if (orderId) {
        await db.collection('orders').updateOne(
          { _id: orderId },
          { $set: { paymentStatus: 'paid', orderStatus: 'confirmed', paidAt: new Date(), updatedAt: new Date() } }
        );
        const printResult = mockPrintOrder(orderId);
        await db.collection('printJobs').insertOne({
          _id: uuidv4(),
          orderId,
          status: 'completed',
          printedAt: new Date(),
          mocked: true
        });
      }
      return NextResponse.json({ success: true, mocked: true });
    }

    if (path === '/sms/send') {
      const { phone, message } = body;
      const result = mockSendSMS(phone, message);
      return NextResponse.json({ success: true, data: result, mocked: true });
    }

    if (path === '/print/queue') {
      const { orderId } = body;
      const result = mockPrintOrder(orderId);
      await db.collection('printJobs').insertOne({
        _id: uuidv4(),
        orderId,
        status: 'completed',
        printedAt: new Date(),
        mocked: true
      });
      return NextResponse.json({ success: true, data: result, mocked: true });
    }

    // Admin endpoint to update Vapi phone number
    if (path === '/admin/update-vapi-number') {
      const { restaurantName, vapiPhoneNumber, vapiPhoneNumberId } = body;
      
      if (!restaurantName || !vapiPhoneNumber || !vapiPhoneNumberId) {
        return NextResponse.json({ 
          error: 'Missing required fields: restaurantName, vapiPhoneNumber, vapiPhoneNumberId' 
        }, { status: 400 });
      }
      
      const result = await db.collection('restaurants').updateOne(
        { name: restaurantName },
        {
          $set: {
            vapiPhoneNumber,
            vapiPhoneNumberId,
            updatedAt: new Date()
          }
        }
      );
      
      if (result.matchedCount === 0) {
        return NextResponse.json({ 
          error: `Restaurant "${restaurantName}" not found` 
        }, { status: 404 });
      }
      
      const restaurant = await db.collection('restaurants').findOne({ name: restaurantName });
      
      return NextResponse.json({ 
        success: true, 
        message: `Updated ${restaurantName} with Vapi phone number`,
        restaurant: {
          id: restaurant._id,
          name: restaurant.name,
          vapiPhoneNumber: restaurant.vapiPhoneNumber,
          vapiPhoneNumberId: restaurant.vapiPhoneNumberId
        }
      });
    }

    return NextResponse.json({ error: 'Route not found' }, { status: 404 });

  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const { pathname } = new URL(request.url);
  const path = pathname.replace('/api', '');

  try {
    const body = await request.json();
    const client = await connectToDatabase();
    const db = client.db('restaurant_system');
    const user = await verifyAuth(request);
    const restaurantId = getRestaurantContext(user);

    // Update Menu Category
    if (path.startsWith('/menu/categories/')) {
      const id = path.split('/').pop();
      const update = { $set: { ...body, updatedAt: new Date() } };
      await db.collection('menuCategories').updateOne({ _id: id, ...(restaurantId && { restaurantId }) }, update);
      const category = await db.collection('menuCategories').findOne({ _id: id });
      return NextResponse.json({ success: true, data: category });
    }

    // Update Menu Item
    if (path.startsWith('/menu/items/')) {
      const id = path.split('/').pop();
      const update = { $set: { ...body, updatedAt: new Date() } };
      await db.collection('menuItems').updateOne({ _id: id, ...(restaurantId && { restaurantId }) }, update);
      const item = await db.collection('menuItems').findOne({ _id: id });
      return NextResponse.json({ success: true, data: item });
    }

    // Update Order Status
    if (path.match(/\/orders\/[^\/]+\/status/)) {
      const id = path.split('/')[2];
      const { status } = body;
      
      await db.collection('orders').updateOne(
        { _id: id, ...(restaurantId && { restaurantId }) },
        { $set: { orderStatus: status, updatedAt: new Date() } }
      );
      
      const order = await db.collection('orders').findOne({ _id: id });
      if (order) {
        // Send SMS notification
        mockSendSMS(order.customerPhone, `Order ${order.orderNumber} status: ${status}`);
        
        // Auto-print when order is marked as completed
        if (status === 'completed') {
          console.log(`[AUTO-PRINT] Triggered for order ${order.orderNumber}`);
          const printResult = mockPrintOrder(order._id);
          
          // Store print job
          await db.collection('printJobs').insertOne({
            _id: uuidv4(),
            orderId: order._id,
            restaurantId: order.restaurantId,
            status: 'completed',
            printData: printResult,
            createdAt: new Date()
          });
        }
      }
      
      return NextResponse.json({ success: true, data: order });
    }

    // Update Order
    if (path.startsWith('/orders/')) {
      const id = path.split('/').pop();
      const update = { $set: { ...body, updatedAt: new Date() } };
      await db.collection('orders').updateOne({ _id: id, ...(restaurantId && { restaurantId }) }, update);
      const order = await db.collection('orders').findOne({ _id: id });
      return NextResponse.json({ success: true, data: order });
    }

    // Update Settings
    if (path === '/settings') {
      if (!restaurantId) {
        return NextResponse.json({ success: false, error: 'No restaurant context' }, { status: 400 });
      }
      
      await db.collection('restaurants').updateOne(
        { _id: restaurantId },
        { $set: { ...body, updatedAt: new Date() } }
      );
      
      const settings = await db.collection('restaurants').findOne({ _id: restaurantId });
      return NextResponse.json({ success: true, data: settings });
    }

    return NextResponse.json({ error: 'Route not found' }, { status: 404 });

  } catch (error) {
    console.error('PUT Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { pathname } = new URL(request.url);
  const path = pathname.replace('/api', '');

  try {
    const client = await connectToDatabase();
    const db = client.db('restaurant_system');
    const user = await verifyAuth(request);
    const restaurantId = getRestaurantContext(user);

    if (path.startsWith('/menu/categories/')) {
      const id = path.split('/').pop();
      await db.collection('menuCategories').deleteOne({ _id: id, ...(restaurantId && { restaurantId }) });
      return NextResponse.json({ success: true });
    }

    if (path.startsWith('/menu/items/')) {
      const id = path.split('/').pop();
      await db.collection('menuItems').deleteOne({ _id: id, ...(restaurantId && { restaurantId }) });
      return NextResponse.json({ success: true });
    }

    // Super Admin: Delete Restaurant
    if (path.startsWith('/super-admin/restaurants/')) {
      const user = await verifyAuth(request);
      if (user.role !== 'super_admin') {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
      }

      const restaurantIdToDelete = path.split('/').pop();
      
      // Delete all associated data
      await db.collection('menuCategories').deleteMany({ restaurantId: restaurantIdToDelete });
      await db.collection('menuItems').deleteMany({ restaurantId: restaurantIdToDelete });
      await db.collection('orders').deleteMany({ restaurantId: restaurantIdToDelete });
      await db.collection('users').deleteMany({ restaurantId: restaurantIdToDelete });
      await db.collection('restaurants').deleteOne({ _id: restaurantIdToDelete });
      
      console.log(`[SUPER ADMIN] Deleted restaurant ${restaurantIdToDelete} and all associated data`);
      
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Route not found' }, { status: 404 });

  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function OPTIONS(request) {
  // Handle CORS preflight requests
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
