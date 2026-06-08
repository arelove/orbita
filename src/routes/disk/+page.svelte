<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { save } from '@tauri-apps/plugin-dialog';
  import * as d3 from 'd3';
  import { getIconForFile, getIconForFolder } from 'vscode-icons-js';
  import { scanParams, osMul, scanError } from '$lib/stores';
  import { itemMap, diskItemToD3Hierarchy, buildFullPath } from '$lib/pruneData';
  import { getChart } from '$lib/d3chart';
  import FileLine from '$lib/components/FileLine.svelte';
  import ParentFolder from '$lib/components/ParentFolder.svelte';
  import type { D3DiskNode, DiskItem, ScanStatus } from '$lib/types';

  // ─── State ─────────────────────────────────────────────────────────────────
  let params = $derived($scanParams);
  let mul = $derived($osMul);

  type ViewState = 'loading' | 'disk' | 'error';
  let view = $state<ViewState>('loading');
  let status = $state<ScanStatus | null>(null);

  let svgEl = $state<SVGSVGElement | undefined>(undefined);
  // FIX non_reactive_update: d3Chart объявлен через $state
  let d3Chart = $state<ReturnType<typeof getChart> | null>(null);

  let focusedDirectory = $state<D3DiskNode | null>(null);
  let hoveredItem = $state<DiskItem | null>(null);

  let rawTreeJson = $state<string | null>(null);
  let rootNode = $state<D3DiskNode | null>(null);

  let deleteList = $state<D3DiskNode[]>([]);
  let deleteMap = $state(new Map<string, boolean>());
  let isDeleting = $state(false);
  let deleteProgress = $state({ current: 0, total: 0 });

  let showConfirmModal = $state(false);

  let isExporting = $state(false);
  let showExportMenu = $state(false);

  let searchQuery = $state('');

  let toastMessage = $state<string | null>(null);
  let toastIsError = $state(false);
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;

  let dragOverDeleteZone = $state(false);
  let draggingItem: D3DiskNode | null = null;

  let mounted = true;

  let unlistenStatus: UnlistenFn | null = null;
  let unlistenCompleted: UnlistenFn | null = null;
  let unlistenTerminated: UnlistenFn | null = null;
  let baseDataD3: D3DiskNode | null = null;

  // ─── Прогресс ──────────────────────────────────────────────────────────────
  const cappedTotal = $derived(
    Math.min(status?.total ?? 0, params?.used ?? 0)
  );
  const scanPercent = $derived(
    params?.used
      ? ((cappedTotal / params.used) * 100).toFixed(1)
      : '0.0'
  );

  const filteredChildren = $derived(
    (() => {
      if (!focusedDirectory?.children) return [];
      const q = searchQuery.trim().toLowerCase();
      if (!q) return focusedDirectory.children;
      return focusedDirectory.children.filter((c) =>
        c.data.name.toLowerCase().includes(q)
      );
    })()
  );

  // ─── Lifecycle ─────────────────────────────────────────────────────────────
  onMount(async () => {
    if (!params) { goto('/'); return; }

    unlistenStatus = await listen<ScanStatus>('scan_status', (event) => {
      if (!mounted) return;
      status = event.payload;
    });

    unlistenCompleted = await listen<string>('scan_completed', async (event) => {
      if (!mounted) return;
      try {
        const parsed = JSON.parse(event.payload);
        const raw = parsed.tree ?? parsed;
        const mapped = itemMap(raw);
        baseDataD3 = diskItemToD3Hierarchy(mapped as DiskItem);
        rawTreeJson = JSON.stringify(buildExportTree(baseDataD3));
        rootNode = baseDataD3;
        view = 'disk';
        const totalBytes = baseDataD3.data.sizeBytes || baseDataD3.data.size || 0;
        const itemCount = status?.items ?? 0;
        invoke('add_history_entry', {
          path: params!.disk,
          totalBytes,
          itemCount,
        }).catch(console.error);
      } catch (e) {
        console.error('Failed to parse scan data:', e);
        showToast('Failed to parse scan results', true);
      }
    });

    unlistenTerminated = await listen<number | null>('scan_terminated', (event) => {
      if (!mounted) return;
      if (view === 'loading' && event.payload !== 0 && event.payload !== null) {
        view = 'error';
      }
    });

    invoke('start_scanning', {
      path: params.disk,
      ratio: params.fullscan ? '0' : '0.001',
    }).catch((e) => {
      if (mounted) { view = 'error'; showToast(String(e), true); }
    });
  });

  onDestroy(() => {
    mounted = false;
    unlistenStatus?.();
    unlistenCompleted?.();
    unlistenTerminated?.();
    if (params) invoke('stop_scanning').catch(() => {});
    if (toastTimeout) clearTimeout(toastTimeout);
  });

  // ─── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg: string, isError = false) {
    toastMessage = msg;
    toastIsError = isError;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toastMessage = null; }, 4000);
  }

  // ─── Chart init ────────────────────────────────────────────────────────────
  $effect(() => {
    if (view === 'disk' && svgEl && baseDataD3) {
      d3.select(svgEl).selectAll('*').remove();
      focusedDirectory = baseDataD3;
      d3Chart = getChart(
        baseDataD3, svgEl,
        {
          centerHover: (_, p) => { hoveredItem = { ...p.data }; },
          arcHover:    (_, p) => { hoveredItem = { ...p.data }; },
          arcClicked:  (_, p) => { focusedDirectory = p; searchQuery = ''; },
        },
        mul
      );
    }
  });

  // ─── Drag & Drop ──────────────────────────────────────────────────────────
  function onFileDragStart(item: D3DiskNode) { draggingItem = item; }
  function onDeleteZoneDragOver(e: DragEvent) { e.preventDefault(); dragOverDeleteZone = true; }
  function onDeleteZoneDragLeave() { dragOverDeleteZone = false; }
  function onDeleteZoneDrop(e: DragEvent) {
    e.preventDefault();
    dragOverDeleteZone = false;
    if (!draggingItem) return;
    const item = draggingItem;
    draggingItem = null;
    if (!deleteMap.has(item.data.id)) {
      deleteMap.set(item.data.id, true);
      deleteList = [...deleteList, item];
    }
  }

  function clearDeleteList() {
    deleteList = [];
    deleteMap = new Map();
  }

  // ─── Удаление ──────────────────────────────────────────────────────────────
  function requestDelete() { showConfirmModal = true; }
  function cancelDelete()  { showConfirmModal = false; }

  async function confirmDelete() {
    showConfirmModal = false;
    isDeleting = true;
    deleteProgress = { current: 0, total: deleteList.length };
    const successful: D3DiskNode[] = [];
    const errors: string[] = [];
    for (const node of deleteList) {
      const nodePath = buildFullPath(node);
      try {
        await invoke('delete_path', { path: nodePath });
        successful.push(node);
      } catch (e) {
        errors.push(`${node.data.name}: ${String(e)}`);
      }
      deleteProgress = { ...deleteProgress, current: deleteProgress.current + 1 };
    }
    d3Chart?.deleteNodes(successful);
    isDeleting = false;
    if (errors.length > 0) {
      scanError.set(errors.join('\n'));
      showToast(`${errors.length} item(s) failed to delete`, true);
    } else {
      showToast(`Moved ${successful.length} item(s) to Trash`);
    }
    clearDeleteList();
  }

  // ─── Экспорт ───────────────────────────────────────────────────────────────
  function buildExportTree(node: D3DiskNode): object {
    return {
      name: node.data.name,
      path: node.data.id,
      sizeBytes: node.data.sizeBytes || node.data.size || 0,
      isDirectory: node.data.isDirectory,
      children: (node.children ?? []).map(buildExportTree),
    };
  }

  async function exportAs(format: 'csv' | 'json') {
    showExportMenu = false;
    if (!rawTreeJson || !rootNode) return;
    isExporting = true;
    try {
      const diskName = (params?.disk ?? 'scan').split('/').at(-1) || 'scan';
      const defaultName = `${diskName}-${new Date().toISOString().slice(0, 10)}.${format}`;
      const destPath = await save({
        defaultPath: defaultName,
        filters: format === 'csv'
          ? [{ name: 'CSV', extensions: ['csv'] }]
          : [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!destPath) return;
      const command = format === 'csv' ? 'export_csv' : 'export_json';
      await invoke(command, { treeJson: rawTreeJson, destPath });
      showToast(`Exported to ${destPath.split('/').at(-1) ?? destPath}`);
    } catch (e) {
      showToast(`Export failed: ${String(e)}`, true);
    } finally {
      isExporting = false;
    }
  }

  function onDocumentClick() {
    if (showExportMenu) showExportMenu = false;
  }

  function onOpenedInFinder() { showToast('Opened in Finder'); }
  function onFileLineNavigate() { searchQuery = ''; }
</script>

{#if showExportMenu}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-10"
    onclick={onDocumentClick}
    onkeydown={() => {}}
    role="presentation"
  ></div>
{/if}

<!-- ─── Toast ───────────────────────────────────────────────────────────────── -->
{#if toastMessage}
  <div
    class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-white text-sm shadow-xl
           max-w-sm text-center border transition-all
           {toastIsError
             ? 'bg-red-900/90 border-red-700'
             : 'bg-gray-800/95 border-gray-600'}"
    role="alert"
  >
    {toastMessage}
  </div>
{/if}

<!-- ─── Модалка подтверждения удаления ──────────────────────────────────────── -->
{#if showConfirmModal}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-40 bg-black/70 flex items-center justify-center"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={cancelDelete}
    onkeydown={(e) => e.key === 'Escape' && cancelDelete()}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-80 shadow-2xl"
      onclick={(e) => e.stopPropagation()}
      onkeydown={() => {}}
    >
      <h2 class="text-white font-semibold text-base mb-1">Move to Trash?</h2>
      <p class="text-gray-400 text-xs mb-3">
        {deleteList.length} item{deleteList.length > 1 ? 's' : ''} will be moved to the system trash.
        You can restore them from there.
      </p>
      <ul class="mb-4 max-h-36 overflow-y-auto space-y-1 pr-1">
        {#each deleteList as node (node.data.id)}
          <li class="flex items-center gap-2 text-xs text-gray-300">
            <img
              src="/fileicons/{node.data.isDirectory
                ? getIconForFolder(node.data.name)
                : getIconForFile(node.data.name)}"
              onerror={(e) => {
                (e.target as HTMLImageElement).src = node.data.isDirectory
                  ? '/fileicons/default_folder.svg'
                  : '/fileicons/default_file.svg';
              }}
              class="w-4 h-4 shrink-0"
              alt=""
              aria-hidden="true"
            />
            <span class="truncate">{node.data.name}</span>
          </li>
        {/each}
      </ul>
      <div class="flex gap-2">
        <button
          onclick={cancelDelete}
          class="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-white transition-colors border border-gray-600"
        >
          Cancel
        </button>
        <button
          onclick={confirmDelete}
          class="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-sm text-white font-medium transition-colors"
        >
          Move to Trash
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ─── Loading ──────────────────────────────────────────────────────────────── -->
{#if view === 'loading'}
  <div class="flex-1 flex flex-col justify-center items-center text-white gap-6">
    <img
      src={params?.isDirectory ? '/fileicons/default_folder.svg' : '/fileicons/default_root_folder.svg'}
      class="w-16 h-16 opacity-60"
      alt="disk"
      aria-hidden="true"
    />
    {#if status}
      <div class="w-2/3 text-center">
        <p class="text-base font-medium mb-4">Scanning {params?.disk}… {scanPercent}%</p>
        <div class="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div
            class="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
            style="width: {scanPercent}%"
          ></div>
        </div>
        <p class="mt-2 text-xs text-gray-400">
          {status.items.toLocaleString()} items scanned
          {#if status.errors > 0}
            <span class="text-red-400 ml-2">· {status.errors} errors</span>
          {/if}
        </p>
      </div>
    {:else}
      <p class="text-gray-400 text-sm">Starting scan…</p>
    {/if}
    <button
      onclick={() => goto('/')}
      class="flex items-center gap-1.5 px-6 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors border border-gray-600"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
      </svg>
      Back
    </button>
  </div>

<!-- ─── Error ────────────────────────────────────────────────────────────────── -->
{:else if view === 'error'}
  <div class="flex-1 flex flex-col justify-center items-center text-white gap-4">
    <svg class="w-12 h-12 text-red-400 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    </svg>
    <p class="text-base font-medium">Scan failed</p>
    <p class="text-sm text-gray-400 text-center max-w-xs">
      Could not scan <span class="text-gray-200 font-mono text-xs">{params?.disk}</span>.
      The path may be inaccessible or the scanner process crashed.
    </p>
    <button
      onclick={() => goto('/')}
      class="flex items-center gap-1.5 px-6 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors border border-gray-600"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
      </svg>
      Back
    </button>
  </div>

<!-- ─── Disk View ─────────────────────────────────────────────────────────────── -->
{:else if view === 'disk'}
  <div class="flex-1 flex overflow-hidden">
    <div class="flex-1 flex items-center justify-center p-2 min-w-0">
      <svg bind:this={svgEl} width="100%" style="max-height: calc(100vh - 40px)"></svg>
    </div>

    <div class="w-80 bg-gray-900 flex flex-col p-2 shrink-0">

      <div class="flex items-center gap-1">
        <div class="flex-1 min-w-0">
          {#if focusedDirectory}
            <ParentFolder {focusedDirectory} {d3Chart} />
          {/if}
        </div>

        <div class="relative shrink-0">
          <button
            onclick={(e) => { e.stopPropagation(); showExportMenu = !showExportMenu; }}
            disabled={isExporting}
            class="flex items-center gap-1 px-2 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700
                   border border-gray-600 text-gray-300 hover:text-white text-xs transition-colors
                   disabled:opacity-40 disabled:cursor-not-allowed"
            title="Export scan results"
          >
            {#if isExporting}
              <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" d="M12 3v3m0 12v3M3 12h3m12 0h3"/>
              </svg>
            {:else}
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/>
              </svg>
            {/if}
            Export
          </button>

          {#if showExportMenu}
            <div
              class="absolute right-0 top-full mt-1 z-20 bg-gray-800 border border-gray-600
                     rounded-lg shadow-xl overflow-hidden min-w-32"
            >
              <button
                onclick={() => exportAs('csv')}
                class="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <img src="/fileicons/file_type_excel.svg" class="w-4 h-4 shrink-0" alt="" aria-hidden="true" />
                Export as CSV
              </button>
              <button
                onclick={() => exportAs('json')}
                class="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <img src="/fileicons/file_type_json.svg" class="w-4 h-4 shrink-0" alt="" aria-hidden="true" />
                Export as JSON
              </button>
            </div>
          {/if}
        </div>
      </div>

      <div class="mt-1 relative">
        <svg
          class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
        </svg>
        <input
          type="text"
          placeholder="Search in folder…"
          bind:value={searchQuery}
          class="w-full pl-8 pr-7 py-1.5 text-xs rounded-md bg-gray-800 border border-gray-700
                 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
        {#if searchQuery}
          <button
            onclick={() => (searchQuery = '')}
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors flex items-center"
            aria-label="Clear search"
          >
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        {/if}
      </div>

      <div class="flex-1 overflow-y-auto mt-1" style="min-height: 0">
        {#if filteredChildren.length === 0 && searchQuery}
          <p class="text-xs text-gray-600 text-center mt-6">No matches for "{searchQuery}"</p>
        {:else}
          {#each filteredChildren as item (item.data.id)}
            <FileLine
              {item}
              {hoveredItem}
              {d3Chart}
              inDeleteList={deleteMap.has(item.data.id)}
              onDragStart={onFileDragStart}
              onOpenedInFinder={onOpenedInFinder}
              onNavigated={onFileLineNavigate}
            />
          {/each}
        {/if}
      </div>

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="mt-1 shrink-0 rounded-lg border border-dashed p-2 text-center text-sm transition-colors
          {dragOverDeleteZone
            ? 'border-red-500 bg-red-900/20 text-red-400'
            : 'border-gray-600 text-gray-500'}"
        role="region"
        aria-label="Delete zone"
        ondragover={onDeleteZoneDragOver}
        ondragleave={onDeleteZoneDragLeave}
        ondrop={onDeleteZoneDrop}
      >
        {#if deleteList.length === 0}
          <span class="text-xs">Drag files here to delete</span>
        {:else}
          <div class="mb-2 text-xs">
            {deleteList.length} item{deleteList.length > 1 ? 's' : ''} selected —
            <button class="underline hover:text-white" onclick={clearDeleteList}>Clear</button>
          </div>
          <button
            onclick={requestDelete}
            disabled={isDeleting}
            class="w-full py-2 px-4 rounded-lg text-white text-sm font-medium transition-colors
              bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500
              disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            {#if isDeleting}
              Moving {deleteProgress.current} / {deleteProgress.total} to Trash…
            {:else}
              Move {deleteList.length} item{deleteList.length > 1 ? 's' : ''} to Trash
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}