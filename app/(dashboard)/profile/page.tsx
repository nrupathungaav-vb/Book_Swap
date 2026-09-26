import type { Metadata } from "next";
import { PartyPopper } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ProfileForm } from "@/components/profile/profile-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile, requireUserOrRedirect } from "@/lib/auth/session";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  await requireUserOrRedirect("/profile");
  const profile = await getCurrentProfile();
  if (!profile) notFound();
  const { welcome } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Profile"
        title="Your profile"
        description="This is how other readers see you. Your email and exact location are never shown."
      />
      {welcome && (
        <Alert variant="success">
          <PartyPopper aria-hidden />
          <AlertTitle>Welcome to BookSwap!</AlertTitle>
          <AlertDescription>
            Set your city and approximate location, then list your first book.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Photo</CardTitle>
        </CardHeader>
        <CardContent>
          <AvatarUploader name={profile.full_name} avatarUrl={profile.avatar_url} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <p className="text-muted-foreground text-sm">Signed in as {profile.email}</p>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>
    </div>
  );
}
