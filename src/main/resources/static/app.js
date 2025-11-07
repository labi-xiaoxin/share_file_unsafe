(() => {
  // 项目标识日志（在控制台可见）
  try { console.log('--本项目由@labi-xiaoxin搭建开发'); } catch(_){}
  const currentPathEl = document.getElementById('currentPath');
  const tableBody = document.getElementById('fileTableBody');
  const upBtn = document.getElementById('upBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const uploadHidden = document.getElementById('uploadHidden');
  const uploadBtn = document.getElementById('uploadBtn');
  const progressList = document.getElementById('uploadProgress');
  const mkdirBtn = document.getElementById('mkdirBtn');
  const batchDeleteBtn = document.getElementById('batchDeleteBtn');

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
        const newName = prompt('输入新名称', it.name);
        if (!newName) return;
        try { await apiRename(it.path, newName); await load(); } catch(e){ alert(e.message); }
      };
      const moveBtn = document.createElement('button');
      moveBtn.textContent = '移动到';
      moveBtn.onclick = async () => {
        const targetDir = prompt('输入目标目录（绝对路径，如 /folder）', '/');
        if (!targetDir) return;
        try { await apiMove(it.path, targetDir); await load(); } catch(e){ alert(e.message); }
      };
      const delBtn = document.createElement('button');
      delBtn.textContent = '删除';
      delBtn.onclick = async () => {
        const tip = it.directory ? `确认删除目录及其所有内容：${it.name} ？` : `确认删除文件 ${it.name} ？`;
        if (!confirm(tip)) return;
        try { await apiDelete(it.path); await load(); } catch(e){ alert(e.message); }
      };
      opsTd.append(renameBtn, moveBtn, delBtn);
      tr.appendChild(opsTd);

      tableBody.appendChild(tr);
    }
  }

  async function load(){
    try {
      const items = await apiList(currentPath);
      renderList(items);
    } catch(e){
      alert(e.message);
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
            progress.setStatus('失败');
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
      const key = [f.name, f.size, f.type, f.lastModified].join('|');
      if (!set.has(key)) { set.add(key); out.push(f); }
    }
    return out;
  }

  function collectClipboardFiles(clipboardData){
    const files = [];
    try {
      if (clipboardData && clipboardData.items) {
        for (const item of clipboardData.items) {
          if (item.kind === 'file') {
            const f = item.getAsFile();
            if (f) files.push(f);
          }
        }
      }
      if (clipboardData && clipboardData.files && clipboardData.files.length > 0) {
        for (const f of clipboardData.files) { files.push(f); }
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
      if (e.dataTransfer && e.dataTransfer.items) {
        for (const item of e.dataTransfer.items){
          if (item.kind === 'file'){
            const f = item.getAsFile();
            if (f) files.push(f);
          }
        }
      }
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
    const name = prompt('输入文件夹名称');
    if (!name) return;
    try { await apiMkdir(currentPath, name); await load(); } catch(e){ alert(e.message); }
  };

  function getSelectedPaths(){
    const sels = tableBody.querySelectorAll('.row-select:checked');
    return Array.from(sels).map(el => el.dataset.path);
  }

  batchDeleteBtn.onclick = async () => {
    const paths = getSelectedPaths();
    if (paths.length === 0){ alert('请先勾选要删除的项目'); return; }
    if (!confirm(`确认删除选中的 ${paths.length} 个项目？目录将递归删除其所有内容。`)) return;
    try {
      const results = await apiBatchDelete(paths);
      const failed = results.filter(r => !r.deleted);
      if (failed.length > 0){
        const msg = '部分项目删除失败:\n' + failed.slice(0,5).map(r => `- ${r.path} (${r.error || '失败'})`).join('\n') + (failed.length > 5 ? `\n... 共 ${failed.length} 项失败` : '');
        alert(msg);
      } else {
        alert('已删除选中的所有项目');
      }
      await load();
    } catch(e){
      alert(e.message);
    }
  };

  // 初始加载
  currentPathEl.textContent = currentPath;
  load();
})();