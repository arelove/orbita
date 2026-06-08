<script lang="ts">
  import { goto } from '$app/navigation';
  import { scanParams, osMul } from '$lib/stores';
  import type { DiskMeta } from '$lib/types';

  let { disk }: { disk: DiskMeta } = $props();

  const mul = $derived($osMul);

  const perc = $derived(
    disk.totalSpace > 0
      ? (disk.totalSpace - disk.availableSpace) / disk.totalSpace
      : 0
  );

  // Цвет по заполненности
  const barColor = $derived(
    perc < 0.6  ? 'bar-green' :
    perc < 0.75 ? 'bar-yellow' :
    perc < 0.9  ? 'bar-orange' :
                  'bar-red'
  );

  const totalGB  = $derived((disk.totalSpace   / mul / mul / mul).toFixed(1));
  const freeGB   = $derived((disk.availableSpace / mul / mul / mul).toFixed(1));
  const usedGB   = $derived(((disk.totalSpace - disk.availableSpace) / mul / mul / mul).toFixed(1));
  const percDisplay = $derived((perc * 100).toFixed(0));
  const barWidth    = $derived(Math.min(perc * 100, 100).toFixed(1));

  function navigate(fullscan: boolean) {
    scanParams.set({
      disk: disk.sMountPoint,
      used: disk.totalSpace - disk.availableSpace,
      fullscan,
    });
    goto('/disk');
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="disk-card group"
  role="button"
  tabindex="0"
  onclick={() => navigate(false)}
  oncontextmenu={(e) => { e.preventDefault(); navigate(true); }}
  onkeydown={(e) => e.key === 'Enter' && navigate(false)}
  title="Left click: quick scan · Right click: full scan"
>
  <!-- Иконка диска -->
  <div class="disk-icon shrink-0">
    {#if disk.isRemovable}
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.3">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 3h6l2 4H7L9 3zM7 7h10v10a2 2 0 01-2 2H9a2 2 0 01-2-2V7z"/>
        <circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none"/>
      </svg>
    {:else}
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.3">
        <rect x="2" y="6" width="20" height="12" rx="2.5"/>
        <path stroke-linecap="round" stroke-width="1" d="M6 12h.01M9 12h.01"/>
        <circle cx="18" cy="12" r="2" fill="currentColor" stroke="none" opacity="0.6"/>
      </svg>
    {/if}
  </div>

  <div class="flex-1 min-w-0">
    <!-- Заголовок и процент -->
    <div class="flex justify-between items-start mb-2.5">
      <div class="min-w-0">
        <div class="disk-name truncate">{disk.name || 'Local Disk'}</div>
        <div class="disk-mount">{disk.sMountPoint}
          {#if disk.isRemovable}
            <span class="removable-badge">removable</span>
          {/if}
        </div>
      </div>
      <div class="text-right shrink-0 ml-4">
        <div class="perc-num {barColor}-text">{percDisplay}<span class="perc-sign">%</span></div>
        <div class="free-label">{freeGB} GB free</div>
      </div>
    </div>

    <!-- Прогресс-бар -->
    <div class="bar-track">
      <div class="bar-fill {barColor}" style="width: {barWidth}%"></div>
    </div>

    <!-- Метка размера -->
    <div class="size-row mt-1.5">
      <span>{usedGB} GB used</span>
      <span class="sep">·</span>
      <span>{totalGB} GB total</span>
    </div>
  </div>

  <!-- Стрелка -->
  <div class="arrow-icon shrink-0 ml-3">
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
    </svg>
  </div>
</div>

<style>
  .disk-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    cursor: pointer;
    transition: background 0.2s, transform 0.15s;
    position: relative;
    overflow: hidden;
  }

  .disk-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(120deg, rgba(129,140,248,0.04), transparent 60%);
    opacity: 0;
    transition: opacity 0.2s;
  }

  .disk-card:hover {
    background: rgba(255, 255, 255, 0.04);
  }
  .disk-card:hover::before { opacity: 1; }

  .disk-icon {
    width: 40px;
    height: 40px;
    border-radius: 11px;
    background: linear-gradient(135deg, rgba(129,140,248,0.12), rgba(56,189,248,0.08));
    border: 1px solid rgba(129,140,248,0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(165, 180, 252, 0.8);
    flex-shrink: 0;
    transition: border-color 0.2s, background 0.2s;
  }

  .disk-card:hover .disk-icon {
    background: linear-gradient(135deg, rgba(129,140,248,0.2), rgba(56,189,248,0.12));
    border-color: rgba(129,140,248,0.3);
  }

  .disk-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: rgba(255,255,255,0.85);
    letter-spacing: -0.01em;
  }

  .disk-mount {
    font-size: 0.6875rem;
    color: rgba(255,255,255,0.28);
    margin-top: 1px;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .removable-badge {
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: rgba(125, 211, 252, 0.7);
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56,189,248,0.2);
    border-radius: 4px;
    padding: 1px 5px;
  }

  .perc-num {
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .perc-sign {
    font-size: 0.65rem;
    font-weight: 500;
    opacity: 0.7;
  }

  .free-label {
    font-size: 0.625rem;
    color: rgba(255,255,255,0.28);
    margin-top: 2px;
  }

  /* Bar */
  .bar-track {
    width: 100%;
    height: 3px;
    border-radius: 99px;
    background: rgba(255,255,255,0.07);
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .bar-green  { background: linear-gradient(90deg, #34d399, #6ee7b7); }
  .bar-yellow { background: linear-gradient(90deg, #fbbf24, #fde68a); }
  .bar-orange { background: linear-gradient(90deg, #f97316, #fdba74); }
  .bar-red    { background: linear-gradient(90deg, #ef4444, #fca5a5); box-shadow: 0 0 8px rgba(239,68,68,0.4); }

  .bar-green-text  { color: #6ee7b7; }
  .bar-yellow-text { color: #fde68a; }
  .bar-orange-text { color: #fdba74; }
  .bar-red-text    { color: #fca5a5; }

  .size-row {
    display: flex;
    gap: 5px;
    font-size: 0.625rem;
    color: rgba(255,255,255,0.22);
  }

  .sep { opacity: 0.4; }

  .arrow-icon {
    color: rgba(255,255,255,0.15);
    transition: color 0.2s, transform 0.2s;
  }

  .disk-card:hover .arrow-icon {
    color: rgba(165,180,252,0.6);
    transform: translateX(2px);
  }
</style>