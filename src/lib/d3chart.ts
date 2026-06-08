import * as d3 from 'd3';
import pSBC from 'shade-blend-color';
import type { D3DiskNode, D3Arc, DiskItem } from './types';

// ─── Константы ────────────────────────────────────────────────────────────────

// Глубина затемнения по уровням — слои становятся темнее
const depthmap: Record<number, number> = {
  0: 0,
  1: -0.08,
  2: -0.20,
  3: -0.32,
  4: -0.42,
  5: -0.50,
};

const width  = 600;
const radius = width / 10;

// Красивая тёмная палитра — индиго, синий, фиолетовый, циан, изумруд
// Заменяет Rainbow — более когерентная и современная
const PALETTE = [
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#a78bfa', // purple-light
  '#38bdf8', // sky
  '#34d399', // green
];

// ─── Arc генератор — с зазором между кольцами ─────────────────────────────────

const arc = d3
  .arc<D3Arc>()
  .startAngle((d) => d.x0)
  .endAngle((d) => d.x1)
  .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.004))
  .padRadius(radius * 1.5)
  .innerRadius((d) => d.y0 * radius + 2)           // +2px зазор внутри
  .outerRadius((d) => Math.max(d.y0 * radius, d.y1 * radius - 2)); // -2px зазор снаружи

// Arc для hover-highlight (чуть больше наружного радиуса)
const arcHovered = d3
  .arc<D3Arc>()
  .startAngle((d) => d.x0)
  .endAngle((d) => d.x1)
  .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.004))
  .padRadius(radius * 1.5)
  .innerRadius((d) => d.y0 * radius + 2)
  .outerRadius((d) => Math.max(d.y0 * radius, d.y1 * radius + 2)); // +2px при hover

const arcVisible = (d: D3Arc) => d.y1 <= 4 && d.y0 >= 1 && d.x1 > d.x0;

// ─── Throttle ─────────────────────────────────────────────────────────────────

function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let last = 0;
  return ((...args: any[]) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
  }) as T;
}

// ─── Целевые углы для анимации ────────────────────────────────────────────────

const setTargetAngles = (filtered: D3DiskNode[], focusedNode: D3DiskNode) => {
  const span = focusedNode.x1 - focusedNode.x0;
  filtered.forEach((d) => {
    const fromPct = (d.x0 - focusedNode.x0) / span;
    const toPct   = (d.x1 - focusedNode.x0) / span;
    d.target = {
      x0: Math.max(0, Math.min(1, fromPct)) * 2 * Math.PI,
      x1: Math.max(0, Math.min(1, toPct))   * 2 * Math.PI,
      y0: Math.max(0, d.y0 - focusedNode.depth),
      y1: Math.max(0, d.y1 - focusedNode.depth),
    };
  });
};

const animateToTarget = (
  g: d3.Selection<SVGGElement, D3DiskNode, null, undefined>,
  path: d3.Selection<SVGPathElement, D3DiskNode, SVGGElement, D3DiskNode>
) => {
  const t = g.transition().duration(650).ease(d3.easeCubicInOut) as any;
  path
    .transition(t)
    .tween('data', (d) => {
      const i = d3.interpolate(d.current, d.target);
      return (tVal: number) => { d.current = i(tVal); };
    })
    .filter(function (d: any) {
      return !!(+(this as Element).getAttribute('fill-opacity')! || arcVisible(d.target));
    })
    .attr('fill-opacity', (d: any) =>
      arcVisible(d.target) ? (d.children ? 0.85 : 0.65) : 0
    )
    .attrTween('d', (d) => () => arc(d.current)!)
    .end()
    .catch(() => {});
};

// ─── Форматирование размера ───────────────────────────────────────────────────

function fmtSize(bytes: number, mul: number): string {
  const gb = bytes / mul / mul / mul;
  if (gb >= 1)   return `${gb.toFixed(2)} GB`;
  const mb = bytes / mul / mul;
  if (mb >= 1)   return `${mb.toFixed(1)} MB`;
  const kb = bytes / mul;
  if (kb >= 1)   return `${kb.toFixed(0)} KB`;
  return `${bytes} B`;
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ChartCallbacks {
  arcClicked:   (e: any, node: D3DiskNode) => void;
  arcHover:     (e: any, node: D3DiskNode) => void;
  centerHover:  (e: any, node: D3DiskNode) => void;
}

// ─── Основная функция ─────────────────────────────────────────────────────────

export const getChart = (
  root: D3DiskNode,
  svgElem: SVGSVGElement,
  { arcClicked, arcHover, centerHover }: ChartCallbacks,
  mul: number
) => {
  let gcolor: d3.ScaleOrdinal<string, string, never> | null = null;
  let current = root;
  let hoveredId: string | null = null;

  // ── SVG setup ────────────────────────────────────────────────────────────────
  const svg = d3
    .select<SVGSVGElement, D3DiskNode>(svgElem)
    .attr('viewBox', [0, 0, width, width].join(' '))
    .style('font', '11px system-ui, sans-serif')
    .style('overflow', 'visible');

  // ── Defs: фильтры и маски ────────────────────────────────────────────────────
  const defs = svg.append('defs');

  // Glow-фильтр для hover
  const glowFilter = defs.append('filter')
    .attr('id', 'glow')
    .attr('x', '-20%').attr('y', '-20%')
    .attr('width', '140%').attr('height', '140%');
  glowFilter.append('feGaussianBlur')
    .attr('stdDeviation', '3')
    .attr('result', 'coloredBlur');
  const feMerge = glowFilter.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'coloredBlur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

  // Тонкий drop shadow для арок
  const shadowFilter = defs.append('filter')
    .attr('id', 'shadow')
    .attr('x', '-5%').attr('y', '-5%')
    .attr('width', '110%').attr('height', '110%');
  shadowFilter.append('feDropShadow')
    .attr('dx', '0').attr('dy', '1')
    .attr('stdDeviation', '2')
    .attr('flood-color', 'rgba(0,0,0,0.4)');

  const g = svg.append('g').attr('transform', `translate(${width / 2},${width / 2})`);
  const innerG = g.append('g');

  const throttledArcHover   = throttle(arcHover,    50);
  const throttledCenterHover = throttle(centerHover, 50);

  // ── Цвет арки ────────────────────────────────────────────────────────────────
  const getFill = (d: D3DiskNode): string => {
    if (!gcolor) return '#4f46e5';
    const depth = d.depth;
    const v = depth in depthmap ? depthmap[depth] : -0.5;
    let node = d;
    while (node.depth > 1 && node.parent) node = node.parent;
    const base = gcolor(node.data.name);
    return (pSBC(v, base) as string) ?? base;
  };

  // ── Яркость при hover ────────────────────────────────────────────────────────
  const getHoverFill = (d: D3DiskNode): string => {
    const base = getFill(d);
    return (pSBC(0.25, base) as string) ?? base;
  };

  // ─── updateData ──────────────────────────────────────────────────────────────
  const updateData = (
    dataRoot: D3DiskNode,
    focused: D3DiskNode
  ): d3.Selection<SVGPathElement, D3DiskNode, SVGGElement, D3DiskNode> => {
    const filtered: D3DiskNode[] = [...focused.ancestors().slice(-1)] as D3DiskNode[];
    const maxDepth   = focused.depth + 3;
    const overallSize = focused.value || 0;
    let accumulator: D3DiskNode | null = null;
    let accumulatorLastParent: D3DiskNode | null = null;
    const skipMap: Record<string, boolean> = {};

    for (const item of focused.descendants().slice(1) as D3DiskNode[]) {
      if (accumulator && accumulatorLastParent && item.parent !== accumulatorLastParent) {
        filtered.push(accumulator);
        accumulator = null;
        accumulatorLastParent = null;
      }
      if (item.parent && item.parent.data.id in skipMap) {
        skipMap[item.data.id] = true;
        continue;
      }
      if (item.depth > maxDepth) break;

      if (overallSize > 0 && (item.value || 0) / overallSize > 0.005) {
        filtered.push(item);
      } else {
        if (accumulator) {
          skipMap[item.data.id] = true;
          (accumulator.data.value as number) += item.value ?? 0;
          (accumulator as any).value += item.value ?? 0;
          (accumulator as any).current.x1 = (item as any).current.x1;
          (accumulator as any).x1 = item.x1;
        } else {
          skipMap[item.data.id] = true;
          const small: DiskItem = {
            id: `__acc__${item.parent?.data.id ?? 'root'}`,
            isDirectory: false,
            name: 'Other',
            size: item.value || 0,
            sizeBytes: item.value || 0,
            value: item.value || 0,
            children: [],
          };
          accumulator = d3.hierarchy(small) as unknown as D3DiskNode;
          accumulatorLastParent = item.parent;
          accumulator.parent = item.parent;
          Object.assign(accumulator as any, item);
        }
      }
    }

    if (accumulator) filtered.push(accumulator);

    // Инициализируем gcolor один раз, используем нашу палитру вместо Rainbow
    if (!gcolor) {
      let rootColorCount = 0;
      for (const item of root.descendants().slice(1) as D3DiskNode[]) {
        if (item.parent === root) rootColorCount += 1;
      }
      // Повторяем палитру если узлов больше чем цветов
      const repeated = Array.from(
        { length: Math.max(rootColorCount, 2) + 2 },
        (_, i) => PALETTE[i % PALETTE.length]
      );
      gcolor = d3.scaleOrdinal(repeated);
    }

    setTargetAngles(filtered, focused);

    const path = (innerG as any)
      .selectAll('path')
      .data(filtered, (d: D3DiskNode) => d.data.id)
      .join(
        (enter: any) => {
          const p = enter
            .append('path')
            .attr('fill', getFill)
            .attr('fill-opacity', (d: D3DiskNode) =>
              arcVisible(d.current) ? (d.children ? 0.85 : 0.65) : 0
            )
            .attr('stroke', (d: D3DiskNode) => {
              // Тонкая светлая граница между арками
              const base = getFill(d);
              return (pSBC(0.3, base) as string) ?? 'transparent';
            })
            .attr('stroke-width', 0.5)
            .attr('stroke-opacity', 0.4)
            .attr('d', (d: D3DiskNode) => arc(d.current))
            .style('cursor', 'pointer')
            .style('transition', 'filter 0.15s')
            .on('click', arcClickHandler)
            .on('mouseover', function(this: SVGPathElement, e: any, d: D3DiskNode) {
              hoveredId = d.data.id;
              d3.select(this)
                .attr('fill', getHoverFill(d))
                .attr('fill-opacity', 1)
                .attr('d', arcHovered(d.current) ?? null)
                .style('filter', 'url(#glow)');
              throttledArcHover(e, d);
            })
            .on('mouseout', function(this: SVGPathElement, _e: any, d: D3DiskNode) {
              hoveredId = null;
              d3.select(this)
                .attr('fill', getFill(d))
                .attr('fill-opacity', arcVisible(d.current) ? (d.children ? 0.85 : 0.65) : 0)
                .attr('d', arc(d.current) ?? null)
                .style('filter', null);
            });

          // Tooltip
          p.append('title').text(
            (d: D3DiskNode) =>
              `${d.ancestors().map((n) => n.data.name).reverse().join('/')}\n${fmtSize(d.data.sizeBytes || 0, mul)}`
          );
          return p;
        },
        (update: any) =>
          update
            .attr('fill', (d: D3DiskNode) => hoveredId === d.data.id ? getHoverFill(d) : getFill(d))
            .attr('fill-opacity', (d: D3DiskNode) =>
              arcVisible(d.current) ? (d.children ? 0.85 : 0.65) : 0
            )
            .attr('d', (d: D3DiskNode) => arc(d.current)),
        (exit: any) => exit.remove()
      );

    return path;
  };

  let path = updateData(root, root);


  function centerClickHandler(e: any, focusedNode: D3DiskNode) {
    if (current === root) return;
    current = focusedNode;
    arcClicked(e, focusedNode);
    innerG.selectAll('path').remove();
    path = updateData(root, focusedNode);
    animateToTarget(g as any, path as any);
  }

  function arcClickHandler(event: any, focusedNode: D3DiskNode) {
    if (!focusedNode.children || focusedNode.children.length === 0) return;
    current = focusedNode;
    arcClicked(event, focusedNode);
    innerG.selectAll('path').remove();
    path = updateData(root, focusedNode);
    animateToTarget(g as any, path as any);
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  return {
    focusDirectory: (node: D3DiskNode) => arcClickHandler(null, node),
    backToParent:   (node: D3DiskNode) => centerClickHandler(null, node),

    deleteNodes: (nodes: D3DiskNode[]) => {
      for (const node of nodes) {
        const sizeToRemove = node.data.sizeBytes || node.data.size || 0;

        node.ancestors().slice(1).forEach((anc: any) => {
          anc.value           = Math.max(0, (anc.value || 0) - sizeToRemove);
          anc.data.value      = Math.max(0, (anc.data.value || 0) - sizeToRemove);
          anc.data.sizeBytes  = Math.max(0, (anc.data.sizeBytes || 0) - sizeToRemove);
          anc.data.size       = Math.max(0, (anc.data.size || 0) - sizeToRemove);
        });

        if (node.parent?.children) {
          node.parent.children = node.parent.children.filter(
            (i: any) => i !== node
          ) as D3DiskNode[];
        }
      }

      (root as any).sum((d: DiskItem) =>
        (!d.children || d.children.length === 0 ? d.size ?? 0 : 0)
      );
      d3.partition<DiskItem>().size([2 * Math.PI, root.height + 1])(root as any);

      root.each((d: any) => {
        d.current = { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 };
      });

      innerG.selectAll('path').remove();
      path = updateData(root, current);
      animateToTarget(g as any, path as any);
    },
  };
};