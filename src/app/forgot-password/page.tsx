import { AuthLink, AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "./forgot-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to choose a new one."
      footer={
        <>
          Remembered it? <AuthLink href="/login">Log in</AuthLink>
        </>
      }
    >
      <ForgotForm />
    </AuthShell>
  );
}
