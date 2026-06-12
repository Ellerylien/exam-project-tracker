import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function LoginScreen({ onLoginSuccess }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('team_users')
        .select('*');

      if (!error && data) {
        const guestUser = { id: 'guest', name: 'Guest', pin: '8888', role: 'Guest' };
        const fullData = [...data, guestUser];

        const roleWeight = { sales: 1, assistant: 2, admin: 3, guest: 4 };
        
        const sortedData = fullData.sort((a, b) => {
          const weightA = roleWeight[a.role?.toLowerCase()] || 99;
          const weightB = roleWeight[b.role?.toLowerCase()] || 99;
          return weightA - weightB;
        });
        
        setUsers(sortedData);
      }
      setLoading(false);
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (pin.length === 4 && selectedUser) {
      if (selectedUser.pin === pin) {
        setError('');
        onLoginSuccess(selectedUser);
      } else {
        setError('PIN 碼錯誤，請再試一次');
        setPin('');
        if (navigator.vibrate) navigator.vibrate(200);
      }
    }
  }, [pin, selectedUser, onLoginSuccess]);

  const getAvatarUrl = (name) => {
    return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
  };

  const handleNumberClick = (num) => {
    if (pin.length < 4) setPin(prev => prev + num);
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">正在載入團隊成員名單...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      
      {!selectedUser ? (
        <div className="w-full max-w-4xl text-center animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-black text-gray-800 mb-2 tracking-tight">誰正在使用系統？</h1>
          <p className="text-gray-400 text-sm mb-8 md:mb-12">請選擇您的身份進入專案管理看板</p>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6 px-2 md:px-4">
            {users.map(user => (
              <div 
                key={user.id}
                onClick={() => { setSelectedUser(user); setError(''); }}
                className="group flex flex-col items-center cursor-pointer transition-all duration-300 transform hover:-translate-y-2"
              >
                <div className="w-20 h-20 sm:w-28 sm:h-28 bg-white border-2 border-gray-200 group-hover:border-blue-500 rounded-full shadow-sm group-hover:shadow-md flex items-center justify-center overflow-hidden transition-all p-2">
                  <img src={getAvatarUrl(user.name)} alt={user.name} className="w-full h-full object-contain" />
                </div>
                <span className="mt-3 font-bold text-gray-700 group-hover:text-blue-600 transition-colors text-sm md:text-base">
                  {user.name}
                </span>
                <span className="text-xs text-gray-400 mt-0.5 px-2 py-0.5 bg-gray-100 rounded-full">
                  {user.role?.toLowerCase().includes('admin') ? '管理員' : 
                   user.role?.toLowerCase().includes('assistant') ? '業助' : 
                   user.role?.toLowerCase().includes('sales') ? '業務' : '訪客'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        
        <div className="w-full max-w-sm text-center animate-fade-in flex flex-col items-center">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-white border border-gray-200 rounded-full shadow-sm flex items-center justify-center overflow-hidden p-1.5 mb-3">
            <img src={getAvatarUrl(selectedUser.name)} alt={selectedUser.name} className="w-full h-full object-contain" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-1">歡迎回來，{selectedUser.name}</h2>
          <p className="text-gray-400 text-xs mb-6">請輸入 4 位數 PIN 碼</p>

          <div className="flex gap-4 mb-6 md:mb-8">
            {[0, 1, 2, 3].map(index => (
              <div 
                key={index} 
                className={`w-3.5 h-3.5 md:w-4 md:h-4 rounded-full border-2 transition-all duration-150 ${
                  pin.length > index 
                    ? 'bg-blue-600 border-blue-600 scale-110 shadow-sm' 
                    : 'bg-transparent border-gray-300'
                }`}
              />
            ))}
          </div>

          {error && <p className="text-red-500 text-xs font-medium mb-4 animate-bounce">{error}</p>}

          {/* RWD 優化：調整 PIN 碼鍵盤高度，避免在小螢幕需要往下拉 */}
          <div className="grid grid-cols-3 gap-3 w-full px-4 mb-4 md:mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleNumberClick(num)}
                className="h-12 md:h-14 bg-white hover:bg-gray-100 border border-gray-200 active:scale-95 text-gray-700 font-bold text-lg md:text-xl rounded-xl shadow-sm transition-all flex items-center justify-center"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setSelectedUser(null); setPin(''); }}
              className="h-12 md:h-14 text-gray-400 text-sm font-medium hover:text-gray-600 flex items-center justify-center"
            >
              返回
            </button>
            <button
              type="button"
              onClick={() => handleNumberClick(0)}
              className="h-12 md:h-14 bg-white hover:bg-gray-100 border border-gray-200 active:scale-95 text-gray-700 font-bold text-lg md:text-xl rounded-xl shadow-sm transition-all flex items-center justify-center"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-12 md:h-14 text-gray-400 hover:text-gray-600 flex items-center justify-center font-bold"
            >
              ⌫
            </button>
          </div>
        </div>
      )}
    </div>
  );
}