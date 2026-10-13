import { requireUser } from "@/lib/auth";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { ChangePasswordForm, ProfileForm, TestEmailForm } from "./forms";
import { emailConfigured } from "@/lib/email";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="My account" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <div className="p-5">
            <ProfileForm user={user} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Change password" />
          <div className="p-5">
            <ChangePasswordForm />
          </div>
        </Card>
        <Card>
          <CardHeader title="Email delivery" />
          <div className="p-5">
            <TestEmailForm configured={emailConfigured()} from={process.env.EMAIL_FROM || "(default sender)"} />
          </div>
        </Card>
      </div>
    </>
  );
}
