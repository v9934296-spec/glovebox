import { dismissScreen } from '../nav';

describe('dismissScreen', () => {
  it('calls back when the router has history', () => {
    const router = { canGoBack: () => true, back: jest.fn(), replace: jest.fn() };
    dismissScreen(router);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('replaces to the fallback when there is no history', () => {
    const router = { canGoBack: () => false, back: jest.fn(), replace: jest.fn() };
    dismissScreen(router, '/(auth)/sign-in');
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(auth)/sign-in');
  });
});
