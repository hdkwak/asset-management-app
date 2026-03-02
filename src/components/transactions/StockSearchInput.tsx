import React, { useState, useEffect, useRef } from 'react';
import { searchStocks } from '../../api/client';
import type { StockSearchResult } from '../../types';

interface Props {
  value: string;
  onChange: (name: string, code: string) => void;
  placeholder?: string;
  className?: string;
}

export function StockSearchInput({ value, onChange, placeholder, className }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes (e.g. when editing an existing transaction)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchStocks(query);
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (r: StockSearchResult) => {
    setQuery(r.name);
    setOpen(false);
    onChange(r.name, r.code);
  };

  const baseInput =
    className ??
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value, ''); // clear code while typing
        }}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        placeholder={placeholder ?? '삼성전자'}
        className={baseInput}
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2">
          <span className="block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </span>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {results.map((r) => (
            <li key={r.code}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex items-center justify-between gap-2"
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent blur before click registers
                  select(r);
                }}
              >
                <span className="font-medium text-gray-900 truncate">{r.name}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  {r.code} · {r.market}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
