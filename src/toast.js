import { createContext, useContext } from 'react';

// Toast 的 context 與 hook；Provider 元件在 ToastProvider.jsx
// 用法：const toast = useToast(); toast.success('已儲存'); toast.error('失敗')
export const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}
