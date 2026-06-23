import React, { useState, useRef, useEffect } from 'react';
import { RECOMMENDED_MODELS } from '../services/models';

interface ModelComboboxProps {
  value: string;
  onChange: (model: string) => void;
  models: string[] | null; // null = not fetched yet / failed
  id?: string;
}

export function ModelCombobox({ value, onChange, models, id = 'model-combobox' }: ModelComboboxProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = `${id}-listbox`;
  const optionId = (idx: number) => `${id}-opt-${idx}`;

  useEffect(() => { setQuery(value); }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Scroll highlighted item into view. Declared before any early return so hook
  // order stays stable when `models` flips from null to a list.
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('li[data-model]');
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  // Free-text mode: no models loaded
  if (!models) {
    return (
      <input
        id={id}
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); }}
        placeholder="e.g. gpt-5.4-mini"
        style={inputStyle}
      />
    );
  }

  const lowerQuery = query.toLowerCase();
  const recommended = models.filter(m => RECOMMENDED_MODELS.includes(m));
  const other = models.filter(m => !RECOMMENDED_MODELS.includes(m));

  const filterList = (list: string[]) =>
    lowerQuery ? list.filter(m => m.toLowerCase().includes(lowerQuery)) : list;

  const filteredRecommended = filterList(recommended);
  const filteredOther = showAll ? filterList(other) : [];
  const allVisible = [...filteredRecommended, ...filteredOther];

  function select(model: string) {
    setQuery(model);
    onChange(model);
    setOpen(false);
    setHighlightIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'Enter' && highlightIndex >= 0 && highlightIndex < allVisible.length) {
      e.preventDefault();
      select(allVisible[highlightIndex]);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(i => Math.min(i + 1, allVisible.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(i => Math.max(i - 1, 0));
    }
  }

  const renderOption = (m: string, idx: number) => (
    <li
      key={m}
      id={optionId(idx)}
      role="option"
      aria-selected={highlightIndex === idx}
      data-model={m}
      onClick={() => select(m)}
      onMouseEnter={() => setHighlightIndex(idx)}
      style={{
        ...itemStyle,
        background: highlightIndex === idx ? 'var(--primary)' : 'transparent',
        color: highlightIndex === idx ? 'var(--primary-foreground)' : 'var(--foreground)',
      }}
    >
      {m}
    </li>
  );

  const hasRecommended = filteredRecommended.length > 0;
  const hasOther = showAll && filteredOther.length > 0;
  const recommendedCount = filteredRecommended.length;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flex: 1 }}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && highlightIndex >= 0 ? optionId(highlightIndex) : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlightIndex(-1);
          // Also update parent so typed values are saved
          onChange(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Select or type a model..."
        style={inputStyle}
      />

      {open && allVisible.length > 0 && (
        <ul ref={listRef} role="listbox" id={listId} style={dropdownStyle}>
          {hasRecommended && (
            <li role="presentation" style={sectionHeaderStyle}>Recommended</li>
          )}
          {hasRecommended && filteredRecommended.map((m, i) => renderOption(m, i))}

          {hasRecommended && !showAll && other.length > 0 && (
            <li
              role="option"
              aria-selected={false}
              onClick={() => setShowAll(true)}
              style={{ ...itemStyle, color: 'var(--muted-foreground)', fontStyle: 'italic', cursor: 'pointer' }}
            >
              Show all models ({other.length} more)
            </li>
          )}

          {hasOther && (
            <>
              <li role="presentation" style={sectionHeaderStyle}>All Models</li>
              {filteredOther.map((m, j) => renderOption(m, recommendedCount + j))}
            </>
          )}

          {/* No recommended at all — show everything directly */}
          {!hasRecommended && allVisible.map((m, i) => renderOption(m, i))}
        </ul>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  background: 'var(--background)',
  color: 'var(--foreground)',
  fontSize: '13px',
  boxSizing: 'border-box',
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  maxHeight: '200px',
  overflowY: 'auto',
  margin: '4px 0 0',
  padding: 0,
  listStyle: 'none',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  background: 'var(--background)',
  zIndex: 10,
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--muted-foreground)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const itemStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: '13px',
  cursor: 'pointer',
};
