<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { invoke } from '@tauri-apps/api/core';
  import { scanParams } from '$lib/stores';
  import type { HistoryEntry } from '$lib/types';

  let entries        = $state<HistoryEntry[]>([]);
  let loading        = $state(true);
  let confirmClearAll = $state(false);

  onMount(async () => { await loadHistory(); });

  async function loadHistory() {
    loading = true;
    try { entries = await invoke<HistoryEntry[]>('get_history'); }
    catch (e) { console.error('Failed to load history:', e); }
    finally { loading = false; }
  }

  async function removeEntry(path: string) {
    try {
      await invoke('remove_history_entry', { path });
      entries = entries.filter((e) => e.path !== path);
    } catch (e) { console.error('Failed to remove entry:', e); }
  }

  async function clearAll() {
    try {
      await invoke('clear_history');
      entries = [];
      confirmClearAll = false;
    } catch (e) { console.error('Failed to clear history:', e); }
  }

  function rescan(entry: HistoryEntry) {
    scanParams.set({ disk: entry.path, used: entry.totalBytes, fullscan: false, isDirectory: true });
    goto('/disk');
  }

  function formatDate(ts: number): string {
    return new Date(ts * 1000).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function formatBytes(bytes: number): string {
    const GB = 1_000_000_000, MB = 1_000_000, KB = 1_000;
    if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
    if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
    if (bytes >= KB) return `${(bytes / KB).toFixed(0)} KB`;
    return `${bytes} B`;
  }

  function shortPath(path: string): string {
    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length <= 3) return path;
    return `…/${parts.slice(-2).join('/')}`;
  }
</script>

<div class="flex-1 flex flex-col text-white overflow-hidden">

  <!-- Header -->
  <div class="history-header">
    <div class="flex items-center gap-2.5">
      <button
        onclick={() => goto('/')}
        class="back-btn"
        aria-label="Back"
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1 class="history-title">Scan History</h1>
      {#if entries.length > 0}
        <span class="entry-count">{entries.length}</span>
      {/if}
    </div>

    {#if entries.length > 0}
      {#if confirmClearAll}
        <div class="flex items-center gap-2 text-xs">
          <span class="text-white/30">Clear all?</span>
          <button onclick={clearAll} class="confirm-yes">Yes</button>
          <button onclick={() => (confirmClearAll = false)} class="confirm-no">No</button>
        </div>
      {:else}
        <button onclick={() => (confirmClearAll = true)} class="clear-btn">
          Clear all
        </button>
      {/if}
    {/if}
  </div>

  <!-- List -->
  <div class="flex-1 overflow-y-auto">
    {#if loading}
      <div class="flex flex-col gap-2 p-4">
        {#each [1,2,3] as _}
          <div class="shimmer h-14 rounded-xl"></div>
        {/each}
      </div>

    {:else if entries.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <p class="text-sm">No scan history yet</p>
        <p class="text-xs opacity-50">Scanned folders will appear here</p>
      </div>

    {:else}
      {#each entries as entry (entry.path)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="entry-row group"
          role="button"
          tabindex="0"
          onclick={() => rescan(entry)}
          onkeydown={(e) => e.key === 'Enter' && rescan(entry)}
          title="Click to rescan"
        >
          <!-- Icon -->
          <div class="entry-icon">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.3">
              <rect x="2" y="6" width="20" height="12" rx="2.5"/>
              <path stroke-linecap="round" stroke-width="1" d="M6 12h.01M9 12h.01"/>
              <circle cx="18" cy="12" r="2" fill="currentColor" stroke="none" opacity="0.5"/>
            </svg>
          </div>

          <!-- Path + meta -->
          <div class="flex-1 min-w-0">
            <div class="entry-path truncate" title={entry.path}>
              {shortPath(entry.path)}
            </div>
            <div class="entry-meta">
              <span>{formatDate(entry.scannedAt)}</span>
              {#if entry.totalBytes > 0}
                <span class="dot">·</span>
                <span>{formatBytes(entry.totalBytes)}</span>
              {/if}
              {#if entry.itemCount > 0}
                <span class="dot">·</span>
                <span>{entry.itemCount.toLocaleString()} items</span>
              {/if}
            </div>
          </div>

          <!-- Actions -->
          <div class="entry-actions">
            <button
              onclick={(e) => { e.stopPropagation(); rescan(entry); }}
              class="action-btn rescan-btn"
              title="Rescan"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v6h6M20 20v-6h-6M20 10A8 8 0 005.07 7M4 14a8 8 0 0014.93 3"/>
              </svg>
            </button>
            <button
              onclick={(e) => { e.stopPropagation(); removeEntry(entry.path); }}
              class="action-btn remove-btn"
              title="Remove from history"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.02);
    flex-shrink: 0;
  }

  .back-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.07);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255,255,255,0.45);
    transition: background 0.15s, color 0.15s;
    cursor: pointer;
  }

  .back-btn:hover {
    background: rgba(255,255,255,0.09);
    color: rgba(255,255,255,0.8);
  }

  .history-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: rgba(255,255,255,0.8);
    letter-spacing: -0.01em;
  }

  .entry-count {
    font-size: 0.6rem;
    font-weight: 600;
    background: rgba(129,140,248,0.15);
    border: 1px solid rgba(129,140,248,0.2);
    color: rgba(165,180,252,0.7);
    border-radius: 99px;
    padding: 1px 7px;
  }

  .clear-btn {
    font-size: 0.6875rem;
    color: rgba(255,255,255,0.25);
    transition: color 0.15s;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 5px;
  }

  .clear-btn:hover { color: rgba(252,165,165,0.8); }

  .confirm-yes {
    font-size: 0.6875rem;
    font-weight: 600;
    color: rgba(252,165,165,0.9);
    cursor: pointer;
  }

  .confirm-no {
    font-size: 0.6875rem;
    color: rgba(255,255,255,0.3);
    cursor: pointer;
  }

  .confirm-yes:hover { color: rgba(248,113,113,1); }
  .confirm-no:hover  { color: rgba(255,255,255,0.6); }

  /* Empty */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 20px;
    gap: 8px;
    color: rgba(255,255,255,0.2);
    text-align: center;
  }

  .empty-icon {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
  }

  /* Entry row */
  .entry-row {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 11px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    cursor: pointer;
    transition: background 0.15s;
    position: relative;
  }

  .entry-row:hover { background: rgba(255,255,255,0.03); }

  .entry-icon {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: linear-gradient(135deg, rgba(129,140,248,0.1), rgba(56,189,248,0.06));
    border: 1px solid rgba(129,140,248,0.14);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(165,180,252,0.65);
    flex-shrink: 0;
  }

  .entry-path {
    font-size: 0.78125rem;
    font-weight: 500;
    color: rgba(255,255,255,0.72);
    letter-spacing: -0.01em;
  }

  .entry-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.625rem;
    color: rgba(255,255,255,0.22);
    margin-top: 2px;
  }

  .dot { opacity: 0.4; }

  /* Action buttons */
  .entry-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s;
    flex-shrink: 0;
  }

  .entry-row:hover .entry-actions { opacity: 1; }

  .action-btn {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255,255,255,0.3);
    transition: background 0.15s, color 0.15s;
    cursor: pointer;
  }

  .rescan-btn:hover {
    background: rgba(129,140,248,0.15);
    color: rgba(165,180,252,0.9);
  }

  .remove-btn:hover {
    background: rgba(239,68,68,0.15);
    color: rgba(252,165,165,0.9);
  }
</style>