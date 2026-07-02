import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';
import { create } from 'zustand';
import { PRO_ENTITLEMENT_ID } from './entitlements';

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.trim(),
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?.trim(),
});

/**
 * Like Supabase, RevenueCat is optional: without an API key (or in builds
 * where the native module is missing, e.g. Expo Go / web) the app stays on
 * the free tier and the paywall explains purchases aren't available.
 */
export const isPurchasesConfigured = (apiKey ?? '').length > 0;

export type PurchasesStatus = 'loading' | 'ready' | 'unavailable';

type PurchasesState = {
  status: PurchasesStatus;
  isPro: boolean;
  /** Packages of the current offering (e.g. monthly, annual), for the paywall. */
  packages: PurchasesPackage[];
  initialize: () => Promise<void>;
  /** Purchase a package. Returns true if Pro is now active, false if the user cancelled. */
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  /** Restore previous purchases. Returns true if Pro is active afterwards. */
  restore: () => Promise<boolean>;
};

function hasPro(info: CustomerInfo): boolean {
  return info.entitlements.active[PRO_ENTITLEMENT_ID] != null;
}

export const useEntitlements = create<PurchasesState>((set) => ({
  status: 'loading',
  isPro: false,
  packages: [],

  initialize: async () => {
    if (!isPurchasesConfigured) {
      set({ status: 'unavailable', isPro: false });
      return;
    }
    try {
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
      Purchases.configure({ apiKey: apiKey! });
      Purchases.addCustomerInfoUpdateListener((info) => {
        set({ isPro: hasPro(info) });
      });
      const [info, offerings] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      set({
        status: 'ready',
        isPro: hasPro(info),
        packages: offerings.current?.availablePackages ?? [],
      });
    } catch {
      // Native module missing (Expo Go) or store unreachable; stay on free tier.
      set({ status: 'unavailable', isPro: false });
    }
  },

  purchase: async (pkg) => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const pro = hasPro(customerInfo);
      set({ isPro: pro });
      return pro;
    } catch (e: unknown) {
      if (typeof e === 'object' && e !== null && (e as { userCancelled?: boolean }).userCancelled) {
        return false;
      }
      throw e;
    }
  },

  restore: async () => {
    const info = await Purchases.restorePurchases();
    const pro = hasPro(info);
    set({ isPro: pro });
    return pro;
  },
}));

/** Convenience selector used by gates across screens. */
export function useIsPro(): boolean {
  return useEntitlements((s) => s.isPro);
}

/**
 * Tie the RevenueCat identity to the Supabase account so Pro follows the
 * user across devices; anonymous ids are used in local-only mode.
 */
export async function identifyPurchasesUser(userId: string | null): Promise<void> {
  if (useEntitlements.getState().status !== 'ready') return;
  try {
    if (userId) {
      const { customerInfo } = await Purchases.logIn(userId);
      useEntitlements.setState({ isPro: hasPro(customerInfo) });
    } else if (!(await Purchases.isAnonymous())) {
      const info = await Purchases.logOut();
      useEntitlements.setState({ isPro: hasPro(info) });
    }
  } catch {
    // Identity sync is best-effort; entitlement listener will catch up.
  }
}
