export interface NutritionInfo {
  calories: number;
  vitamin: string;
  preservatives: string;
}

export interface Product {
  id: string;
  name: string;
  desc: string;
  image: string;
  category: "Signature Blends" | "Single Fruit Series";
  mrp: number;
  offerPrice: number;
  price: number;
  tagline: string;
  bestSeller: boolean;
  sweetness: number;
  nutrition: NutritionInfo;
  benefits: string[];
  ingredients: string[];
  createdAt?: number;
}

export interface SubscriptionProduct {
  id: "sub_weekly" | "sub_monthly";
  name: "Weekly Subscription" | "Monthly Subscription";
  desc: string;
  mrp: number;
  offerPrice: number;
}

export type CartItem = Product | SubscriptionProduct;

export interface OrderItem {
  id: string;
  name: string;
  qty: number;
  price: number;
}

export interface OrderAddress {
  name: string;
  phone: string;
  area: string;
  address: string;
  addressType: 'Home' | 'Office' | 'Other';
}

export interface Order {
  id: string;
  userId: string | null;
  userEmail: string | null;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  subscriptionType: "weekly" | "monthly" | null;
  paymentId: string | null;
  paymentStatus: "paid" | "unpaid" | "refunded";
  orderStatus: "pending" | "paid" | "delivered" | "cancelled";
  deliverySlot: string;
  assignedRider: string;
  notes: string;
  address: OrderAddress;
  location: string | null;
  locationAccuracy: number | null;
  createdAt: number;
  updatedAt?: number;
}

export interface UserProfile extends Partial<OrderAddress> {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber: string;
  location?: string;
  locationAccuracy?: number;
}