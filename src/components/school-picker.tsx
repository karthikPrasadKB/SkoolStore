"use client";

import { useId, useRef, useState } from "react";
import { Check, ChevronDown, School as SchoolIcon, X } from "lucide-react";

export type School = { id: string; name: string; join_code: string };

// Searchable dropdown of schools. Type part of a name or code to filter.
// Selected codes are submitted as hidden inputs called `name`.
export function SchoolPicker({
  schools,
  name,
  multiple = false,
  selected,
  onChange,
  placeholder = "Search by school name or code",
}: {
  schools: School[];
  name: string;
  multiple?: boolean;
  selected: string[];
  onChange: (codes: string[]) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const term = query.trim().toLowerCase();
  const matches = schools.filter(
    (s) => !term || s.name.toLowerCase().includes(term) || s.join_code.toLowerCase().includes(term),
  );
  const selectedSchools = selected
    .map((code) => schools.find((s) => s.join_code === code))
    .filter((s): s is School => Boolean(s));

  function choose(school: School) {
    if (multiple) {
      onChange(
        selected.includes(school.join_code)
          ? selected.filter((c) => c !== school.join_code)
          : [...selected, school.join_code],
      );
      setQuery("");
      inputRef.current?.focus();
    } else {
      onChange([school.join_code]);
      setQuery("");
      setOpen(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && open && matches[highlight]) {
      e.preventDefault();
      choose(matches[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !query && multiple && selected.length) {
      onChange(selected.slice(0, -1));
    }
  }

  const single = !multiple ? selectedSchools[0] : undefined;

  return (
    <div className="relative">
      {selected.map((code) => (
        <input key={code} type="hidden" name={name} value={code} />
      ))}

      {multiple && selectedSchools.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedSchools.map((school) => (
            <span
              key={school.join_code}
              className="flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-3 pr-1.5 text-sm font-semibold text-brand-700"
            >
              {school.name} <span className="font-mono text-xs text-brand-500">{school.join_code}</span>
              <button
                type="button"
                onClick={() => onChange(selected.filter((c) => c !== school.join_code))}
                className="rounded-full p-0.5 hover:bg-brand-100"
                title={`Remove ${school.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <SchoolIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={single && !open ? `${single.name} · ${single.join_code}` : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => {
            setOpen(true);
            if (single) setQuery("");
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          autoComplete="off"
          placeholder={multiple && selectedSchools.length ? "Add another school" : placeholder}
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-9 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500">No school matches &ldquo;{query}&rdquo;</li>
          ) : (
            matches.map((school, index) => {
              const isSelected = selected.includes(school.join_code);
              return (
                <li
                  key={school.id}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(school);
                  }}
                  onMouseEnter={() => setHighlight(index)}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm ${
                    index === highlight ? "bg-slate-100" : ""
                  }`}
                >
                  <span className="font-medium text-slate-900">{school.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                      {school.join_code}
                    </span>
                    {isSelected && <Check className="h-4 w-4 text-brand-600" />}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
