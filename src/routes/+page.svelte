<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { invoke } from '@tauri-apps/api/core';
  import { getVersion } from '@tauri-apps/api/app';
  import { open } from '@tauri-apps/plugin-dialog';
  import DiskItem from '$lib/components/DiskItem.svelte';
  import { scanParams, osPlatform } from '$lib/stores';
  import type { DiskMeta } from '$lib/types';

  const BLOCKED_MOUNTS: Record<string, string[]> = {
    macos: ['/System/Volumes/Data'],
    linux: [
      '/var/snap/firefox/common/host-hunspell',
      '/boot/efi',
      '/snap',
    ],
  };

  let rawDisks     = $state<DiskMeta[]>([]);
  let appVersion   = $state('0.1.0');
  let loadError    = $state<string | null>(null);
  let interval: ReturnType<typeof setInterval> | null = null;
  let destroyed    = false;

  const plf   = $derived($osPlatform);
  const disks = $derived(
    rawDisks.filter((d) => !BLOCKED_MOUNTS[plf]?.includes(d.sMountPoint))
  );

  onMount(async () => {
    appVersion = await getVersion().catch(() => '0.1.0');
    await loadDisks();
    interval = setInterval(() => {
      if (!destroyed) loadDisks();
    }, 3000);
  });

  onDestroy(() => {
    destroyed = true;
    if (interval) clearInterval(interval);
  });

  async function loadDisks() {
    if (destroyed) return;
    try {
      const result = await invoke<DiskMeta[]>('get_disks');
      if (!destroyed) { rawDisks = result; loadError = null; }
    } catch (e) {
      console.error('Failed to load disks:', e);
      if (!destroyed) loadError = String(e);
    }
  }

  async function selectFolder() {
    try {
      const directory = await open({ multiple: false, directory: true });
      if (directory && typeof directory === 'string') {
        const path = directory.replace(/\\/g, '/');
        scanParams.set({ disk: path, used: 0, fullscan: false, isDirectory: true });
        goto('/disk');
      }
    } catch (e) {
      console.error('Failed to open folder dialog:', e);
    }
  }
</script>

<div class="flex-1 flex flex-col overflow-hidden text-white">

  <!-- Error banner — FIX: SVG вместо ⚠ символа -->
  {#if loadError}
    <div class="mx-3 mt-3 px-3 py-2 rounded-lg text-xs text-red-300/80
                bg-red-500/10 border border-red-500/20 flex items-center gap-2">
      <svg class="w-3.5 h-3.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      </svg>
      Failed to load disks: {loadError}
    </div>
  {/if}

  <!-- Disks list -->
  <div class="flex-1 overflow-y-auto">

    <!-- Section label -->
    <div class="section-label px-4 pt-4 pb-2">
      <span>Storage Devices</span>
      <span class="count">{disks.length}</span>
    </div>

    {#if disks.length === 0 && !loadError}
      <div class="empty-state">
        <div class="empty-icon">
          <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
            <rect x="2" y="6" width="20" height="12" rx="2"/>
            <path stroke-linecap="round" d="M6 12h.01M9 12h.01"/>
          </svg>
        </div>
        <p>No disks found</p>
      </div>
    {/if}

    {#each disks as disk (disk.sMountPoint)}
      <DiskItem {disk} />
    {/each}

    <!-- Divider -->
    <div class="section-divider mx-3 my-1"></div>

    <!-- Section label -->
    <div class="section-label px-4 pt-3 pb-2">
      <span>Actions</span>
    </div>

    <!-- Select folder -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="action-row"
      role="button"
      tabindex="0"
      onclick={selectFolder}
      onkeydown={(e) => e.key === 'Enter' && selectFolder()}
    >
      <div class="action-icon folder-icon">
        <svg class="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"/>
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <div class="action-title">Select Folder</div>
        <div class="action-sub">Analyze any folder on your system</div>
      </div>
      <svg class="w-3.5 h-3.5 text-white/15 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
      </svg>
    </div>

    <!-- History -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="action-row"
      role="button"
      tabindex="0"
      onclick={() => goto('/history')}
      onkeydown={(e) => e.key === 'Enter' && goto('/history')}
    >
      <div class="action-icon history-icon">
        <svg class="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <div class="action-title">Scan History</div>
        <div class="action-sub">Recently scanned disks and folders</div>
      </div>
      <svg class="w-3.5 h-3.5 text-white/15 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
      </svg>
    </div>

  </div>

  <!-- Footer -->
  <div class="footer px-4 py-2">
    <span>Right-click a disk for full scan</span>
    <span class="ver">v{appVersion}</span>
  </div>
</div>

<style>
  .section-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.2);
  }

  .section-label .count {
    background: rgba(255,255,255,0.06);
    border-radius: 99px;
    padding: 0 6px;
    font-size: 0.6rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 0;
    gap: 10px;
    color: rgba(255,255,255,0.18);
    font-size: 0.75rem;
  }

  .empty-icon {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Action rows */
  .action-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 16px;
    cursor: pointer;
    transition: background 0.15s;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    position: relative;
    overflow: hidden;
  }

  .action-row:hover { background: rgba(255,255,255,0.03); }

  .action-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .folder-icon {
    background: linear-gradient(135deg, rgba(251,191,36,0.1), rgba(251,191,36,0.05));
    border: 1px solid rgba(251,191,36,0.15);
    color: rgba(253,230,138,0.7);
  }

  .history-icon {
    background: linear-gradient(135deg, rgba(129,140,248,0.1), rgba(129,140,248,0.05));
    border: 1px solid rgba(129,140,248,0.15);
    color: rgba(165,180,252,0.7);
  }

  .action-title {
    font-size: 0.78125rem;
    font-weight: 600;
    color: rgba(255,255,255,0.75);
    letter-spacing: -0.01em;
  }

  .action-sub {
    font-size: 0.625rem;
    color: rgba(255,255,255,0.25);
    margin-top: 1px;
  }

  /* Footer */
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.625rem;
    color: rgba(255,255,255,0.15);
    border-top: 1px solid rgba(255,255,255,0.05);
    padding-top: 8px;
    padding-bottom: 8px;
  }

  .ver {
    font-variant-numeric: tabular-nums;
    color: rgba(255,255,255,0.1);
  }
</style>