import { useState, useEffect } from 'react';

export default function LoginScreen({ onLoginSuccess }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  
  // 🔥 新增：控制整個畫面淡出的狀態
  const [isFadingOut, setIsFadingOut] = useState(false);

const AVATAR_MAP = { 
    'Deborah': 'Deborah_6', 'Lisa': 'Lisa_50', 'Jessica': 'Jessica_16', 
    'Wanda': 'Wanda_40', 'Mark': 'Mark_33', 'Richard': 'Richard_58', 
    'Ellery': 'Ellery_9', 'Guest': 'Guest_5' 
  };

  const getAvatarUrl = (name) => { 
    if (!name) return `https://api.dicebear.com/7.x/notionists/svg?seed=fallback`;
    
    // 🔥 防呆機制：強制去除名字前後的不小心打到的空白字元
    const cleanName = name.trim();
    
    // 尋找對應的專屬編號，找不到就用原本的名字產圖
    const seed = AVATAR_MAP[cleanName] || cleanName; 
    return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}`; 
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users');
        const json = await res.json();
        const data = json.users || [];
        const hasGuest = data.some(u => u.name.toLowerCase() === 'guest');
        const fullData = [...data];
        if (!hasGuest) fullData.push({ id: 'guest', name: 'Guest', role: 'Guest' });
        const roleWeight = { sales: 1, assistant: 2, admin: 3, guest: 4 };
        setUsers(fullData.sort((a, b) => (roleWeight[a.role?.toLowerCase()] || 99) - (roleWeight[b.role?.toLowerCase()] || 99)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // 🔥 新增：鍵盤輸入支援機制
  useEffect(() => {
    if (!selectedUser || isFadingOut) return;
    
    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        setPin(prev => prev.length < 4 ? prev + e.key : prev);
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
        setSelectedUser(null);
        setPin('');
        setError('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedUser, isFadingOut]);

  useEffect(() => {
    if (pin.length !== 4 || !selectedUser) return;
    let cancelled = false;
    const verify = async () => {
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: selectedUser.name, pin }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (res.ok && json.ok) {
          setError('');
          setIsFadingOut(true); // 觸發離場動畫
          setTimeout(() => onLoginSuccess(json.user), 400); // 配合 CSS 動畫時間
        } else if (res.status === 429) {
          setError('嘗試太多次，請稍後再試');
          setPin('');
        } else {
          setError('PIN 碼錯誤');
          setPin('');
          if (navigator.vibrate) navigator.vibrate(200);
        }
      } catch {
        if (cancelled) return;
        setError('連線失敗，請再試一次');
        setPin('');
      }
    };
    verify();
    return () => { cancelled = true; };
  }, [pin, selectedUser, onLoginSuccess]);

  if (loading) return <div className="min-h-screen bg-paper flex items-center justify-center text-ink-muted text-sm font-medium animate-pulse">正在準備您的工作空間...</div>;

  return (
    <div className={`min-h-screen bg-paper flex flex-col items-center justify-center p-6 text-ink transition-opacity duration-400 ease-in-out ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}>
        {!selectedUser ? (
          <div className="w-full max-w-3xl text-center animate-fade-slide-up">
            <h1 className="text-3xl font-bold mb-3 tracking-tight text-ink">誰正在使用系統？</h1>
            <p className="text-ink-muted text-sm mb-16">請選擇您的身份進入</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-12">
              {users.map(user => (
                // 🔥 修改：為整個群組加上 hover:-translate-y-2 的上浮效果
                <div key={user.id} role="button" tabIndex={0} onClick={() => setSelectedUser(user)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedUser(user); } }} className="group flex flex-col items-center cursor-pointer transition-transform duration-300 ease-out hover:-translate-y-2">
                  <div className="w-24 h-24 md:w-28 md:h-28 bg-card border border-line group-hover:border-ink rounded-full flex items-center justify-center overflow-hidden transition-all duration-300 p-2 shadow-sm group-hover:shadow-lg">
                    <img src={getAvatarUrl(user.name)} alt={user.name} className="w-full h-full object-contain" />
                  </div>
                  <span className="mt-4 font-bold text-ink-soft group-hover:text-ink transition-colors">{user.name}</span>
                  {/* 🔥 修改：已將身份文字刪除，保持極簡留白 */}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full max-w-sm text-center flex flex-col items-center animate-fade-slide-up">
            <div className="w-20 h-20 bg-card border border-line rounded-full flex items-center justify-center overflow-hidden p-2 mb-4 shadow-sm">
              <img src={getAvatarUrl(selectedUser.name)} alt={selectedUser.name} className="w-full h-full object-contain" />
            </div>
            <h2 className="text-xl font-bold mb-8 text-ink">歡迎回來，{selectedUser.name}</h2>
            
            <div className="flex gap-5 mb-12">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-3 h-3 rounded-full transition-all duration-300 ${pin.length > i ? 'bg-ink scale-125 shadow-sm' : 'bg-line'}`} />
              ))}
            </div>

            {error && <p className="text-danger text-xs font-bold mb-6 animate-bounce">{error}</p>}

            <div className="grid grid-cols-3 gap-5 w-full">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button key={num} onClick={() => pin.length < 4 && setPin(p => p + num)} className="h-16 bg-card border border-line hover:border-ink rounded-full text-xl font-medium transition-all active:scale-90 shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-ink-soft">{num}</button>
              ))}
              <button onClick={() => { setSelectedUser(null); setPin(''); setError(''); }} className="h-16 text-ink-muted text-sm font-bold hover:text-ink uppercase tracking-widest transition-colors">返回</button>
              <button onClick={() => pin.length < 4 && setPin(p => p + 0)} className="h-16 bg-card border border-line hover:border-ink rounded-full text-xl font-medium transition-all active:scale-90 shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-ink-soft">0</button>
              <button onClick={() => setPin(p => p.slice(0, -1))} className="h-16 text-ink-muted hover:text-ink text-xl flex items-center justify-center transition-colors">⌫</button>
            </div>
          </div>
        )}
    </div>
  );
}