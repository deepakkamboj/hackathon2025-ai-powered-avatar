const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function initializeDatabase() {
  console.log('🔄 Initializing SQLite database...');

  try {
    // Create database file path
    const dbPath = path.join(__dirname, '../db/orders.db');
    console.log(`📂 Database path: ${dbPath}`);

    // Open database connection
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    console.log('✅ Database connection established');

    // Create orders table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        orderId TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        customerName TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'preparing',
        createdAt INTEGER NOT NULL,
        UNIQUE(orderId)
      );
    `);

    console.log('✅ Created orders table');

    // Create order_items table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        orderId TEXT NOT NULL,
        itemType TEXT NOT NULL,
        size TEXT NOT NULL,
        syrup TEXT,
        shotType TEXT NOT NULL DEFAULT 'Single',
        milk TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        price REAL NOT NULL,
        FOREIGN KEY (orderId) REFERENCES orders (orderId) ON DELETE CASCADE,
        UNIQUE(id)
      );
    `);

    console.log('✅ Created order_items table');

    // Create indexes for better performance
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_sessionId ON orders(sessionId);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_order_items_orderId ON order_items(orderId);`);

    console.log('✅ Created database indexes');

    // Insert some sample data for testing
    const sampleOrderId = 'ORD-1001';
    const sampleSessionId = 'session-demo-123';

    // Check if sample data already exists
    const existingOrder = await db.get('SELECT orderId FROM orders WHERE orderId = ?', [sampleOrderId]);

    if (!existingOrder) {
      // Insert sample order
      await db.run(
        `
        INSERT INTO orders (orderId, sessionId, customerName, status, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `,
        [sampleOrderId, sampleSessionId, 'John Doe', 'preparing', Date.now()],
      );

      // Insert sample order items
      await db.run(
        `
        INSERT INTO order_items (id, orderId, itemType, size, syrup, shotType, milk, quantity, price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        ['item-1001-1', sampleOrderId, 'Latte', 'Medium', 'Vanilla', 'Single', '2% Milk', 1, 4.5],
      );

      await db.run(
        `
        INSERT INTO order_items (id, orderId, itemType, size, syrup, shotType, milk, quantity, price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        ['item-1001-2', sampleOrderId, 'Cappuccino', 'Large', null, 'Double', 'Oat Milk', 2, 6.75],
      );

      console.log('✅ Inserted sample data');
    } else {
      console.log('ℹ️ Sample data already exists, skipping insert');
    }

    // Verify tables were created successfully
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    console.log('📊 Database tables:');
    tables.forEach((table) => console.log(`   - ${table.name}`));

    // Show sample data
    const orderCount = await db.get('SELECT COUNT(*) as count FROM orders');
    const itemCount = await db.get('SELECT COUNT(*) as count FROM order_items');

    console.log(`📈 Database statistics:`);
    console.log(`   - Orders: ${orderCount.count}`);
    console.log(`   - Order Items: ${itemCount.count}`);

    // Test a complex query to ensure relationships work
    const sampleQuery = await db.all(
      `
      SELECT 
        o.orderId,
        o.customerName,
        o.status,
        o.createdAt,
        oi.itemType,
        oi.size,
        oi.quantity,
        oi.price
      FROM orders o
      LEFT JOIN order_items oi ON o.orderId = oi.orderId
      WHERE o.orderId = ?
    `,
      [sampleOrderId],
    );

    if (sampleQuery.length > 0) {
      console.log('✅ Database relationships working correctly');
      console.log('📝 Sample query result:');
      sampleQuery.forEach((row) => {
        console.log(`   ${row.customerName}: ${row.quantity}x ${row.size} ${row.itemType} - $${row.price}`);
      });
    }

    await db.close();
    console.log('🎉 Database initialization completed successfully!');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

// Run initialization
initializeDatabase();
