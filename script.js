/**
 * Texture Lab — Multi (Light + Tone)
 * Вырезанный и отрефакторенный JS из HTML-версии:
 * - Понятные имена переменных и функций
 * - JSDoc-типизация
 * - Логика разбита на небольшие функции
 *
 * Требования к разметке: используйте те же id-атрибуты, что были в исходной HTML-версии.
 */

/* =========================================
 *              Типы (JSDoc)
 * ========================================= */

/**
 * @typedef {Object} ImageItem
 * @property {string} id
 * @property {string} name
 * @property {HTMLImageElement} img
 * @property {number} width
 * @property {number} height
 * @property {Blob | undefined} outBlob
 */

/**
 * @typedef {Object} LightToneParams
 * @property {boolean} tiling                 // Безшовный режим свёрток (wrap)
 * @property {boolean} keepAlpha              // Сохранять полностью прозрачные пиксели
 * @property {number} lightStrength           // 0..1
 * @property {number} lightAzimuthRad         // радианы
 * @property {number} lightElevationRad       // радианы
 * @property {number} lightSoftness           // 0..2 (больше — мягче)
 * @property {number} ambientMin              // 0..1 (минимум яркости в тени)
 * @property {number} midContrast             // 0..0.6 (контраст средних тонов)
 * @property {number} exposure                // 0.6..1.1 (затемнение/осветление)
 * @property {number} saturationDelta         // -0.4..0.6
 * @property {number} vibrance                // -1..1
 * @property {number} gamma                   // 0.5..1.8
 * @property {number} posterize               // 0 или >=2 (уровни/канал)
 */

/* =========================================
 *           Глобальное состояние
 * ========================================= */

/** @type {{ items: ImageItem[], activeId: string | null }} */
const appState = {
    items: [],
    activeId: null,
};

/** Удобный алиас для document.getElementById */
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/* =========================================
 *              Захват элементов
 * ========================================= */

const ui = {
    // Левая панель
    fileInput: /** @type {HTMLInputElement} */ ($('file')),
    dropZone: /** @type {HTMLElement} */ ($('drop')),
    list: /** @type {HTMLElement} */ ($('list')),
    applySelectedBtn: /** @type {HTMLButtonElement} */ ($('applySelected')),
    applyAllBtn: /** @type {HTMLButtonElement} */ ($('applyAll')),
    downloadSelectedBtn: /** @type {HTMLButtonElement} */ ($('downloadSelected')),
    downloadAllBtn: /** @type {HTMLButtonElement} */ ($('downloadAll')),

    // Настройки света
    lightStrength: /** @type {HTMLInputElement} */ ($('lightStrength')),
    lightStrengthNum: /** @type {HTMLInputElement} */ ($('lightStrengthNum')),
    azimuth: /** @type {HTMLInputElement} */ ($('azimuth')),
    azimuthNum: /** @type {HTMLInputElement} */ ($('azimuthNum')),
    elevation: /** @type {HTMLInputElement} */ ($('elevation')),
    elevationNum: /** @type {HTMLInputElement} */ ($('elevationNum')),
    lightSoft: /** @type {HTMLInputElement} */ ($('lightSoft')),
    lightSoftNum: /** @type {HTMLInputElement} */ ($('lightSoftNum')),
    ambient: /** @type {HTMLInputElement} */ ($('ambient')),
    ambientNum: /** @type {HTMLInputElement} */ ($('ambientNum')),

    // Тоновые правки
    contrast: /** @type {HTMLInputElement} */ ($('contrast')),
    contrastNum: /** @type {HTMLInputElement} */ ($('contrastNum')),
    exposure: /** @type {HTMLInputElement} */ ($('exposure')),
    exposureNum: /** @type {HTMLInputElement} */ ($('exposureNum')),
    saturation: /** @type {HTMLInputElement} */ ($('saturation')),
    saturationNum: /** @type {HTMLInputElement} */ ($('saturationNum')),
    vibrance: /** @type {HTMLInputElement} */ ($('vibrance')),
    vibranceNum: /** @type {HTMLInputElement} */ ($('vibranceNum')),
    gamma: /** @type {HTMLInputElement} */ ($('gamma')),
    gammaNum: /** @type {HTMLInputElement} */ ($('gammaNum')),
    posterize: /** @type {HTMLInputElement} */ ($('posterize')),
    posterizeNum: /** @type {HTMLInputElement} */ ($('posterizeNum')),

    // Флаги
    tiling: /** @type {HTMLInputElement} */ ($('tiling')),
    preserveAlpha: /** @type {HTMLInputElement} */ ($('preserveAlpha')),

    // Зум и сброс
    zoom: /** @type {HTMLInputElement} */ ($('zoom')),
    zoomNum: /** @type {HTMLInputElement} */ ($('zoomNum')),
    resetBtn: /** @type {HTMLButtonElement} */ ($('reset')),

    // Превью
    srcCanvas: /** @type {HTMLCanvasElement} */ ($('srcCanvas')),
    outCanvas: /** @type {HTMLCanvasElement} */ ($('outCanvas')),
};

const srcCtx = ui.srcCanvas.getContext('2d', {
    willReadFrequently: true
});
const outCtx = ui.outCanvas.getContext('2d', {
    willReadFrequently: true
});

/* =========================================
 *                 Инициализация
 * ========================================= */

initApp();

/** Точка входа: биндинг UI, стартовые слушатели, пустое превью */
function initApp() {
    bindNumberToRange(ui.lightStrength, ui.lightStrengthNum, onAnyParamChange);
    bindNumberToRange(ui.azimuth, ui.azimuthNum, onAnyParamChange);
    bindNumberToRange(ui.elevation, ui.elevationNum, onAnyParamChange);
    bindNumberToRange(ui.lightSoft, ui.lightSoftNum, onAnyParamChange);
    bindNumberToRange(ui.ambient, ui.ambientNum, onAnyParamChange);

    bindNumberToRange(ui.contrast, ui.contrastNum, onAnyParamChange);
    bindNumberToRange(ui.exposure, ui.exposureNum, onAnyParamChange);
    bindNumberToRange(ui.saturation, ui.saturationNum, onAnyParamChange);
    bindNumberToRange(ui.vibrance, ui.vibranceNum, onAnyParamChange);
    bindNumberToRange(ui.gamma, ui.gammaNum, onAnyParamChange);
    bindNumberToRange(ui.posterize, ui.posterizeNum, onAnyParamChange);

    ui.tiling.addEventListener('change', onAnyParamChange);
    ui.preserveAlpha.addEventListener('change', onAnyParamChange);

    // DnD / выбор файлов
    ['dragenter', 'dragover'].forEach((t) =>
        ui.dropZone.addEventListener(t, (e) => {
            e.preventDefault();
            ui.dropZone.classList.add('drag');
        }),
    );
    ['dragleave', 'drop'].forEach((t) =>
        ui.dropZone.addEventListener(t, (e) => {
            e.preventDefault();
            ui.dropZone.classList.remove('drag');
        }),
    );
    ui.dropZone.addEventListener('click', () => ui.fileInput.click());
    ui.dropZone.addEventListener('drop', (e) => handleFileList(e.dataTransfer?.files));
    ui.fileInput.addEventListener('change', (e) => handleFileList(ui.fileInput.files));

    // Кнопки применения/скачивания
    ui.applySelectedBtn.addEventListener('click', () => applyProcessing('one'));
    ui.applyAllBtn.addEventListener('click', () => applyProcessing('all'));
    ui.downloadSelectedBtn.addEventListener('click', () => downloadResults('one'));
    ui.downloadAllBtn.addEventListener('click', () => downloadResults('all'));

    // Навигация по списку
    document.addEventListener('keydown', (e) => {
        if (!appState.items.length) return;
        const index = appState.items.findIndex((it) => it.id === appState.activeId);
        if (e.key === 'ArrowDown') {
            const next = appState.items[Math.min(appState.items.length - 1, index + 1)];
            if (next) selectItem(next.id);
        }
        if (e.key === 'ArrowUp') {
            const prev = appState.items[Math.max(0, index - 1)];
            if (prev) selectItem(prev.id);
        }
        if (e.key === 'Enter') {
            applyProcessing('one');
        }
    });

    // Зум (меняем только CSS-размеры, не трогаем буфер)
    ui.zoom.addEventListener('input', () => {
        const item = getActiveItem();
        if (!item) return;
        resizeCanvasCss(ui.srcCanvas, item.width, item.height);
        resizeCanvasCss(ui.outCanvas, item.width, item.height);
    });
    bindNumberToRange(ui.zoom, ui.zoomNum, () => ui.zoom.dispatchEvent(new Event('input')));

    // Сброс настроек
    ui.resetBtn.addEventListener('click', () => {
        setControls({
            lightStrength: 0.58,
            azimuth: 315,
            elevation: 55,
            lightSoft: 0.6,
            ambient: 0.25,
            contrast: 0.18,
            exposure: 0.9,
            saturation: 0.08,
            vibrance: 0.0,
            gamma: 1.0,
            posterize: 0,
            tiling: true,
            preserveAlpha: true,
            zoom: 8,
        });
        onAnyParamChange();
    });

    // Пустая шахматка в превью
    drawEmptyPreview();
    updateActionButtons();
}

/* =========================================
 *              Привязка инпутов
 * ========================================= */

/**
 * Линкует range <-> number и вешает единый колбэк
 * @param {HTMLInputElement} range
 * @param {HTMLInputElement} number
 * @param {() => void} onChange
 */
function bindNumberToRange(range, number, onChange) {
    range.addEventListener('input', () => {
        number.value = range.value;
        onChange();
    });
    number.addEventListener('input', () => {
        range.value = number.value;
        onChange();
    });
}

/** Любое изменение параметров — обновляем превью */
function onAnyParamChange() {
    const item = getActiveItem();
    if (!item) return;
    renderOriginalToCanvas(item);
    renderProcessedPreview(item);
}

/* =========================================
 *             Работа с файлами
 * ========================================= */

/**
 * Обработка списка файлов
 * @param {FileList | File[] | null | undefined} fileList
 */
async function handleFileList(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type === 'image/png');
    if (!files.length) return;

    const loaded = await Promise.all(files.map(loadImageItem));
    let firstNewId = null;
    for (const it of loaded) {
        appState.items.push(it);
        if (!appState.activeId) firstNewId = it.id;
    }
    renderList();
    if (firstNewId) selectItem(firstNewId);
    updateActionButtons();
}

/**
 * Загружает файл PNG в ImageItem
 * @param {File} file
 * @returns {Promise<ImageItem>}
 */
function loadImageItem(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () =>
            resolve({
                id: crypto.randomUUID(),
                name: file.name,
                img,
                width: img.naturalWidth,
                height: img.naturalHeight,
                outBlob: undefined,
            });
        img.onerror = reject;
        img.src = url;
    });
}

/* =========================================
 *            Список и выбор файла
 * ========================================= */

function renderList() {
    ui.list.innerHTML = '';
    for (const it of appState.items) {
        const row = document.createElement('div');
        row.className = 'item' + (it.id === appState.activeId ? ' active' : '');
        row.tabIndex = 0;
        row.addEventListener('click', () => selectItem(it.id));

        const thumb = document.createElement('canvas');
        thumb.className = 'thumb';
        thumb.width = it.width;
        thumb.height = it.height;

        const tctx = thumb.getContext('2d', {
            willReadFrequently: true
        });
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(it.img, 0, 0, it.width, it.height);

        const meta = document.createElement('div');
        meta.className = 'meta';
        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = it.name;
        const dim = document.createElement('div');
        dim.className = 'dim';
        dim.textContent = `${it.width}×${it.height}`;

		const deleteButton = document.createElement('button');
		deleteButton.className = "delete-button";
		deleteButton.innerText = '×'
		deleteButton.addEventListener('click', (event => {
			appState.items = appState.items.filter(item => item.id != it.id);
			renderList();
			updateActionButtons();
		}));

        meta.append(name, dim);
        row.append(thumb, meta, deleteButton);
        ui.list.append(row);
    }
}

/**
 * Выбрать элемент по id
 * @param {string} id
 */
function selectItem(id) {
    appState.activeId = id;
    renderList();
    const item = getActiveItem();
    if (!item) return;
    renderOriginalToCanvas(item);
    renderProcessedPreview(item);
    updateActionButtons();
}

/** @returns {ImageItem | null} */
function getActiveItem() {
    return appState.items.find((i) => i.id === appState.activeId) || null;
}

/* =========================================
 *            Превью и обработка
 * ========================================= */

/** Отрисовать оригинал в левый canvas */
function renderOriginalToCanvas(item) {
    resizeCanvasBufferAndCss(ui.srcCanvas, item.width, item.height);
    resizeCanvasBufferAndCss(ui.outCanvas, item.width, item.height);
    srcCtx.imageSmoothingEnabled = false;
    outCtx.imageSmoothingEnabled = false;
    srcCtx.clearRect(0, 0, item.width, item.height);
    srcCtx.drawImage(item.img, 0, 0, item.width, item.height);
}

/** Обновить превью справа по текущим параметрам */
function renderProcessedPreview(item) {
    const p = readParamsFromControls();
    processCanvas(ui.srcCanvas, ui.outCanvas, p);
}

/** Сменить только CSS-размеры (для зума) */
function resizeCanvasCss(canvas, w, h) {
    const scale = Number(ui.zoom.value);
    canvas.style.width = `${w * scale}px`;
    canvas.style.height = `${h * scale}px`;
}

/** Задать буферные размеры canvas и CSS-зум */
function resizeCanvasBufferAndCss(canvas, w, h) {
    canvas.width = w;
    canvas.height = h;
    resizeCanvasCss(canvas, w, h);
}

/** Прорисовать шахматку в обоих превью на старте */
function drawEmptyPreview() {
    const w = 16,
        h = 16;
    resizeCanvasBufferAndCss(ui.srcCanvas, w, h);
    resizeCanvasBufferAndCss(ui.outCanvas, w, h);
    const drawChecker = (ctx) => {
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
                ctx.fillStyle = ((x >> 1) + (y >> 1)) % 2 ? '#141821' : '#10141b';
                ctx.fillRect(x, y, 1, 1);
            }
    };
    drawChecker(srcCtx);
    drawChecker(outCtx);
}

/* =========================================
 *          Чтение параметров из UI
 * ========================================= */

/** @returns {LightToneParams} */
function readParamsFromControls() {
    return {
        tiling: ui.tiling.checked,
        keepAlpha: ui.preserveAlpha.checked,
        lightStrength: Number(ui.lightStrength.value),
        lightAzimuthRad: (Number(ui.azimuth.value) * Math.PI) / 180,
        lightElevationRad: (Number(ui.elevation.value) * Math.PI) / 180,
        lightSoftness: Number(ui.lightSoft.value),
        ambientMin: Number(ui.ambient.value),
        midContrast: Number(ui.contrast.value),
        exposure: Number(ui.exposure.value),
        saturationDelta: Number(ui.saturation.value),
        vibrance: Number(ui.vibrance.value),
        gamma: Number(ui.gamma.value),
        posterize: Number(ui.posterize.value) | 0,
    };
}

/**
 * Массово проставить значения контролам (для сброса/пресетов)
 * @param {Partial<Record<keyof typeof ui, number | boolean>>} map
 */
function setControls(map) {
    for (const [key, value] of Object.entries(map)) {
        const el = /** @type {any} */ (ui)[key];
        if (!el) continue;
        if (typeof value === 'boolean') el.checked = value;
        else el.value = String(value);

        const num = /** @type {any} */ (ui)[`${key}Num`];
        if (num && typeof value !== 'boolean') num.value = String(value);
    }
}

/* =========================================
 *         Основная обработка изображения
 * ========================================= */

/**
 * Обработка: берёт пиксели из srcCanvas и пишет результат в outCanvas
 * @param {HTMLCanvasElement} srcCanvas
 * @param {HTMLCanvasElement} outCanvas
 * @param {LightToneParams} p
 */
function processCanvas(srcCanvas, outCanvas, p) {
    const w = srcCanvas.width;
    const h = srcCanvas.height;
    const src = srcCtx.getImageData(0, 0, w, h);
    const out = outCtx.createImageData(w, h);

    // 1) LUMA
    const luma = computeLuma(src.data, w, h);

    // 2) Градиенты Собеля для псевдо-нормалей (свет/тень)
    const {
        gradX,
        gradY
    } = sobel(luma, w, h, p.tiling);

    // 3) Направление света
    const lightVec = normalize3([
        Math.cos(p.lightElevationRad) * Math.cos(p.lightAzimuthRad),
        Math.cos(p.lightElevationRad) * Math.sin(p.lightAzimuthRad),
        Math.sin(p.lightElevationRad),
    ]);

    // 4) Проход по пикселям
    const s = src.data;
    const d = out.data;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const a = s[idx + 3];
            let r = s[idx] / 255;
            let g = s[idx + 1] / 255;
            let b = s[idx + 2] / 255;

            // Сохраняем полностью прозрачные пиксели
            if (p.keepAlpha && a === 0) {
                d[idx] = s[idx];
                d[idx + 1] = s[idx + 1];
                d[idx + 2] = s[idx + 2];
                d[idx + 3] = 0;
                continue;
            }

            // LIGHT: псевдо-нормаль из градиентов
            if (p.lightStrength !== 0) {
                let nx = -gradX[y * w + x];
                let ny = -gradY[y * w + x];
                let nz = 1.0 * (1 + p.lightSoftness * 1.2); // мягкость — «приплющивание» нормали
                const N = normalize3([nx, ny, nz]);

                let shade = Math.max(p.ambientMin, dot3(N, lightVec) * 0.5 + 0.5);
                shade = softCurve(shade, 0.5 + p.lightSoftness * 0.12);
                const k = 1 + (shade - 0.5) * (p.lightStrength * 1.2);

                r = clamp01(r * k);
                g = clamp01(g * k);
                b = clamp01(b * k);
            }

            // CONTRAST (mid-tones)
            if (p.midContrast !== 0) {
                const mid = 0.5;
                const c = p.midContrast;
                const adjust = (v) => mid + (v - mid) * (1 + c);
                r = clamp01(adjust(r));
                g = clamp01(adjust(g));
                b = clamp01(adjust(b));
            }

            // SATURATION
            if (p.saturationDelta !== 0) {
                [r, g, b] = applySaturation(r, g, b, p.saturationDelta);
            }

            // VIBRANCE
            if (p.vibrance !== 0) {
                [r, g, b] = applyVibrance(r, g, b, p.vibrance);
            }

            // EXPOSURE + GAMMA
            r = clamp01(Math.pow(r * p.exposure, p.gamma));
            g = clamp01(Math.pow(g * p.exposure, p.gamma));
            b = clamp01(Math.pow(b * p.exposure, p.gamma));

            // POSTERIZE (после тонемапа)
            if (p.posterize && p.posterize >= 2) {
                const steps = p.posterize | 0;
                const quant = (v) => Math.round(v * (steps - 1)) / (steps - 1);
                r = quant(r);
                g = quant(g);
                b = quant(b);
            }

            d[idx] = (r * 255) | 0;
            d[idx + 1] = (g * 255) | 0;
            d[idx + 2] = (b * 255) | 0;
            d[idx + 3] = a;
        }
    }

    outCtx.putImageData(out, 0, 0);
}

/* =========================================
 *            Кнопки: применить/скачать
 * ========================================= */

/**
 * Применить текущие настройки к одному или ко всем изображениям
 * @param {'one'|'all'} scope
 */
function applyProcessing(scope) {
    const targets = scope === 'one' ? [getActiveItem()] : appState.items;
    const params = readParamsFromControls();
    /** @type {HTMLCanvasElement} */
    const tempCanvas = document.createElement('canvas');
    /** @type {CanvasRenderingContext2D} */
    const tempCtx = tempCanvas.getContext('2d', {
        willReadFrequently: true
    });

    for (const item of targets) {
        if (!item) continue;
        tempCanvas.width = item.width;
        tempCanvas.height = item.height;
        tempCtx.imageSmoothingEnabled = false;
        tempCtx.clearRect(0, 0, item.width, item.height);
        tempCtx.drawImage(item.img, 0, 0, item.width, item.height);

        // переносим исходник в общий srcCanvas → процессим → blob в item.outBlob
        ui.srcCanvas.width = item.width;
        ui.srcCanvas.height = item.height;
        ui.outCanvas.width = item.width;
        ui.outCanvas.height = item.height;
        srcCtx.putImageData(tempCtx.getImageData(0, 0, item.width, item.height), 0, 0);
        processCanvas(ui.srcCanvas, ui.outCanvas, params);

        ui.outCanvas.toBlob((blob) => {
            item.outBlob = blob || undefined;
            updateActionButtons();
        }, 'image/png');
    }
}

/**
 * Скачать результат для одного или всех
 * @param {'one'|'all'} scope
 */
function downloadResults(scope) {
    const targets = scope === 'one' ? [getActiveItem()] : appState.items;
    for (const item of targets) {
        if (!item || !item.outBlob) continue;
        const a = document.createElement('a');
        a.download = item.name.replace(/\.png$/i, '') + '.enhanced.png';
        a.href = URL.createObjectURL(item.outBlob);
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
}

/** Вкл/выкл кнопок в зависимости от состояния */
function updateActionButtons() {
    const hasItems = appState.items.length > 0;
    ui.applySelectedBtn.disabled = !hasItems || !appState.activeId;
    ui.applyAllBtn.disabled = !hasItems;

    const active = getActiveItem();
    ui.downloadSelectedBtn.disabled = !(active && active.outBlob);
    ui.downloadAllBtn.disabled = !appState.items.some((i) => i.outBlob);
}

/* =========================================
 *           Вспомогательные фильтры
 * ========================================= */

/**
 * Посчитать яркость (luma) во Float32Array
 * @param {Uint8ClampedArray} rgba
 * @param {number} width
 * @param {number} height
 */
function computeLuma(rgba, width, height) {
    const out = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = rgba[i] / 255;
            const g = rgba[i + 1] / 255;
            const b = rgba[i + 2] / 255;
            out[y * width + x] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }
    }
    return out;
}

/**
 * Собель-градиенты (wrap по краям при tiling=true)
 * @param {Float32Array} luma
 * @param {number} width
 * @param {number} height
 * @param {boolean} wrap
 * @returns {{gradX: Float32Array, gradY: Float32Array}}
 */
function sobel(luma, width, height, wrap) {
    const gradX = new Float32Array(width * height);
    const gradY = new Float32Array(width * height);
    const Kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const Ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    const idx = (x, y) =>
        wrap ?
        (((((y % height) + height) % height) * width) + ((((x % width) + width) % width))) :
        y * width + x;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sx = 0,
                sy = 0,
                p = 0;
            for (let j = -1; j <= 1; j++) {
                for (let i = -1; i <= 1; i++) {
                    const X = wrap ? x + i : Math.min(width - 1, Math.max(0, x + i));
                    const Y = wrap ? y + j : Math.min(height - 1, Math.max(0, y + j));
                    const Ls = luma[idx(X, Y)];
                    sx += Kx[p] * Ls;
                    sy += Ky[p] * Ls;
                    p++;
                }
            }
            gradX[y * width + x] = sx;
            gradY[y * width + x] = sy;
        }
    }
    return {
        gradX,
        gradY
    };
}

/**
 * Коррекция насыщенности (HSL-приближённая)
 * @param {number} r 0..1
 * @param {number} g 0..1
 * @param {number} b 0..1
 * @param {number} delta -0.4..0.6
 * @returns {[number, number, number]}
 */
function applySaturation(r, g, b, delta) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const s0 =
        max === min ? 0 : l < 0.5 ? (max - min) / (max + min) : (max - min) / (2 - max - min);
    const target = clamp01(s0 + delta);
    const scale = s0 === 0 ? 0 : target / s0;
    return [
        clamp01(l + (r - l) * scale),
        clamp01(l + (g - l) * scale),
        clamp01(l + (b - l) * scale),
    ];
}

/**
 * Vibrance — усиливает тусклые цвета сильнее
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} vib -1..1
 * @returns {[number, number, number]}
 */
function applyVibrance(r, g, b, vib) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const s0 =
        max === min ? 0 : l < 0.5 ? (max - min) / (max + min) : (max - min) / (2 - max - min);

    let target = vib >= 0 ? clamp01(s0 + (1 - s0) * vib) : clamp01(s0 * (1 + vib));
    const scale = s0 === 0 ? 0 : target / s0;
    return [
        clamp01(l + (r - l) * scale),
        clamp01(l + (g - l) * scale),
        clamp01(l + (b - l) * scale),
    ];
}

/* =========================================
 *               Математика
 * ========================================= */

function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** @param {[number,number,number]} a @param {[number,number,number]} b */
function dot3(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** @param {[number,number,number]} v */
function normalize3(v) {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
}

/**
 * Плавная кривая (смешение линейки и smoothstep) для мягкой светотени
 * @param {number} x
 * @param {number} c
 */
function softCurve(x, c) {
    const t = clamp01(x);
    const k = clamp01(c);
    const sm = t * t * (3 - 2 * t); // smoothstep
    return sm * k + t * (1 - k);
}