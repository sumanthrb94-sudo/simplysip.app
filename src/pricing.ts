import { Product, SubscriptionProduct } from './types';

export const roundUpTo9 = (value: number): number => {
  const base = Math.ceil(value);
  const mod = base % 10;
  return mod === 9 ? base : base + (9 - mod);
};

export const getMrp = (item: Partial<Product> | Partial<SubscriptionProduct>): number => {
  // For subscriptions, use the MRP directly
  if (item.id === 'sub_weekly' || item.id === 'sub_monthly') {
    return item.mrp ?? 0;
  }
  return Number(item.mrp ?? 0);
};

export const getOfferPrice = (item: Partial<Product> | Partial<SubscriptionProduct>): number => {
  // For subscriptions, use the offer price directly
  if (item.id === 'sub_weekly' || item.id === 'sub_monthly') {
    return Number(item.offerPrice ?? item.mrp ?? 0);
  }
  
  const mrp = getMrp(item);
  
  // If we have an explicit offerPrice from the Admin Dashboard, use it exactly
  if (item.offerPrice !== undefined && item.offerPrice !== null && Number(item.offerPrice) > 0) {
    return Number(item.offerPrice);
  }

  // Fallback to legacy 25% off logic with charm pricing for older items
  const rawOffer = mrp * 0.75;
  return roundUpTo9(rawOffer);
};