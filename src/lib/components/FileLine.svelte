<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import prettyBytes from 'pretty-bytes';
  import { getIconForFile, getIconForFolder } from 'vscode-icons-js';
  import type { D3DiskNode, DiskItem } from '$lib/types';
  import { osMul } from '$lib/stores';
  import { buildFullPath } from '$lib/pruneData';

  interface Props {
    item: D3DiskNode;
    hoveredItem: DiskItem | null;
    d3Chart: any;
    inDeleteList: boolean;
    onDragStart: (item: D3DiskNode) => void;
    onOpenedInFinder?: () => void;
    // FIX: callback для сброса searchQuery при навигации в папку
    onNavigated?: () => void;
  }

  let { item, hoveredItem, d3Chart, inDeleteList, onDragStart, onOpenedInFinder, onNavigated }: Props = $props();

  const mul = $derived($osMul);

  const isHovered = $derived(hoveredItem?.id === item.data.id);

  const iconSrc = $derived(
    item.data.isDirectory
      ? `/fileicons/${getIconForFolder(item.data.name)}`
      : `/fileicons/${getIconForFile(item.data.name)}`
  );

  const displaySize = $derived(
    prettyBytes(item.data.sizeBytes || item.data.size || 0, { binary: mul === 1024 })
  );

  async function handleClick() {
    if (item.children && item.children.length > 0) {
      // FIX: сбрасываем поиск при навигации в подпапку
      onNavigated?.();
      d3Chart?.focusDirectory(item);
    } else {
      try {
        await invoke('show_in_folder', { path: buildFullPath(item) });
        onOpenedInFinder?.();
      } catch (e) {
        console.error('show_in_folder failed:', e);
      }
    }
  }

  async function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    try {
      await invoke('show_in_folder', { path: buildFullPath(item) });
      onOpenedInFinder?.();
    } catch (e) {
      console.error('show_in_folder failed:', e);
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="p-2 text-white flex items-center justify-between rounded-md mt-1 pl-4 cursor-pointer transition-colors
    {isHovered ? 'bg-blue-900/30' : 'bg-gray-900 hover:bg-gray-800'}
    {inDeleteList ? 'border border-red-700/70 bg-red-950/20' : ''}"
  role="button"
  tabindex="0"
  draggable="true"
  ondragstart={() => onDragStart(item)}
  onclick={handleClick}
  oncontextmenu={handleContextMenu}
  onkeydown={(e) => e.key === 'Enter' && handleClick()}
  title="{buildFullPath(item)}"
>
  <img
    class="h-4 w-4 mr-2 shrink-0"
    src={iconSrc}
    onerror={(e) => {
      (e.target as HTMLImageElement).src = item.data.isDirectory
        ? '/fileicons/default_folder.svg'
        : '/fileicons/default_file.svg';
    }}
    alt=""
    aria-hidden="true"
  />

  <span class="flex-1 text-sm truncate">{item.data.name}</span>

  <span class="text-xs text-gray-400 ml-2 shrink-0 tabular-nums">
    {displaySize}
  </span>
</div>