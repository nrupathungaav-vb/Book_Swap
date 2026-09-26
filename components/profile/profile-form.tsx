"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { updateProfile } from "@/actions/profile";
import { LocationPicker } from "@/components/map/location-picker";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { profileSchema } from "@/lib/validations/profile";
import type { Profile } from "@/types";

type FormInput = z.input<typeof profileSchema>;
type FormOutput = z.output<typeof profileSchema>;

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    profile.geo_lat != null && profile.geo_lng != null ? { lat: profile.geo_lat, lng: profile.geo_lng } : null,
  );
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile.full_name ?? "",
      bio: profile.bio ?? "",
      locationCity: profile.location_city ?? "",
      geoLat: profile.geo_lat,
      geoLng: profile.geo_lng,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await updateProfile(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Saved.");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormField id="fullName" label="Name" required error={errors.fullName?.message}>
        <Input autoComplete="name" maxLength={80} {...form.register("fullName")} />
      </FormField>
      <FormField id="bio" label="About you" description="What do you like to read? Shown on your listings." error={errors.bio?.message}>
        <Textarea rows={3} maxLength={500} {...form.register("bio")} />
      </FormField>
      <FormField id="locationCity" label="City or neighbourhood" description="Shown publicly next to your listings." error={errors.locationCity?.message}>
        <Input autoComplete="address-level2" maxLength={80} {...form.register("locationCity")} />
      </FormField>
      <div className="space-y-2">
        <Label>Approximate location (private)</Label>
        <LocationPicker
          value={location}
          onChange={(next) => {
            setLocation(next);
            form.setValue("geoLat", next?.lat ?? null, { shouldDirty: true });
            form.setValue("geoLng", next?.lng ?? null, { shouldDirty: true });
          }}
        />
        {errors.geoLat && <p className="text-xs text-destructive" role="alert">{errors.geoLat.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Save profile
      </Button>
    </form>
  );
}
