import * as d3 from 'd3';
import type { DiskItem, D3DiskNode } from './types';

/**
 * Рекурсивно обходит дерево от pdu и:
 * - присваивает уникальный id каждому узлу (полный путь)
 * - проставляет isDirectory
 * - переименовывает поле data → sizeBytes
 */
export const itemMap = (obj: any, parent: any = null): DiskItem => {
  if (obj.name === '(total)') {
    obj.id = '/';
    obj.name = '/';
  } else if (parent && parent.id === '/') {
    obj.id = obj.name;
    obj.name = obj.name.startsWith('/') ? obj.name.substring(1) : obj.name;
  } else {
    obj.id = parent ? `${parent.id}/${obj.name}` : obj.name;
  }

  obj.sizeBytes = obj.size ?? 0;

  const hasChildren = Object.prototype.hasOwnProperty.call(obj, 'children');
  if (hasChildren && Array.isArray(obj.children) && obj.children.length > 0) {
    obj.isDirectory = true;
    obj.value = obj.size ?? 0;
    obj.children.forEach((child: any) => itemMap(child, obj));
  } else {
    obj.isDirectory = hasChildren;
    obj.value = obj.size ?? 0;
    if (!hasChildren) {
      obj.children = [];
    }
  }

  return obj as DiskItem;
};

const partition = (data: DiskItem) => {
  const hierarchy = d3
    .hierarchy(data)
    .sum((d) => (!d.children || d.children.length === 0 ? d.size ?? 0 : 0))
    .sort((a, b) => (b.data.size ?? 0) - (a.data.size ?? 0));

  return d3.partition<DiskItem>().size([2 * Math.PI, hierarchy.height + 1])(hierarchy);
};

export function diskItemToD3Hierarchy(baseData: DiskItem): D3DiskNode {
  const root = partition(baseData) as unknown as D3DiskNode;
  root.each((d: any) => {
    d.current = { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 };
  });
  return root;
}

/**
 * FIX #5: нормализация пути вынесена сюда — больше нет дублирования .replace() по всему коду.
 */
export function buildFullPath(node: D3DiskNode): string {
  return node.data.id.replace('\\/', '/').replace(/\\/g, '/');
}

export function buildPath(node: D3DiskNode): string[] {
  return node
    .ancestors()
    .map((d) => d.data.name)
    .reverse();
}

export function depthCut(node: DiskItem, depth: number, curDepth = 0): DiskItem {
  const newNode = { ...node };
  if (newNode.children && depth === curDepth) {
    newNode.children = [];
  } else if (newNode.children) {
    newNode.children = newNode.children.map((c) => depthCut(c, depth, curDepth + 1));
  }
  return newNode;
}

export function getViewNodeGraph(root: D3DiskNode, path: string[]): D3DiskNode | null {
  let current: D3DiskNode = root;
  for (const segment of path.slice(1)) {
    const found = current.children?.find((c) => c.data.name === segment);
    if (!found) return null;
    current = found;
  }
  return current;
}