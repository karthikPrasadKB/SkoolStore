"use client";

import { useState } from "react";
import { InfoTip } from "@/components/info-tip";

const ID_TIP =
  "The admission or ID number printed on your child's school ID card. No ID card? Tick the box below and make up " +
  "your own 6-character code using letters and numbers (e.g. AB12CD). Your child gives this number or code at the counter.";

// The child's school ID card number, or, if they have no ID card, a 6-character code the parent makes up.
export function IdCardField({
  id,
  defaultValue = "",
  inputClass,
}: {
  id: string;
  defaultValue?: string;
  inputClass: string;
}) {
  const [noCard, setNoCard] = useState(false);

  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <label htmlFor={id} className="text-sm font-semibold text-slate-700">
          {noCard ? "Your own 6-character code" : "ID card number"}
        </label>
        <InfoTip text={ID_TIP} />
      </div>
      <input
        id={id}
        name="id_card_number"
        defaultValue={defaultValue}
        required={noCard}
        maxLength={noCard ? 6 : 30}
        minLength={noCard ? 6 : undefined}
        pattern={noCard ? "[A-Za-z0-9]{6}" : undefined}
        title={noCard ? "Exactly 6 letters or numbers, e.g. AB12CD" : undefined}
        placeholder={noCard ? "e.g. AB12CD" : "e.g. 2024/0153"}
        autoComplete="off"
        className={`${inputClass} font-mono uppercase`}
      />
      <input type="hidden" name="no_id_card" value={noCard ? "1" : ""} />
      <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={noCard}
          onChange={(e) => setNoCard(e.target.checked)}
          className="h-3.5 w-3.5 accent-accent-500"
        />
        My child doesn&apos;t have an ID card. I&apos;ll make up a code.
      </label>
    </div>
  );
}
