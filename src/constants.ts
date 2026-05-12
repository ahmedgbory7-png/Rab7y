import { Currency } from './types';

export const DEFAULT_EXCHANGE_RATES: Record<Currency, number> = {
  [Currency.IQD]: 1,
  [Currency.USD]: 0.00068, // 1 IQD = 0.00068 USD (Example rate)
  [Currency.EUR]: 0.00063,
  [Currency.TRY]: 0.022,
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  [Currency.IQD]: 'د.ع',
  [Currency.USD]: '$',
  [Currency.EUR]: '€',
  [Currency.TRY]: '₺',
};

export const CURRENCY_NAMES: Record<Currency, string> = {
  [Currency.IQD]: 'دينار عراقي',
  [Currency.USD]: 'دولار أمريكي',
  [Currency.EUR]: 'يورو',
  [Currency.TRY]: 'ليرة تركية',
};

export const PRO_UNLOCK_CODE = '0099';
export const FREE_TRIAL_LIMIT = 3;
export const WHATSAPP_NUMBER = '07745121483';
export const WHATSAPP_CONTACT_NAME = 'ابو وطن';
