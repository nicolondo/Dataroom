import { Lock } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-lg font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-white">
            <Lock className="h-4 w-4" />
          </span>
          Data Room
        </div>
        {children}
      </div>
    </main>
  );
}
