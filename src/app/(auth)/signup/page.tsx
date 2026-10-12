import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  if (process.env.ALLOW_SIGNUP === "false") redirect("/login");
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
      <h1 className="text-lg font-semibold">Create your account</h1>
      <p className="mb-5 text-sm text-muted">Set up an owner account to start sharing documents.</p>
      <SignupForm />
      <p className="mt-5 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
