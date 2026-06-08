<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import type { D3DiskNode } from '$lib/types';
  import { osMul } from '$lib/stores';
  import { buildFullPath } from '$lib/pruneData';

  interface Props {
    focusedDirectory: D3DiskNode;
    d3Chart: any;
  }

  let { focusedDirectory, d3Chart }: Props = $props();

  const mul = $derived($osMul);

  // FIX #5: buildFullPath теперь сам нормализует путь — .replace() убраны
  const fullPath = $derived(buildFullPath(focusedDirectory));

  const sizeGB = $derived(
    ((focusedDirectory.data.value ?? 0) / mul / mul / mul).toFixed(2)
  );

  function handleClick() {
    if (focusedDirectory.parent) {
      d3Chart?.backToParent(focusedDirectory.parent);
    }
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    invoke('show_in_folder', { path: buildFullPath(focusedDirectory) });
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="bg-gray-800 p-2 text-white flex justify-between items-center rounded-md cursor-pointer hover:bg-gray-700 transition-colors"
  role="button"
  tabindex="0"
  onclick={handleClick}
  oncontextmenu={handleContextMenu}
  onkeydown={(e) => e.key === 'Enter' && handleClick()}
>
  <!-- FIX #2: показываем стрелку назад только если есть родитель -->
  <div class="flex items-center gap-1.5 flex-1 min-w-0">
    {#if focusedDirectory.parent}
      <svg class="w-3 h-3 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
      </svg>
    {/if}
    <div class="truncate text-xs text-gray-300">{fullPath}</div>
  </div>
  <div class="text-xs text-gray-400 shrink-0 ml-2">{sizeGB} GB</div>
</div>