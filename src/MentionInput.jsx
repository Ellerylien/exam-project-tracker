import { useRef, useState } from 'react';
import { roleLabel } from './team';

// 留言輸入框 + @提及選單：輸入 @（或按右側 @ 按鈕）跳出成員清單，邊打邊篩選，
// 選了插入「@名字 」。送出時由 team.js 的 extractMentions 解析出被提到的人，
// api/notify.js 會推「某某 提到你」的手機通知給他們。

// 游標前面是「@查詢字」就回傳 { start: @ 的位置, query }；前一個字是英數或 . 時視為 Email，不跳選單
function findMentionQuery(text, caret) {
  const match = /(?:^|[^A-Za-z0-9_.])@([^\s@]*)$/.exec(text.slice(0, caret));
  if (!match) return null;
  return { start: caret - match[1].length - 1, query: match[1] };
}

export default function MentionInput({ value, onChange, onSubmit, members, getAvatarUrl, placeholder, className }) {
  const inputRef = useRef(null);
  const [mention, setMention] = useState(null); // { start, query } | null
  const [highlight, setHighlight] = useState(0);

  const options = mention
    ? members.filter(m => m.name.toLowerCase().startsWith(mention.query.toLowerCase()))
    : [];
  const open = options.length > 0;

  const sync = (text, caret) => {
    const next = findMentionQuery(text, caret);
    // 查詢字變了才把反白移回第一項，方向鍵移動游標時不會亂跳
    if (next?.query !== mention?.query) setHighlight(0);
    setMention(next);
  };

  const placeCaret = (pos) => requestAnimationFrame(() => {
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(pos, pos);
  });

  const choose = (name) => {
    const caret = inputRef.current.selectionStart ?? value.length;
    const insert = `@${name} `;
    const rest = value.slice(caret).replace(/^ /, '');
    onChange(value.slice(0, mention.start) + insert + rest);
    setMention(null);
    placeCaret(mention.start + insert.length);
  };

  // 手機上打 @ 要切鍵盤，右側按鈕直接插入 @ 並跳出清單
  const openPicker = () => {
    const caret = inputRef.current.selectionStart ?? value.length;
    const insert = caret > 0 && /[A-Za-z0-9_.]/.test(value[caret - 1]) ? ' @' : '@';
    const pos = caret + insert.length;
    onChange(value.slice(0, caret) + insert + value.slice(caret));
    setHighlight(0);
    setMention({ start: pos - 1, query: '' });
    placeCaret(pos);
  };

  const handleKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return; // 注音選字的 Enter 不算送出
    if (open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setHighlight(h => (h + step + options.length) % options.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        choose(options[Math.min(highlight, options.length - 1)].name);
        return;
      }
      if (e.key === 'Escape') {
        // 只關選單，不要連專案視窗一起關（視窗的 ESC 監聽在 window 上）
        e.preventDefault();
        e.stopPropagation();
        setMention(null);
        return;
      }
    }
    if (e.key === 'Enter') onSubmit();
  };

  return (
    <div className="relative flex-1 w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); sync(e.target.value, e.target.selectionStart); }}
        onSelect={(e) => sync(e.target.value, e.target.selectionStart)}
        onKeyDown={handleKeyDown}
        onBlur={() => setMention(null)}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={openPicker}
        title="提及成員（對方會收到手機通知）"
        aria-label="提及成員"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded text-ink-muted hover:text-ink hover:bg-paper font-bold text-sm transition-colors"
      >
        @
      </button>

      {open && (
        <ul role="listbox" aria-label="提及成員" className="absolute bottom-full left-0 mb-2 w-60 max-w-full bg-card border border-line rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.10)] py-1 z-10 max-h-64 overflow-y-auto">
          {options.map((m, i) => (
            <li
              key={m.name}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => { e.preventDefault(); choose(m.name); }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm ${i === highlight ? 'bg-paper' : ''}`}
            >
              <img src={getAvatarUrl(m.name)} alt="" className="w-6 h-6 rounded-full border border-line bg-card object-contain p-px shrink-0" />
              <span className="font-bold text-ink">{m.name}</span>
              <span className="ml-auto text-[11px] text-ink-muted">{roleLabel(m.role)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
