"use client";

import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, Check, Info, Loader2, MapPin, MapPinned, X } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { respondToMeeting, suggestMeeting } from "@/actions/meetings";
import type { MapPin as Pin } from "@/components/map/leaflet-map";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeetings } from "@/hooks/use-meetings";
import { cn, formatDateTime, formatRelativeTime } from "@/lib/utils";
import { meetingSchema } from "@/lib/validations/meeting";
import type { MeetingLocation } from "@/types";

const LeafletMap = dynamic(() => import("@/components/map/leaflet-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

type FormInput = z.input<typeof meetingSchema>;
type FormOutput = z.output<typeof meetingSchema>;

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function MeetingPanel({
  swapId,
  userId,
  otherName,
  initialMeetings,
  canArrange,
  defaultCenter,
}: {
  swapId: string;
  userId: string;
  otherName: string;
  initialMeetings: MeetingLocation[];
  canArrange: boolean;
  defaultCenter: { lat: number; lng: number } | null;
}) {
  const { meetings, upsertLocal } = useMeetings(swapId, initialMeetings);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [responding, startResponding] = useTransition();
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);

  const agreed = meetings.find((m) => m.agreed_status === "Accepted");
  const open = meetings.filter((m) => m.agreed_status === "Suggested");

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(meetingSchema),
    defaultValues: { swapId, lat: 0, lng: 0, locationName: "", suggestedTime: "" },
  });

  const pins: Pin[] = useMemo(() => {
    const list: Pin[] = meetings
      .filter((m) => m.agreed_status !== "Rejected")
      .map((m) => ({
        id: m.id,
        lat: m.lat,
        lng: m.lng,
        label: `${m.location_name} (${m.agreed_status === "Accepted" ? "agreed" : "suggested"})`,
        tone: m.agreed_status === "Accepted" ? "agreed" : "suggested",
      }));
    if (draft)
      list.push({ id: "draft", lat: draft.lat, lng: draft.lng, label: "Your new suggestion", tone: "draft" });
    return list;
  }, [meetings, draft]);

  const first = agreed ?? open[0] ?? meetings[0];
  const center = first ? { lat: first.lat, lng: first.lng } : (defaultCenter ?? { lat: 20.59, lng: 78.96 });
  const zoom = first ? 15 : defaultCenter ? 12 : 4;

  const onPick = (lat: number, lng: number) => {
    if (!canArrange) return;
    setDraft({ lat, lng });
    form.setValue("lat", lat);
    form.setValue("lng", lng);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const suggestedTime = values.suggestedTime ? new Date(values.suggestedTime).toISOString() : null;
    const result = await suggestMeeting({ ...values, suggestedTime });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    upsertLocal(result.data);
    setDraft(null);
    form.reset({ swapId, lat: 0, lng: 0, locationName: "", suggestedTime: "" });
    toast.success(result.message ?? "Suggested.");
  });

  const respond = (meeting: MeetingLocation, accept: boolean) =>
    startResponding(async () => {
      const result = await respondToMeeting(meeting.id, accept);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      upsertLocal(result.data);
      toast.success(result.message ?? "Done.");
    });

  return (
    <section
      aria-labelledby="meeting-heading"
      className="bg-card flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm"
    >
      <header className="border-b px-4 py-3">
        <h2 id="meeting-heading" className="flex items-center gap-2 font-sans text-sm font-semibold">
          <MapPinned className="text-primary size-4" aria-hidden /> Meeting spot
        </h2>
        {agreed ? (
          <p className="mt-1 text-sm">
            <Badge variant="forest" className="mr-1.5">
              <Check aria-hidden /> Agreed
            </Badge>
            <span className="font-medium">{agreed.location_name}</span>
            {agreed.suggested_time && (
              <span className="text-muted-foreground"> · {formatDateTime(agreed.suggested_time)}</span>
            )}
          </p>
        ) : (
          <p className="text-muted-foreground mt-1 text-xs">
            {canArrange
              ? "Tap the map to drop a pin, then name the place."
              : "Meeting spots can be arranged once the swap is accepted."}
          </p>
        )}
      </header>

      <div className="relative h-72 shrink-0 md:h-80">
        <LeafletMap
          center={center}
          zoom={zoom}
          pins={pins}
          onPick={canArrange ? onPick : undefined}
          focus={focus}
        />
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <Alert variant="info">
          <Info aria-hidden />
          <AlertDescription>
            Pick a busy public place — a library, café, mall or station — and meet in daylight. Never share
            your home address.
          </AlertDescription>
        </Alert>

        {canArrange && draft && (
          <form onSubmit={onSubmit} className="bg-secondary/40 space-y-3 rounded-xl border p-3" noValidate>
            <p className="text-sm font-medium">Suggest this spot</p>
            <FormField
              id="meeting-name"
              label="Place name"
              required
              error={form.formState.errors.locationName?.message}
            >
              <Input
                maxLength={120}
                placeholder="e.g. Central Library, main entrance"
                {...form.register("locationName")}
              />
            </FormField>
            <FormField
              id="meeting-time"
              label="Proposed time"
              error={form.formState.errors.suggestedTime?.message}
            >
              <Input
                type="datetime-local"
                min={toLocalInputValue(new Date())}
                {...form.register("suggestedTime")}
              />
            </FormField>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Suggest to{" "}
                {otherName}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)}>
                Discard pin
              </Button>
            </div>
          </form>
        )}

        {meetings.length === 0 ? (
          <p className="text-muted-foreground text-center text-sm">No meeting spots suggested yet.</p>
        ) : (
          <ul className="space-y-2" aria-label="Meeting suggestions">
            {meetings.map((meeting) => {
              const mine = meeting.suggested_by_user_id === userId;
              return (
                <li
                  key={meeting.id}
                  className={cn(
                    "rounded-xl border p-3 text-sm",
                    meeting.agreed_status === "Accepted" && "border-forest/40 bg-forest/5",
                    meeting.agreed_status === "Rejected" && "opacity-60",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        className="text-left font-medium hover:underline"
                        onClick={() => setFocus({ lat: meeting.lat, lng: meeting.lng })}
                      >
                        {meeting.location_name}
                      </button>
                      <p className="text-muted-foreground text-xs">
                        {mine ? "You suggested" : `${otherName} suggested`} ·{" "}
                        {formatRelativeTime(meeting.created_at)}
                      </p>
                      {meeting.suggested_time && (
                        <p className="mt-1 flex items-center gap-1 text-xs">
                          <CalendarClock className="size-3.5" aria-hidden />{" "}
                          {formatDateTime(meeting.suggested_time)}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={
                        meeting.agreed_status === "Accepted"
                          ? "forest"
                          : meeting.agreed_status === "Rejected"
                            ? "muted"
                            : "amber"
                      }
                    >
                      {meeting.agreed_status}
                    </Badge>
                  </div>
                  {canArrange && !mine && meeting.agreed_status === "Suggested" && (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="forest"
                        disabled={responding}
                        onClick={() => respond(meeting, true)}
                      >
                        <Check aria-hidden /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={responding}
                        onClick={() => respond(meeting, false)}
                      >
                        <X aria-hidden /> Decline
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
