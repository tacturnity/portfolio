/**
 * Shared masonry column-packing engine.
 *
 * This was previously copy-pasted between `Masonry.tsx` (DOM) and
 * `Wall3d.tsx` (WebGL), which let the two layouts drift and doubled the
 * maintenance + test surface. Both now consume this single implementation.
 */

export interface PackableItem {
  id: string;
  category?: string;
  width?: number | string;
  height?: number | string;
}

export interface PackedSlot {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** True when the slot spans the full row width (pano). */
  span: number;
}

export interface MasonryLayoutConfig {
  /** Container width in CSS pixels, used to derive column width. */
  containerWidth: number;
  /** Column count (2/3/4/5). */
  columns: number;
  /** Horizontal + vertical gap between cells, in px. */
  gap: number;
  enableCrop: boolean;
  enablePanoSpan: boolean;
}

/**
 * Greedy shortest-column packing — the exact algorithm the DOM masonry grid
 * and the WebGL wall used, unified so they can never drift again.
 *
 * - Portrait/landscape crop balancing spreads shots evenly across columns
 *   when `enableCrop` is on.
 * - Pano photos span all columns when `enablePanoSpan` is on.
 */
export function computeMasonryLayout(
  items: PackableItem[],
  config: MasonryLayoutConfig,
): PackedSlot[] {
  const { containerWidth, columns, gap, enableCrop, enablePanoSpan } = config;
  if (columns < 1 || items.length === 0) return [];

  const columnWidth = columns === 1
    ? containerWidth
    : (containerWidth - (columns - 1) * gap) / columns;

  const colHeights = new Array<number>(columns).fill(0);

  // Orientation balancing when cropping is enabled.
  let balanceCounter = 0;
  if (enableCrop) {
    let landscapeCount = 0;
    let portraitCount = 0;
    for (const item of items) {
      const isPano = (item.category ?? '').toLowerCase() === 'panos';
      if (isPano) continue;
      const w = parseFloat(String(item.width)) || 1000;
      const h = parseFloat(String(item.height)) || 1000;
      if (w >= h) landscapeCount++;
      else portraitCount++;
    }
    balanceCounter = Math.round((landscapeCount - portraitCount) / 2);
  }

  const slots: PackedSlot[] = [];

  for (const item of items) {
    const isPano = (item.category ?? '').toLowerCase() === 'panos';
    const naturalW = parseFloat(String(item.width)) || 1000;
    const naturalH = parseFloat(String(item.height)) || 1000;
    const isNaturalLandscape = naturalW >= naturalH;
    const naturalAspectRatio = naturalW / naturalH;

    let span = 1;
    let targetAspectRatio = naturalAspectRatio;

    if (enableCrop) {
      if (isPano && enablePanoSpan) {
        span = columns;
        targetAspectRatio = naturalAspectRatio;
      } else {
        let forced = isNaturalLandscape ? 'landscape' : 'portrait';
        if (!isPano) {
          if (balanceCounter > 0 && isNaturalLandscape) {
            forced = 'portrait';
            balanceCounter--;
          } else if (balanceCounter < 0 && !isNaturalLandscape) {
            forced = 'landscape';
            balanceCounter++;
          }
        }
        targetAspectRatio = forced === 'landscape' ? 4 / 3 : 3 / 4;
      }
    } else if (isPano && enablePanoSpan) {
      span = columns;
    }

    const finalWidth = columnWidth * span + gap * (span - 1);
    const targetHeight = finalWidth / targetAspectRatio;

    // Shortest-column placement within the panning window.
    let targetCol = 0;
    let minY = Infinity;
    for (let i = 0; i <= columns - span; i++) {
      let maxHeightInRange = 0;
      for (let c = i; c < i + span; c++) {
        if (colHeights[c] > maxHeightInRange) maxHeightInRange = colHeights[c];
      }
      if (maxHeightInRange < minY) {
        minY = maxHeightInRange;
        targetCol = i;
      }
    }

    const x = targetCol * (columnWidth + gap);
    const y = minY;

    for (let c = targetCol; c < targetCol + span; c++) {
      colHeights[c] = y + targetHeight + gap;
    }

    slots.push({
      id: item.id,
      x,
      y,
      w: finalWidth,
      h: targetHeight,
      span,
    });
  }

  return slots;
}

/** Total packed height for the outer container to reserve. */
export function totalMasonryHeight(slots: PackedSlot[]): number {
  if (slots.length === 0) return 0;
  let max = 0;
  for (const slot of slots) {
    const bottom = slot.y + slot.h;
    if (bottom > max) max = bottom;
  }
  return max;
}