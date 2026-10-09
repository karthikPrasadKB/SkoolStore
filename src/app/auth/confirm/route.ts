import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Links in emails (password reset, email confirmation) land here. They carry a one-time token that logs the
// person in. This works even if the email is opened on a different phone or computer than the one that asked.
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      if (type === "recovery") {
        // A password reset: they must choose a new password before doing anything else.
        await supabase.auth.updateUser({ data: { must_change_password: true, password_reset: true } });
        await supabase.auth.refreshSession();
        return NextResponse.redirect(new URL("/account/password", request.url));
      }
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
