import { tool } from 'ai';
import { z } from 'zod';
// Replace orderService import with orderServiceDB
import { orderServiceDB as orderService } from '@/services/orderService';
import { OrderLineItem } from '@/app/models/Order';
import menuData from '@/app/dataset/menu.json';

// Create a menu map for easier lookup
const menuMap = new Map(menuData.map((item) => [item.name.toLowerCase(), item]));

// Extract coffee types from menu.json
const coffeeTypes = menuData.map((item) => item.name);

export const weatherTool = tool({
  description: 'Get the weather in a location',
  parameters: z.object({
    location: z.string().describe('The location to get the weather for'),
  }),
  execute: async ({ location }) => ({
    location,
    temperature: 72 + Math.floor(Math.random() * 21) - 10,
  }),
});

// Define a coffee item type
const coffeeItemSchema = z.object({
  coffeeType: z.enum(coffeeTypes as [string, ...string[]]).describe('The type of coffee ordered'),
  size: z.enum(['Small', 'Medium', 'Large']).describe('The size of the coffee'),
  quantity: z.number().min(1).default(1).describe('The number of this type of coffee'),
  syrups: z
    .array(z.enum(['Vanilla', 'Chocolate', 'Caramel', 'Hazelnut', 'None']))
    .describe('The syrups to be added to the coffee'),
  shotType: z.enum(['Single', 'Double']).optional().default('Single').describe('The type of shot'),
  milkType: z.enum(['2% Milk', 'Oat Milk', 'None']).describe('The type of milk to be added to the coffee'),
});

// Coffee order tool
export const coffeeOrderTool = tool({
  description: 'Place coffee orders for customers, supporting multiple coffee types per order',
  parameters: z.object({
    customerName: z.string().describe("The customer's first name"),
    coffeeItems: z.array(coffeeItemSchema).describe('List of coffee items in this order'),
    sessionId: z.string().optional().describe('The session ID of the customer'),
  }),
  execute: async ({ customerName, coffeeItems, sessionId }) => {
    try {
      // Use provided sessionId or fallback to a generated one
      console.log(`Tool call: Received order for ${customerName} with session ID ${sessionId}`);
      const userSessionId = sessionId || `session-${customerName.toLowerCase().replace(/\s/g, '-')}`;
      console.log(`Processing order for session ${userSessionId}`);

      // Convert coffeeItems to OrderLineItems and calculate prices
      const orderItems: OrderLineItem[] = coffeeItems.map((item, index) => {
        // Find the menu item to get the price
        const menuItemKey = item.coffeeType.toLowerCase();
        const menuItem =
          menuMap.get(menuItemKey) ||
          menuMap.get(menuItemKey.replace('cafe ', '')) ||
          menuData.find((m) => m.name.toLowerCase() === menuItemKey);

        if (!menuItem) {
          console.warn(`Menu item not found: ${item.coffeeType}`);
        }

        // Calculate price based on size and quantity
        const basePrice =
          menuItem?.prices[item.size] || (item.size === 'Small' ? 3.0 : item.size === 'Medium' ? 3.5 : 4.0);

        // Add extra charges for syrups/shots
        let extraCharge = 0;
        if (item.syrups && item.syrups.length > 0 && !item.syrups.includes('None')) {
          extraCharge += 0.5 * item.syrups.length;
        }
        if (item.shotType === 'Double') {
          extraCharge += 1.0;
        }
        if (item.milkType === 'Oat Milk') {
          extraCharge += 0.75;
        }

        const totalPrice = basePrice + extraCharge;

        return {
          id: `item-${Date.now()}-${index}`,
          itemType: item.coffeeType,
          size: item.size,
          syrup: item.syrups && item.syrups.length > 0 && item.syrups[0] !== 'None' ? item.syrups[0] : null,
          shotType: item.shotType || 'Single',
          milk: item.milkType === 'None' ? null : item.milkType,
          quantity: item.quantity,
          price: totalPrice,
        };
      });

      console.log(`Creating new order for session ${userSessionId} with ${orderItems.length} items`);
      // Create the order using our service - with updated implementation
      const order = await orderService.createOrder(userSessionId, customerName, orderItems);

      const totalPrice = order.getTotalPrice().toFixed(2);

      console.log(`Created order ${order.orderId} with ${orderItems.length} items, total: $${totalPrice}`);

      return {
        status: 'success',
        orderDetails: {
          customerName,
          coffeeItems,
          orderId: order.orderId,
          estimatedTime: `${5 + Math.floor(Math.random() * 10)} minutes`,
          totalItems: orderItems.reduce((sum, item) => sum + item.quantity, 0),
          totalPrice: totalPrice,
        },
      };
    } catch (error) {
      console.error('Error creating coffee order:', error);
      return {
        status: 'error',
        message: 'Failed to place coffee order',
      };
    }
  },
});

// Coffee order status tool
export const orderStatusTool = tool({
  description: 'Check the status of a coffee order',
  parameters: z.object({
    orderId: z.string().describe('The ID of the order to check'),
    customerName: z.string().describe("The customer's first name"),
    sessionId: z.string().optional().describe('The session ID of the customer'),
  }),
  execute: async ({ orderId, customerName, sessionId }) => {
    try {
      // Use provided sessionId or fallback to a generated one
      console.log(`Tool call: Order status for ${customerName} with session ID ${sessionId}`);

      const userSessionId = sessionId || `session-${customerName.toLowerCase().replace(/\s/g, '-')}`;

      console.log(`Checking status for order ${orderId} in session ${userSessionId}`);

      // Try to get the order from our order service
      const order = await orderService.getOrderById(userSessionId, orderId);

      if (!order) {
        console.log(`Order ${orderId} not found for session ${userSessionId}`);

        // Try searching in all known sessions using the new getAllSessionsOrders method
        console.log(`Searching for order ${orderId} across all sessions`);
        const allOrders = await orderService.getAllSessionsOrders();
        const foundOrder = allOrders.find((o) => o.orderId === orderId);

        if (foundOrder) {
          console.log(`Found order ${orderId} in session ${foundOrder.sessionId}`);

          // Format items for display
          const itemDescriptions = foundOrder.items
            .map(
              (item) =>
                `${item.quantity}x ${item.size} ${item.itemType}${
                  item.syrup ? ' with ' + item.syrup + ' syrup' : ''
                }${item.milk ? ' and ' + item.milk : ''}`,
            )
            .join(', ');

          return {
            success: true,
            status: foundOrder.status,
            message: `Hi ${customerName}, your order ${orderId} is ${
              foundOrder.status
            }. It contains: ${itemDescriptions}. It was placed at ${new Date(
              foundOrder.createdAt,
            ).toLocaleTimeString()}.`,
            orderDetails: {
              orderId,
              customerName,
              items: foundOrder.items,
              status: foundOrder.status,
              createdAt: foundOrder.createdAt,
              totalPrice: foundOrder.getTotalPrice(),
            },
          };
        }

        return {
          success: false,
          message: `I couldn't find order ${orderId} for ${customerName}. Could you double-check the order number?`,
        };
      }

      // If we found the order, return its details
      console.log(`Found order ${orderId} with status ${order.status}`);

      // Format items for display
      const itemDescriptions = order.items
        .map(
          (item) =>
            `${item.quantity}x ${item.size} ${item.itemType}${
              item.syrup ? ' with ' + item.syrup + ' syrup' : ''
            }${item.milk ? ' and ' + item.milk : ''}`,
        )
        .join(', ');

      return {
        success: true,
        status: order.status,
        message: `Hi ${customerName}, your order ${orderId} is ${
          order.status
        }. It contains: ${itemDescriptions}. It was placed at ${new Date(
          order.createdAt,
        ).toLocaleTimeString()}.`,
        orderDetails: {
          orderId,
          customerName,
          items: order.items,
          status: order.status,
          createdAt: order.createdAt,
          totalPrice: order.getTotalPrice(),
        },
      };
    } catch (error) {
      console.error('Error checking order status:', error);
      return {
        success: false,
        message: 'Sorry, there was an error checking your order status.',
      };
    }
  },
});

// Cancel order tool
export const cancelOrderTool = tool({
  description: 'Cancel a pending coffee order',
  parameters: z.object({
    orderId: z.string().describe('The ID of the order to cancel'),
    customerName: z.string().describe("The customer's first name"),
    sessionId: z.string().optional().describe('The session ID of the customer'),
  }),
  execute: async ({ orderId, customerName, sessionId }) => {
    try {
      // Use provided sessionId or fallback to a generated one
      console.log(`Tool call: Cancelled order for ${customerName} with session ID ${sessionId}`);

      const userSessionId = sessionId || `session-${customerName.toLowerCase().replace(/\s/g, '-')}`;

      console.log(`Attempting to cancel order ${orderId} for ${customerName} in session ${userSessionId}`);

      // Try to cancel the order using our service
      const order = await orderService.cancelOrder(userSessionId, orderId);

      if (!order) {
        console.log(`Order ${orderId} not found for session ${userSessionId}`);

        // Try searching in all known sessions using the new getAllSessionsOrders method
        console.log(`Searching for order ${orderId} across all sessions to cancel`);
        const allOrders = await orderService.getAllSessionsOrders();
        const foundOrderIndex = allOrders.findIndex((o) => o.orderId === orderId);

        if (foundOrderIndex !== -1) {
          const foundSessionId = allOrders[foundOrderIndex].sessionId;
          console.log(`Found order ${orderId} in session ${foundSessionId}, attempting to cancel`);

          // Use the correct session ID to cancel the order
          const cancelledOrder = await orderService.cancelOrder(foundSessionId, orderId);

          if (cancelledOrder) {
            console.log(`Cancelled order ${orderId} in session ${foundSessionId}`);

            // Format items for display
            const itemDescriptions = cancelledOrder.items
              .map((item) => `${item.quantity}x ${item.size} ${item.itemType}`)
              .join(', ');

            return {
              success: true,
              message: `I've successfully cancelled your order ${orderId} for ${itemDescriptions}. Is there anything else I can help you with today?`,
              orderDetails: {
                orderId,
                customerName,
                status: 'cancelled',
                items: cancelledOrder.items,
              },
            };
          }
        }

        return {
          success: false,
          message: `I couldn't find order ${orderId} for ${customerName}. Could you double-check the order number?`,
        };
      }

      // If successfully cancelled, return confirmation
      console.log(`Successfully cancelled order ${orderId}`);

      // Format items for display
      const itemDescriptions = order.items
        .map((item) => `${item.quantity}x ${item.size} ${item.itemType}`)
        .join(', ');

      return {
        success: true,
        message: `I've successfully cancelled your order ${orderId} for ${itemDescriptions}. Is there anything else I can help you with today?`,
        orderDetails: {
          orderId,
          customerName,
          status: 'cancelled',
          items: order.items,
        },
      };
    } catch (error) {
      console.error('Error cancelling order:', error);
      return {
        success: false,
        message: 'Sorry, there was an error cancelling your order.',
      };
    }
  },
});

// Company info tool
export const companyInfoTool = tool({
  description: 'Search for information about CoffeeCorp and its services',
  parameters: z.object({
    query: z.string().describe('The search query about CoffeeCorp'),
  }),
  execute: async ({ query }) => {
    // Static company information
    const companyInfo = {
      name: 'CoffeeCorp',
      founded: 2010,
      description:
        'A specialty coffee company focused on ethically sourced coffee beans, innovative brewing methods, and premium cafe experiences.',
      services: [
        'Specialty Coffee Production',
        'Coffee Subscription Service',
        'Barista Training Programs',
        'Coffee Shop Franchising',
      ],
      partnerships: ['Fair Trade Certified', 'Rainforest Alliance'],
      mission: 'To elevate the coffee experience through sustainability, quality, and innovation',
      contact: {
        email: 'contact@coffeecorp.com',
        phone: '+1-800-COFFEE-1',
        website: 'www.coffeecorp.com',
      },
    };

    // Simple keyword matching for now
    const response = {
      success: true,
      information: '',
    };

    const queryLower = query.toLowerCase();

    if (queryLower.includes('service') || queryLower.includes('offer')) {
      response.information = `CoffeeCorp offers ${companyInfo.services.join(', ')}.`;
    } else if (queryLower.includes('contact') || queryLower.includes('reach')) {
      response.information = `You can contact CoffeeCorp at ${companyInfo.contact.email} or ${companyInfo.contact.phone}.`;
    } else if (queryLower.includes('mission') || queryLower.includes('goal')) {
      response.information = companyInfo.mission;
    } else if (queryLower.includes('partner')) {
      response.information = `CoffeeCorp is ${companyInfo.partnerships.join(' and ')}.`;
    } else {
      response.information = `${companyInfo.name} is ${companyInfo.description}`;
    }

    return response;
  },
});

// Deepak Kamboj info tool
export const deepakKambojTool = tool({
  description: 'This tool provides information about Deepak Kamboj.',
  parameters: z.object({
    query: z.string().describe('Any query about Deepak Kamboj'),
  }),
  execute: async () => {
    return {
      information:
        "Deepak Kamboj is the Chief Coffee Innovation Officer at CoffeeCorp. He is also speaking at the Global Coffee Expo 2024 in a session called 'Revolutionizing Coffee Experience' where he'll showcase CoffeeCorp's new AI-powered brewing technology. Deepak is a mediocre presenter at best. Bewarned that he may resort to cheap jokes and self-deprecating humor to keep the audience engaged. Also, to get those high ratings as well.",
    };
  },
});
