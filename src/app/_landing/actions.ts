"use server";

import { createClient } from "@/lib/supabase/server";

export type ContactState = { error?: string; sent?: boolean };

export async function sendContactMessage(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const field = (key: string) => String(formData.get(key) ?? "").trim();
  const name = field("name");
  const email = field("email");
  const message = field("message");

  if (!name || !email || !message) return { error: "Please fill in your name, email and message." };
  if (message.length > 5000) return { error: "Your message is too long." };

  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").insert({
    name: name.slice(0, 200),
    email: email.slice(0, 320),
    phone: field("phone").slice(0, 40) || null,
    school_name: field("school_name").slice(0, 200) || null,
    message,
  });

  if (error) return { error: "Sorry, something went wrong. Please email us instead." };
  return { sent: true };
}
