import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
      <h1 className="text-lg font-semibold">Sign in</h1>
      <p className="mb-5 text-sm text-muted">Manage your data rooms and invitations.</p>
      <LoginForm />
      {process.env.ALLOW_SIGNUP !== "false" && (
        <p className="mt-5 text-center text-sm text-muted">
          New here?{" "}
          <Link href="/signup" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </p>
      )}
    </div>
  );
}
