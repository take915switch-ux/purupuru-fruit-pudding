"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type FruitType = "melon" | "apple" | "banana" | "grape";
type Phase = "collect" | "decorate" | "complete";

type Fruit = {
  id: string;
  type: FruitType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  status: "active" | "moving" | "table";
};

type Fly = {
  id: string;
  src: string;
  left: number;
  top: number;
  width: number;
  dx: number;
  dy: number;
};

const ASSET_BASE = `${import.meta.env.BASE_URL || "/"}assets/`;

const INFO: Record<FruitType, { name: string; src: string }> = {
  melon: { name: "メロン", src: `${ASSET_BASE}melon.png` },
  apple: { name: "りんご", src: `${ASSET_BASE}apple.png` },
  banana: { name: "バナナ", src: `${ASSET_BASE}banana.png` },
  grape: { name: "ぶどう", src: `${ASSET_BASE}grape.png` },
};

const TYPES = Object.keys(INFO) as FruitType[];
const FRUIT_SIZE = 76;
const RADIUS = 35;

function shuffle<T>(values: T[]) {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export default function FruitPuddingGame() {
  const playfieldRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fruitsRef = useRef<Fruit[]>([]);
  const remainingRef = useRef<Partial<Record<FruitType, number>>>({});
  const dragRef = useRef<string | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ id: string; startDistance: number; startScale: number } | null>(null);
  const scalesRef = useRef<Record<string, number>>({});
  const selectedFruitRef = useRef<string | null>(null);
  const stagePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const stagePinchRef = useRef<{ startDistance: number; startScale: number } | null>(null);
  const [phase, setPhase] = useState<Phase>("collect");
  const [renderTick, setRenderTick] = useState(0);
  const [round, setRound] = useState<Partial<Record<FruitType, number>>>({});
  const [tableOrder, setTableOrder] = useState<string[]>([]);
  const [flies, setFlies] = useState<Fly[]>([]);
  const [decor, setDecor] = useState<Record<string, { x: number; y: number }>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [dragVisual, setDragVisual] = useState<{ id: string; x: number; y: number } | null>(null);
  const [fruitScales, setFruitScales] = useState<Record<string, number>>({});
  const [selectedFruitId, setSelectedFruitId] = useState<string | null>(null);

  const playSound = useCallback((kind: "ok" | "ng") => {
    const audio = new Audio(`${ASSET_BASE}${kind}.m4a`);
    audio.volume = 0.9;
    void audio.play().catch(() => undefined);
  }, []);

  const chooseRound = useCallback(() => {
    const active = fruitsRef.current.filter((fruit) => fruit.status === "active");
    if (!active.length) {
      setRound({});
      remainingRef.current = {};
      return;
    }
    const total = 1 + Math.floor(Math.random() * Math.min(3, active.length));
    const pool = shuffle(active.map((fruit) => fruit.type));
    const next: Partial<Record<FruitType, number>> = {};
    for (let i = 0; i < total; i += 1) {
      const type = pool[i];
      next[type] = (next[type] ?? 0) + 1;
    }
    setRound(next);
    remainingRef.current = { ...next };
  }, []);

  const initialize = useCallback(() => {
    const field = playfieldRef.current;
    if (!field) return;
    const width = field.clientWidth;
    const height = field.clientHeight;
    const placed: Fruit[] = [];
    for (const type of TYPES) {
      for (let copy = 0; copy < 2; copy += 1) {
        let x = RADIUS + Math.random() * Math.max(1, width - RADIUS * 2);
        let y = RADIUS + Math.random() * Math.max(1, height - RADIUS * 2);
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const clear = placed.every((other) => Math.hypot(other.x - x, other.y - y) > RADIUS * 2.15);
          if (clear) break;
          x = RADIUS + Math.random() * Math.max(1, width - RADIUS * 2);
          y = RADIUS + Math.random() * Math.max(1, height - RADIUS * 2);
        }
        const speed = 82 + Math.random() * 55;
        const angle = Math.random() * Math.PI * 2;
        placed.push({
          id: `${type}-${copy}`,
          type,
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          status: "active",
        });
      }
    }
    fruitsRef.current = shuffle(placed);
    setTableOrder([]);
    setDecor({});
    scalesRef.current = {};
    setFruitScales({});
    selectedFruitRef.current = null;
    setSelectedFruitId(null);
    stagePointersRef.current.clear();
    stagePinchRef.current = null;
    setFlies([]);
    setRenderTick((v) => v + 1);
    window.setTimeout(chooseRound, 100);
  }, [chooseRound]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (phase !== "collect") return;
    let frame = 0;
    let previous = performance.now();
    const animate = (now: number) => {
      const field = playfieldRef.current;
      if (!field) return;
      const dt = Math.min((now - previous) / 1000, 0.035);
      previous = now;
      const active = fruitsRef.current.filter((fruit) => fruit.status === "active");
      const width = field.clientWidth;
      const height = field.clientHeight;
      for (const fruit of active) {
        fruit.x += fruit.vx * dt;
        fruit.y += fruit.vy * dt;
        if (fruit.x < RADIUS) { fruit.x = RADIUS; fruit.vx = Math.abs(fruit.vx); }
        if (fruit.x > width - RADIUS) { fruit.x = width - RADIUS; fruit.vx = -Math.abs(fruit.vx); }
        if (fruit.y < RADIUS) { fruit.y = RADIUS; fruit.vy = Math.abs(fruit.vy); }
        if (fruit.y > height - RADIUS) { fruit.y = height - RADIUS; fruit.vy = -Math.abs(fruit.vy); }
      }
      for (let i = 0; i < active.length; i += 1) {
        for (let j = i + 1; j < active.length; j += 1) {
          const a = active[i];
          const b = active[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let distance = Math.hypot(dx, dy);
          if (distance >= RADIUS * 2) continue;
          if (distance < 0.01) { dx = 1; dy = 0; distance = 1; }
          const nx = dx / distance;
          const ny = dy / distance;
          const overlap = RADIUS * 2 - distance;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;
          const approach = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (approach < 0) {
            a.vx += approach * nx;
            a.vy += approach * ny;
            b.vx -= approach * nx;
            b.vy -= approach * ny;
          }
        }
      }
      setRenderTick((v) => v + 1);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  const handleFruitTap = useCallback((fruit: Fruit, element: HTMLButtonElement) => {
    if (fruit.status !== "active" || phase !== "collect") return;
    const needed = remainingRef.current[fruit.type] ?? 0;
    if (needed <= 0) {
      playSound("ng");
      element.classList.remove("fruit-wiggle");
      void element.offsetWidth;
      element.classList.add("fruit-wiggle");
      return;
    }

    playSound("ok");
    fruit.status = "moving";
    const nextNeeded = { ...remainingRef.current, [fruit.type]: needed - 1 };
    remainingRef.current = nextNeeded;

    const source = element.getBoundingClientRect();
    const table = tableRef.current?.getBoundingClientRect();
    const slot = tableOrder.length;
    const targetX = table ? table.left + table.width * (0.08 + (slot / 7) * 0.84) : innerWidth / 2;
    const targetY = table ? table.top + Math.min(54, table.height * 0.42) : innerHeight - 70;
    setFlies((current) => [...current, {
      id: fruit.id,
      src: INFO[fruit.type].src,
      left: source.left,
      top: source.top,
      width: source.width,
      dx: targetX - source.left - source.width / 2,
      dy: targetY - source.top - source.height / 2,
    }]);
    setRenderTick((v) => v + 1);

    window.setTimeout(() => {
      fruit.status = "table";
      setTableOrder((current) => [...current, fruit.id]);
      setFlies((current) => current.filter((fly) => fly.id !== fruit.id));
      setRenderTick((v) => v + 1);
    }, 620);

    const finishedRound = Object.values(nextNeeded).every((count) => !count);
    if (finishedRound) {
      remainingRef.current = {};
      window.setTimeout(() => {
        if (fruitsRef.current.some((item) => item.status === "active")) {
          chooseRound();
        } else {
          setRound({});
        }
      }, 720);
    }
  }, [chooseRound, phase, playSound, tableOrder.length]);

  const instruction = useMemo(() => {
    const parts = TYPES
      .filter((type) => (round[type] ?? 0) > 0)
      .map((type) => `${INFO[type].name}を${round[type]}つ`);
    return parts.length ? `${parts.join("、")}、おしてね` : "よくできたね！";
  }, [round]);

  const tableFruits = tableOrder.map((id) => fruitsRef.current.find((fruit) => fruit.id === id)).filter(Boolean) as Fruit[];
  const allCollected = tableOrder.length === 8 && fruitsRef.current.every((fruit) => fruit.status === "table");
  void renderTick;

  const beginDecorating = () => {
    setPhase("decorate");
    setRound({});
  };

  const placeFromPointer = useCallback((id: string, clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const size = Math.min(92, Math.max(64, rect.width * 0.13));
    const x = Math.max(-size * 0.15, Math.min(rect.width - size * 0.85, clientX - rect.left - size / 2));
    const y = Math.max(0, Math.min(rect.height - size * 0.85, clientY - rect.top - size / 2));
    setDecor((current) => ({ ...current, [id]: { x, y } }));
  }, []);

  const beginDrag = (id: string, event: React.PointerEvent) => {
    if (phase !== "decorate") return;
    event.preventDefault();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (dragRef.current) return;
    selectedFruitRef.current = id;
    setSelectedFruitId(id);
    dragRef.current = id;
    setIsDragging(true);
    setDragVisual({ id, x: event.clientX, y: event.clientY });
  };

  useEffect(() => {
    if (!isDragging) return;
    const startPinch = () => {
      const id = dragRef.current;
      const points = [...pointersRef.current.values()];
      if (!id || points.length < 2) return;
      pinchRef.current = {
        id,
        startDistance: Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)),
        startScale: scalesRef.current[id] ?? 1,
      };
    };
    const down = (event: PointerEvent) => {
      if (!dragRef.current) return;
      if (!pointersRef.current.has(event.pointerId)) {
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      if (pointersRef.current.size === 2 && !pinchRef.current) startPinch();
    };
    const move = (event: PointerEvent) => {
      const id = dragRef.current;
      if (!id || !pointersRef.current.has(event.pointerId)) return;
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const points = [...pointersRef.current.values()];
      if (points.length >= 2) {
        if (!pinchRef.current) startPinch();
        const pinch = pinchRef.current;
        if (pinch) {
          const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
          const scale = Math.max(0.5, Math.min(2, pinch.startScale * distance / pinch.startDistance));
          scalesRef.current = { ...scalesRef.current, [id]: scale };
          setFruitScales(scalesRef.current);
          setDragVisual({ id, x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
        }
      } else {
        setDragVisual({ id, x: event.clientX, y: event.clientY });
      }
    };
    const end = (event: PointerEvent) => {
      if (!pointersRef.current.has(event.pointerId)) return;
      pointersRef.current.delete(event.pointerId);
      const remainingPointer = [...pointersRef.current.values()][0];
      if (remainingPointer) {
        pinchRef.current = null;
        if (dragRef.current) setDragVisual({ id: dragRef.current, x: remainingPointer.x, y: remainingPointer.y });
        return;
      }
      const id = dragRef.current;
      const table = tableRef.current?.getBoundingClientRect();
      if (id) {
        if (table && event.clientY >= table.top - 18) {
          setDecor((current) => {
            const next = { ...current };
            delete next[id];
            return next;
          });
        } else {
          placeFromPointer(id, event.clientX, event.clientY);
        }
      }
      dragRef.current = null;
      pinchRef.current = null;
      setDragVisual(null);
      setIsDragging(false);
    };
    const cancel = () => {
      dragRef.current = null;
      pointersRef.current.clear();
      pinchRef.current = null;
      setDragVisual(null);
      setIsDragging(false);
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [isDragging, placeFromPointer]);

  const handleStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (phase !== "decorate" || dragRef.current || !selectedFruitRef.current) return;
    if ((event.target as HTMLElement).closest(".placed-fruit")) return;
    event.preventDefault();
    stagePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    const points = [...stagePointersRef.current.values()];
    if (points.length === 2) {
      stagePinchRef.current = {
        startDistance: Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)),
        startScale: scalesRef.current[selectedFruitRef.current] ?? 1,
      };
    }
  };

  const handleStagePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!stagePointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    stagePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...stagePointersRef.current.values()];
    const selected = selectedFruitRef.current;
    const pinch = stagePinchRef.current;
    if (selected && pinch && points.length >= 2) {
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const scale = Math.max(0.5, Math.min(2, pinch.startScale * distance / pinch.startDistance));
      scalesRef.current = { ...scalesRef.current, [selected]: scale };
      setFruitScales(scalesRef.current);
    }
  };

  const handleStagePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    stagePointersRef.current.delete(event.pointerId);
    if (stagePointersRef.current.size < 2) stagePinchRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const saveImage = async () => {
    const stage = stageRef.current;
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const outputScale = 1200 / stageRect.width;
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = Math.round(stageRect.height * outputScale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#fffdf2");
    gradient.addColorStop(0.48, "#fff6c9");
    gradient.addColorStop(1, "#ffd7b0");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawContained = (image: HTMLImageElement, elementRect: DOMRect) => {
      const boxX = (elementRect.left - stageRect.left) * outputScale;
      const boxY = (elementRect.top - stageRect.top) * outputScale;
      const boxWidth = elementRect.width * outputScale;
      const boxHeight = elementRect.height * outputScale;
      const fit = Math.min(boxWidth / image.naturalWidth, boxHeight / image.naturalHeight);
      const width = image.naturalWidth * fit;
      const height = image.naturalHeight * fit;
      ctx.drawImage(image, boxX + (boxWidth - width) / 2, boxY + (boxHeight - height) / 2, width, height);
    };

    const puddingElement = stage.querySelector<HTMLImageElement>(".pudding");
    const pudding = await loadImage(`${ASSET_BASE}pudding.png`);
    if (puddingElement) drawContained(pudding, puddingElement.getBoundingClientRect());

    for (const fruit of tableFruits) {
      if (!decor[fruit.id]) continue;
      const element = stage.querySelector<HTMLButtonElement>(`[data-fruit-id="${fruit.id}"]`);
      if (!element) continue;
      const image = await loadImage(INFO[fruit.type].src);
      drawContained(image, element.getBoundingClientRect());
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], "fruit-pudding.png", { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "わたしの フルーツプリン" });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    const link = document.createElement("a");
    link.download = file.name;
    link.href = URL.createObjectURL(blob);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const reset = () => {
    setPhase("collect");
    setDecor({});
    scalesRef.current = {};
    setFruitScales({});
    selectedFruitRef.current = null;
    setSelectedFruitId(null);
    stagePointersRef.current.clear();
    stagePinchRef.current = null;
    setTableOrder([]);
    window.setTimeout(initialize, 50);
  };

  return (
    <main className={`game-shell phase-${phase}`}>
      <header className="game-title" aria-label="ぷるぷるフルーツプリン">
        <span>ぷるぷる</span> フルーツプリン
      </header>

      <section className="game-card">
        <div className="prompt-bar" aria-live="polite">
          {phase === "collect"
            ? instruction
            : phase === "complete"
              ? "かんせい！ とっても おいしそう！"
              : "フルーツを ドラッグして もりつけよう！"}
        </div>
        {phase === "collect" ? (
          <div className="playfield" ref={playfieldRef}>
            {fruitsRef.current.filter((fruit) => fruit.status === "active").map((fruit) => (
              <button
                className={`bouncing-fruit fruit-${fruit.type}`}
                key={fruit.id}
                style={{ transform: `translate3d(${fruit.x - FRUIT_SIZE / 2}px, ${fruit.y - FRUIT_SIZE / 2}px, 0)` }}
                onPointerDown={(event) => { event.preventDefault(); handleFruitTap(fruit, event.currentTarget); }}
                aria-label={INFO[fruit.type].name}
              >
                <img src={INFO[fruit.type].src} alt="" draggable={false} />
              </button>
            ))}
          </div>
        ) : (
          <div className="decorate-area">
            <div
              className="pudding-stage"
              ref={stageRef}
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMove}
              onPointerUp={handleStagePointerEnd}
              onPointerCancel={handleStagePointerEnd}
            >
              <div className="sparkle sparkle-one">✦</div>
              <div className="sparkle sparkle-two">●</div>
              <img className="pudding" src={`${ASSET_BASE}pudding.png`} alt="プリン" draggable={false} />
              {tableFruits.filter((fruit) => decor[fruit.id]).map((fruit) => (
                <button
                  key={fruit.id}
                  data-fruit-id={fruit.id}
                  className={`placed-fruit ${selectedFruitId === fruit.id ? "is-selected" : ""} ${dragVisual?.id === fruit.id ? "is-drag-source" : ""}`}
                  style={{ left: decor[fruit.id].x, top: decor[fruit.id].y, transform: `scale(${fruitScales[fruit.id] ?? 1})` }}
                  onPointerDown={phase === "decorate" ? (event) => beginDrag(fruit.id, event) : undefined}
                  aria-label={`${INFO[fruit.type].name}をうごかす`}
                >
                  <img src={INFO[fruit.type].src} alt="" draggable={false} />
                </button>
              ))}
              {phase === "complete" && <div className="complete-stamp">できた！</div>}
            </div>
          </div>
        )}

        <div className="table-wrap" ref={tableRef}>
          <div className="table-edge" />
          <div className="table-surface">
            {tableFruits.map((fruit) => {
              const isOnStage = Boolean(decor[fruit.id]);
              return (
                <div className="table-slot" key={fruit.id}>
                  {phase === "collect" || !isOnStage ? (
                    <button
                      className={`table-fruit ${phase === "decorate" ? "is-draggable" : ""} ${selectedFruitId === fruit.id ? "is-selected" : ""} ${dragVisual?.id === fruit.id ? "is-drag-source" : ""}`}
                      onPointerDown={phase === "decorate" ? (event) => beginDrag(fruit.id, event) : undefined}
                      aria-label={phase === "decorate" ? `${INFO[fruit.type].name}をもりつける` : INFO[fruit.type].name}
                    >
                      <img src={INFO[fruit.type].src} alt="" draggable={false} />
                    </button>
                  ) : <span className="empty-slot">○</span>}
                </div>
              );
            })}
            {Array.from({ length: 8 - tableFruits.length }).map((_, index) => <div className="table-slot" key={`empty-${index}`} />)}
          </div>
          <div className="table-legs"><span /><span /></div>
        </div>

        {phase === "collect" && allCollected && (
          <button className="big-action decorate-button" onClick={beginDecorating}>もりつけする！</button>
        )}
        {phase === "decorate" && (
          <button
            className="big-action finish-button"
            onClick={() => setPhase("complete")}
          >
            かんせい！
          </button>
        )}
        {phase === "complete" && (
          <div className="complete-actions">
            <button className="big-action save-button" onClick={saveImage}>かんせいした がぞうを ほぞん</button>
            <button className="big-action reset-button" onClick={reset}>さいしょに もどる</button>
          </div>
        )}
      </section>

      {flies.map((fly) => (
        <img
          className="flying-fruit"
          key={fly.id}
          src={fly.src}
          alt=""
          style={{ left: fly.left, top: fly.top, width: fly.width, "--fly-x": `${fly.dx}px`, "--fly-y": `${fly.dy}px` } as React.CSSProperties}
        />
      ))}
      {dragVisual && (() => {
        const fruit = fruitsRef.current.find((item) => item.id === dragVisual.id);
        return fruit ? (
          <img
            className="dragging-fruit"
            src={INFO[fruit.type].src}
            alt=""
            style={{ left: dragVisual.x, top: dragVisual.y, "--drag-scale": fruitScales[fruit.id] ?? 1 } as React.CSSProperties}
          />
        ) : null;
      })()}
    </main>
  );
}
