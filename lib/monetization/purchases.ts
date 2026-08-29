import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';
import { create } from 'zustand';
import { hasActiveProEntitlement, PRO_ENTITLEMENT_ID } from './entitlements';

function resolvePurchasesApiKey(): string {
  const test = process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY?.trim() ?? '';
  const platform =
    Platform.select({
      ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.trim(),
      android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?.trim(),
      default: test,
    }) ?? '';
  return platform || test;
}

const apiKey = resolvePurchasesApiKey();

/**
 * Like Supabase, RevenueCat is optional: without an API key (or in builds
 * where the native module is missing, e.g. Expo Go / web) the app stays on
 * the free tier and the paywall explains purchases aren't available.
 */
export const isPurchasesConfigured = apiKey.length > 0;
let purchasesSdkStarted = false;

export type PurchasesStatus = 'loading' | 'ready' | 'unavailable';
export type RemotePaywallResult = 'unlocked' | 'dismissed' | 'unavailable';

const PACKAGE_ORDER: Record<string, number> = {
  [PACKAGE_TYPE.MONTHLY]: 0,
  [PACKAGE_TYPE.ANNUAL]: 1,
  [PACKAGE_TYPE.LIFETIME]: 2,
};

function sortOfferingPackages(packages: PurchasesPackage[]): PurchasesPackage[] {
  return [...packages].sort(
    (a, b) => (PACKAGE_ORDER[a.packageType] ?? 9) - (PACKAGE_ORDER[b.packageType] ?? 9),
  );
}

function hasPro(info: CustomerInfo): boolean {
  return hasActiveProEntitlement(info.entitlements.active);
}

function applyCustomerInfo(info: CustomerInfo) {
  useEntitlements.setState({ isPro: hasPro(info) });
}

type PurchasesState = {
  status: PurchasesStatus;
  isPro: boolean;
  /** Current offering packages (monthly, yearly, lifetime) for the fallback paywall. */
  packages: PurchasesPackage[];
  initialize: () => Promise<void>;
  /** Purchase a package. Returns true if Pro is now active, false if the user cancelled. */
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  /** Restore previous purchases. Returns true if Pro is active afterwards. */
  restore: () => Promise<boolean>;
};

export const useEntitlements = create<PurchasesState>((set) => ({
  status: 'loading',
  isPro: false,
  packages: [],

  initialize: async () => {
    if (!isPurchasesConfigured) {
      set({ status: 'unavailable', isPro: false });
      return;
    }
    if (purchasesSdkStarted) return;
    purchasesSdkStarted = true;
    try {
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
      Purchases.configure({ apiKey });
      Purchases.addCustomerInfoUpdateListener((info) => {
        applyCustomerInfo(info);
      });
      const [info, offerings] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      set({
        status: 'ready',
        isPro: hasPro(info),
        packages: sortOfferingPackages(offerings.current?.availablePackages ?? []),
      });
    } catch {
      purchasesSdkStarted = false;
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

export async function refreshCustomerInfo(): Promise<void> {
  try {
    const info = await Purchases.getCustomerInfo();
    applyCustomerInfo(info);
  } catch {
    // Keep last known entitlement if the store is unreachable.
  }
}

/**
 * Present the current offering's RevenueCat Paywall.
 * Returns true after PURCHASED or RESTORED; false on cancel/error/not presented.
 */
export async function presentPaywall(): Promise<boolean> {
  try {
    const { default: RevenueCatUI, PAYWALL_RESULT } = await import('react-native-purchases-ui');
    const paywallResult = await RevenueCatUI.presentPaywall();

    switch (paywallResult) {
      case PAYWALL_RESULT.NOT_PRESENTED:
      case PAYWALL_RESULT.ERROR:
      case PAYWALL_RESULT.CANCELLED:
        return false;
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        await refreshCustomerInfo();
        return true;
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/** Helper: present only if the `pro` entitlement is missing. */
export async function presentPaywallIfNeeded(): Promise<boolean> {
  try {
    const { default: RevenueCatUI, PAYWALL_RESULT } = await import('react-native-purchases-ui');
    const paywallResult = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: PRO_ENTITLEMENT_ID,
    });
    if (paywallResult === PAYWALL_RESULT.PURCHASED || paywallResult === PAYWALL_RESULT.RESTORED) {
      await refreshCustomerInfo();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Try the remote Paywall first. `unavailable` means the UI native module is
 * missing (Expo Go / web) so the caller should show the in-app package list.
 */
export async function presentRemotePaywall(): Promise<RemotePaywallResult> {
  if (useEntitlements.getState().status !== 'ready') return 'unavailable';
  try {
    const { default: RevenueCatUI } = await import('react-native-purchases-ui');
    if (typeof RevenueCatUI.presentPaywall !== 'function') return 'unavailable';
  } catch {
    return 'unavailable';
  }
  const unlocked = await presentPaywall();
  return unlocked ? 'unlocked' : 'dismissed';
}

export async function presentCustomerCenter(): Promise<boolean> {
  if (useEntitlements.getState().status !== 'ready') return false;
  try {
    const { default: RevenueCatUI } = await import('react-native-purchases-ui');
    await RevenueCatUI.presentCustomerCenter({
      callbacks: {
        onRestoreCompleted: ({ customerInfo }: { customerInfo: CustomerInfo }) => {
          applyCustomerInfo(customerInfo);
        },
      },
    });
    await refreshCustomerInfo();
    return true;
  } catch {
    return false;
  }
}

/**
 * Tie the RevenueCat identity to the Supabase account so Pro follows the
 * user across devices; anonymous ids are used when signed out.
 */
export async function identifyPurchasesUser(userId: string | null): Promise<void> {
  if (useEntitlements.getState().status !== 'ready') return;
  try {
    if (userId) {
      const { customerInfo } = await Purchases.logIn(userId);
      applyCustomerInfo(customerInfo);
    } else if (!(await Purchases.isAnonymous())) {
      const info = await Purchases.logOut();
      applyCustomerInfo(info);
    }
  } catch {
    // Identity sync is best-effort; entitlement listener will catch up.
  }
}
