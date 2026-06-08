// Данные одного элемента файловой системы от pdu
export interface DiskItem {
  id: string;
  name: string;
  size: number;       // оригинальное поле от pdu (байты)
  sizeBytes: number;  // алиас size, используется D3 для отрисовки
  value: number;      // псевдоним для d3.hierarchy().sum()
  isDirectory: boolean;
  children: DiskItem[];
}

// D3 arc координаты (текущие или целевые для анимации)
export interface D3Arc {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

// D3 hierarchy узел поверх DiskItem
export interface D3DiskNode extends d3.HierarchyRectangularNode<DiskItem> {
  target: D3Arc;
  current: D3Arc;
  // Use 'this' to match d3's this-typed parent/children declarations
  parent: this | null;
  children: this[];
  data: DiskItem;
}

// Информация о диске из Rust
export interface DiskMeta {
  name: string;
  sMountPoint: string;
  totalSpace: number;
  availableSpace: number;
  isRemovable: boolean;
}

// Прогресс сканирования
export interface ScanStatus {
  items: number;
  total: number;
  errors: number;
}

// Параметры перехода на страницу диска
export interface ScanParams {
  disk: string;
  used: number;
  fullscan: boolean;
  isDirectory?: boolean;
}

// Результат удаления для отображения ошибок
export interface DeleteResult {
  node: D3DiskNode;
  success: boolean;
  error?: string;
}

// Запись истории сканирований
export interface HistoryEntry {
  path: string;
  scannedAt: number;   // Unix timestamp (секунды)
  totalBytes: number;
  itemCount: number;
}