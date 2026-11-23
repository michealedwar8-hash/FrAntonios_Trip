export type BusKey = 'bus1' | 'bus2';
export type ColorGroupKey = 'red' | 'blue' | 'yellow' | 'green';
export type RecipientKey = 'mekhail' | 'fayez';
export type PaymentMethodKey = 'instapay' | 'vf' | 'orange';
export type BookingStatusKey = 'paid' | 'partial' | 'unpaid' | 'cancelled';

export interface MemberRecord {
  id: string;
  name: string;
  phone: string;
  isMain: boolean;
  paid: boolean;
  cancelled: boolean;
  bus?: BusKey;
  colorGroup?: ColorGroupKey;
}

export interface RegistrationRecord {
  id: number;
  requestId?: string;
  seqNo?: number;
  isTest?: boolean;
  isGroup: boolean;
  members: MemberRecord[];
  bus: BusKey;
  colorGroup: ColorGroupKey;
  recipient: RecipientKey;
  paymentMethod: PaymentMethodKey;
  timestamp: string;
}

export type WhatsAppConfig = Record<RecipientKey, Record<PaymentMethodKey, string>>;

export const TICKET_PRICE = 250;
export const BUS_CAPACITY = 50;
export const COLOR_GROUP_CAPACITY = 25;

export const STORAGE_KEY = 'trip_registrations';
export const WHATSAPP_STORAGE_KEY = 'trip_whatsapp_numbers_v2';
export const ADMIN_PIN_HASH_KEY = 'trip_admin_pin_hash_v1';
export const ADMIN_SESSION_KEY = 'trip_admin_session_v1';
export const ADMIN_STRESS_SECRET = 'THREEYOUTH_ANTHONY_2026_ADMIN';

// Official WhatsApp numbers for the two organizers
export const MEKHAIL_PHONE_DIGITS = '1288651567';
export const FAYEZ_PHONE_DIGITS = '1096656853';

export const ORGANIZER_ACCOUNTS: Record<
  RecipientKey,
  { key: RecipientKey; name: string; phoneDigits: string; formattedPhone: string }
> = {
  mekhail: {
    key: 'mekhail',
    name: 'ميخائيل إدور',
    phoneDigits: MEKHAIL_PHONE_DIGITS,
    formattedPhone: `+20${MEKHAIL_PHONE_DIGITS}`,
  },
  fayez: {
    key: 'fayez',
    name: 'فايز فيكتور',
    phoneDigits: FAYEZ_PHONE_DIGITS,
    formattedPhone: `+20${FAYEZ_PHONE_DIGITS}`,
  },
};

// Automatic recipient assignment based on payment method:
// InstaPay & Orange Cash => Mekhail Edwar (+201288651567)
// Vodafone Cash => Fayez Victor (+201096656853)
export const PAYMENT_RECIPIENT_MAP: Record<PaymentMethodKey, RecipientKey> = {
  instapay: 'mekhail',
  orange: 'mekhail',
  vf: 'fayez',
};

export const DEFAULT_WHATSAPP_NUMBERS: WhatsAppConfig = {
  mekhail: {
    instapay: `20${MEKHAIL_PHONE_DIGITS}`,
    orange: `20${MEKHAIL_PHONE_DIGITS}`,
    vf: `20${MEKHAIL_PHONE_DIGITS}`,
  },
  fayez: {
    instapay: `20${FAYEZ_PHONE_DIGITS}`,
    orange: `20${FAYEZ_PHONE_DIGITS}`,
    vf: `20${FAYEZ_PHONE_DIGITS}`,
  },
};

export const BUS_LIST: { key: BusKey; label: string }[] = [
  { key: 'bus1', label: 'الباص الأول' },
  { key: 'bus2', label: 'الباص الثاني' },
];

export const COLOR_GROUP_LIST: {
  key: ColorGroupKey;
  label: string;
  swatchClass: string;
  borderClass: string;
  softBgClass: string;
}[] = [
  {
    key: 'red',
    label: 'أحمر',
    swatchClass: 'bg-red-600',
    borderClass: 'border-red-600',
    softBgClass: 'bg-red-50/70',
  },
  {
    key: 'blue',
    label: 'أزرق',
    swatchClass: 'bg-blue-600',
    borderClass: 'border-blue-600',
    softBgClass: 'bg-blue-50/70',
  },
  {
    key: 'yellow',
    label: 'أصفر',
    swatchClass: 'bg-amber-400',
    borderClass: 'border-amber-500',
    softBgClass: 'bg-amber-50/70',
  },
  {
    key: 'green',
    label: 'أخضر',
    swatchClass: 'bg-emerald-600',
    borderClass: 'border-emerald-600',
    softBgClass: 'bg-emerald-50/70',
  },
];

export const RECIPIENT_LIST: { key: RecipientKey; label: string }[] = [
  { key: 'mekhail', label: 'ميخائيل إدور' },
  { key: 'fayez', label: 'فايز فيكتور' },
];

export const PAYMENT_METHOD_LIST: { key: PaymentMethodKey; label: string; enLabel: string }[] = [
  { key: 'instapay', label: 'إنستا باي', enLabel: 'InstaPay' },
  { key: 'orange', label: 'أورانج كاش', enLabel: 'Orange Cash' },
  { key: 'vf', label: 'فودافون كاش', enLabel: 'Vodafone Cash' },
];

export const LABELS = {
  recipients: {
    mekhail: 'ميخائيل إدور',
    fayez: 'فايز فيكتور',
  } as Record<RecipientKey, string>,
  payments: {
    instapay: 'إنستا باي',
    vf: 'فودافون كاش',
    orange: 'أورانج كاش',
  } as Record<PaymentMethodKey, string>,
  colors: {
    red: 'أحمر',
    blue: 'أزرق',
    yellow: 'أصفر',
    green: 'أخضر',
  } as Record<ColorGroupKey, string>,
  buses: {
    bus1: 'الباص الأول',
    bus2: 'الباص الثاني',
  } as Record<BusKey, string>,
};
