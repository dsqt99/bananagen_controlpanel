import { supabase, TABLE_NAME } from './supabase.js';

// ===== State =====
const state = {
  imageName: '',
  modelId: 'gemini-3.1-flash-image-preview',
  latestImageNameCheckToken: 0,
  isImageNameDuplicate: false,
  steps: [
    {
      id: 1, state_key: 'run_1', label: 'Step 1 - Khởi tạo', type: 'required',
      input_url: '', prompt: '', ref_url: '', output_url: '', aspect_ratio: 'auto',
      input_required: true, prompt_required: true, ref_required: false,
      status: 'idle', expanded: true,
    },
    {
      id: 2, state_key: 'run_2', label: 'Step 2 - Biến đổi', type: 'optional',
      input_url: '', prompt: '', ref_url: '', output_url: '', aspect_ratio: 'auto',
      input_required: false, prompt_required: false, ref_required: false,
      autoInput: true, status: 'idle', expanded: false,
    },
    {
      id: 3, state_key: 'run_3', label: 'Step 3 - Tinh chỉnh', type: 'optional',
      input_url: '', prompt: '', ref_url: '', output_url: '', aspect_ratio: 'auto',
      input_required: false, prompt_required: false, ref_required: false,
      autoInput: true, status: 'idle', expanded: false,
    },
    {
      id: 4, state_key: 'run_4', label: 'Step 4 - Nâng cấp', type: 'optional',
      input_url: '', prompt: '', ref_url: '', output_url: '', aspect_ratio: 'auto',
      input_required: false, prompt_required: false, ref_required: false,
      autoInput: true, status: 'idle', expanded: false,
    },
    {
      id: 5, state_key: 'run_5', label: 'Step 5 - Hoàn thiện', type: 'optional',
      input_url: '', prompt: '', ref_url: '', output_url: '', aspect_ratio: 'auto',
      input_required: false, prompt_required: false, ref_required: false,
      autoInput: true, status: 'idle', expanded: false,
    },
    {
      id: 6, state_key: 'run_6', label: 'Step 6 - Tùy chỉnh', type: 'optional',
      input_url: '', prompt: '', ref_url: '', output_url: '', aspect_ratio: 'auto',
      prompts6: { a: '', b: '', c: '', d: '', e: '', f: '', g: '' },
      outputs6: { a: '', b: '', c: '', d: '', e: '', f: '', g: '' },
      input_required: false, prompt_required: false, ref_required: false,
      autoInput: true, status: 'idle', expanded: false,
    },
  ],
  supabaseData: [],
};

// ===== Toast =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };

  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-removing');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ===== Get effective input URL for a step (auto-fill from previous output) =====
function getEffectiveInputUrl(stepIndex) {
  const step = state.steps[stepIndex];

  // Step 6 always uses the latest output from steps 1-5
  if (stepIndex === 5) {
    for (let i = 4; i >= 0; i--) {
      if (state.steps[i].output_url) return state.steps[i].output_url;
    }
    return '';
  }

  if (step.input_url) return step.input_url;
  if (step.autoInput && stepIndex > 0) {
    // Walk backwards to find the last step with an output
    for (let i = stepIndex - 1; i >= 0; i--) {
      if (state.steps[i].output_url) return state.steps[i].output_url;
    }
  }
  return '';
}

// ===== Check if run button should be enabled =====
function canRun(stepIndex) {
  const step = state.steps[stepIndex];

  // Step 1: requires input_url and prompt
  if (stepIndex === 0) {
    return !!(step.input_url.trim() && step.prompt.trim());
  }

  // Step 6: requires input_url (at least one prompt 6A-6G will be sent, even if empty)
  if (stepIndex === 5) {
    const inputUrl = getEffectiveInputUrl(stepIndex);
    return !!inputUrl;
  }

  // Steps 2-5: require prompt to run
  return !!step.prompt.trim();
}

// ===== Render Steps =====
function renderSteps() {
  const container = document.getElementById('pipeline-steps');
  container.innerHTML = state.steps.map((step, idx) => renderStep(step, idx)).join('');
  bindStepEvents();
  updateProgress();
}

function renderStep(step, idx) {
  const isExpanded = step.expanded ? 'expanded' : '';
  const statusClass = step.status === 'success' ? 'completed' : step.status === 'running' ? 'running' : '';
  const effectiveInput = getEffectiveInputUrl(idx);
  const hasOutput = step.output_url;
  const isRunEnabled = canRun(idx) && step.status !== 'running';

  const autoFillHtml = step.autoInput && !step.input_url && idx > 0
    ? `<div class="auto-fill-indicator">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
        Tự động lấy từ output step trước
      </div>`
    : '';

  const statusText = step.status === 'running' ? 'Đang xử lý...'
    : step.status === 'success' ? 'Hoàn thành ✓'
      : step.status === 'error' ? 'Lỗi ✗'
        : '';

  const statusTextClass = step.status === 'running' ? 'running'
    : step.status === 'success' ? 'success'
      : step.status === 'error' ? 'error'
        : '';

  const displayInputValue = step.input_url || effectiveInput || '';

  const step6PromptFieldsHtml = idx === 5
    ? ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(key => `
      <div class="step-field">
        <label class="field-label">Prompt 6${key.toUpperCase()}</label>
        <textarea class="field-textarea step6-prompt"
          data-step="${idx}"
          data-key="${key}"
          placeholder="Nhập prompt 6${key.toUpperCase()}..."
          rows="2">${step.prompts6?.[key] || ''}</textarea>
      </div>
    `).join('')
    : '';

  // Build output URL display next to status text
  const outputUrlHtml = hasOutput
    ? idx === 5
      ? `<div class="output-url-wrapper">
          <span class="output-url-label">Link ảnh đầu ra step 6:</span>
          <div class="output-urls-list">
            ${['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(key => {
              const url = step.outputs6?.[key];
              return url ? `<a href="${url}" target="_blank" class="output-url-link output-url-6${key}" title="${url}">6${key.toUpperCase()}</a>` : '';
            }).filter(Boolean).join('')}
          </div>
        </div>`
      : `<div class="output-url-wrapper">
          <span class="output-url-label">Link ảnh đầu ra step ${step.id}:</span>
          <a href="${step.output_url}" target="_blank" class="output-url-link" title="${step.output_url}">${step.output_url.substring(0, 60)}${step.output_url.length > 60 ? '...' : ''}</a>
        </div>`
    : '';

  const runBtnText = idx === 5 ? 'Kích hoạt 6A-6G' : 'Kích hoạt';
  const runBtnClass = idx === 5 ? 'step-run-all6-btn' : 'step-run-btn';

  return `
    <div class="step-card ${isExpanded} ${statusClass}" data-step="${idx}">
      <div class="step-header" data-toggle="${idx}">
        <div class="step-number">${step.status === 'success' ? '✓' : step.id}</div>
        <span class="step-title">${step.label}</span>
        <span class="step-badge ${step.type}">${step.type === 'required' ? 'Bắt buộc' : 'Tùy chọn'}</span>
        <span class="step-toggle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </div>
      <div class="step-body">
        <div class="step-content">
          <div class="step-field">
            <label class="field-label">
              Ảnh đầu vào ${step.input_required ? '<span class="field-required">*</span>' : ''}
            </label>
            ${step.autoInput && idx > 0 ? `
            <div class="auto-fill-indicator">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
              Input: tự động lấy từ output step trước (có thể sửa)
            </div>
            ` : ''}
            <div class="input-with-preview">
              <input type="text" class="field-input step-input-url"
                data-step="${idx}"
                placeholder="Nhập URL ảnh đầu vào..."
                value="${displayInputValue}" />
            </div>
          </div>
          ${idx === 5 ? `
            ${step6PromptFieldsHtml}
          ` : `
          <div class="step-field">
            <label class="field-label">
              Prompt ${step.prompt_required ? '<span class="field-required">*</span>' : ''}
            </label>
            <textarea class="field-textarea step-prompt"
              data-step="${idx}"
              placeholder="Nhập prompt mô tả..."
              rows="3">${step.prompt}</textarea>
          </div>
          `}
          ${idx !== 5 ? `
          <div class="step-field">
            <label class="field-label">Ảnh tham chiếu</label>
            <div class="input-with-preview">
              <input type="text" class="field-input step-ref-url"
                data-step="${idx}"
                placeholder="Nhập URL ảnh tham chiếu (optional)..."
                value="${step.ref_url}" />
            </div>
          </div>
          ` : ''}
          <div class="step-field">
            <label class="field-label">Kích thước ảnh output</label>
            <select class="field-select step-aspect-ratio" data-step="${idx}">
              <option value="auto" ${step.aspect_ratio === 'auto' ? 'selected' : ''}>Auto</option>
              <option value="1:1" ${step.aspect_ratio === '1:1' ? 'selected' : ''}>1:1</option>
              <option value="9:16" ${step.aspect_ratio === '9:16' ? 'selected' : ''}>9:16</option>
              <option value="16:9" ${step.aspect_ratio === '16:9' ? 'selected' : ''}>16:9</option>
              <option value="3:4" ${step.aspect_ratio === '3:4' ? 'selected' : ''}>3:4</option>
              <option value="4:3" ${step.aspect_ratio === '4:3' ? 'selected' : ''}>4:3</option>
              <option value="3:2" ${step.aspect_ratio === '3:2' ? 'selected' : ''}>3:2</option>
              <option value="2:3" ${step.aspect_ratio === '2:3' ? 'selected' : ''}>2:3</option>
              <option value="5:4" ${step.aspect_ratio === '5:4' ? 'selected' : ''}>5:4</option>
              <option value="4:5" ${step.aspect_ratio === '4:5' ? 'selected' : ''}>4:5</option>
              <option value="21:9" ${step.aspect_ratio === '21:9' ? 'selected' : ''}>21:9</option>
            </select>
          </div>
        </div>
        <div class="step-actions">
          ${outputUrlHtml}
          <span class="step-status-text ${statusTextClass}">${statusText}</span>
          <button class="btn btn-run ${runBtnClass} ${step.status === 'running' ? 'loading' : ''}"
            data-step="${idx}"
            ${!isRunEnabled ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            ${runBtnText}
          </button>
        </div>
      </div>
    </div>
  `;
}

function bindStepEvents() {
  // Toggle expand
  document.querySelectorAll('[data-toggle]').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.toggle);
      state.steps[idx].expanded = !state.steps[idx].expanded;
      renderSteps();
    });
  });

  // Input URL
  document.querySelectorAll('.step-input-url').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.step);
      state.steps[idx].input_url = e.target.value;
      updateRunButtons();
    });
  });

  // Prompt
  document.querySelectorAll('.step-prompt').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.step);
      state.steps[idx].prompt = e.target.value;
      updateRunButtons();
    });
  });

  // Step 6 prompts (6A-6G)
  document.querySelectorAll('.step6-prompt').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.step);
      const key = e.target.dataset.key;
      state.steps[idx].prompts6[key] = e.target.value;
      updateRunButtons();
    });
  });

  // Ref URL
  document.querySelectorAll('.step-ref-url').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.step);
      state.steps[idx].ref_url = e.target.value;
    });
  });

  // Aspect ratio
  document.querySelectorAll('.step-aspect-ratio').forEach(el => {
    el.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.step);
      state.steps[idx].aspect_ratio = e.target.value;
    });
  });

  // Run buttons
  document.querySelectorAll('.step-run-btn, .step-run-all6-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.step);
      runStep(idx);
    });
  });
}

function updateRunButtons() {
  document.querySelectorAll('.step-run-btn, .step-run-all6-btn').forEach(el => {
    const idx = parseInt(el.dataset.step);
    const step = state.steps[idx];
    el.disabled = !canRun(idx) || step.status === 'running';
  });
}

function updateProgress() {
  const completed = state.steps.filter(s => s.status === 'success').length;
  const total = state.steps.length;
  const pct = Math.round((completed / total) * 100);
  document.getElementById('progress-fill').style.width = `${pct}%`;
  document.getElementById('progress-text').textContent = `${completed}/${total} hoàn thành`;
}

function setImageNameStatus(text = '', status = '') {
  const statusEl = document.getElementById('image-name-status');
  if (!statusEl) return;

  statusEl.textContent = text;
  statusEl.className = `field-status${status ? ` ${status}` : ''}`;
}

async function checkImageNameDuplicate(name) {
  if (!name) {
    state.isImageNameDuplicate = false;
    setImageNameStatus('');
    return false;
  }

  const checkToken = ++state.latestImageNameCheckToken;
  setImageNameStatus('Đang kiểm tra tên ảnh...', 'checking');

  try {
    const { data: existing, error } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('image_name', name)
      .eq('status', 'DONE')
      .limit(1);

    if (checkToken !== state.latestImageNameCheckToken) return false;
    if (error) throw error;

    const isDuplicate = !!(existing && existing.length > 0);
    state.isImageNameDuplicate = isDuplicate;

    if (isDuplicate) {
      setImageNameStatus('Tên ảnh đã tồn tại trong hệ thống.', 'duplicate');
      return true;
    }

    setImageNameStatus('Tên ảnh hợp lệ, có thể sử dụng.', 'ok');
    return false;
  } catch (e) {
    if (checkToken !== state.latestImageNameCheckToken) return false;
    console.error('Duplicate check error:', e);
    state.isImageNameDuplicate = false;
    setImageNameStatus('Không thể kiểm tra trùng tên. Vui lòng thử lại.', 'error');
    return false;
  }
}

// ===== Run Step =====
async function runStep(idx) {
  const step = state.steps[idx];
  const imageName = document.getElementById('image-name').value.trim();
  const modelId = document.getElementById('model-select').value;

  if (!imageName) {
    showToast('Vui lòng nhập Tên Ảnh trước khi chạy', 'error');
    return;
  }

  // Check duplicate name in Supabase (only for step 1)
  if (idx === 0) {
    const isDuplicate = await checkImageNameDuplicate(imageName);
    if (isDuplicate) {
      showToast(`Tên ảnh "${imageName}" đã tồn tại trong hệ thống. Vui lòng đổi tên khác.`, 'error');
      return;
    }
  }

  const inputUrl = step.input_url || getEffectiveInputUrl(idx);
  if (!inputUrl) {
    showToast(`Step ${step.id}: Thiếu ảnh đầu vào`, 'error');
    return;
  }

  step.status = 'running';
  renderSteps();

  try {
    const n8n_domain = import.meta.env.VITE_N8N_DOMAIN;
    const gemini_api_key = import.meta.env.VITE_GEMINI_API_KEY;

    // Step 6: run all prompts 6A-6G sequentially
    if (idx === 5) {
      const step6Keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
      let completedCount = 0;

      for (const key of step6Keys) {
        const prompt = (step.prompts6?.[key] || '').trim();

        showToast(`Step 6${key.toUpperCase()}: Đang gửi yêu cầu...`, 'info');

        const body = {
          state: `${step.state_key}${key}`,
          template_model_url: inputUrl,
          prompt: prompt || '',
          ref_image_url: '',
          image_name: imageName,
          model_id: modelId,
          aspect_ratio: step.aspect_ratio || 'auto',
        };

        const response = await fetch(`${n8n_domain}/webhook/bananagen`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'gemini_api_key': `${gemini_api_key}`
          },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
          const apiMsg = data.message || data.error || data.msg || `HTTP ${response.status}`;
          throw new Error(`Step 6${key.toUpperCase()}: ${apiMsg}`);
        }

        const outputUrl = data.output_url || data.result_url || data.image_url || data.url || '';
        step.outputs6[key] = outputUrl;
        step.output_url = outputUrl;
        completedCount += 1;

        await saveToSupabase(idx);
      }

      step.status = 'success';
      showToast(`Step 6: Hoàn thành ${completedCount} prompt (6A-6G)!`, 'success');
      renderSteps();
      return;
    }

    showToast(`Step ${step.id}: Đang gửi yêu cầu...`, 'info');

    const body = {
      state: step.state_key,
      template_model_url: inputUrl,
      prompt: step.prompt,
      ref_image_url: step.ref_url || '',
      image_name: imageName,
      model_id: modelId,
      aspect_ratio: step.aspect_ratio || 'auto',
    };

    const response = await fetch(`${n8n_domain}/webhook/bananagen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'gemini_api_key': `${gemini_api_key}`
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      // Show API's own error message
      const apiMsg = data.message || data.error || data.msg || `HTTP ${response.status}`;
      throw new Error(apiMsg);
    }

    // Try to get output URL from response
    const outputUrl = data.output_url || data.result_url || data.image_url || data.url || '';

    step.output_url = outputUrl;
    step.status = 'success';
    showToast(`Step ${step.id}: Hoàn thành!`, 'success');

    // Save to Supabase
    await saveToSupabase(idx);

  } catch (error) {
    console.error('Run step error:', error);
    step.status = 'error';
    showToast(`Step ${step.id}: ${error.message}`, 'error');
  }

  renderSteps();
}

// ===== Save to Supabase =====
async function saveToSupabase(stepIdx) {
  const imageName = document.getElementById('image-name').value.trim();
  const step = state.steps[stepIdx];

  // Build column mapping based on step index
  const colMap = {};
  colMap['image_name'] = imageName;
  colMap['status'] = 'Running';

  // Step-specific columns matching the CSV schema
  if (stepIdx === 0) {
    colMap['input_url'] = step.input_url;
    colMap['ref_url_1'] = step.ref_url;
    colMap['Prompt 1'] = step.prompt;
    colMap['output_1'] = step.output_url;
  } else if (stepIdx >= 1 && stepIdx <= 4) {
    const n = stepIdx + 1;
    colMap[`Prompt ${n}`] = step.prompt;
    colMap[`ref_url_${n}`] = step.ref_url;
    colMap[`output_${n}`] = step.output_url;
  } else if (stepIdx === 5) {
    colMap['prompt_6A'] = step.prompts6?.a || '';
    colMap['output_6a'] = step.outputs6?.a || '';
    colMap['prompt_6B'] = step.prompts6?.b || '';
    colMap['output_6b'] = step.outputs6?.b || '';
    colMap['prompt_6C'] = step.prompts6?.c || '';
    colMap['output_6c'] = step.outputs6?.c || '';
    colMap['prompt_6D'] = step.prompts6?.d || '';
    colMap['output_6d'] = step.outputs6?.d || '';
    colMap['prompt_6E'] = step.prompts6?.e || '';
    colMap['output_6e'] = step.outputs6?.e || '';
    colMap['prompt_6F'] = step.prompts6?.f || '';
    colMap['output_6f'] = step.outputs6?.f || '';
    colMap['prompt_6G'] = step.prompts6?.g || '';
    colMap['output_6g'] = step.outputs6?.g || '';
  }

  try {
    // Check if row already exists
    const { data: existing } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('image_name', imageName)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from(TABLE_NAME)
        .update(colMap)
        .eq('image_name', imageName);
    } else {
      await supabase
        .from(TABLE_NAME)
        .insert([colMap]);
    }
  } catch (e) {
    console.error('Supabase save error:', e);
    showToast('Không thể lưu vào Supabase', 'error');
  }
}

// ===== Load data from Supabase =====
async function loadSupabaseData() {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .limit(50);

    if (error) throw error;

    state.supabaseData = data || [];
    renderDataTable();

    // Update connection status
    const statusEl = document.getElementById('connection-status');
    statusEl.querySelector('.status-dot').classList.add('connected');
    statusEl.querySelector('.status-text').textContent = 'Connected';
  } catch (e) {
    console.error('Load data error:', e);
    const statusEl = document.getElementById('connection-status');
    statusEl.querySelector('.status-dot').classList.add('error');
    statusEl.querySelector('.status-dot').classList.remove('connected');
    statusEl.querySelector('.status-text').textContent = 'Error';

    document.getElementById('data-table-wrapper').innerHTML =
      `<p class="empty-state">Không thể kết nối Supabase: ${e.message}</p>`;
  }
}

function fillPipelineFromDataRow(row) {
  if (!row) return;

  const getVal = (...keys) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) return row[key];
    }
    return '';
  };

  const imageNameInput = document.getElementById('image-name');
  const imageName = getVal('image_name');
  imageNameInput.value = imageName;
  state.imageName = imageName;
  state.latestImageNameCheckToken += 1;
  state.isImageNameDuplicate = false;
  setImageNameStatus('');

  // Step 1
  state.steps[0].input_url = getVal('input_url');
  state.steps[0].prompt = getVal('prompt_1', 'Prompt 1');
  state.steps[0].ref_url = getVal('ref_url_1');
  state.steps[0].output_url = getVal('output_1');

  // Steps 2-5
  for (let i = 1; i <= 4; i++) {
    const n = i + 1;
    state.steps[i].prompt = getVal(`prompt_${n}`, `Prompt ${n}`);
    state.steps[i].ref_url = getVal(`ref_url_${n}`);
    state.steps[i].output_url = getVal(`output_${n}`);
  }

  // Step 6 prompts/outputs
  const keys6 = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  keys6.forEach((key) => {
    const upper = key.toUpperCase();
    state.steps[5].prompts6[key] = getVal(`prompt_6${upper}`, `Prompt 6${upper}`);
    state.steps[5].outputs6[key] = getVal(`output_6${key}`);
  });
  state.steps[5].output_url = state.steps[5].outputs6.g || state.steps[5].outputs6.f || state.steps[5].outputs6.e || state.steps[5].outputs6.d || state.steps[5].outputs6.c || state.steps[5].outputs6.b || state.steps[5].outputs6.a || '';

  renderSteps();
  showToast(`Đã nạp dữ liệu cho ảnh "${imageName}"`, 'success');
}

function renderDataTable() {
  const wrapper = document.getElementById('data-table-wrapper');
  const data = state.supabaseData;

  if (!data.length) {
    wrapper.innerHTML = '<p class="empty-state">Chưa có dữ liệu</p>';
    return;
  }

  // Get all columns from first row
  const columns = Object.keys(data[0]).filter(k => k !== 'id' && k !== 'created_at');
  const csvColumnOrder = [
    'status',
    'image_name',
    'input_url',
    'ref_url_1',
    'prompt_1',
    'output_1',
    'prompt_2',
    'ref_url_2',
    'output_2',
    'prompt_3',
    'ref_url_3',
    'output_3',
    'prompt_4',
    'ref_url_4',
    'output_4',
    'prompt_5',
    'ref_url_5',
    'output_5',
    'prompt_6A',
    'output_6a',
    'prompt_6B',
    'output_6b',
    'prompt_6C',
    'output_6c',
    'prompt_6D',
    'output_6d',
    'prompt_6E',
    'output_6e',
    'prompt_6F',
    'output_6f',
    'prompt_6G',
    'output_6g',
  ];

  const getStepForColumn = (col) => {
    if (col === 'status' || col === 'image_name') return 0;
    if (col === 'input_url' || col === 'ref_url_1' || col === 'prompt_1' || col === 'output_1') return 1;
    if (col === 'prompt_2' || col === 'ref_url_2' || col === 'output_2') return 2;
    if (col === 'prompt_3' || col === 'ref_url_3' || col === 'output_3') return 3;
    if (col === 'prompt_4' || col === 'ref_url_4' || col === 'output_4') return 4;
    if (col === 'prompt_5' || col === 'ref_url_5' || col === 'output_5') return 5;
    if (col.startsWith('prompt_6') || col.startsWith('output_6')) return 6;
    return 0;
  };

  const isOutputColumn = (col) => col.startsWith('output_');

  const showCols = csvColumnOrder.filter(c => columns.includes(c));
  // Add remaining columns not in CSV order
  columns.forEach(c => {
    if (!showCols.includes(c)) showCols.push(c);
  });

  const truncate = (val) => {
    if (!val) return '';
    return String(val);
  };

  const isUrl = (val) => val && typeof val === 'string' && (val.startsWith('http') || val.startsWith('//'));

  let html = `<table class="data-table">
    <thead><tr>${showCols.map(c => {
    const stepNum = getStepForColumn(c);
    const isOutput = isOutputColumn(c) ? ' output-col' : '';
    return `<th class="step-${stepNum}-col${isOutput}">${c}</th>`;
  }).join('')}<th class="action-col">Thao tác</th></tr></thead>
    <tbody>`;

  data.forEach((row, rowIdx) => {
    const rowId = row.id;
    html += `<tr class="data-row" data-row-index="${rowIdx}">`;
    showCols.forEach(col => {
      const val = row[col];
      const stepNum = getStepForColumn(col);
      const stepClass = `step-${stepNum}-col`;
      const isOutput = isOutputColumn(col) ? ' output-col' : '';
      const dataCol = `data-col="${col}"`;

      if (col === 'status') {
        const cls = val === 'Done' ? 'status-done' : val === 'Running' ? 'status-running' : '';
        html += `<td class="status-cell ${cls} ${stepClass}${isOutput}" ${dataCol}>${val || ''}</td>`;
      } else if (isUrl(val)) {
        html += `<td class="url-cell ${stepClass}${isOutput}" title="${val}" ${dataCol}><a href="${val}" target="_blank" style="color:inherit;text-decoration:inherit;">${truncate(val)}</a></td>`;
      } else {
        html += `<td class="${stepClass}${isOutput}" title="${(val || '').toString().replace(/"/g, '&quot;')}" ${dataCol}>${truncate(val)}</td>`;
      }
    });
    // Delete button cell
    html += `<td class="action-col" data-row-id="${rowId}">
      <button class="row-delete-btn" data-row-index="${rowIdx}" title="Xóa hàng">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </td>`;
    html += '</tr>';
  });

  html += '</tbody></table>';
  wrapper.innerHTML = html;

  wrapper.querySelectorAll('.data-row').forEach((rowEl) => {
    rowEl.addEventListener('click', async (e) => {
      if (e.target.closest('a')) return;

      const deleteBtn = e.target.closest('.row-delete-btn');
      if (deleteBtn) {
        e.stopPropagation();
        const rowIndex = parseInt(deleteBtn.dataset.rowIndex, 10);
        const rowData = data[rowIndex];
        if (!rowData?.id) {
          showToast('Không tìm thấy ID để xóa', 'error');
          return;
        }

        const { error } = await supabase.from(TABLE_NAME).delete().eq('id', rowData.id);
        if (error) {
          showToast(`Xóa thất bại: ${error.message}`, 'error');
          return;
        }

        state.supabaseData = state.supabaseData.filter(item => item.id !== rowData.id);
        renderDataTable();
        showToast(`Đã xóa dòng "${rowData.image_name || rowData.id}"`, 'success');
        return;
      }

      const clickedCell = e.target.closest('td[data-col]');
      if (!clickedCell) return;

      const col = clickedCell.dataset.col;
      const rowIndex = parseInt(rowEl.dataset.rowIndex, 10);
      const rowData = data[rowIndex];

      if (col === 'image_name') {
        fillPipelineFromDataRow(rowData);
        return;
      }

      const textToCopy = rowData?.[col] == null ? '' : String(rowData[col]);
      try {
        await navigator.clipboard.writeText(textToCopy);
        showToast(`Đã copy ô "${col}"`, 'success');
      } catch {
        showToast('Copy thất bại', 'error');
      }
    });
  });

  // Column resize functionality
  const table = wrapper.querySelector('.data-table');
  if (table) {
    const ths = table.querySelectorAll('th');
    ths.forEach((th) => {
      const resizer = document.createElement('div');
      resizer.className = 'column-resizer';
      th.appendChild(resizer);

      let startX, startWidth;
      resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startX = e.pageX;
        startWidth = th.offsetWidth;

        const onMouseMove = (e) => {
          const width = startWidth + (e.pageX - startX);
          th.style.width = `${Math.max(60, width)}px`;
          th.style.minWidth = `${Math.max(60, width)}px`;
        };

        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
  }
}

// ===== Init =====
function init() {
  // Render pipeline steps
  renderSteps();

  // Load Supabase data
  loadSupabaseData();

  // Header input bindings
  const imageNameInput = document.getElementById('image-name');
  imageNameInput.addEventListener('input', (e) => {
    state.imageName = e.target.value;
    state.latestImageNameCheckToken += 1;
    state.isImageNameDuplicate = false;
    setImageNameStatus('');
  });

  imageNameInput.addEventListener('blur', async (e) => {
    const name = e.target.value.trim();
    await checkImageNameDuplicate(name);
  });

  document.getElementById('model-select').addEventListener('change', (e) => {
    state.modelId = e.target.value;
  });

  // Refresh button
  document.getElementById('btn-refresh-data').addEventListener('click', () => {
    showToast('Đang tải lại dữ liệu...', 'info');
    loadSupabaseData();
  });
}

document.addEventListener('DOMContentLoaded', init);
