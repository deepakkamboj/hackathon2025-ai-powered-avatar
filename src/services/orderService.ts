import { Order, OrderLineItem } from '@/app/models/Order';
import connectDB from '@/lib/connectDB';

export class OrderServiceDB {
  constructor() {
    // Initialize database tables if needed
    this.initDatabase();
  }

  private async initDatabase() {
    try {
      const db = await connectDB();

      // Create orders table
      await db.exec(`
        CREATE TABLE IF NOT EXISTS orders (
          orderId TEXT PRIMARY KEY,
          sessionId TEXT NOT NULL,
          customerName TEXT NOT NULL,
          status TEXT NOT NULL,
          createdAt INTEGER NOT NULL
        )
      `);

      // Create order_items table
      await db.exec(`
        CREATE TABLE IF NOT EXISTS order_items (
          id TEXT PRIMARY KEY,
          orderId TEXT NOT NULL,
          itemType TEXT NOT NULL,
          size TEXT NOT NULL,
          syrup TEXT,
          shotType TEXT NOT NULL,
          milk TEXT,
          quantity INTEGER NOT NULL,
          price REAL NOT NULL,
          FOREIGN KEY (orderId) REFERENCES orders (orderId)
        )
      `);

      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
    }
  }

  // Get all orders for a specific session
  async getSessionOrders(sessionId: string): Promise<Order[]> {
    try {
      const db = await connectDB();

      // Get all orders for the session
      const orders = await db.all(`SELECT * FROM orders WHERE sessionId = ? ORDER BY createdAt DESC`, [
        sessionId,
      ]);

      // For each order, fetch its items
      const result: Order[] = [];

      for (const orderData of orders) {
        const items = await db.all(`SELECT * FROM order_items WHERE orderId = ?`, [orderData.orderId]);

        // Create Order with correct constructor parameters
        const order = new Order(
          orderData.sessionId,
          orderData.orderId,
          orderData.customerName,
          items as OrderLineItem[],
        );

        // Status and createdAt are already set in the constructor, but we need to override with DB values
        order.status = orderData.status;
        order.createdAt = orderData.createdAt;

        result.push(order);
      }

      return result;
    } catch (error) {
      console.error('Error getting session orders:', error);
      return [];
    }
  }

  // Get all orders across all sessions
  async getAllSessionsOrders(): Promise<Order[]> {
    try {
      const db = await connectDB();

      // Get all orders
      const orders = await db.all(`SELECT * FROM orders ORDER BY createdAt DESC`);

      // For each order, fetch its items
      const result: Order[] = [];

      for (const orderData of orders) {
        const items = await db.all(`SELECT * FROM order_items WHERE orderId = ?`, [orderData.orderId]);

        // Create Order with correct constructor parameters
        const order = new Order(
          orderData.sessionId,
          orderData.orderId,
          orderData.customerName,
          items as OrderLineItem[],
        );

        // Status and createdAt are already set in the constructor, but we need to override with DB values
        order.status = orderData.status;
        order.createdAt = orderData.createdAt;

        result.push(order);
      }

      return result;
    } catch (error) {
      console.error('Error getting all orders:', error);
      return [];
    }
  }

  // Get a specific order by ID within a session
  async getOrderById(sessionId: string, orderId: string): Promise<Order | undefined> {
    try {
      const db = await connectDB();

      // Get the order
      const orderData = await db.get(`SELECT * FROM orders WHERE orderId = ? AND sessionId = ?`, [
        orderId,
        sessionId,
      ]);

      if (!orderData) return undefined;

      // Get the order items
      const items = await db.all(`SELECT * FROM order_items WHERE orderId = ?`, [orderId]);

      // Create Order with correct constructor parameters
      const order = new Order(
        orderData.sessionId,
        orderData.orderId,
        orderData.customerName,
        items as OrderLineItem[],
      );

      // Status and createdAt are already set in the constructor, but we need to override with DB values
      order.status = orderData.status;
      order.createdAt = orderData.createdAt;

      return order;
    } catch (error) {
      console.error(`Error getting order ${orderId}:`, error);
      return undefined;
    }
  }

  // Create a new order for a specific session
  async createOrder(sessionId: string, customerName: string, items: OrderLineItem[]): Promise<Order> {
    try {
      const db = await connectDB();

      // Generate order ID
      const orderId = `order-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Create a new Order object with correct constructor parameters
      const order = new Order(sessionId, orderId, customerName, items);

      // Insert the order into the database
      await db.run(
        `INSERT INTO orders (orderId, sessionId, customerName, status, createdAt)
         VALUES (?, ?, ?, ?, ?)`,
        [order.orderId, order.sessionId, order.customerName, order.status, order.createdAt],
      );

      // Insert each order item
      for (const item of items) {
        await db.run(
          `INSERT INTO order_items (id, orderId, itemType, size, syrup, shotType, milk, quantity, price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            order.orderId,
            item.itemType,
            item.size,
            item.syrup,
            item.shotType,
            item.milk,
            item.quantity,
            item.price,
          ],
        );
      }

      return order;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  // Cancel an order
  async cancelOrder(sessionId: string, orderId: string): Promise<Order | null> {
    try {
      const db = await connectDB();

      // Check if the order exists and can be cancelled
      const orderData = await db.get(
        `SELECT * FROM orders WHERE orderId = ? AND sessionId = ? AND status = 'preparing'`,
        [orderId, sessionId],
      );

      if (!orderData) return null;

      // Update the order status to cancelled
      await db.run(`UPDATE orders SET status = 'cancelled' WHERE orderId = ?`, [orderId]);

      // Get the updated order with its items
      const items = await db.all(`SELECT * FROM order_items WHERE orderId = ?`, [orderId]);

      // Create Order with correct constructor parameters
      const order = new Order(
        orderData.sessionId,
        orderData.orderId,
        orderData.customerName,
        items as OrderLineItem[],
      );

      // Set the updated status
      order.status = 'cancelled';
      order.createdAt = orderData.createdAt;

      return order;
    } catch (error) {
      console.error(`Error cancelling order ${orderId}:`, error);
      return null;
    }
  }

  // Find an order by ID across all sessions
  async findOrderById(orderId: string): Promise<Order | null> {
    try {
      const db = await connectDB();

      // Get the order from any session
      const orderData = await db.get(`SELECT * FROM orders WHERE orderId = ?`, [orderId]);

      if (!orderData) return null;

      // Get the order items
      const items = await db.all(`SELECT * FROM order_items WHERE orderId = ?`, [orderId]);

      // Create Order with correct constructor parameters
      const order = new Order(
        orderData.sessionId,
        orderData.orderId,
        orderData.customerName,
        items as OrderLineItem[],
      );

      // Status and createdAt are already set in the constructor, but we need to override with DB values
      order.status = orderData.status;
      order.createdAt = orderData.createdAt;

      return order;
    } catch (error) {
      console.error(`Error finding order ${orderId}:`, error);
      return null;
    }
  }
}

// Create a singleton instance
export const orderServiceDB = new OrderServiceDB();
