const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const uri = process.env.MONGO_URL || 'mongodb://localhost:27017';

async function seedData() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('restaurant_system');
    
    // Clear existing data
    await db.collection('users').deleteMany({});
    await db.collection('restaurants').deleteMany({});
    await db.collection('orders').deleteMany({});
    await db.collection('menuItems').deleteMany({});
    await db.collection('sessions').deleteMany({});
    
    console.log('Cleared existing data');
    
    // Create super admin restaurant
    const superAdminRestaurant = {
      _id: uuidv4(),
      name: 'System Administration',
      isSystemRestaurant: true,
      isOnline: false,
      createdAt: new Date()
    };
    await db.collection('restaurants').insertOne(superAdminRestaurant);
    
    // Create super admin user
    const superAdminUser = {
      _id: uuidv4(),
      email: 'usamaosama104@gmail.com',
      password: 'superadmin123',
      phone: '07718589407',
      role: 'super_admin',
      restaurantId: superAdminRestaurant._id,
      createdAt: new Date()
    };
    await db.collection('users').insertOne(superAdminUser);
    console.log('Created super admin user');
    
    // Create demo restaurant
    const restaurant1 = {
      _id: uuidv4(),
      name: 'Pizza Palace',
      phone: '+12075075278',
      email: 'admin@pizzapalace.com',
      address: '123 Pizza St, Food City, FC 12345',
      isOnline: false,
      vapiPhoneNumber: '+12075075278',
      vapiPhoneNumberId: '0f119cbc-d543-484f-8ee5-e5341fe88458',
      createdAt: new Date()
    };
    await db.collection('restaurants').insertOne(restaurant1);
    console.log('Created Pizza Palace restaurant');
    
    // Create restaurant owner
    const restaurant1Owner = {
      _id: uuidv4(),
      email: 'admin@pizzapalace.com',
      password: 'admin123',
      role: 'restaurant_owner',
      restaurantId: restaurant1._id,
      createdAt: new Date()
    };
    await db.collection('users').insertOne(restaurant1Owner);
    console.log('Created Pizza Palace owner');
    
    // Create demo menu items
    const menuItems = [
      {
        _id: uuidv4(),
        restaurantId: restaurant1._id,
        name: 'Margherita Pizza',
        description: 'Classic tomato sauce, fresh mozzarella, and basil',
        price: 12.99,
        available: true,
        createdAt: new Date()
      },
      {
        _id: uuidv4(),
        restaurantId: restaurant1._id,
        name: 'Pepperoni Pizza',
        description: 'Loaded with pepperoni and extra cheese',
        price: 14.99,
        available: true,
        createdAt: new Date()
      },
      {
        _id: uuidv4(),
        restaurantId: restaurant1._id,
        name: 'Classic Burger',
        description: 'Beef patty, lettuce, tomato, onion, pickles',
        price: 9.99,
        available: true,
        createdAt: new Date()
      },
      {
        _id: uuidv4(),
        restaurantId: restaurant1._id,
        name: 'Coca Cola',
        description: 'Chilled Coca Cola',
        price: 2.99,
        available: true,
        createdAt: new Date()
      }
    ];
    await db.collection('menuItems').insertMany(menuItems);
    console.log('Created menu items');
    
    // Create demo orders
    const orders = [
      {
        _id: uuidv4(),
        restaurantId: restaurant1._id,
        orderNumber: 'ORD-001',
        customerName: 'John Doe',
        customerPhone: '+1234567890',
        deliveryAddress: '123 Main St, City',
        orderType: 'delivery',
        items: [{ name: 'Margherita Pizza', quantity: 1, price: 12.99 }],
        subtotal: 12.99,
        tax: 1.04,
        deliveryFee: 5.00,
        total: 19.03,
        paymentMethod: 'card',
        paymentStatus: 'paid',
        orderStatus: 'completed',
        source: 'phone',
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(Date.now() - 86400000)
      },
      {
        _id: uuidv4(),
        restaurantId: restaurant1._id,
        orderNumber: 'ORD-002',
        customerName: 'Jane Smith',
        customerPhone: '+1987654321',
        deliveryAddress: '456 Oak Ave, City',
        orderType: 'delivery',
        items: [{ name: 'Pepperoni Pizza', quantity: 2, price: 14.99 }],
        subtotal: 29.98,
        tax: 2.40,
        deliveryFee: 5.00,
        total: 37.38,
        paymentMethod: 'card',
        paymentStatus: 'paid',
        orderStatus: 'completed',
        source: 'phone',
        createdAt: new Date(Date.now() - 43200000),
        updatedAt: new Date(Date.now() - 43200000)
      },
      {
        _id: uuidv4(),
        restaurantId: restaurant1._id,
        orderNumber: 'ORD-003',
        customerName: 'Bob Johnson',
        customerPhone: '+1555123456',
        deliveryAddress: '',
        orderType: 'pickup',
        items: [{ name: 'Classic Burger', quantity: 1, price: 9.99 }],
        subtotal: 9.99,
        tax: 0.80,
        deliveryFee: 0,
        total: 10.79,
        paymentMethod: 'cash',
        paymentStatus: 'pending',
        orderStatus: 'pending',
        source: 'phone',
        createdAt: new Date(Date.now() - 3600000),
        updatedAt: new Date(Date.now() - 3600000)
      }
    ];
    await db.collection('orders').insertMany(orders);
    console.log('Created demo orders');
    
    console.log('\n✅ Seeding completed successfully!');
    console.log('\n=== Login Credentials ===');
    console.log('\nSuper Admin:');
    console.log('  Email: usamaosama104@gmail.com');
    console.log('  Password: superadmin123');
    console.log('  Access: /super-admin');
    console.log('\nRestaurant Owner:');
    console.log('  Email: admin@pizzapalace.com');
    console.log('  Password: admin123');
    console.log('  Access: /dashboard');
    
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await client.close();
  }
}

seedData();
