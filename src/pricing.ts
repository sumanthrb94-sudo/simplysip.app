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
    return item.offerPrice ?? item.mrp ?? 0;
  }
  const mrp = getMrp(item);
  const rawOffer = Number((item as Product).offerPrice ?? (mrp * 0.75));
  return roundUpTo9(rawOffer);
};