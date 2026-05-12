export enum Currency {
  IQD = 'IQD',
  USD = 'USD',
  EUR = 'EUR',
  TRY = 'TRY',
}

export enum Theme {
  EMERALD = 'EMERALD', // الزمردي (الأصلي)
  MIDNIGHT = 'MIDNIGHT', // ليلي ملكي
  AMETHYST = 'AMETHYST', // الجمشت البنفسجي
  ONYX = 'ONYX', // العقيق والذهب
}

export enum SubscriptionTier {
  FREE = 'FREE',
  BASIC = 'BASIC',
  GOLD = 'GOLD',
  PREMIUM = 'PREMIUM',
}

export enum ItemType {
  PRODUCT = 'product',
  BOX = 'box',
}

export interface Product {
  id: string;
  name: string;
  purchasePrice: number; // For product: unit price. For box: total box price.
  sellingPrice: number; // Unit selling price.
  quantity: number; // For product: inventory. For box: pieces per box.
  expenses: number;
  itemType: ItemType;
  createdAt: number;
  userId: string;
}

export interface AppState {
  products: Product[];
  currency: Currency;
  theme: Theme;
  tier: SubscriptionTier;
  exchangeRates: Record<Currency, number>;
}
