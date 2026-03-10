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
}

type SlotItem =
  | { id: string; type: "beer"; beer: Beer; entries: BeerEntry[] }
  | { id: string; type: "empty" };

interface LayoutConfig {
  cols: number;
  canHeight: number;
  gap: number;
  minRows: number;
  slotWidth: number;
  slotHeight: number;
  emptyWidth: number;
  emptyHeight: number;
}

// ─── Adaptive Layout Engine ──────────────────────────────────────────────────

function getLayoutConfig(beerCount: number, containerWidth: number): LayoutConfig {
  const narrow = containerWidth > 0 && containerWidth < 340;

  let cols: number;
  let canHeight: number;
  let gap: number;

  if (beerCount === 0) {
    cols = narrow ? 2 : 3;
    canHeight = 86;
    gap = 6;
  } else if (beerCount <= 2) {
    cols = 2;
    canHeight = narrow ? 98 : 116;
    gap = 14;
  } else if (beerCount <= 4) {
    cols = 2;
    canHeight = narrow ? 90 : 104;
    gap = 10;
  } else if (beerCount <= 6) {
    cols = 3;
    canHeight = narrow ? 78 : 90;
    gap = 6;
  } else if (beerCount <= 9) {
    cols = 3;
    canHeight = narrow ? 74 : 82;
    gap = 5;
  } else if (beerCount <= 15) {
    cols = narrow ? 3 : 4;
    canHeight = narrow ? 74 : 72;
    gap = 4;
  } else {
    cols = narrow ? 4 : 5;
    canHeight = narrow ? 64 : 62;
    gap = 3;
  }

  // Rows: enough for all beers + 1 extra row for breathing / drop targets
  const neededRows = beerCount === 0
    ? 3
    : Math.ceil(beerCount / cols) + 1;
  const minRows = Math.max(2, neededRows);

  // Derived slot dimensions — tight but with a little breathing room
  const slotWidth = Math.round(canHeight * 0.54) + 8;
  const slotHeight = canHeight + 10;
  const emptyWidth = Math.round(slotWidth * 0.68);
  const emptyHeight = Math.round(slotHeight * 0.56);

  return { cols, canHeight, gap, minRows, slotWidth, slotHeight, emptyWidth, emptyHeight };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Deterministic pseudo-random tilt from beer id */
function getTilt(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return ((hash % 5) - 2) * 0.7; // -1.4 to 1.4 degrees
}

/** Deduplicate entries into unique beers */
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

/** Build slot grid from entries + optional arrangement */
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

  const totalSlots = config.minRows * config.cols;
  const slots: SlotItem[] = [];

  for (let i = 0; i < totalSlots; i++) {
    if (i < orderedBeerIds.length) {
      const beerId = orderedBeerIds[i];
      const data = beerMap.get(beerId)!;
      slots.push({ id: beerId, type: "beer", beer: data.beer, entries: data.entries });
    } else {
      slots.push({ id: `empty-${i}`, type: "empty" });
    }
  }

  return slots;
}

// ─── Container Width Hook ────────────────────────────────────────────────────

function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(460); // sensible default for max-w-lg

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Measure immediately
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

  // Build rows
  const rows: SlotItem[][] = [];
  for (let i = 0; i < slots.length; i += config.cols) {
    rows.push(slots.slice(i, i + config.cols));
  }

  const activeBeer = activeId
    ? slots.find((s) => s.id === activeId && s.type === "beer")
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    setOverId(event.over ? (event.over.id as string) : null);
  }

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
      const currentBeerIdx = beerIds.indexOf(activeSlot.id);
      if (currentBeerIdx === -1) return;
      const newIds = [...beerIds];
      newIds.splice(currentBeerIdx, 1);
      const insertIdx = Math.min(overIdx, newIds.length);
      newIds.splice(insertIdx, 0, activeSlot.id);
      onArrangementChange?.(newIds);
    } else {
      const fromIdx = beerIds.indexOf(active.id as string);
      const toIdx = beerIds.indexOf(over.id as string);
      if (fromIdx === -1 || toIdx === -1) return;
      const newIds = [...beerIds];
      [newIds[fromIdx], newIds[toIdx]] = [newIds[toIdx], newIds[fromIdx]];
      onArrangementChange?.(newIds);
    }
  }

  function handleDragCancel() {
    setActiveId(null);
    setOverId(null);
  }

  const slotIds = slots.map((s) => s.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={slotIds} strategy={rectSortingStrategy}>
        <div ref={containerRef}>
          {rows.map((row, rowIdx) => {
            const hasAnyBeer = row.some((s) => s.type === "beer");

            return (
              <div key={rowIdx} className="relative overflow-visible">
                {/* Slot grid — centered, tight columns */}
                <div
                  className="grid overflow-visible relative z-20 mx-auto"
                  style={{
                    gridTemplateColumns: `repeat(${config.cols}, ${config.slotWidth}px)`,
                    justifyContent: "center",
                    gap: `0 ${config.gap}px`,
                    marginBottom: -3,
                  }}
                >
                  {row.map((slot) => (
                    <ShelfSlot
                      key={slot.id}
                      slot={slot}
                      config={config}
                      isActive={activeId === slot.id}
                      isOver={overId === slot.id}
                      isGhostRow={!hasAnyBeer}
                      onSelectBeer={onSelectBeer}
                    />
                  ))}
                </div>

                {/* Wooden shelf plank — always full width */}
                <div
                  className="shelf-plank relative z-10"
                  style={{
                    height: Math.max(8, Math.round(config.canHeight * 0.085)),
                    marginLeft: 4,
                    marginRight: 4,
                    borderRadius: "0 0 3px 3px",
                  }}
                />
                {/* Shelf edge */}
                <div
                  className="shelf-edge"
                  style={{
                    height: 3,
                    marginLeft: 8,
                    marginRight: 8,
                    borderRadius: "0 0 2px 2px",
                  }}
                />
                {/* Contact shadow */}
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

      {/* Drag overlay ghost */}
      <DragOverlay dropAnimation={null}>
        {activeBeer && activeBeer.type === "beer" ? (
          <div className="opacity-90" style={{ transform: "scale(1.05)" }}>
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
  config,
  isActive,
  isOver,
  isGhostRow,
  onSelectBeer,
}: {
  slot: SlotItem;
  config: LayoutConfig;
  isActive: boolean;
  isOver: boolean;
  isGhostRow: boolean;
  onSelectBeer: (beer: Beer, entries: BeerEntry[]) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: slot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (slot.type === "empty") {
    return (
      <div
        ref={setNodeRef}
        style={{ ...style, height: config.slotHeight }}
        className="flex items-end justify-center overflow-visible"
        {...attributes}
      >
        <div
          className={`empty-slot ${isOver ? "drop-target" : ""} ${isGhostRow ? "ghost-row" : ""}`}
          style={{
            width: config.emptyWidth,
            height: config.emptyHeight,
          }}
        />
      </div>
    );
  }

  const tilt = getTilt(slot.id);

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, height: config.slotHeight }}
      className="flex items-end justify-center overflow-visible"
      {...attributes}
    >
      <div
        className={`beer-can-slot ${isActive ? "dragging" : ""}`}
        style={{ "--can-tilt": `${tilt}deg` } as React.CSSProperties}
        {...listeners}
        onClick={() => onSelectBeer(slot.beer, slot.entries)}
      >
        <BeerImage beer={slot.beer} canHeight={config.canHeight} />
      </div>
    </div>
  );
}

// ─── Beer Image ──────────────────────────────────────────────────────────────

function BeerImage({ beer, canHeight }: { beer: Beer; canHeight: number }) {
  const renderSrc = `/renders/${beer.id}.png`;
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!failed) return;
    const timer = setTimeout(() => {
      setFailed(false);
      setRetryCount((c) => c + 1);
    }, 10000);
    return () => clearTimeout(timer);
  }, [failed, retryCount]);

  const src = beer.image_url || `${renderSrc}?v=${retryCount}`;

  // Scale fallback badge proportionally
  const badgeWidth = Math.round(canHeight * 0.38);
  const badgeHeight = Math.round(canHeight * 0.58);
  const fontSize = canHeight >= 100 ? 10 : canHeight >= 76 ? 9 : 8;

  if (failed) {
    return (
      <div className="flex items-center justify-center">
        <div
          className="rounded-sm flex items-center justify-center"
          style={{
            width: badgeWidth,
            height: badgeHeight,
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
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={beer.name}
      className="object-contain block pointer-events-none"
      style={{
        height: canHeight,
        width: "auto",
        filter: "drop-shadow(1px 3px 4px rgba(0,0,0,0.5))",
      }}
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}
