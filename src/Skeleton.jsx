// 骨架屏的基本積木：一塊柔和脈動的米灰色塊，用 className 決定形狀
export default function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded bg-line/70 ${className}`} />;
}
