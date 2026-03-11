"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { Beer, BeerEntry } from "@/lib/types/database";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BeerShelfProps {
  entries: BeerEntry[];
  onSelectBeer: (beer: Beer, entries: BeerEntry[]) => void;
  arrangement?: string[];
  onArrangementChange?: (beerIds: string[]) => void;
  onAddBeer?: () => void;
}

type SlotItem =
  | { id: string; type: "beer"; beer: Beer; entries: BeerEntry[] }
  | { id: string; type: "empty" };

interface LayoutConfig {
  cols: number;
  /** Height of the can image in px */
  canHeight: number;
  /** Width of each grid column in px */
  slotWidth: number;
  /** Column gap in px */
  gap: number;
  /** Minimum shelf rows to show */
  minRows: number;
}

// ─── Adaptive Layout ─────────────────────────────────────────────────────────
// The can renders are ~2:3 aspect ratio (width:height) after trimming.
// canWidth ≈ canHeight * 0.67

function getLayoutConfig(beerCount: number, containerWidth: number): LayoutConfig {
  const narrow = containerWidth > 0 && containerWidth < 340;

  let cols: number;
  let canHeight: number;
  let gap: number;

  if (beerCount === 0) {
    cols = 3;
    canHeight = 176;
    gap = 4;
  } else if (beerCount <= 3) {
    cols = 3;
    canHeight = narrow ? 176 : 200;
    gap = 4;
  } else if (beerCount <= 6) {
    cols = 3;
    canHeight = narrow ? 164 : 184;
    gap = 4;
  } else if (beerCount <= 9) {
    cols = 3;
    canHeight = narrow ? 152 : 168;
    gap = 3;
  } else if (beerCount <= 15) {
    cols = narrow ? 3 : 4;
    canHeight = narrow ? 152 : 152;
    gap = 3;
  } else {
    cols = narrow ? 4 : 5;
    canHeight = narrow ? 132 : 132;
    gap = 2;
  }

  const neededRows = beerCount === 0
    ? 3
    : Math.ceil(beerCount / cols) + 1;
  const minRows = Math.max(2, neededRows);

  // Slot width: can width + tight padding
  // Can aspect ≈ 0.67 width:height after trim
  const canWidth = Math.round(canHeight * 0.67);
  const slotWidth = canWidth + 6;

  return { cols, canHeight, slotWidth, gap, minRows };
}

// ─── Shelf geometry constants ────────────────────────────────────────────────

const SHELF_PLANK_H = 10;
const SHELF_OVERLAP = 8; // how far cans extend below shelf-plank top

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTilt(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return ((hash % 5) - 2) * 0.7;
}

function deduplicateBeers(entries: BeerEntry[]) {
  const beerMap = new Map<string, { beer: Beer; entries: BeerEntry[] }>();
  for (const entry of entries) {
    if (!entry.beer) continue;
    const existing = beerMap.get(entry.beer_id);
    if (existing) {
      existing.entries.push(entry);
    } else {
      beerMap.set(entry.beer_id, { beer: entry.beer, entries: [entry] });
    }
  }
  return beerMap;
}

function buildSlots(
  entries: BeerEntry[],
  arrangement: string[] | undefined,
  config: LayoutConfig,
): SlotItem[] {
  const beerMap = deduplicateBeers(entries);

  let orderedBeerIds: string[];
  if (arrangement && arrangement.length > 0) {
    const arranged = arrangement.filter((id) => beerMap.has(id));
    const newBeers = Array.from(beerMap.keys()).filter(
      (id) => !arrangement.includes(id),
    );
    orderedBeerIds = [...arranged, ...newBeers];
  } else {
    orderedBeerIds = Array.from(beerMap.keys());
  }

  const slots: SlotItem[] = [];
  for (let i = 0; i < orderedBeerIds.length; i++) {
    const beerId = orderedBeerIds[i];
    const data = beerMap.get(beerId)!;
    slots.push({ id: beerId, type: "beer", beer: data.beer, entries: data.entries });
  }
  // Add exactly one "add" slot after the last beer
  slots.push({ id: "add-new", type: "empty" });

  // Pad remaining slots in the last row so the grid stays aligned
  const remainder = slots.length % config.cols;
  if (remainder !== 0) {
    const padding = config.cols - remainder;
    for (let i = 0; i < padding; i++) {
      slots.push({ id: `pad-${slots.length}-${i}`, type: "empty" });
    }
  }
  return slots;
}

// ─── Container Width Hook ────────────────────────────────────────────────────

function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(460);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BeerShelf({
  entries,
  onSelectBeer,
  arrangement,
  onArrangementChange,
  onAddBeer,
}: BeerShelfProps) {
  const { ref: containerRef, width: containerWidth } = useContainerWidth();
  const beerCount = useMemo(() => deduplicateBeers(entries).size, [entries]);
  const config = useMemo(
    () => getLayoutConfig(beerCount, containerWidth),
    [beerCount, containerWidth],
  );
  const slots = useMemo(
    () => buildSlots(entries, arrangement, config),
    [entries, arrangement, config],
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const rows: SlotItem[][] = [];
  for (let i = 0; i < slots.length; i += config.cols) {
    rows.push(slots.slice(i, i + config.cols));
  }

  const activeBeer = activeId
    ? slots.find((s) => s.id === activeId && s.type === "beer")
    : null;

  function handleDragStart(e: DragStartEvent) { setActiveId(e.active.id as string); }
  function handleDragOver(e: DragOverEvent) { setOverId(e.over ? (e.over.id as string) : null); }
  function handleDragCancel() { setActiveId(null); setOverId(null); }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    setOverId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const beerSlots = slots.filter((s) => s.type === "beer");
    const beerIds = beerSlots.map((s) => s.id);
    const activeIdx = slots.findIndex((s) => s.id === active.id);
    const overIdx = slots.findIndex((s) => s.id === over.id);
    if (activeIdx === -1 || overIdx === -1) return;

    const activeSlot = slots[activeIdx];
    const overSlot = slots[overIdx];
    if (activeSlot.type !== "beer") return;

    if (overSlot.type === "empty") {
      const idx = beerIds.indexOf(activeSlot.id);
      if (idx === -1) return;
      const newIds = [...beerIds];
      newIds.splice(idx, 1);
      newIds.splice(Math.min(overIdx, newIds.length), 0, activeSlot.id);
      onArrangementChange?.(newIds);
    } else {
      const from = beerIds.indexOf(active.id as string);
      const to = beerIds.indexOf(over.id as string);
      if (from === -1 || to === -1) return;
      const newIds = [...beerIds];
      [newIds[from], newIds[to]] = [newIds[to], newIds[from]];
      onArrangementChange?.(newIds);
    }
  }

  // The slot height determines the row height.
  // Cans sit at the bottom of their slot. The shelf-plank overlaps
  // the bottom SHELF_OVERLAP px of the slot area via negative margin-top.
  // This makes cans appear to sit ON the shelf.
  const slotHeight = config.canHeight + 4;

  // Empty slot visual dimensions (smaller, proportional)
  const emptyW = Math.round(config.slotWidth * 0.65);
  const emptyH = Math.round(slotHeight * 0.45);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={slots.map((s) => s.id)} strategy={rectSortingStrategy}>
        <div ref={containerRef}>
          {rows.map((row, rowIdx) => {
            const hasAnyBeer = row.some((s) => s.type === "beer");
            return (
              <div key={rowIdx} className="relative overflow-visible" style={{ marginBottom: 18 }}>
                {/* Can grid */}
                <div
                  className="grid relative z-20"
                  style={{
                    gridTemplateColumns: `repeat(${config.cols}, ${config.slotWidth}px)`,
                    justifyContent: "center",
                    columnGap: config.gap,
                  }}
                >
                  {row.map((slot) => (
                    <ShelfSlot
                      key={slot.id}
                      slot={slot}
                      slotHeight={slotHeight}
                      canHeight={config.canHeight}
                      emptyW={emptyW}
                      emptyH={emptyH}
                      isActive={activeId === slot.id}
                      isOver={overId === slot.id}
                      isGhostRow={!hasAnyBeer}
                      onSelectBeer={onSelectBeer}
                      onAddBeer={onAddBeer}
                    />
                  ))}
                </div>

                {/* Shelf plank — pulls UP into the can area */}
                <div
                  className="shelf-plank relative z-10"
                  style={{
                    height: SHELF_PLANK_H,
                    marginTop: -SHELF_OVERLAP,
                    marginLeft: 4,
                    marginRight: 4,
                    borderRadius: "0 0 3px 3px",
                  }}
                />
                <div
                  className="shelf-edge"
                  style={{
                    height: 3,
                    marginLeft: 8,
                    marginRight: 8,
                    borderRadius: "0 0 2px 2px",
                  }}
                />
                <div
                  style={{
                    height: 5,
                    marginLeft: 14,
                    marginRight: 14,
                    background: "linear-gradient(180deg, rgba(0,0,0,0.12) 0%, transparent 100%)",
                    borderRadius: "0 0 4px 4px",
                  }}
                />
              </div>
            );
          })}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeBeer && activeBeer.type === "beer" ? (
          <div style={{ opacity: 0.9, transform: "scale(1.05)" }}>
            <BeerImage beer={activeBeer.beer} canHeight={config.canHeight} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ─── Shelf Slot ──────────────────────────────────────────────────────────────

function ShelfSlot({
  slot,
  slotHeight,
  canHeight,
  emptyW,
  emptyH,
  isActive,
  isOver,
  isGhostRow,
  onSelectBeer,
  onAddBeer,
}: {
  slot: SlotItem;
  slotHeight: number;
  canHeight: number;
  emptyW: number;
  emptyH: number;
  isActive: boolean;
  isOver: boolean;
  isGhostRow: boolean;
  onSelectBeer: (beer: Beer, entries: BeerEntry[]) => void;
  onAddBeer?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: slot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    height: slotHeight,
  };

  if (slot.type === "empty") {
    const isAddSlot = slot.id === "add-new";

    if (!isAddSlot) {
      // Padding slot — render invisible spacer
      return (
        <div ref={setNodeRef} style={style} {...attributes} />
      );
    }

    // The single "+" add button
    const btnSize = Math.round(canHeight * 0.35);
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-end justify-center overflow-visible"
        {...attributes}
      >
        <button
          onClick={onAddBeer}
          className={`flex items-center justify-center rounded-full transition-all ${isOver ? "drop-target" : ""}`}
          style={{
            width: btnSize,
            height: btnSize,
            marginBottom: SHELF_OVERLAP + 2 + (emptyH - btnSize) / 2,
            background: "rgba(212, 165, 74, 0.1)",
            border: "2px solid rgba(212, 165, 74, 0.3)",
            color: "rgba(212, 165, 74, 0.5)",
            fontSize: btnSize * 0.5,
            lineHeight: 1,
          }}
          aria-label="Add a beer"
        >
          +
        </button>
      </div>
    );
  }

  const tilt = getTilt(slot.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-end justify-center overflow-visible"
      {...attributes}
    >
      <div
        className={`beer-can-slot ${isActive ? "dragging" : ""}`}
        style={{ "--can-tilt": `${tilt}deg` } as React.CSSProperties}
        {...listeners}
        onClick={() => onSelectBeer(slot.beer, slot.entries)}
      >
        <BeerImage beer={slot.beer} canHeight={canHeight} />
      </div>
    </div>
  );
}

// ─── Beer Image ──────────────────────────────────────────────────────────────

function BeerImage({ beer, canHeight }: { beer: Beer; canHeight: number }) {
  const renderSrc = `/renders/${beer.id}.png`;
  // Try local render first, then image_url (Supabase Storage), then fallback badge
  const [phase, setPhase] = useState<"local" | "remote" | "failed">("local");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (phase !== "failed") return;
    const timer = setTimeout(() => {
      setPhase("local");
      setRetryCount((c) => c + 1);
    }, 10000);
    return () => clearTimeout(timer);
  }, [phase, retryCount]);

  const src =
    phase === "local"
      ? `${renderSrc}?v=${retryCount}`
      : beer.image_url || renderSrc;

  const badgeW = Math.round(canHeight * 0.45);
  const badgeH = Math.round(canHeight * 0.7);
  const fontSize = canHeight >= 96 ? 10 : canHeight >= 76 ? 9 : 8;

  if (phase === "failed") {
    return (
      <div
        className="rounded-sm flex items-center justify-center"
        style={{
          width: badgeW,
          height: badgeH,
          background: "linear-gradient(180deg, #c4873a 0%, #a06830 50%, #7a4f25 100%)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
        }}
      >
        <span
          className="text-white/90 font-bold text-center leading-tight px-0.5 overflow-hidden"
          style={{ fontSize }}
        >
          {beer.name.slice(0, 14)}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={beer.name}
      className="block pointer-events-none"
      style={{
        height: canHeight,
        width: "auto",
        objectFit: "contain",
        filter: "drop-shadow(1px 3px 4px rgba(0,0,0,0.5))",
      }}
      onError={() => {
        if (phase === "local" && beer.image_url) {
          setPhase("remote");
        } else {
          setPhase("failed");
        }
      }}
      draggable={false}
    />
  );
}
