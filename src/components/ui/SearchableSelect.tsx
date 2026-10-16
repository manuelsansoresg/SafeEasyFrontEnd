"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  id: number;
  name: string;
};

interface SearchableSelectProps {
  id: string;
  value: SearchableSelectOption | null;
  options: SearchableSelectOption[];
  onChange: (option: SearchableSelectOption | null) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
}

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder = "Buscar...",
  emptyLabel = "Sin resultados",
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return options;
    return options.filter((option) => normalizeText(option.name).includes(normalizedQuery));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open || !filteredOptions[activeIndex]) return;
    document.getElementById(`${id}-option-${filteredOptions[activeIndex].id}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, filteredOptions, id, open]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const selectOption = (option: SearchableSelectOption) => {
    onChange(option);
    setOpen(false);
    setQuery("");
    buttonRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setActiveIndex(Math.max(0, options.findIndex((option) => option.id === value?.id)));
          setOpen((current) => !current);
        }}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500",
          className,
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn("min-w-0 truncate", !value && "text-gray-400")}>
          {value?.name || placeholder}
        </span>
        <ChevronDown size={16} className="shrink-0 text-gray-500" />
      </button>

      {open ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              ref={inputRef}
              type="text"
              name={`${id}-search`}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setOpen(false);
                  setQuery("");
                  buttonRef.current?.focus();
                } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  if (filteredOptions.length === 0) return;
                  setActiveIndex((index) => event.key === "ArrowDown"
                      ? Math.min(index + 1, filteredOptions.length - 1)
                      : Math.max(index - 1, 0));
                } else if (event.key === "Enter" && filteredOptions[activeIndex]) {
                  event.preventDefault();
                  selectOption(filteredOptions[activeIndex]);
                }
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={`${id}-options`}
              aria-activedescendant={filteredOptions[activeIndex] ? `${id}-option-${filteredOptions[activeIndex].id}` : undefined}
              className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <div id={`${id}-options`} className="max-h-56 overflow-y-auto py-1" role="listbox" aria-labelledby={id}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const selected = value?.id === option.id;
                return (
                  <button
                    key={option.id}
                    id={`${id}-option-${option.id}`}
                    type="button"
                    onClick={() => selectOption(option)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-primary/5",
                      selected ? "bg-primary/5 font-semibold text-primary" : "text-gray-700",
                      activeIndex === index && "bg-primary/10",
                    )}
                    role="option"
                    aria-selected={selected}
                  >
                    <span className="min-w-0 truncate">{option.name}</span>
                    {selected ? <Check size={16} className="shrink-0" /> : null}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-3 text-sm text-gray-500">{emptyLabel}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
