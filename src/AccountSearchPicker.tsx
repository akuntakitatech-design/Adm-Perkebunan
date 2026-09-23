import { useEffect, useMemo, useState } from 'react';

export type AccountSearchOption = {
  id: string;
  code: string;
  name: string;
};

type Props = {
  accounts: AccountSearchOption[];
  value: string;
  onChange: (accountId: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

const codeCollator = new Intl.Collator('id-ID', { numeric: true, sensitivity: 'base' });

export default function AccountSearchPicker({ accounts, value, onChange, placeholder = 'Ketik kode atau nama akun...', className = '', disabled = false, ariaLabel = 'Cari akun COA' }: Props) {
  const sortedAccounts = useMemo(() => [...accounts].sort((a, b) => codeCollator.compare(a.code, b.code) || a.name.localeCompare(b.name, 'id-ID')), [accounts]);
  const selected = sortedAccounts.find(item => item.id === value);
  const selectedLabel = selected ? `${selected.code} - ${selected.name}` : '';
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) setQuery(selectedLabel);
  }, [selectedLabel, open]);

  const searchText = (open && selected && query === selectedLabel ? '' : query).trim().toLowerCase();
  const filtered = sortedAccounts.filter(item => !searchText || item.code.toLowerCase().includes(searchText) || item.name.toLowerCase().includes(searchText));
  const choose = (item: AccountSearchOption) => {
    setQuery(`${item.code} - ${item.name}`);
    onChange(item.id);
    setOpen(false);
  };

  return <div className={`cash-account-picker ${className}`.trim()}>
    <input
      type="text"
      autoComplete="off"
      disabled={disabled}
      value={query}
      placeholder={placeholder}
      role="combobox"
      aria-label={ariaLabel}
      aria-autocomplete="list"
      aria-expanded={open}
      onFocus={event => {
        setOpen(true);
        event.currentTarget.select();
      }}
      onBlur={() => setOpen(false)}
      onChange={event => {
        setQuery(event.target.value);
        if (value) onChange('');
        setOpen(true);
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') setOpen(false);
        if (event.key === 'Enter' && open && filtered[0]) {
          event.preventDefault();
          choose(filtered[0]);
        }
      }}
    />
    {open && !disabled && <div className="cash-account-options" role="listbox">
      {filtered.length === 0 ? <div className="cash-account-empty">Akun tidak ditemukan.</div> : filtered.slice(0, 100).map(item => <button key={item.id} type="button" role="option" aria-selected={item.id === value} onMouseDown={event => event.preventDefault()} onClick={() => choose(item)}><strong>{item.code}</strong><span>{item.name}</span></button>)}
    </div>}
  </div>;
}
