(() => {
  // 项目标识日志（在控制台可见）
  try { console.log('--本项目由@labi-xiaoxin搭建开发'); } catch(_){}
  const currentPathEl = document.getElementById('currentPath');
  const tableBody = document.getElementById('fileTableBody');
  const upBtn = document.getElementById('upBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const uploadHidden = document.getElementById('uploadHidden');
  const uploadBtn = document.getElementById('uploadBtn');
  const batchDownloadBtn = document.getElementById('batchDownloadBtn');
  const progressList = document.getElementById('uploadProgress');
  const mkdirBtn = document.getElementById('mkdirBtn');
  const batchDeleteBtn = document.getElementById('batchDeleteBtn');
  const selectAllEl = document.getElementById('selectAll');

  // 自定义弹框元素
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitleEl = document.getElementById('modalTitle');
  const modalBodyEl = document.getElementById('modalBody');
  const modalFooterEl = document.getElementById('modalFooter');
  const modalCloseBtn = document.getElementById('modalClose');

  function hideModal(){
    try {
      modalOverlay.classList.remove('show');
      modalOverlay.setAttribute('aria-hidden', 'true');
      modalBodyEl.innerHTML = '';
      modalFooterEl.innerHTML = '';
      modalCloseBtn.onclick = null;
      modalOverlay.onclick = null;
    } catch(_){ }
  }

  function showModal(title, bodyContent, buttons){
    return new Promise((resolve) => {
      try {
        modalTitleEl.textContent = title || '提示';
        // 内容
        modalBodyEl.innerHTML = '';
        if (typeof bodyContent === 'string'){
          const text = document.createElement('div');
          text.textContent = bodyContent;
          modalBodyEl.appendChild(text);
        } else if (bodyContent instanceof Node) {
          modalBodyEl.appendChild(bodyContent);
        }
        // 按钮
        modalFooterEl.innerHTML = '';
        const complete = (value) => { hideModal(); resolve(value); };
        for (const btn of (buttons || [])){
          const b = document.createElement('button');
          b.textContent = btn.text || '确定';
          b.className = btn.className || 'btn-primary';
          b.onclick = () => complete(btn.value);
          modalFooterEl.appendChild(b);
        }
        // 展示与关闭规则
        modalOverlay.classList.add('show');
        modalOverlay.setAttribute('aria-hidden', 'false');
        modalCloseBtn.onclick = () => complete(undefined);
        modalOverlay.onclick = (e) => { if (e.target === modalOverlay) complete(undefined); };
      } catch(err){ console.error(err); resolve(undefined); }
    });
  }

  async function uiAlert(message, title){
    await showModal(title || '提示', message, [ { text: '确定', className: 'btn-primary', value: true } ]);
  }

  async function uiConfirm(message, title){
    const val = await showModal(title || '确认', message, [
      { text: '取消', className: 'btn-secondary', value: false },
      { text: '确定', className: 'btn-primary', value: true }
    ]);
    return !!val;
  }

  async function uiPrompt(title, defaultValue){
    const wrap = document.createElement('div');
    const label = document.createElement('div');
    label.style.marginBottom = '8px';
    label.textContent = title || '请输入内容';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = (defaultValue ?? '');
    wrap.append(label, input);
    return new Promise((resolve) => {
      const finish = (val) => { hideModal(); resolve(val); };
      modalTitleEl.textContent = '输入';
      modalBodyEl.innerHTML = '';
      modalBodyEl.appendChild(wrap);
      modalFooterEl.innerHTML = '';
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = '取消';
      cancelBtn.className = 'btn-secondary';
      cancelBtn.onclick = () => finish(null);
      const okBtn = document.createElement('button');
      okBtn.textContent = '确定';
      okBtn.className = 'btn-primary';
      okBtn.onclick = () => finish(input.value);
      modalFooterEl.append(cancelBtn, okBtn);
      modalOverlay.classList.add('show');
      modalOverlay.setAttribute('aria-hidden', 'false');
      modalCloseBtn.onclick = () => finish(null);
      modalOverlay.onclick = (e) => { if (e.target === modalOverlay) finish(null); };
      setTimeout(() => { try { input.focus(); input.select(); } catch(_){ } }, 50);
      const keyHandler = (e) => { if (e.key === 'Escape') finish(null); else if (e.key === 'Enter') finish(input.value); };
      document.addEventListener('keydown', keyHandler, { once: true });
    });
  }

  function updateSelectAllState(){
    if (!selectAllEl) return;
    const boxes = tableBody.querySelectorAll('.row-select');
    const total = boxes.length;
    const checked = tableBody.querySelectorAll('.row-select:checked').length;
    selectAllEl.checked = (total > 0 && checked === total);
    selectAllEl.indeterminate = (checked > 0 && checked < total);
  }
  if (selectAllEl){
    selectAllEl.addEventListener('change', () => {
      const checked = selectAllEl.checked;
      const boxes = tableBody.querySelectorAll('.row-select');
      boxes.forEach(b => { b.checked = checked; });
      updateSelectAllState();
    });
  }

  let currentPath = '/';

  // 简单的 SVG 图标模板
  const folderSVG = "<svg viewBox='0 0 16 16' class='icon-folder' xmlns='http://www.w3.org/2000/svg'><path d='M1 4h5l1.5 2H15v6.5A1.5 1.5 0 0 1 13.5 14h-11A1.5 1.5 0 0 1 1 12.5V4z'/></svg>";
  const fileSVG = "<svg viewBox='0 0 16 16' class='icon-file' xmlns='http://www.w3.org/2000/svg'><rect x='3' y='2' width='10' height='12' rx='2'/><path d='M5 5h6M5 8h6M5 11h6' stroke='white' stroke-width='1.4' /></svg>";

  function fmtSize(bytes){
    if (bytes == null) return '-';
    const thresh = 1024;
    if (bytes < thresh) return bytes + ' B';
    const units = ['KB','MB','GB','TB'];
    let u = -1; do { bytes /= thresh; ++u; } while (bytes >= thresh && u < units.length-1);
    return bytes.toFixed(1) + ' ' + units[u];
  }

  function fmtTime(ms){
    try { return new Date(ms).toLocaleString(); } catch { return '-'; }
  }

  async function apiList(path){
    const url = `/api/files?path=${encodeURIComponent(path || '/')}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`列表失败: ${res.status}`);
    return res.json();
  }

  async function apiDownload(path){
    window.location.href = `/api/files/download?path=${encodeURIComponent(path)}`;
  }

  function apiBatchDownload(paths){
    const qs = paths.map(p => `paths=${encodeURIComponent(p)}`).join('&');
    const url = `/api/files/batch-download?${qs}`;
    // 直接跳转触发浏览器下载
    window.location.href = url;
  }

  async function apiUpload(path, file){
    const fd = new FormData();
    fd.append('path', path);
    fd.append('file', file);
    const res = await fetch('/api/files/upload', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`上传失败: ${res.status}`);
    return res.json();
  }

  async function apiMkdir(path, name){
    const fd = new URLSearchParams();
    fd.append('path', path);
    fd.append('name', name);
    const res = await fetch('/api/folders/create', { method: 'POST', body: fd, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!res.ok) throw new Error(`创建失败: ${res.status}`);
    return res.json();
  }

  async function apiRename(path, newName){
    const fd = new URLSearchParams();
    fd.append('path', path);
    fd.append('newName', newName);
    const res = await fetch('/api/files/rename', { method: 'POST', body: fd, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!res.ok) throw new Error(`重命名失败: ${res.status}`);
    return res.json();
  }

  async function apiMove(sourcePath, targetDir){
    const fd = new URLSearchParams();
    fd.append('sourcePath', sourcePath);
    fd.append('targetDir', targetDir);
    const res = await fetch('/api/files/move', { method: 'POST', body: fd, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!res.ok) throw new Error(`移动失败: ${res.status}`);
    return res.json();
  }

  async function apiDelete(path){
    const url = `/api/files?path=${encodeURIComponent(path)}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`删除失败: ${res.status}`);
    return res.json();
  }

  async function apiBatchDelete(paths){
    const fd = new URLSearchParams();
    for (const p of paths){ fd.append('paths', p); }
    const res = await fetch('/api/files/batch-delete', { method: 'POST', body: fd, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!res.ok) throw new Error(`批量删除失败: ${res.status}`);
    return res.json();
  }

  function renderList(items){
    tableBody.innerHTML = '';
    for (const it of items){
      const tr = document.createElement('tr');
      const selTd = document.createElement('td');
      const sel = document.createElement('input');
      sel.type = 'checkbox';
      sel.className = 'row-select';
      sel.dataset.path = it.path;
      sel.addEventListener('change', updateSelectAllState);
      selTd.appendChild(sel);
      tr.appendChild(selTd);
      const nameTd = document.createElement('td');
      nameTd.className = 'name';
      const a = document.createElement('a');
      a.textContent = it.name;
      if (it.directory){
        a.href = '#';
        a.onclick = (e) => {
          e.preventDefault();
          currentPath = (currentPath.endsWith('/') ? currentPath : currentPath + '/') + it.name;
          currentPathEl.textContent = currentPath;
          load();
        };
      } else {
        a.href = `/api/files/download?path=${encodeURIComponent(it.path)}`;
        a.target = '_blank';
        a.rel = 'noopener';
      }
      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.innerHTML = it.directory ? folderSVG : fileSVG;
      a.prepend(icon);
      nameTd.appendChild(a);
      tr.appendChild(nameTd);

      const typeTd = document.createElement('td');
      typeTd.textContent = it.directory ? '目录' : '文件';
      tr.appendChild(typeTd);

      const sizeTd = document.createElement('td');
      sizeTd.textContent = it.directory ? '-' : fmtSize(it.size);
      tr.appendChild(sizeTd);

      const timeTd = document.createElement('td');
      timeTd.textContent = fmtTime(it.lastModified);
      tr.appendChild(timeTd);

      const opsTd = document.createElement('td');
      const renameBtn = document.createElement('button');
      renameBtn.textContent = '重命名';
      renameBtn.onclick = async () => {
        const newName = await uiPrompt('输入新名称', it.name);
        if (!newName) return;
        try { await apiRename(it.path, newName); await load(); } catch(e){ await uiAlert(e.message); }
      };
      const moveBtn = document.createElement('button');
      moveBtn.textContent = '移动到';
      moveBtn.onclick = async () => {
        const targetDir = await uiPrompt('输入目标目录（绝对路径，如 /folder）', '/');
        if (!targetDir) return;
        try { await apiMove(it.path, targetDir); await load(); } catch(e){ await uiAlert(e.message); }
      };
      const delBtn = document.createElement('button');
      delBtn.textContent = '删除';
      delBtn.onclick = async () => {
        const tip = it.directory ? `确认删除目录及其所有内容：${it.name} ？` : `确认删除文件 ${it.name} ？`;
        const ok = await uiConfirm(tip);
        if (!ok) return;
        try { await apiDelete(it.path); await load(); } catch(e){ await uiAlert(e.message); }
      };
      if (it.directory){
        const dlBtn = document.createElement('button');
        dlBtn.textContent = '下载';
        dlBtn.onclick = () => { apiBatchDownload([it.path]); };
        opsTd.append(renameBtn, moveBtn, delBtn, dlBtn);
      } else {
        opsTd.append(renameBtn, moveBtn, delBtn);
      }
      tr.appendChild(opsTd);

      tableBody.appendChild(tr);
    }
  }

  async function load(){
    try {
      const items = await apiList(currentPath);
      renderList(items);
    } catch(e){
      await uiAlert(e.message);
    }
  }

  upBtn.onclick = () => {
    if (currentPath === '/' ) return;
    const parts = currentPath.replace(/\/+/g,'/').split('/').filter(Boolean);
    parts.pop();
    currentPath = '/' + parts.join('/');
    if (currentPath === '') currentPath = '/';
    currentPathEl.textContent = currentPath;
    load();
  };
  refreshBtn.onclick = () => load();
  uploadBtn.onclick = () => {
    // 触发文件选择
    uploadHidden.click();
  };

  function makeProgressItem(name){
    const row = document.createElement('div');
    row.className = 'progress-item';
    const nameEl = document.createElement('div');
    nameEl.className = 'progress-name';
    nameEl.textContent = name;
    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    const barInner = document.createElement('div');
    barInner.className = 'progress-bar-inner';
    bar.appendChild(barInner);
    const status = document.createElement('div');
    status.className = 'progress-status';
    status.textContent = '待上传';
    row.append(nameEl, bar, status);
    progressList.appendChild(row);
    return {
      setPercent(p){ barInner.style.width = Math.max(0, Math.min(100, p)) + '%'; },
      setStatus(t){ status.textContent = t; },
      remove(){ row.remove(); }
    };
  }

  function xhrUpload(path, file, progress){
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/files/upload', true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable){
          const percent = (e.loaded / e.total) * 100;
          progress.setPercent(percent);
          progress.setStatus(percent.toFixed(0) + '%');
        } else {
          progress.setStatus('正在上传...');
        }
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4){
          if (xhr.status >= 200 && xhr.status < 300){
            progress.setPercent(100);
            progress.setStatus('完成');
            // 5秒后移除进度项
            setTimeout(() => { try { progress.remove(); } catch(_){} }, 5000);
            try { resolve(JSON.parse(xhr.responseText)); }
            catch { resolve({ ok: true }); }
          } else {
            progress.setStatus(xhr.status === 0 ? '被浏览器阻止' : '失败');
            setTimeout(() => { try { progress.remove(); } catch(_){} }, 5000);
            reject(new Error('上传失败: ' + xhr.status));
          }
        }
      };

      xhr.onerror = () => { 
        progress.setStatus('失败'); 
        setTimeout(() => { try { progress.remove(); } catch(_){} }, 5000);
        reject(new Error('网络错误')); 
      };

      const fd = new FormData();
      fd.append('path', path);
      // 传递相对路径，后端按层级创建目录
      const rel = (file.webkitRelativePath && file.webkitRelativePath.length > 0)
        ? file.webkitRelativePath
        : (file._relativePath || file.name);
      fd.append('relativePath', rel);
      fd.append('file', file);
      xhr.send(fd);
    });
  }

  async function uploadFilesSequential(files){
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++){
      const file = files[i];
      const p = makeProgressItem(file.name);
      try {
        await xhrUpload(currentPath, file, p);
      } catch(e){
        console.error(e);
      }
    }
    await load();
  }

  function dedupeFiles(arr){
    const set = new Set();
    const out = [];
    for (const f of arr){
      if (!f) continue;
      const rel = (f.webkitRelativePath && f.webkitRelativePath.length > 0)
        ? f.webkitRelativePath
        : (f._relativePath || f.name);
      const key = [rel, f.name, f.size, f.type, f.lastModified].join('|');
      if (!set.has(key)) { set.add(key); out.push(f); }
    }
    return out;
  }

  function collectClipboardFiles(clipboardData){
    const files = [];
    try {
      if (clipboardData && clipboardData.items) {
        for (const item of clipboardData.items) {
          // 仅接受具备明确 MIME 类型的文件，过滤目录或不可识别项
          if (item.kind === 'file' && item.type && item.type.length > 0) {
            const f = item.getAsFile();
            if (f && typeof f.name === 'string' && typeof f.size === 'number') {
              files.push(f);
            }
          }
        }
      }
      if (clipboardData && clipboardData.files && clipboardData.files.length > 0) {
        for (const f of clipboardData.files) {
          if (f && f.type && f.type.length > 0) { files.push(f); }
        }
      }
    } catch(_){}
    return dedupeFiles(files);
  }

  uploadHidden.onchange = async () => {
    const files = uploadHidden.files;
    if (!files || files.length === 0) return;
    try {
      // 逐个上传，展示每个文件进度
      await uploadFilesSequential(files);
    } finally {
      uploadHidden.value = '';
    }
  };

  // 支持粘贴上传：当剪贴板中存在文件时，自动上传
  document.addEventListener('paste', async (e) => {
    try {
      const files = collectClipboardFiles(e.clipboardData);
      if (files.length > 0) {
        e.preventDefault();
        await uploadFilesSequential(files);
      } else {
        // 说明剪贴板未提供文件对象或浏览器限制
        // 目前浏览器不支持通过粘贴读取本地目录，请使用拖拽或文件选择
        await uiAlert('剪贴板未提供可上传的文件。浏览器不支持粘贴本地目录，请使用拖拽或“上传文件”。');
      }
    } catch(err){
      console.error('粘贴上传失败', err);
    }
  });

  // 拖拽上传：拖动文件到页面进行上传
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    try {
      const files = [];

      // 支持目录拖拽：使用 webkitGetAsEntry 递归遍历
      if (e.dataTransfer && e.dataTransfer.items) {
        // 先收集顶层 entries，避免在迭代中状态被改变导致漏读
        const entries = [];
        for (const item of e.dataTransfer.items) {
          if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
            if (entry) entries.push(entry);
            else {
              const f = item.getAsFile();
              if (f) files.push(f);
            }
          }
        }

        const traverseEntry = async (entry, prefix) => {
          prefix = prefix || '';
          if (entry.isFile) {
            await new Promise((resolve, reject) => {
              entry.file((f) => {
                try {
                  f._relativePath = (prefix ? prefix + '/' : '') + f.name;
                  files.push(f);
                  resolve();
                } catch(err){ reject(err); }
              }, reject);
            });
          } else if (entry.isDirectory) {
            await new Promise((resolve, reject) => {
              const reader = entry.createReader();
              const batch = () => {
                reader.readEntries(async (entries) => {
                  if (!entries || entries.length === 0) return resolve();
                  for (const ent of entries) {
                    await traverseEntry(ent, (prefix ? prefix + '/' : '') + entry.name);
                  }
                  batch();
                }, reject);
              };
              batch();
            });
          }
        };
        // 并行遍历多个顶层目录，避免只处理第一个
        for (const entry of entries) {
          await traverseEntry(entry, '');
        }
      }

      // 退化方案：直接读取 files 列表（可能带有 webkitRelativePath）
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        for (const f of e.dataTransfer.files) { files.push(f); }
      }
      const unique = dedupeFiles(files);
      if (unique.length > 0){
        await uploadFilesSequential(unique);
      }
    } catch(err){
      console.error('拖拽上传失败', err);
    }
  });
  mkdirBtn.onclick = async () => {
    const name = await uiPrompt('输入文件夹名称');
    if (!name) return;
    try { await apiMkdir(currentPath, name); await load(); } catch(e){ await uiAlert(e.message); }
  };

  function getSelectedPaths(){
    const sels = tableBody.querySelectorAll('.row-select:checked');
    return Array.from(sels).map(el => el.dataset.path);
  }

  batchDeleteBtn.onclick = async () => {
    const paths = getSelectedPaths();
    if (paths.length === 0){ await uiAlert('请先勾选要删除的项目'); return; }
    const ok = await uiConfirm(`确认删除选中的 ${paths.length} 个项目？目录将递归删除其所有内容。`);
    if (!ok) return;
    try {
      const results = await apiBatchDelete(paths);
      const failed = results.filter(r => !r.deleted);
      if (failed.length > 0){
        const msg = '部分项目删除失败:\n' + failed.slice(0,5).map(r => `- ${r.path} (${r.error || '失败'})`).join('\n') + (failed.length > 5 ? `\n... 共 ${failed.length} 项失败` : '');
        await uiAlert(msg);
      } else {
        await uiAlert('已删除选中的所有项目');
      }
      await load();
    } catch(e){
      await uiAlert(e.message);
    }
  };

  batchDownloadBtn.onclick = async () => {
    const paths = getSelectedPaths();
    if (paths.length === 0){ await uiAlert('请先勾选要下载的项目'); return; }
    apiBatchDownload(paths);
  };

  // 初始加载
  currentPathEl.textContent = currentPath;
  load();
  // 渲染后同步“全选”状态
  const origRenderList = renderList;
  const renderListRef = renderList;
  renderList = function(items){
    renderListRef(items);
    updateSelectAllState();
  };
})();