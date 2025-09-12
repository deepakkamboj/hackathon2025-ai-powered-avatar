export interface OrderLineItem {
  id: string;
  itemType: string;
  size: string;
  syrup: string | null;
  shotType: string;
  milk: string | null;
  quantity: number;
  price: number;
}

export class Order {
  public orderId: string;
  public status: "preparing" | "ready" | "completed" | "cancelled";
  public createdAt: number;
  public sessionId: string;

  constructor(
    sessionId: string,
    orderId: string,
    public customerName: string,
    public items: OrderLineItem[]
  ) {
    this.sessionId = sessionId;
    this.orderId = orderId;
    this.items = items;
    this.customerName = customerName;
    this.status = "preparing";
    this.createdAt = Date.now();
  }

  getTotalPrice(): number {
    return this.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
  }
}
