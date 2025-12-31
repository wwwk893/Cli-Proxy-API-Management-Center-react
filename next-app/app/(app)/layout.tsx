import { redirect } from "next/navigation";

import { Sidebar } from "@/components/layout/sidebar";
import { asAuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireSession();
  } catch (err) {
    const authError = asAuthError(err);
    if (authError && authError.status < 500) {
      redirect("/login");
    }
    throw err;
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto w-full px-4 py-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
