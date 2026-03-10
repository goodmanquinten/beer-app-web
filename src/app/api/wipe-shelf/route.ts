import { NextResponse } from "next/server";
import { removeAllFromShelf } from "@/actions/entries";

// Temporary route to wipe all entries. DELETE after use.
export async function POST() {
  const result = await removeAllFromShelf();
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
