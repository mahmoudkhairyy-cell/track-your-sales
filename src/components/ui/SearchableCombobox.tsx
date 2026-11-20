"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

type SearchableComboboxProps = {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
};

export function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = "— اختر —",
  label,
}: SearchableComboboxProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      option.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);

  useEffect(() => {
    function handleOutsideClick(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("pointerdown", handleOutsideClick);
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, []);

  function choose(option: string) {
    onChange(option);
    setQuery("");
    setIsOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        filteredOptions.length ? (current + 1) % filteredOptions.length : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        filteredOptions.length
          ? (current - 1 + filteredOptions.length) % filteredOptions.length
          : 0,
      );
    } else if (event.key === "Enter" && isOpen && filteredOptions.length) {
      event.preventDefault();
      choose(filteredOptions[Math.min(activeIndex, filteredOptions.length - 1)]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setQuery("");
      setActiveIndex(0);
    }
  }

  const listboxId = `${id}-listbox`;
  const activeOptionId =
    isOpen && filteredOptions.length
      ? `${id}-option-${Math.min(activeIndex, filteredOptions.length - 1)}`
      : undefined;

  return (
    <div ref={rootRef} className="relative w-full" dir="rtl">
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-neutral-800">
        {label}
      </label>

      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        autoComplete="off"
        value={isOpen ? query : value}
        placeholder={placeholder}
        onFocus={() => {
          setQuery("");
          setActiveIndex(0);
          setIsOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className="min-h-12 w-full rounded-xl border border-orange-200 bg-white px-4 py-3 text-right text-base text-orange-800 outline-none transition placeholder:text-neutral-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
      />

      {isOpen ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-60 overflow-y-auto rounded-xl border border-orange-200 bg-white p-1 shadow-lg"
        >
          {filteredOptions.length ? (
            filteredOptions.map((option, index) => {
              const active = index === activeIndex;
              return (
                <li
                  key={option}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={value === option}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(option);
                  }}
                  className={`cursor-pointer rounded-lg px-3 py-2.5 text-right text-sm transition-colors ${
                    active
                      ? "bg-orange-50 text-orange-800"
                      : "text-neutral-800 hover:bg-orange-50 hover:text-orange-800"
                  }`}
                >
                  {option}
                </li>
              );
            })
          ) : (
            <li className="px-3 py-3 text-center text-sm text-neutral-500" role="status">
              مفيش نتائج مطابقة
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
