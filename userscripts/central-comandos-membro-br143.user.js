// ==UserScript==
// @name         Central de Comandos - Membro BR143
// @namespace    central-comandos-membro-br143
// @version      1.4.1
// @description  Lê, exporta e sincroniza automaticamente os comandos recebidos da própria conta no mundo BR143.
// @updateURL    https://raw.githubusercontent.com/guijanuario/monitorCommanderMembro/main/userscripts/central-comandos-membro-br143.user.js
// @downloadURL  https://raw.githubusercontent.com/guijanuario/monitorCommanderMembro/main/userscripts/central-comandos-membro-br143.user.js
// @match        *://br143.tribalwars.*/game.php*
// @match        *://br143.guerrastribais.*/game.php*
// @match        *://br143.tribalwars.com.br/game.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @connect      monitorcommander.guitw2025.workers.dev
// @run-at       document-end
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const WORLD = 'br143';
  // A versão pública não inclui a credencial; ela é configurada uma vez no menu do script.
  const SERVER_URL = 'https://monitorcommander.guitw2025.workers.dev';
  const MEMBER_TOKEN = '';
  const MAX_PAGES = 50;
  const TABLE_SELECTOR = '#incomings_table';
  const SYNC_INTERVAL = 5 * 60 * 1000;
  const hostWorld = location.hostname.match(/(?:^|\.)(br\d{1,3})\./i)?.[1]?.toLowerCase();
  if (hostWorld !== WORLD || document.getElementById('br143-member-export')) return;

  function accountName() {
    return String(unsafeWindow.game_data?.player?.name || '').trim();
  }

  function cellText(cell) {
    return (cell?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function commandId(row, firstCell) {
    const direct = row.getAttribute('data-command-id') || firstCell.getAttribute('data-command-id') ||
      firstCell.querySelector('[data-command-id]')?.getAttribute('data-command-id');
    if (direct && /^\d+$/.test(direct)) return direct;
    const input = row.querySelector('input[name^="command_ids["], input[name^="id_"]');
    const inputId = input?.name?.match(/(?:command_ids\[|id_)(\d+)/)?.[1];
    if (inputId) return inputId;
    const link = firstCell.querySelector('a[href*="command_id="]');
    return link?.href?.match(/[?&]command_id=(\d+)/)?.[1] || '';
  }

  function arrivalTime(cell) {
    const element = cell.querySelector('[data-endtime], [data-timestamp], [data-time]');
    const raw = element?.getAttribute('data-endtime') || element?.getAttribute('data-timestamp') ||
      element?.getAttribute('data-time');
    if (raw && /^\d+$/.test(raw)) {
      const n = Number(raw);
      return n < 100000000000 ? n * 1000 : n;
    }
    const text = element?.getAttribute('title') || cell.getAttribute('title') || cellText(cell);
    const match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return null;
    const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    const date = new Date(year, Number(match[2]) - 1, Number(match[1]), Number(match[4]), Number(match[5]), Number(match[6] || 0));
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  function axeColor(image) {
    const source = (image?.getAttribute('src') || '').split('?')[0].toLowerCase();
    if (/attack_large\.(?:png|webp)$/.test(source)) return 'red';
    if (/attack_medium\.(?:png|webp)$/.test(source)) return 'orange';
    if (/attack_small\.(?:png|webp)$/.test(source)) return 'green';
    if (/\/attack\.(?:png|webp)$/.test(source)) return 'gray';
    return 'unknown';
  }

  function commandKind(first, image, label) {
    const source = (image?.getAttribute('src') || '').toLowerCase();
    const description = [cellText(label), image?.getAttribute('alt'), image?.getAttribute('title')].join(' ');
    if (/\/support\.(?:png|webp)(?:\?|$)/.test(source) || /\b(?:apoio|support)\b/i.test(description)) return 'support';
    if (/\/attack(?:_small|_medium|_large)?\.(?:png|webp)(?:\?|$)/.test(source) || /\b(?:ataque|attack|nobre|noble)\b/i.test(description)) return 'attack';
    return 'unknown';
  }

  function hasNoble(first, label) {
    if (first.querySelector('img[src*="/unit/tiny/snob"], img[src*="/unit/snob"], img[src*="/unit/tiny/noble"], img[src*="/unit/noble"]')) return true;
    const description = [cellText(label), ...[...first.querySelectorAll('img')].map(img => `${img.alt || ''} ${img.title || ''}`)].join(' ');
    return /\b(?:nobre|noble|snob)\b/i.test(description);
  }

  function towerInfo(row, cells, headers) {
    const towerIndex = headers.findIndex(text => /torre\s*de\s*vigia|watchtower/i.test(text));
    const cell = towerIndex >= 0 ? cells[towerIndex] : null;
    const marker = row.querySelector('.commandicon-wt, [data-title*="torre de vigia" i], [title*="torre de vigia" i], [title*="watchtower" i]');
    const markerText = marker?.getAttribute('data-title') || marker?.getAttribute('title') || '';
    const towerText = cellText(cell);
    const rawTime = cell?.querySelector('[data-endtime], [data-timestamp]')?.getAttribute('data-endtime') ||
      cell?.querySelector('[data-timestamp]')?.getAttribute('data-timestamp');
    const towerAt = rawTime && /^\d+$/.test(rawTime) ? (Number(rawTime) < 100000000000 ? Number(rawTime) * 1000 : Number(rawTime)) : null;
    const countdown = (towerText || markerText).match(/\b\d{1,3}:\d{2}:\d{2}\b/)?.[0] || '';
    return {
      watchtower: Boolean(marker) || Boolean(towerText && !/^(?:n\/a|—|-|não|nao)$/i.test(towerText)),
      watchtower_text: towerText || markerText || '',
      watchtower_at: towerAt,
      watchtower_countdown: countdown
    };
  }

  function readPage(doc, player) {
    const table = doc.querySelector(TABLE_SELECTOR);
    if (!table) throw new Error('A tabela de comandos recebidos não foi encontrada.');
    const rows = [...table.querySelectorAll('tbody tr')];
    const headers = [...table.querySelectorAll('thead th, tr:first-child th')].map(cellText);
    return rows.flatMap(row => {
      const cells = [...row.querySelectorAll(':scope > td')];
      if (cells.length < 7) return [];
      const first = cells[0];
      const image = first.querySelector('img[src*="/graphic/command/"]');
      const label = first.querySelector('.quickedit-label, .quickedit span');
      const kind = commandKind(first, image, label);
      const tower = towerInfo(row, cells, headers);
      return [{
        world: WORLD,
        player,
        command_id: commandId(row, first),
        type: cellText(label) || image?.alt || cellText(first),
        command_kind: kind,
        is_noble: kind === 'attack' && hasNoble(first, label),
        target: cellText(cells[1]),
        origin: cellText(cells[2]),
        attacker: cellText(cells[3]),
        distance: cellText(cells[4]),
        arrival_text: cellText(cells[5]),
        arrival_at: arrivalTime(cells[5]),
        countdown: cellText(cells[6]),
        icon_src: image?.src || '',
        axe_color: kind === 'support' ? 'unknown' : axeColor(image),
        ...tower,
        captured_at: Date.now()
      }];
    });
  }

  function pageUrl(page) {
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set('screen', 'overview_villages');
    url.searchParams.set('mode', 'incomings');
    url.searchParams.set('page', String(page));
    return url;
  }

  function lastPage(doc) {
    const links = [...doc.querySelectorAll('a[href*="page="]')];
    const numbers = links.map(link => Number(new URL(link.href, location.origin).searchParams.get('page')))
      .filter(Number.isFinite);
    return numbers.length ? Math.min(Math.max(...numbers), MAX_PAGES - 1) : 0;
  }

  async function collect(status) {
    const player = accountName();
    if (!player) throw new Error('Não foi possível identificar o jogador conectado. Abra uma página do jogo e tente novamente.');
    const result = new Map();
    let maxPage = MAX_PAGES - 1;
    let previousIds = null;
    for (let page = 0; page <= maxPage; page++) {
      status(`Lendo página ${page + 1}...`);
      const response = await fetch(pageUrl(page), { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Falha ao ler página ${page + 1}: HTTP ${response.status}.`);
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const rows = readPage(doc, player);
      if (page === 0) maxPage = Math.min(maxPage, lastPage(doc));
      if (!rows.length) break;
      const fingerprint = rows.map(row => `${row.command_id}|${row.origin}|${row.target}`).join('\n');
      if (fingerprint === previousIds) break;
      previousIds = fingerprint;
      for (const row of rows) {
        const key = row.command_id || `${row.origin}|${row.target}|${row.attacker}|${row.arrival_text}`;
        result.set(key, row);
      }
      if (page < maxPage) await new Promise(resolve => setTimeout(resolve, 150));
    }
    return { world: WORLD, player, collected_at: new Date().toISOString(), commands: [...result.values()] };
  }

  function download(name, content, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function post(url, token, payload) {
    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method: 'POST', url: `${url}/api/attacks`, timeout: 30000,
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
      data: JSON.stringify(payload),
      onload: response => {
        if (response.status < 200 || response.status >= 300) { reject(new Error(`Servidor respondeu HTTP ${response.status}: ${response.responseText.slice(0, 200)}`)); return; }
        try { resolve(JSON.parse(response.responseText)); } catch { reject(new Error('Resposta inválida do servidor.')); }
      },
      onerror: () => reject(new Error('Falha de conexão com o servidor.')),
      ontimeout: () => reject(new Error('Tempo de espera esgotado.'))
    }));
  }

  let syncing = false;
  function configuredToken() {
    const stored = GM_getValue('br143-member-token', null);
    return String(stored === null ? MEMBER_TOKEN : stored).trim();
  }
  async function sync() {
    if (syncing) return;
    const token = configuredToken();
    if (!token) {
      const button = document.getElementById('br143-member-sync');
      if (button) button.textContent = 'Configure o envio primeiro';
      return;
    }
    syncing = true;
    const button = document.getElementById('br143-member-sync');
    try {
      if (button) { button.disabled = true; button.textContent = 'Lendo recebidos...'; }
      const result = await collect(text => { if (button) button.textContent = text; });
      let sent = 0;
      for (let index = 0; index < result.commands.length; index += 200) {
        const batch = result.commands.slice(index, index + 200);
        const response = await post(SERVER_URL, token, { world: WORLD, player: result.player, attacks: batch });
        sent += Number(response.accepted || 0);
      }
      if (button) button.textContent = `${sent} enviados`;
      console.info(`[Membro BR143] ${sent} recebidos sincronizados para ${result.player}.`);
    } catch (error) {
      if (button) button.textContent = 'Erro ao sincronizar';
      console.error('[Membro BR143]', error);
      throw error;
    } finally {
      syncing = false;
      setTimeout(() => { if (button) { button.disabled = false; button.textContent = 'Sincronizar BR143'; } }, 4000);
    }
  }

  function csv(payload) {
    const fields = ['world', 'player', 'command_id', 'type', 'command_kind', 'is_noble', 'target', 'origin', 'attacker',
      'distance', 'arrival_text', 'arrival_at', 'countdown', 'axe_color', 'watchtower',
      'watchtower_text', 'watchtower_at', 'watchtower_countdown', 'captured_at'];
    const escape = value => {
      let text = value == null ? '' : String(value);
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    return '\uFEFF' + [fields.join(';'), ...payload.commands.map(row => fields.map(field => escape(row[field])).join(';'))].join('\r\n');
  }

  function showButton() {
    if (document.getElementById('br143-member-export')) return;
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;top:98px;left:75px;z-index:10000;font:13px Arial,sans-serif';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = '↻';
    toggle.title = 'Central BR143 · abrir opções de sincronização';
    toggle.setAttribute('aria-label', 'Abrir opções da Central BR143');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.style.cssText = 'display:grid;place-items:center;width:28px;height:28px;padding:0;background:#f3e1b5;color:#6b421d;border:1px solid #a77d43;border-radius:6px;box-shadow:0 1px 3px #0004;cursor:pointer;font-size:19px;line-height:1';
    const menu = document.createElement('div');
    menu.hidden = true;
    menu.style.cssText = 'position:absolute;top:34px;left:0;width:210px;padding:9px;background:#f4e2bb;border:1px solid #a77d43;border-radius:7px;box-shadow:0 4px 15px #0006;display:none;flex-direction:column;gap:6px';
    const heading = document.createElement('strong'); heading.textContent = 'Central BR143'; heading.style.cssText = 'color:#573416';
    const button = document.createElement('button');
    button.id = 'br143-member-export';
    button.type = 'button';
    button.textContent = 'Exportar recebidos BR143';
    button.title = 'Lê as páginas de ataques recebidos da sua conta e baixa um arquivo.';
    const style = 'padding:7px 9px;background:#744a24;color:#fff;border:1px solid #573416;border-radius:4px;cursor:pointer;text-align:left';
    button.style.cssText = style;
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      button.disabled = true;
      const status = text => { button.textContent = text; };
      try {
        const payload = await collect(status);
        const safePlayer = payload.player.replace(/[^\p{L}\p{N}_-]+/gu, '_');
        const suffix = new Date().toISOString().replace(/[:.]/g, '-');
        const format = confirm(`Foram encontrados ${payload.commands.length} comandos recebidos de ${payload.player}.\n\nOK: baixar JSON. Cancelar: baixar CSV.`);
        if (format) download(`recebidos_${WORLD}_${safePlayer}_${suffix}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
        else download(`recebidos_${WORLD}_${safePlayer}_${suffix}.csv`, csv(payload), 'text/csv;charset=utf-8');
        status(`${payload.commands.length} comandos exportados`);
      } catch (error) {
        console.error('[Membro BR143]', error);
        status('Erro ao exportar');
        alert(`Não foi possível exportar os recebidos: ${error.message}`);
      } finally {
        setTimeout(() => { button.textContent = 'Exportar recebidos BR143'; button.disabled = false; }, 3000);
      }
    });
    const syncButton = document.createElement('button');
    syncButton.id = 'br143-member-sync'; syncButton.type = 'button'; syncButton.textContent = 'Sincronizar BR143'; syncButton.style.cssText = style;
    syncButton.addEventListener('click', () => sync().catch(error => alert(`Falha na sincronização: ${error.message}`)));
    const configButton = document.createElement('button');
    configButton.type = 'button'; configButton.textContent = 'Configurar credencial de envio'; configButton.style.cssText = style;
    configButton.addEventListener('click', () => {
      const value = prompt('Digite a credencial de envio fornecida pela liderança (64 caracteres). Deixe vazio para desativar o envio neste navegador:');
      if (value === null) return;
      const token = value.trim();
      if (token && !/^[a-f0-9]{64}$/i.test(token)) { alert('Credencial inválida. Verifique os 64 caracteres recebidos da liderança.'); return; }
      GM_setValue('br143-member-token', token);
      syncButton.textContent = token ? 'Sincronizar BR143' : 'Configure o envio primeiro';
      toggle.title = token ? 'Central BR143 · envio configurado' : 'Central BR143 · configure o envio';
      if (token) sync().catch(error => alert(`Falha na sincronização: ${error.message}`));
    });
    menu.append(heading, configButton, syncButton, button);
    box.append(toggle, menu);
    const setOpen = open => { menu.hidden = !open; menu.style.display = open ? 'flex' : 'none'; toggle.setAttribute('aria-expanded', String(open)); };
    toggle.addEventListener('click', () => setOpen(menu.hidden));
    document.addEventListener('click', event => { if (!box.contains(event.target)) setOpen(false); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') setOpen(false); });
    document.body.appendChild(box);
    if (configuredToken()) sync().catch(error => console.error('[Membro BR143]', error));
    else { syncButton.textContent = 'Configure o envio primeiro'; toggle.title = 'Central BR143 · configure o envio'; }
    setInterval(() => sync().catch(error => console.error('[Membro BR143]', error)), SYNC_INTERVAL);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showButton, { once: true });
  else showButton();
})();
