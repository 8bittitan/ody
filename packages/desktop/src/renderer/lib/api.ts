import type { OdyApi } from '@/types/ipc';

const assertApi = () => {
  if (typeof window === 'undefined' || !window.ody) {
    throw new Error('window.ody is not available outside the Electron renderer process');
  }

  return window.ody;
};

export const api: OdyApi = new Proxy({} as OdyApi, {
  get(_target, prop, receiver) {
    return Reflect.get(assertApi(), prop, receiver);
  },
});
