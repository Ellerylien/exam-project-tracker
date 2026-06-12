import { createContext, useContext } from 'react';

// App 透過此 context 提供「重新計算未讀數」的函式給深層元件呼叫。
// 未讀狀態的所有變動都發生在 ProjectDetailModal（開卡清除、留言設定、換狀態清除）。
export const UnreadContext = createContext(null);

export function useUnreadRefresh() {
  return useContext(UnreadContext);
}
