"use client";

// Form pieces for adding an admin or partner (used in HQ and on a client admin's Dashboard).

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

// Name, username, phone, optional email and temporary password for a new admin account.
export function AdminFields() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <input name="full_name" required maxLength={100} placeholder="Admin's full name" className={inputClass} />
      <input
        name="username"
        required
        pattern="[a-zA-Z0-9._]{3,30}"
        title="3–30 letters, numbers, dots or underscores"
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        placeholder="Username for login"
        className={`${inputClass} lowercase`}
      />
      <input name="phone" type="tel" required maxLength={20} placeholder="Admin's phone" className={inputClass} />
      <input name="email" type="email" required placeholder="Admin's email" className={inputClass} />
      <input
        name="password"
        type="text"
        required
        minLength={8}
        autoComplete="off"
        placeholder="Temporary password (8+ characters)"
        className={`${inputClass} sm:col-span-2`}
      />
    </div>
  );
}

export function SchoolChecks({ schools }: { schools: { id: string; name: string }[] }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Schools they manage
      </legend>
      <div className="flex flex-wrap gap-2">
        {schools.map((school) => (
          <label key={school.id} className="cursor-pointer">
            <input type="checkbox" name="school_ids" value={school.id} defaultChecked className="peer sr-only" />
            <span className="block rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-500 transition peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-700">
              {school.name}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ExistingToggle({ existing, setExisting }: { existing: boolean; setExisting: (v: boolean) => void }) {
  return (
    <div className="flex rounded-lg bg-white p-1 text-xs font-semibold ring-1 ring-slate-200">
      {[
        { value: false, label: "New account" },
        { value: true, label: "Existing staff username" },
      ].map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => setExisting(o.value)}
          className={`flex-1 rounded-md py-1.5 ${existing === o.value ? "bg-slate-900 text-white" : "text-slate-600"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ExistingUsername() {
  return (
    <input
      name="existing_username"
      required
      autoCapitalize="none"
      spellCheck={false}
      placeholder="Their username, e.g. ramesh.k"
      className={`${inputClass} lowercase`}
    />
  );
}
