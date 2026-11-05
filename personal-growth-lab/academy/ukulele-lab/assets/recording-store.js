(function (root) {
  'use strict';
  const DB_NAME = 'yixindao.ukulele-recordings.v2', STORE = 'recordings';
  let opening;
  const memory = new Map();
  function db() {
    if (!opening) opening = new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error('浏览器没有开放录音存储，请下载文件备份。')); return; }
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => { const s = r.result.createObjectStore(STORE, { keyPath: 'id' }); s.createIndex('createdAt', 'createdAt'); };
      r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); resolve(r.result); };
      r.onerror = () => reject(new Error('无法打开录音库：' + (r.error && r.error.message || '存储受限')));
      r.onblocked = () => reject(new Error('请关闭旧版练习室标签页后重试。'));
    });
    return opening;
  }
  async function transaction(mode, operation) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, mode), request = operation(tx.objectStore(STORE)); let value;
      request.onsuccess = () => { value = request.result; };
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(new Error(tx.error && tx.error.name === 'QuotaExceededError' ? '本机录音空间不足。当前录音仍可下载，释放空间后再保存。' : (tx.error && tx.error.message || '录音保存失败')));
      tx.onabort = () => reject(new Error(tx.error && tx.error.message || '录音操作没有完成'));
    });
  }
  const id = () => root.crypto && crypto.randomUUID ? crypto.randomUUID() : 'uke-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  function validate(item) {
    if (!item || typeof item !== 'object' || !/^[\w-]{1,90}$/.test(item.id || '')) throw new Error('录音编号无效。');
    if (!(item.blob instanceof Blob) || item.blob.size <= 0 || item.blob.size > 20 * 1024 * 1024) throw new Error('录音文件需要大于0且不超过20 MB。');
    if (!Number.isFinite(item.duration) || item.duration <= 0 || item.duration > 600) throw new Error('录音时长应在10分钟以内。');
    if (typeof item.fileName !== 'string' || item.fileName.length > 240) throw new Error('文件名无效。');
    if (!Number.isFinite(Date.parse(item.createdAt))) throw new Error('录音时间无效。');
    const c = item.context || {};
    if (c.day != null && (!Number.isInteger(c.day) || c.day < 1 || c.day > 30)) throw new Error('录音课次无效。');
    if (c.songId && !['an-jing', 'qing-tian', 'sadness'].includes(c.songId)) throw new Error('录音曲目无效。');
    if (JSON.stringify(item.analysis || {}).length > 450000) throw new Error('分析报告过大。');
    return item;
  }
  async function put(item, options = {}) { validate(item); const result = { ...item, updatedAt: options.preserveUpdatedAt ? item.updatedAt : new Date().toISOString(), contentVersion: options.preserveUpdatedAt ? (item.contentVersion || id()) : id(), cloudDirty: options.markDirty !== false, persisted: true }; await transaction('readwrite', s => s.put(result)); memory.delete(item.id); return result; }
  async function get(key) { return memory.get(key) || await transaction('readonly', s => s.get(key)); }
  async function list(context) {
    let rows; try { rows = await transaction('readonly', s => s.getAll()); } catch (err) { if (!memory.size) throw err; rows = []; }
    const byId = new Map(rows.map(r => [r.id, r])); for (const r of memory.values()) byId.set(r.id, r);
    rows = [...byId.values()];
    if (context && context.day) rows = rows.filter(r => r.context && r.context.day === context.day);
    else if (context && context.songId) rows = rows.filter(r => r.context && r.context.songId === context.songId);
    else if (context && context.assessmentId) rows = rows.filter(r => r.context && r.context.assessmentId === context.assessmentId);
    return rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  async function update(key, patch) { const item = await get(key); if (!item) throw new Error('找不到这条录音。'); return put({ ...item, ...patch, id: item.id, blob: item.blob }); }
  async function markCloudSynced(key, serverTime, contentVersion, userId) {
    const mark = item => ({...item,cloudSyncedAt:serverTime,cloudUserId:userId,cloudMissing:false,cloudDirty:item.contentVersion!==contentVersion});
    if(memory.has(key)){const result=mark(memory.get(key));memory.set(key,result);return result;}
    const database=await db();
    return new Promise((resolve,reject)=>{const tx=database.transaction(STORE,'readwrite'),s=tx.objectStore(STORE),request=s.get(key);let result;
      request.onsuccess=()=>{if(memory.has(key)){result=mark(memory.get(key));memory.set(key,result);return;}const item=request.result;if(!item)return;result=mark(item);s.put(result);};
      tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(new Error('本机同步标记未保存，下次会安全重试。'));tx.onabort=tx.onerror;
    });
  }
  function sameCloudSnapshot(current, expected) {
    return !!current && !!expected && !current.cloudDirty &&
      current.contentVersion === expected.contentVersion && current.updatedAt === expected.updatedAt &&
      current.cloudSyncedAt === expected.cloudSyncedAt && current.cloudUserId === expected.cloudUserId;
  }
  // Read, check, and write in ONE transaction. An earlier list() result is
  // only a snapshot; analysis, backup restore, or another tab may have edited
  // the same recording while a network response was in flight.
  async function cloudMutation(key, choose) {
    function inMemory() { const result=choose(memory.get(key));if(result.applied&&result.item){result.item={...result.item,persisted:false};memory.set(key,result.item);}return result; }
    if(memory.has(key))return inMemory();
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, 'readwrite'), s = tx.objectStore(STORE), request = s.get(key);
      let result;
      request.onsuccess = () => {
        try {
          if (memory.has(key)) { result = inMemory(); return; }
          const current = request.result || null;
          result = choose(current);
          if (result.applied && result.item) s.put(result.item);
        } catch (error) { result = {error}; tx.abort(); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(result?.error || new Error('本机同步记录未保存，请保留本机内容并重试。'));
      tx.onabort = tx.onerror;
    });
  }
  async function applyCloudRecording(incoming, expected) {
    validate(incoming);
    return cloudMutation(incoming.id, current => {
      if (expected === null ? !!current : !sameCloudSnapshot(current, expected)) {
        return {applied:false, reason:current ? 'changed' : 'missing', item:current};
      }
      const item = {...incoming, blob:current ? current.blob : incoming.blob, contentVersion:id(), cloudDirty:false, cloudMissing:false, persisted:true};
      return {applied:true, item};
    });
  }
  async function markCloudMissing(key, expected) {
    return cloudMutation(key, current => {
      if (!current) return {applied:false, reason:'missing', item:null};
      if (!sameCloudSnapshot(current, expected)) return {applied:false, reason:'changed', item:current};
      return {applied:true, item:{...current, cloudMissing:true}};
    });
  }
  async function remove(key) { await transaction('readwrite', s => s.delete(key)); memory.delete(key); }
  function keepTemporary(item) { memory.set(item.id, { ...item, updatedAt:new Date().toISOString(),contentVersion:id(),cloudDirty:true,persisted:false }); return memory.get(item.id); }
  function metadata(item) { const { blob, ...rest } = item; return { ...rest, size: blob.size, mimeType: blob.type || item.mimeType || 'application/octet-stream' }; }
  const table = Uint32Array.from({ length: 256 }, (_, k) => { let c = k; for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ c >>> 1 : c >>> 1; return c >>> 0; });
  function crc32(bytes) { let crc = 0xffffffff; for (const b of bytes) crc = table[(crc ^ b) & 255] ^ crc >>> 8; return (crc ^ 0xffffffff) >>> 0; }
  function header(size) { const data = new Uint8Array(size); return { data, view: new DataView(data.buffer) }; }
  async function exportArchive(progress) {
    const rows = await list();
    if(rows.length > 300 || rows.reduce((n,r)=>n+r.blob.size,0)>490*1024*1024) throw new Error('完整备份支持最多300条、约490 MB音频。请先逐条下载较早录音并整理后再备份。');
    const manifest = { app: 'yixindao.ukulele.audio-backup', schema: 1, exportedAt: new Date().toISOString(), progress, recordings: rows.map(r => ({ ...metadata(r), archivePath: 'audio/' + r.id })) };
    const files = [{ name: 'manifest.json', blob: new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }) }, ...rows.map(r => ({ name: 'audio/' + r.id, blob: r.blob }))];
    const parts = [], central = []; let offset = 0;
    for (const file of files) {
      const name = new TextEncoder().encode(file.name), bytes = new Uint8Array(await file.blob.arrayBuffer()), crc = crc32(bytes);
      const h = header(30), v = h.view; v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x800, true); v.setUint32(14, crc, true); v.setUint32(18, bytes.length, true); v.setUint32(22, bytes.length, true); v.setUint16(26, name.length, true);
      parts.push(h.data, name, bytes);
      const c = header(46), w = c.view; w.setUint32(0, 0x02014b50, true); w.setUint16(4, 20, true); w.setUint16(6, 20, true); w.setUint16(8, 0x800, true); w.setUint32(16, crc, true); w.setUint32(20, bytes.length, true); w.setUint32(24, bytes.length, true); w.setUint16(28, name.length, true); w.setUint32(42, offset, true); central.push(c.data, name); offset += 30 + name.length + bytes.length;
    }
    const centralSize = central.reduce((n, p) => n + p.length, 0), end = header(22), e = end.view; e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.data], { type: 'application/zip' });
  }
  async function readArchive(file) {
    if (!file || file.size > 500 * 1024 * 1024) throw new Error('备份包超过500 MB，请分批迁移。');
    const bytes = new Uint8Array(await file.arrayBuffer()), view = new DataView(bytes.buffer), files = new Map(); let pos = 0;
    while (pos + 30 <= bytes.length && view.getUint32(pos, true) === 0x04034b50) {
      const flags = view.getUint16(pos + 6, true), method = view.getUint16(pos + 8, true), size = view.getUint32(pos + 18, true), length = view.getUint16(pos + 26, true), extra = view.getUint16(pos + 28, true), start = pos + 30 + length + extra, end = start + size;
      if (method !== 0 || flags & 9 || end > bytes.length || files.size > 301) throw new Error('请选择本练习室导出的未重新压缩ZIP备份。');
      const name = new TextDecoder().decode(bytes.subarray(pos + 30, pos + 30 + length)); if (!/^(manifest\.json|audio\/[\w-]{1,90})$/.test(name) || files.has(name)) throw new Error('备份包包含不支持的文件路径。');
      const part = bytes.subarray(start, end); if (crc32(part) !== view.getUint32(pos + 14, true)) throw new Error('备份包校验失败，可能没有下载完整。');
      files.set(name, part); pos = end;
    }
    const raw = files.get('manifest.json'); if (!raw || raw.length > 8 * 1024 * 1024) throw new Error('没有找到有效备份清单。');
    const manifest = JSON.parse(new TextDecoder().decode(raw));
    if (manifest.app !== 'yixindao.ukulele.audio-backup' || manifest.schema !== 1 || !Array.isArray(manifest.recordings) || manifest.recordings.length > 300) throw new Error('备份格式不受支持。');
    const checked = root.UKE_PROGRESS.validate(manifest.progress); if (!checked.ok) throw new Error('进度记录校验未通过：' + checked.errors[0]);
    const rows = manifest.recordings.map(meta => { const data = files.get(meta.archivePath); if (!data || meta.archivePath !== 'audio/' + meta.id) throw new Error('录音文件缺失。'); return validate({ id: meta.id, fileName: meta.fileName, label: String(meta.label || '').slice(0, 160), createdAt: meta.createdAt, updatedAt: meta.updatedAt || meta.createdAt, duration: meta.duration, context: meta.context || {}, source: meta.source === 'recorded' ? 'recorded' : 'uploaded', config: meta.config || {}, analysis: meta.analysis || null, mimeType: meta.mimeType, blob: new Blob([data], { type: /^audio\//.test(meta.mimeType) ? meta.mimeType : 'audio/webm' }) }); });
    return { progress: checked.state, rows };
  }
  root.UKE_RECORDINGS = { id, db, put, get, list, update, markCloudSynced, applyCloudRecording, markCloudMissing, remove, keepTemporary, hasTemporary:()=>memory.size>0, metadata, exportArchive, readArchive };
})(window);
