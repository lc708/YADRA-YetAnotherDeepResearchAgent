"use server";

import { nanoid } from "nanoid";
import { redirect } from "next/navigation";

export async function submitHeroInput(formData: FormData) {
  const content = formData.get("content") as string;

  if (!content?.trim()) {
    throw new Error("Content is required");
  }

  const traceId = nanoid();

  redirect(`/workspace/${traceId}?q=${encodeURIComponent(content)}`);
}
