(function () {
    'use strict';

    // =========================================
    // Constants
    // =========================================
    const SAVE_KEY = 'snaplayout_data';
    const THEME_KEY = 'snaplayout_theme';
    const INTRO_KEY = 'snaplayout_seen_intro';
    const SAVE_VERSION = 1;
    const GRID_SIZE = 12;           // minor grid in canvas px
    const GRID_MAJOR = 4;           // major grid every N minor
    const SNAP_ROTATION = 15;       // degrees
    const MAX_UNDO = 50;
    const DEFAULT_PPI = 4;          // default pixels per inch (before calibration)
    const MIN_ZOOM = 0.1;
    const MAX_ZOOM = 10;
    const WALL_WIDTH = 4;
    const SCALE_LINE_WIDTH = 2;
    const MAX_IMAGE_DIM = 2000;     // max px for stored images

    // Conversion helpers (everything stored in inches internally)
    const CONVERSIONS = {
        ft: { fromInches: v => v / 12, toInches: v => v * 12, label: 'ft', areaLabel: 'sq ft', areaDiv: 144 },
        in: { fromInches: v => v, toInches: v => v, label: 'in', areaLabel: 'sq in', areaDiv: 1 },
        cm: { fromInches: v => v * 2.54, toInches: v => v / 2.54, label: 'cm', areaLabel: 'sq cm', areaDiv: 1 / 6.4516 },
        m:  { fromInches: v => v * 0.0254, toInches: v => v / 0.0254, label: 'm', areaLabel: 'sq m', areaDiv: 1 / 0.00064516 }
    };

    // =========================================
    // State
    // =========================================
    let canvas;
    let currentTool = 'select';
    let unit = 'ft';
    let pixelsPerInch = DEFAULT_PPI;
    let scaleCalibrated = false;
    let snapEnabled = true;
    let gridVisible = true;
    let gridLines = null;           // fabric.Group for grid
    let undoStack = [];
    let redoStack = [];
    let savePending = false;
    let wallDrawingPoints = [];
    let wallPreviewLine = null;
    let scalePoints = [];
    let scaleLine = null;
    let floorplanImage = null;
    let hasContent = false;

    // =========================================
    // DOM References
    // =========================================
    const $ = id => document.getElementById(id);
    const canvasWrapper = $('canvas-wrapper');
    const dropZone = $('drop-zone');
    const unitSelect = $('unit-select');
    const dimensionsDisplay = $('dimensions-display');
    const areaDisplay = $('area-display');
    const areaDot = $('area-dot');
    const undoBtn = $('undo-btn');
    const redoBtn = $('redo-btn');
    const snapBtn = $('snap-btn');
    const gridBtn = $('grid-btn');
    const propertiesPanel = $('properties-panel');
    const announcer = $('app-announcer');

    // =========================================
    // Utility
    // =========================================
    function announce(msg) {
        announcer.textContent = '';
        requestAnimationFrame(() => { announcer.textContent = msg; });
    }

    function formatDimensions(wInches, hInches) {
        const c = CONVERSIONS[unit];
        const wVal = c.fromInches(wInches);
        const hVal = c.fromInches(hInches);
        const fmt = (v) => {
            if (unit === 'ft') return v.toFixed(1);
            if (unit === 'in') return Math.round(v).toString();
            if (unit === 'cm') return v.toFixed(1);
            return v.toFixed(2);
        };
        return fmt(wVal) + ' \u00d7 ' + fmt(hVal) + ' ' + unit;
    }

    function inchesToDisplay(inches) {
        const c = CONVERSIONS[unit];
        const val = c.fromInches(inches);
        if (unit === 'ft') return val.toFixed(1) + ' ft';
        if (unit === 'in') return Math.round(val) + ' in';
        if (unit === 'cm') return val.toFixed(1) + ' cm';
        return val.toFixed(2) + ' m';
    }

    function areaToDisplay(sqInches) {
        const c = CONVERSIONS[unit];
        if (unit === 'ft') return (sqInches / 144).toFixed(0) + ' sq ft';
        if (unit === 'in') return Math.round(sqInches) + ' sq in';
        if (unit === 'cm') return (sqInches * 6.4516).toFixed(0) + ' sq cm';
        return (sqInches * 0.00064516).toFixed(1) + ' sq m';
    }

    function pxToInches(px) {
        return px / pixelsPerInch;
    }

    function inchesToPx(inches) {
        return inches * pixelsPerInch;
    }

    function getComputedVar(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    // =========================================
    // Theme
    // =========================================
    function initTheme() {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'light') {
            document.documentElement.classList.add('light-theme');
            document.documentElement.classList.remove('dark-theme');
        } else if (saved === 'dark') {
            document.documentElement.classList.add('dark-theme');
            document.documentElement.classList.remove('light-theme');
        }
        updateThemeBtn();
    }

    function toggleTheme() {
        const isLight = document.documentElement.classList.contains('light-theme') ||
            (!document.documentElement.classList.contains('dark-theme') &&
             window.matchMedia('(prefers-color-scheme: light)').matches);

        if (isLight) {
            document.documentElement.classList.remove('light-theme');
            document.documentElement.classList.add('dark-theme');
            localStorage.setItem(THEME_KEY, 'dark');
        } else {
            document.documentElement.classList.remove('dark-theme');
            document.documentElement.classList.add('light-theme');
            localStorage.setItem(THEME_KEY, 'light');
        }
        updateThemeBtn();
        updateCanvasBg();
        drawGrid();
    }

    function updateThemeBtn() {
        const isLight = document.documentElement.classList.contains('light-theme') ||
            (!document.documentElement.classList.contains('dark-theme') &&
             window.matchMedia('(prefers-color-scheme: light)').matches);
        $('theme-btn').textContent = isLight ? '\u{1F319}' : '\u{2600}';
    }

    function isDarkTheme() {
        return document.documentElement.classList.contains('dark-theme') ||
            (!document.documentElement.classList.contains('light-theme') &&
             window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    function updateCanvasBg() {
        if (!canvas) return;
        canvas.backgroundColor = isDarkTheme() ? '#12122a' : '#dddee8';
        canvas.requestRenderAll();
    }

    // =========================================
    // Canvas Initialization
    // =========================================
    function initCanvas() {
        canvas = new fabric.Canvas('layout-canvas', {
            selection: true,
            preserveObjectStacking: true,
            stopContextMenu: true,
            fireRightClick: true,
            allowTouchScrolling: false
        });

        resizeCanvas();
        updateCanvasBg();

        // Resize observer
        if (window.ResizeObserver) {
            new ResizeObserver(() => resizeCanvas()).observe(canvasWrapper);
        } else {
            window.addEventListener('resize', resizeCanvas);
        }

        // Canvas events
        canvas.on('object:moving', onObjectMoving);
        canvas.on('object:rotating', onObjectRotating);
        canvas.on('object:modified', onObjectModified);
        canvas.on('selection:created', onSelectionChanged);
        canvas.on('selection:updated', onSelectionChanged);
        canvas.on('selection:cleared', onSelectionCleared);
        canvas.on('mouse:wheel', onMouseWheel);
        canvas.on('mouse:down', onMouseDown);
        canvas.on('mouse:move', onMouseMove);
        canvas.on('mouse:up', onMouseUp);

        drawGrid();
    }

    function resizeCanvas() {
        if (!canvas) return;
        const rect = canvasWrapper.getBoundingClientRect();
        canvas.setDimensions({ width: rect.width, height: rect.height });
        drawGrid();
    }

    // =========================================
    // Grid
    // =========================================
    function drawGrid() {
        if (gridLines) {
            canvas.remove(gridLines);
            gridLines = null;
        }
        if (!gridVisible) {
            canvas.requestRenderAll();
            return;
        }

        const zoom = canvas.getZoom();
        const vpt = canvas.viewportTransform;
        const w = canvas.getWidth();
        const h = canvas.getHeight();

        // Visible area in canvas coordinates
        const left = -vpt[4] / zoom;
        const top = -vpt[5] / zoom;
        const right = left + w / zoom;
        const bottom = top + h / zoom;

        const lines = [];
        const step = GRID_SIZE;
        const majorStep = step * GRID_MAJOR;

        const gridColor = isDarkTheme() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
        const majorColor = isDarkTheme() ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.2)';

        // Determine effective step based on zoom (skip lines when zoomed out)
        let effectiveStep = step;
        if (zoom < 0.5) effectiveStep = step * GRID_MAJOR;
        if (zoom < 0.2) effectiveStep = step * GRID_MAJOR * 2;

        const startX = Math.floor(left / effectiveStep) * effectiveStep;
        const startY = Math.floor(top / effectiveStep) * effectiveStep;

        // Cap line count to prevent performance issues
        const maxLines = 400;
        let lineCount = 0;

        for (let x = startX; x <= right && lineCount < maxLines; x += effectiveStep) {
            const isMajor = Math.abs(x % majorStep) < 0.5;
            lines.push(new fabric.Line([x, top, x, bottom], {
                stroke: isMajor ? majorColor : gridColor,
                strokeWidth: (isMajor ? 1 : 0.5) / zoom,
                selectable: false,
                evented: false
            }));
            lineCount++;
        }

        for (let y = startY; y <= bottom && lineCount < maxLines; y += effectiveStep) {
            const isMajor = Math.abs(y % majorStep) < 0.5;
            lines.push(new fabric.Line([left, y, right, y], {
                stroke: isMajor ? majorColor : gridColor,
                strokeWidth: (isMajor ? 1 : 0.5) / zoom,
                selectable: false,
                evented: false
            }));
            lineCount++;
        }

        if (lines.length > 0) {
            gridLines = new fabric.Group(lines, {
                selectable: false,
                evented: false,
                excludeFromExport: true
            });
            canvas.add(gridLines);
            canvas.sendToBack(gridLines);
            if (floorplanImage) canvas.sendToBack(floorplanImage);
        }
        canvas.requestRenderAll();
    }

    // =========================================
    // Zoom / Pan
    // =========================================
    function onMouseWheel(opt) {
        const e = opt.e;
        e.preventDefault();
        e.stopPropagation();

        const delta = e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));

        canvas.zoomToPoint({ x: e.offsetX, y: e.offsetY }, zoom);
        drawGrid();
        scheduleSave();
    }

    let isPanning = false;
    let panStartX, panStartY;

    function onMouseDown(opt) {
        const e = opt.e;

        if (currentTool === 'pan' || e.button === 1) {
            isPanning = true;
            panStartX = e.clientX;
            panStartY = e.clientY;
            canvas.selection = false;
            canvas.setCursor('grabbing');
            return;
        }

        if (currentTool === 'wall') {
            handleWallClick(opt);
            return;
        }

        if (currentTool === 'scale') {
            handleScaleClick(opt);
            return;
        }
    }

    function onMouseMove(opt) {
        const e = opt.e;

        if (isPanning) {
            const dx = e.clientX - panStartX;
            const dy = e.clientY - panStartY;
            panStartX = e.clientX;
            panStartY = e.clientY;
            canvas.relativePan(new fabric.Point(dx, dy));
            drawGrid();
            return;
        }

        if (currentTool === 'wall' && wallDrawingPoints.length > 0) {
            updateWallPreview(opt);
        }

        if (currentTool === 'scale' && scalePoints.length === 1) {
            updateScalePreview(opt);
        }
    }

    function onMouseUp(opt) {
        if (isPanning) {
            isPanning = false;
            canvas.selection = currentTool === 'select';
            canvas.setCursor(currentTool === 'pan' ? 'grab' : 'default');
            scheduleSave();
        }
    }

    // =========================================
    // Touch handling (pinch zoom, two-finger pan)
    // =========================================
    function initTouchHandlers() {
        let lastDist = 0;
        let lastCenter = null;
        let touching = 0;

        canvasWrapper.addEventListener('touchstart', function (e) {
            touching = e.touches.length;
            if (touching === 2) {
                e.preventDefault();
                lastDist = getTouchDist(e.touches);
                lastCenter = getTouchCenter(e.touches);
                canvas.selection = false;
            }
        }, { passive: false });

        canvasWrapper.addEventListener('touchmove', function (e) {
            if (touching === 2 && e.touches.length === 2) {
                e.preventDefault();
                const dist = getTouchDist(e.touches);
                const center = getTouchCenter(e.touches);

                // Zoom
                const scale = dist / lastDist;
                let zoom = canvas.getZoom() * scale;
                zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
                canvas.zoomToPoint(center, zoom);

                // Pan
                const dx = center.x - lastCenter.x;
                const dy = center.y - lastCenter.y;
                canvas.relativePan(new fabric.Point(dx, dy));

                lastDist = dist;
                lastCenter = center;
                drawGrid();
            }
        }, { passive: false });

        canvasWrapper.addEventListener('touchend', function (e) {
            touching = e.touches.length;
            if (touching < 2) {
                canvas.selection = currentTool === 'select';
                scheduleSave();
            }
        });
    }

    function getTouchDist(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function getTouchCenter(touches) {
        const rect = canvasWrapper.getBoundingClientRect();
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
            y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top
        };
    }

    // =========================================
    // Snap & Grid
    // =========================================
    function onObjectMoving(opt) {
        if (!snapEnabled) return;
        const obj = opt.target;
        obj.set({
            left: Math.round(obj.left / GRID_SIZE) * GRID_SIZE,
            top: Math.round(obj.top / GRID_SIZE) * GRID_SIZE
        });
    }

    function onObjectRotating(opt) {
        if (!snapEnabled) return;
        const obj = opt.target;
        obj.angle = Math.round(obj.angle / SNAP_ROTATION) * SNAP_ROTATION;
    }

    function onObjectModified(opt) {
        const obj = opt.target;

        // If a furniture group was scaled, rebuild it at the new size for crisp text
        if (obj && obj.data && obj.data.type === 'furniture' &&
            (Math.abs(obj.scaleX - 1) > 0.001 || Math.abs(obj.scaleY - 1) > 0.001)) {
            rebuildScaledObject(obj);
            return;
        }

        pushUndo();
        scheduleSave();
        updateProperties();
    }

    function rebuildScaledObject(obj) {
        const newRealW = obj.data.realWidth * obj.scaleX;
        const newRealH = obj.data.realHeight * obj.scaleY;
        const angle = obj.angle || 0;
        const left = obj.left;
        const top = obj.top;

        const item = {
            id: obj.data.itemId,
            label: obj.data.label,
            w: newRealW,
            h: newRealH,
            shape: obj.data.shape,
            style: obj.data.style
        };

        canvas.remove(obj);
        const newGroup = buildFurnitureGroup(item, 0, 0);
        newGroup.set({ left: left, top: top, angle: angle });
        newGroup.setCoords();
        canvas.add(newGroup);

        if (item.style === 'room') {
            sendRoomToBack(newGroup);
        }

        canvas.setActiveObject(newGroup);
        canvas.requestRenderAll();

        pushUndo();
        scheduleSave();
        updateProperties();
    }

    // =========================================
    // Selection & Properties Panel
    // =========================================
    function onSelectionChanged() {
        const active = canvas.getActiveObject();
        if (!active || !active.data || active.data.type !== 'furniture') {
            hideProperties();
            return;
        }
        showProperties(active);
    }

    function onSelectionCleared() {
        hideProperties();
    }

    function showProperties(obj) {
        propertiesPanel.hidden = false;
        requestAnimationFrame(() => propertiesPanel.classList.add('open'));
        updateProperties();
    }

    function hideProperties() {
        propertiesPanel.classList.remove('open');
        setTimeout(() => { propertiesPanel.hidden = true; }, 250);
    }

    function updateProperties() {
        const obj = canvas.getActiveObject();
        if (!obj || !obj.data || obj.data.type !== 'furniture') return;

        $('prop-title').textContent = obj.data.label || 'Properties';

        const widthInches = obj.data.realWidth * (obj.scaleX || 1);
        const heightInches = obj.data.realHeight * (obj.scaleY || 1);

        $('prop-width').value = parseFloat(CONVERSIONS[unit].fromInches(widthInches).toFixed(1));
        $('prop-height').value = parseFloat(CONVERSIONS[unit].fromInches(heightInches).toFixed(1));
        $('prop-rotation').value = Math.round(obj.angle || 0);
        $('prop-label').value = obj.data.label || '';
        $('prop-width-unit').textContent = unit;
        $('prop-height-unit').textContent = unit;
    }

    function initPropertiesPanel() {
        $('prop-close').addEventListener('click', () => {
            canvas.discardActiveObject();
            canvas.requestRenderAll();
            hideProperties();
        });

        $('prop-width').addEventListener('change', function () {
            const obj = canvas.getActiveObject();
            if (!obj || !obj.data) return;
            const newInches = CONVERSIONS[unit].toInches(parseFloat(this.value));
            const newPx = inchesToPx(newInches);
            obj.scaleX = newPx / obj.width;
            obj.data.realWidth = newInches;
            updateFurnitureLabel(obj);
            canvas.requestRenderAll();
            pushUndo();
            scheduleSave();
        });

        $('prop-height').addEventListener('change', function () {
            const obj = canvas.getActiveObject();
            if (!obj || !obj.data) return;
            const newInches = CONVERSIONS[unit].toInches(parseFloat(this.value));
            const newPx = inchesToPx(newInches);
            obj.scaleY = newPx / obj.height;
            obj.data.realHeight = newInches;
            updateFurnitureLabel(obj);
            canvas.requestRenderAll();
            pushUndo();
            scheduleSave();
        });

        $('prop-rotation').addEventListener('change', function () {
            const obj = canvas.getActiveObject();
            if (!obj) return;
            obj.angle = parseFloat(this.value) || 0;
            canvas.requestRenderAll();
            pushUndo();
            scheduleSave();
        });

        $('prop-label').addEventListener('change', function () {
            const obj = canvas.getActiveObject();
            if (!obj || !obj.data) return;
            obj.data.label = this.value;
            updateFurnitureLabel(obj);
            canvas.requestRenderAll();
            pushUndo();
            scheduleSave();
        });

        $('prop-duplicate').addEventListener('click', duplicateSelected);
        $('prop-delete').addEventListener('click', deleteSelected);
    }

    // =========================================
    // Furniture Bar
    // =========================================
    function initFurnitureBar() {
        const tabsContainer = $('furniture-tabs');
        const itemsContainer = $('furniture-items');
        const lib = window.FURNITURE_LIBRARY;
        const categories = Object.keys(lib);
        let activeCategory = categories[0];

        function renderTabs() {
            tabsContainer.innerHTML = '';
            categories.forEach(key => {
                const cat = lib[key];
                const btn = document.createElement('button');
                btn.className = 'furniture-tab' + (key === activeCategory ? ' active' : '');
                btn.textContent = cat.icon + ' ' + cat.label;
                btn.addEventListener('click', () => {
                    activeCategory = key;
                    renderTabs();
                    renderItems();
                });
                tabsContainer.appendChild(btn);
            });
        }

        function renderItems() {
            itemsContainer.innerHTML = '';
            const items = lib[activeCategory].items;
            items.forEach(item => {
                const btn = document.createElement('button');
                btn.className = 'furniture-item';
                btn.setAttribute('aria-label', item.label + ' (' + item.w + '" x ' + item.h + '")');

                // Preview shape
                const preview = document.createElement('div');
                preview.className = 'furniture-item-preview';
                const shape = document.createElement('div');
                const aspect = item.w / item.h;
                const maxW = 36;
                const maxH = 24;
                let pw, ph;
                if (aspect > maxW / maxH) {
                    pw = maxW;
                    ph = maxW / aspect;
                } else {
                    ph = maxH;
                    pw = maxH * aspect;
                }
                shape.style.width = pw + 'px';
                shape.style.height = ph + 'px';
                if (item.shape === 'circle') {
                    shape.className = 'preview-shape preview-circle';
                } else {
                    shape.className = 'preview-shape preview-rect';
                }
                if (item.style) {
                    shape.classList.add('preview-' + item.style);
                }
                preview.appendChild(shape);

                const label = document.createElement('span');
                label.textContent = item.label;

                btn.appendChild(preview);
                btn.appendChild(label);
                btn.addEventListener('click', () => addFurniture(item));
                itemsContainer.appendChild(btn);
            });
        }

        renderTabs();
        renderItems();
    }

    // =========================================
    // Furniture Placement
    // =========================================
    function getStyleColors(style) {
        if (style === 'room') {
            return {
                fill: 'rgba(255,255,255,0.03)',
                stroke: getComputedVar('--color-wall') || '#ff6b6b',
                strokeWidth: 3
            };
        }
        if (style === 'door') {
            return {
                fill: isDarkTheme() ? '#12122a' : '#e8e9f2',
                stroke: getComputedVar('--color-scale-line') || '#ffd93d',
                strokeWidth: 2
            };
        }
        if (style === 'window') {
            return {
                fill: isDarkTheme() ? 'rgba(100,180,255,0.15)' : 'rgba(100,180,255,0.25)',
                stroke: '#64b4ff',
                strokeWidth: 2
            };
        }
        return {
            fill: getComputedVar('--color-furniture-fill') || 'rgba(100,120,255,0.25)',
            stroke: getComputedVar('--color-furniture-stroke') || 'rgba(100,120,255,0.6)',
            strokeWidth: 1.5
        };
    }

    function buildFurnitureGroup(item, cx, cy) {
        const w = inchesToPx(item.w);
        const h = inchesToPx(item.h);
        const style = item.style || 'furniture';
        const colors = getStyleColors(style);
        const objects = [];

        // Main shape
        if (item.shape === 'circle') {
            const r = Math.min(w, h) / 2;
            objects.push(new fabric.Circle({
                radius: r,
                fill: colors.fill,
                stroke: colors.stroke,
                strokeWidth: colors.strokeWidth,
                originX: 'center',
                originY: 'center',
                left: 0,
                top: 0
            }));
        } else {
            objects.push(new fabric.Rect({
                width: w,
                height: h,
                fill: colors.fill,
                stroke: colors.stroke,
                strokeWidth: colors.strokeWidth,
                rx: style === 'room' ? 0 : 3,
                ry: style === 'room' ? 0 : 3,
                originX: 'center',
                originY: 'center',
                left: 0,
                top: 0
            }));
        }

        // Door swing arc
        if (style === 'door') {
            const arcRadius = w * 0.9;
            const arcPath = 'M 0 0 L ' + arcRadius + ' 0 A ' + arcRadius + ' ' + arcRadius + ' 0 0 1 0 ' + (-arcRadius);
            objects.push(new fabric.Path(arcPath, {
                fill: 'transparent',
                stroke: colors.stroke,
                strokeWidth: 1.5,
                strokeDashArray: [4, 3],
                originX: 'center',
                originY: 'center',
                left: -w / 2,
                top: h / 2,
                selectable: false,
                evented: false
            }));
        }

        // Window cross-hatching (two parallel lines inside)
        if (style === 'window') {
            const lineY = h * 0.15;
            objects.push(new fabric.Line([-w / 2 + 2, -lineY, w / 2 - 2, -lineY], {
                stroke: '#64b4ff', strokeWidth: 1, selectable: false, evented: false
            }));
            objects.push(new fabric.Line([-w / 2 + 2, lineY, w / 2 - 2, lineY], {
                stroke: '#64b4ff', strokeWidth: 1, selectable: false, evented: false
            }));
        }

        // Label text
        const fontSize = style === 'room'
            ? Math.max(10, Math.min(18, Math.min(w, h) * 0.12))
            : Math.max(8, Math.min(14, Math.min(w, h) * 0.3));
        const dimFontSize = Math.max(6, fontSize * 0.75);

        objects.push(new fabric.Text(item.label, {
            fontSize: fontSize,
            fill: '#1a1a2e',
            stroke: '#ffffff',
            strokeWidth: 2.5,
            paintFirst: 'stroke',
            fontFamily: 'Inter, sans-serif',
            fontWeight: '600',
            textAlign: 'center',
            originX: 'center',
            originY: 'center',
            left: 0,
            top: -dimFontSize * 0.6,
            selectable: false,
            evented: false
        }));

        // Dimensions text
        objects.push(new fabric.Text(formatDimensions(item.w, item.h), {
            fontSize: dimFontSize,
            fill: '#1a1a2e',
            stroke: '#ffffff',
            strokeWidth: 2,
            paintFirst: 'stroke',
            fontFamily: 'Inter, sans-serif',
            fontWeight: '500',
            textAlign: 'center',
            originX: 'center',
            originY: 'center',
            left: 0,
            top: fontSize * 0.6,
            selectable: false,
            evented: false,
            data: { isDimLabel: true }
        }));

        const group = new fabric.Group(objects, {
            left: cx - w / 2,
            top: cy - h / 2,
            hasControls: true,
            hasBorders: true,
            cornerColor: getComputedVar('--color-accent') || '#4a5aff',
            cornerSize: 10,
            transparentCorners: false,
            borderColor: getComputedVar('--color-accent') || '#4a5aff',
            cornerStyle: 'circle'
        });

        group.data = {
            type: 'furniture',
            itemId: item.id,
            label: item.label,
            realWidth: item.w,
            realHeight: item.h,
            shape: item.shape || 'rect',
            style: style
        };

        return group;
    }

    function addFurniture(item) {
        const zoom = canvas.getZoom();
        const vpt = canvas.viewportTransform;
        const cx = (-vpt[4] + canvas.getWidth() / 2) / zoom;
        const cy = (-vpt[5] + canvas.getHeight() / 2) / zoom;

        const group = buildFurnitureGroup(item, cx, cy);
        canvas.add(group);

        // Rooms/structure go behind furniture
        if (item.style === 'room') {
            sendRoomToBack(group);
        }

        canvas.setActiveObject(group);
        canvas.requestRenderAll();

        hideDropZone();
        pushUndo();
        scheduleSave();
        announce(item.label + ' placed');
    }

    function sendRoomToBack(group) {
        // Place rooms above grid and floorplan but below all furniture/doors/windows
        canvas.sendToBack(group);
        if (gridLines) canvas.sendToBack(gridLines);
        if (floorplanImage) canvas.sendToBack(floorplanImage);
    }

    function updateFurnitureLabel(obj) {
        if (!obj._objects) return;
        const texts = obj._objects.filter(o => o.type === 'text');
        const nameText = texts.find(o => !o.data || !o.data.isDimLabel);
        const dimText = texts.find(o => o.data && o.data.isDimLabel);
        if (nameText && obj.data) {
            nameText.set('text', obj.data.label);
        }
        if (dimText && obj.data) {
            const wInches = obj.data.realWidth * (obj.scaleX || 1);
            const hInches = obj.data.realHeight * (obj.scaleY || 1);
            dimText.set('text', formatDimensions(wInches, hInches));
        }
        canvas.requestRenderAll();
    }

    function updateAllFurnitureDimensions() {
        canvas.getObjects().forEach(obj => {
            if (obj.data && obj.data.type === 'furniture') {
                updateFurnitureLabel(obj);
            }
        });
    }

    // =========================================
    // Wall Drawing
    // =========================================
    function handleWallClick(opt) {
        const pointer = canvas.getPointer(opt.e);
        const pt = snapEnabled
            ? { x: Math.round(pointer.x / GRID_SIZE) * GRID_SIZE, y: Math.round(pointer.y / GRID_SIZE) * GRID_SIZE }
            : pointer;

        if (opt.e.detail === 2 || (wallDrawingPoints.length > 0 &&
            Math.abs(pt.x - wallDrawingPoints[0].x) < GRID_SIZE &&
            Math.abs(pt.y - wallDrawingPoints[0].y) < GRID_SIZE)) {
            // Double click or close to start: finish wall
            finishWall();
            return;
        }

        wallDrawingPoints.push(pt);

        if (wallDrawingPoints.length >= 2) {
            const p1 = wallDrawingPoints[wallDrawingPoints.length - 2];
            const p2 = wallDrawingPoints[wallDrawingPoints.length - 1];
            const line = new fabric.Line([p1.x, p1.y, p2.x, p2.y], {
                stroke: getComputedVar('--color-wall') || '#ff6b6b',
                strokeWidth: WALL_WIDTH,
                strokeLineCap: 'round',
                selectable: false,
                evented: false,
                data: { type: 'wall' }
            });
            canvas.add(line);
            canvas.requestRenderAll();
        }
    }

    function updateWallPreview(opt) {
        const pointer = canvas.getPointer(opt.e);
        const pt = snapEnabled
            ? { x: Math.round(pointer.x / GRID_SIZE) * GRID_SIZE, y: Math.round(pointer.y / GRID_SIZE) * GRID_SIZE }
            : pointer;

        if (wallPreviewLine) canvas.remove(wallPreviewLine);
        const last = wallDrawingPoints[wallDrawingPoints.length - 1];
        wallPreviewLine = new fabric.Line([last.x, last.y, pt.x, pt.y], {
            stroke: getComputedVar('--color-wall-preview') || 'rgba(255,107,107,0.5)',
            strokeWidth: WALL_WIDTH,
            strokeLineCap: 'round',
            strokeDashArray: [8, 4],
            selectable: false,
            evented: false,
            excludeFromExport: true
        });
        canvas.add(wallPreviewLine);
        canvas.requestRenderAll();
    }

    function finishWall() {
        if (wallPreviewLine) {
            canvas.remove(wallPreviewLine);
            wallPreviewLine = null;
        }
        wallDrawingPoints = [];
        if (canvas.getObjects().some(o => o.data && o.data.type === 'wall')) {
            hideDropZone();
            pushUndo();
            scheduleSave();
        }
    }

    // =========================================
    // Scale Tool
    // =========================================
    function handleScaleClick(opt) {
        const pointer = canvas.getPointer(opt.e);
        const pt = { x: pointer.x, y: pointer.y };
        scalePoints.push(pt);

        if (scalePoints.length === 2) {
            // Remove preview
            if (scaleLine) canvas.remove(scaleLine);
            scaleLine = null;

            // Draw final scale line
            const p1 = scalePoints[0];
            const p2 = scalePoints[1];
            const line = new fabric.Line([p1.x, p1.y, p2.x, p2.y], {
                stroke: getComputedVar('--color-scale-line') || '#ffd93d',
                strokeWidth: SCALE_LINE_WIDTH,
                strokeDashArray: [6, 3],
                selectable: false,
                evented: false,
                data: { type: 'scale-line' },
                excludeFromExport: true
            });
            canvas.add(line);
            canvas.requestRenderAll();

            // Calc pixel distance
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const pixelDist = Math.sqrt(dx * dx + dy * dy);

            // Show scale modal
            openScaleModal(pixelDist);
            scalePoints = [];
        }
    }

    function updateScalePreview(opt) {
        const pointer = canvas.getPointer(opt.e);
        if (scaleLine) canvas.remove(scaleLine);
        const p1 = scalePoints[0];
        scaleLine = new fabric.Line([p1.x, p1.y, pointer.x, pointer.y], {
            stroke: getComputedVar('--color-scale-line') || '#ffd93d',
            strokeWidth: SCALE_LINE_WIDTH,
            strokeDashArray: [6, 3],
            selectable: false,
            evented: false,
            excludeFromExport: true
        });
        canvas.add(scaleLine);
        canvas.requestRenderAll();
    }

    function openScaleModal(pixelDist) {
        const modal = $('scale-modal');
        modal.hidden = false;
        $('scale-distance').value = '';
        $('scale-distance').focus();

        const confirmHandler = function () {
            const dist = parseFloat($('scale-distance').value);
            const scaleUnit = $('scale-unit').value;
            if (!dist || dist <= 0) return;

            // Convert to inches
            const distInches = CONVERSIONS[scaleUnit].toInches(dist);
            pixelsPerInch = pixelDist / distInches;
            scaleCalibrated = true;

            modal.hidden = true;
            setTool('select');
            updateMeasurementDisplay();
            announce('Scale set: ' + dist + ' ' + scaleUnit);
            scheduleSave();

            $('scale-confirm').removeEventListener('click', confirmHandler);
        };

        $('scale-confirm').addEventListener('click', confirmHandler);
    }

    function updateMeasurementDisplay() {
        if (!scaleCalibrated) {
            dimensionsDisplay.textContent = 'Set scale to see measurements';
            areaDot.hidden = true;
            areaDisplay.textContent = '';
            return;
        }
        dimensionsDisplay.textContent = 'Scale: ' + inchesToDisplay(pxToInches(100)) + ' per 100px';
        areaDot.hidden = true;
        areaDisplay.textContent = '';
    }

    // =========================================
    // Tools
    // =========================================
    function initToolbar() {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => setTool(btn.dataset.tool));
        });

        undoBtn.addEventListener('click', undo);
        redoBtn.addEventListener('click', redo);

        snapBtn.addEventListener('click', () => {
            snapEnabled = !snapEnabled;
            snapBtn.classList.toggle('active', snapEnabled);
            announce('Snap ' + (snapEnabled ? 'on' : 'off'));
            scheduleSave();
        });

        gridBtn.addEventListener('click', () => {
            gridVisible = !gridVisible;
            gridBtn.classList.toggle('active', gridVisible);
            drawGrid();
            announce('Grid ' + (gridVisible ? 'on' : 'off'));
            scheduleSave();
        });

        $('clear-btn').addEventListener('click', clearCanvas);
        $('import-btn').addEventListener('click', () => { $('import-modal').hidden = false; });
        $('export-btn').addEventListener('click', openExportModal);
        $('theme-btn').addEventListener('click', toggleTheme);
        $('help-btn').addEventListener('click', () => { $('help-modal').hidden = false; });

        unitSelect.addEventListener('change', function () {
            unit = this.value;
            updateMeasurementDisplay();
            updateProperties();
            updateAllFurnitureDimensions();
            scheduleSave();
        });
    }

    function setTool(tool) {
        // Finish any in-progress wall
        if (currentTool === 'wall' && tool !== 'wall') finishWall();
        // Clear scale state
        if (currentTool === 'scale' && tool !== 'scale') {
            scalePoints = [];
            if (scaleLine) { canvas.remove(scaleLine); scaleLine = null; }
        }

        currentTool = tool;

        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });

        // Update canvas interaction
        canvas.selection = tool === 'select';
        canvas.forEachObject(obj => {
            if (obj.data && (obj.data.type === 'furniture')) {
                obj.selectable = tool === 'select';
                obj.evented = tool === 'select';
            }
        });

        // Update cursor class
        canvasWrapper.classList.remove('tool-wall', 'tool-scale', 'tool-pan');
        if (tool === 'wall') canvasWrapper.classList.add('tool-wall');
        if (tool === 'scale') canvasWrapper.classList.add('tool-scale');
        if (tool === 'pan') canvasWrapper.classList.add('tool-pan');

        canvas.requestRenderAll();
        announce(tool + ' tool');
    }

    // =========================================
    // Image Import
    // =========================================
    function initImport() {
        // File input
        $('import-file').addEventListener('change', function () {
            if (this.files && this.files[0]) {
                loadImageFile(this.files[0]);
                $('import-modal').hidden = true;
            }
        });

        // URL import
        $('import-url-btn').addEventListener('click', function () {
            const url = $('import-url').value.trim();
            if (!url) return;
            loadImageURL(url);
        });

        // Drag & drop on import modal zone
        const importDropZone = $('import-drop-zone');
        importDropZone.addEventListener('dragover', e => {
            e.preventDefault();
            importDropZone.classList.add('drag-over');
        });
        importDropZone.addEventListener('dragleave', () => {
            importDropZone.classList.remove('drag-over');
        });
        importDropZone.addEventListener('drop', e => {
            e.preventDefault();
            importDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                loadImageFile(e.dataTransfer.files[0]);
                $('import-modal').hidden = true;
            }
        });

        // Drag & drop on canvas drop zone
        canvasWrapper.addEventListener('dragover', e => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        canvasWrapper.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });
        canvasWrapper.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                loadImageFile(e.dataTransfer.files[0]);
            }
        });

        // Clipboard paste
        document.addEventListener('paste', function (e) {
            const items = e.clipboardData && e.clipboardData.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image/')) {
                    e.preventDefault();
                    loadImageFile(items[i].getAsFile());
                    $('import-modal').hidden = true;
                    break;
                }
            }
        });
    }

    function loadImageFile(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            setFloorplanImage(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    function loadImageURL(url) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
            // Draw to temp canvas to get data URL
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = img.width;
            tmpCanvas.height = img.height;
            tmpCanvas.getContext('2d').drawImage(img, 0, 0);
            try {
                const dataURL = tmpCanvas.toDataURL('image/png');
                setFloorplanImage(dataURL);
                $('import-modal').hidden = true;
            } catch (err) {
                alert('Could not load that image due to cross-origin restrictions. Try downloading the image first, then upload it here.');
            }
        };
        img.onerror = function () {
            alert('Could not load that image. Check the URL and try again, or download it and upload directly.');
        };
        img.src = url;
    }

    function setFloorplanImage(dataURL) {
        // Resize if too large for localStorage
        const img = new Image();
        img.onload = function () {
            let w = img.width;
            let h = img.height;
            if (w > MAX_IMAGE_DIM || h > MAX_IMAGE_DIM) {
                const scale = MAX_IMAGE_DIM / Math.max(w, h);
                w = Math.round(w * scale);
                h = Math.round(h * scale);
            }
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = w;
            tmpCanvas.height = h;
            tmpCanvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const resizedURL = tmpCanvas.toDataURL('image/jpeg', 0.8);

            // Remove old floorplan
            if (floorplanImage) canvas.remove(floorplanImage);

            fabric.Image.fromURL(resizedURL, function (fImg) {
                fImg.set({
                    selectable: false,
                    evented: false,
                    hasControls: false,
                    hasBorders: false
                });

                // Scale to fit canvas
                const zoom = canvas.getZoom();
                const cw = canvas.getWidth() / zoom;
                const ch = canvas.getHeight() / zoom;
                const scale = Math.min(cw * 0.9 / fImg.width, ch * 0.9 / fImg.height, 1);
                fImg.scale(scale);
                fImg.set({
                    left: (cw - fImg.width * scale) / 2,
                    top: (ch - fImg.height * scale) / 2
                });

                fImg.data = { type: 'floorplan' };
                floorplanImage = fImg;
                canvas.add(fImg);
                canvas.sendToBack(fImg);
                if (gridLines) canvas.sendToBack(gridLines);
                canvas.requestRenderAll();

                hideDropZone();
                pushUndo();
                scheduleSave();
                announce('Floorplan imported');
            });
        };
        img.src = dataURL;
    }

    function hideDropZone() {
        hasContent = true;
        dropZone.classList.add('hidden');
    }

    function showDropZone() {
        hasContent = false;
        dropZone.classList.remove('hidden');
    }

    // =========================================
    // Export
    // =========================================
    function openExportModal() {
        const modal = $('export-modal');

        // Hide grid and deselect
        canvas.discardActiveObject();
        const wasGridVisible = gridVisible;
        if (gridLines) canvas.remove(gridLines);

        // Remove non-export objects
        const hidden = [];
        canvas.getObjects().forEach(obj => {
            if (obj.excludeFromExport) {
                obj.visible = false;
                hidden.push(obj);
            }
        });

        canvas.requestRenderAll();

        const dataURL = canvas.toDataURL({
            format: 'png',
            multiplier: 2
        });

        // Restore
        hidden.forEach(obj => { obj.visible = true; });
        if (wasGridVisible) drawGrid();
        canvas.requestRenderAll();

        // Show preview
        const preview = $('export-preview');
        preview.innerHTML = '';
        const previewImg = document.createElement('img');
        previewImg.src = dataURL;
        preview.appendChild(previewImg);

        modal.hidden = false;

        $('export-confirm').onclick = function () {
            const filename = ($('export-filename').value || 'snaplayout-export') + '.png';
            const a = document.createElement('a');
            a.href = dataURL;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            modal.hidden = true;
            announce('Layout exported as ' + filename);
        };
    }

    // =========================================
    // Undo / Redo
    // =========================================
    function pushUndo() {
        const json = canvas.toJSON(['data', 'excludeFromExport']);
        undoStack.push(JSON.stringify(json));
        if (undoStack.length > MAX_UNDO) undoStack.shift();
        redoStack = [];
        updateUndoButtons();
    }

    function undo() {
        if (undoStack.length < 2) return;
        redoStack.push(undoStack.pop());
        const state = undoStack[undoStack.length - 1];
        loadCanvasState(state);
        updateUndoButtons();
        scheduleSave();
    }

    function redo() {
        if (redoStack.length === 0) return;
        const state = redoStack.pop();
        undoStack.push(state);
        loadCanvasState(state);
        updateUndoButtons();
        scheduleSave();
    }

    function loadCanvasState(jsonStr) {
        const json = JSON.parse(jsonStr);
        canvas.loadFromJSON(json, function () {
            // Restore references
            floorplanImage = null;
            canvas.getObjects().forEach(obj => {
                if (obj.data && obj.data.type === 'floorplan') {
                    floorplanImage = obj;
                    obj.selectable = false;
                    obj.evented = false;
                }
                if (obj.data && obj.data.type === 'wall') {
                    obj.selectable = false;
                    obj.evented = false;
                }
            });
            hasContent = canvas.getObjects().some(o => o.data && (o.data.type === 'furniture' || o.data.type === 'floorplan' || o.data.type === 'wall'));
            if (hasContent) hideDropZone(); else showDropZone();
            drawGrid();
            canvas.requestRenderAll();
        });
    }

    function updateUndoButtons() {
        undoBtn.disabled = undoStack.length < 2;
        redoBtn.disabled = redoStack.length === 0;
    }

    // =========================================
    // Delete / Duplicate
    // =========================================
    function deleteSelected() {
        const active = canvas.getActiveObject();
        if (!active) return;

        if (active.type === 'activeSelection') {
            active.forEachObject(obj => canvas.remove(obj));
            canvas.discardActiveObject();
        } else {
            canvas.remove(active);
        }

        canvas.requestRenderAll();
        hideProperties();
        pushUndo();
        scheduleSave();
        announce('Deleted');

        // Check if canvas is empty
        const remaining = canvas.getObjects().filter(o => o.data && (o.data.type === 'furniture' || o.data.type === 'floorplan' || o.data.type === 'wall'));
        if (remaining.length === 0) showDropZone();
    }

    function duplicateSelected() {
        const active = canvas.getActiveObject();
        if (!active) return;

        active.clone(function (cloned) {
            cloned.set({
                left: cloned.left + 20,
                top: cloned.top + 20
            });
            if (active.data) cloned.data = JSON.parse(JSON.stringify(active.data));
            canvas.add(cloned);
            canvas.setActiveObject(cloned);
            canvas.requestRenderAll();
            pushUndo();
            scheduleSave();
            announce('Duplicated');
        }, ['data']);
    }

    function clearCanvas() {
        $('confirm-modal').hidden = false;
    }

    function doClearCanvas() {
        canvas.clear();
        floorplanImage = null;
        updateCanvasBg();
        drawGrid();
        showDropZone();
        undoStack = [];
        redoStack = [];
        updateUndoButtons();
        scaleCalibrated = false;
        pixelsPerInch = DEFAULT_PPI;
        updateMeasurementDisplay();
        scheduleSave();
        announce('Canvas cleared');
    }

    // =========================================
    // Persistence (localStorage)
    // =========================================
    function scheduleSave() {
        if (savePending) return;
        savePending = true;
        setTimeout(() => {
            savePending = false;
            saveState();
        }, 1000);
    }

    function saveState() {
        try {
            const data = {
                version: SAVE_VERSION,
                canvas: canvas.toJSON(['data', 'excludeFromExport']),
                pixelsPerInch: pixelsPerInch,
                scaleCalibrated: scaleCalibrated,
                unit: unit,
                snapEnabled: snapEnabled,
                gridVisible: gridVisible,
                zoom: canvas.getZoom(),
                panX: canvas.viewportTransform[4],
                panY: canvas.viewportTransform[5]
            };
            localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        } catch (e) {
            // localStorage full — try without canvas image data
            console.warn('Save failed:', e);
        }
    }

    function loadState() {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;

        try {
            const data = JSON.parse(raw);
            if (data.version !== SAVE_VERSION) {
                localStorage.removeItem(SAVE_KEY);
                return false;
            }

            // Restore settings
            pixelsPerInch = data.pixelsPerInch || DEFAULT_PPI;
            scaleCalibrated = data.scaleCalibrated || false;
            unit = data.unit || 'ft';
            snapEnabled = data.snapEnabled !== false;
            gridVisible = data.gridVisible !== false;

            unitSelect.value = unit;
            snapBtn.classList.toggle('active', snapEnabled);
            gridBtn.classList.toggle('active', gridVisible);
            updateMeasurementDisplay();

            // Restore canvas
            canvas.loadFromJSON(data.canvas, function () {
                // Restore references
                floorplanImage = null;
                canvas.getObjects().forEach(obj => {
                    if (obj.data && obj.data.type === 'floorplan') {
                        floorplanImage = obj;
                        obj.selectable = false;
                        obj.evented = false;
                    }
                    if (obj.data && obj.data.type === 'wall') {
                        obj.selectable = false;
                        obj.evented = false;
                    }
                });

                // Restore zoom/pan
                if (data.zoom) {
                    canvas.setZoom(data.zoom);
                    canvas.viewportTransform[4] = data.panX || 0;
                    canvas.viewportTransform[5] = data.panY || 0;
                }

                hasContent = canvas.getObjects().some(o => o.data && (o.data.type === 'furniture' || o.data.type === 'floorplan' || o.data.type === 'wall'));
                if (hasContent) hideDropZone(); else showDropZone();

                drawGrid();
                canvas.requestRenderAll();

                // Initialize undo with loaded state
                pushUndo();
            });

            return true;
        } catch (e) {
            console.warn('Load failed:', e);
            return false;
        }
    }

    // =========================================
    // Keyboard Shortcuts
    // =========================================
    function initKeyboard() {
        document.addEventListener('keydown', function (e) {
            // Don't intercept when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

            const key = e.key.toLowerCase();

            if (key === 'v') { setTool('select'); return; }
            if (key === 'h') { setTool('pan'); return; }
            if (key === 'w') { setTool('wall'); return; }
            if (key === 'r') { setTool('scale'); return; }
            if (key === 'g') { gridBtn.click(); return; }
            if (key === 's' && !e.ctrlKey && !e.metaKey) { snapBtn.click(); return; }

            if (key === 'delete' || key === 'backspace') {
                e.preventDefault();
                deleteSelected();
                return;
            }

            if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
                return;
            }

            if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
                e.preventDefault();
                redo();
                return;
            }

            if ((e.ctrlKey || e.metaKey) && key === 'd') {
                e.preventDefault();
                duplicateSelected();
                return;
            }

            if ((e.ctrlKey || e.metaKey) && key === 's') {
                e.preventDefault();
                saveState();
                return;
            }

            if (key === 'escape') {
                canvas.discardActiveObject();
                canvas.requestRenderAll();
                hideProperties();
                // Close modals
                document.querySelectorAll('.modal-overlay').forEach(m => { m.hidden = true; });
                // Finish wall/scale
                if (currentTool === 'wall') finishWall();
                if (currentTool === 'scale') {
                    scalePoints = [];
                    if (scaleLine) { canvas.remove(scaleLine); scaleLine = null; }
                }
                return;
            }

            // Arrow nudge
            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
                const active = canvas.getActiveObject();
                if (!active) return;
                e.preventDefault();
                const step = e.shiftKey ? GRID_SIZE * 4 : GRID_SIZE;
                if (key === 'arrowup') active.top -= step;
                if (key === 'arrowdown') active.top += step;
                if (key === 'arrowleft') active.left -= step;
                if (key === 'arrowright') active.left += step;
                active.setCoords();
                canvas.requestRenderAll();
                pushUndo();
                scheduleSave();
            }
        });
    }

    // =========================================
    // Modals
    // =========================================
    function initModals() {
        // Close on overlay click or close button
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', function (e) {
                if (e.target === modal) modal.hidden = true;
            });
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => { modal.hidden = true; });
            }
        });

        // Intro modal
        if (!localStorage.getItem(INTRO_KEY)) {
            $('intro-modal').hidden = false;
            $('intro-dismiss').addEventListener('click', function () {
                $('intro-modal').hidden = true;
                localStorage.setItem(INTRO_KEY, '1');
            });
        }

        // Confirm clear modal
        $('confirm-clear').addEventListener('click', function () {
            $('confirm-modal').hidden = true;
            doClearCanvas();
        });
        $('confirm-cancel').addEventListener('click', function () {
            $('confirm-modal').hidden = true;
        });
    }

    // =========================================
    // Initialization
    // =========================================
    // =========================================
    // Example Layout
    // =========================================
    function loadExampleLayout() {
        const lib = window.FURNITURE_LIBRARY;
        const find = (cat, id) => lib[cat].items.find(i => i.id === id);

        // Canvas center
        const zoom = canvas.getZoom();
        const vpt = canvas.viewportTransform;
        const cw = canvas.getWidth() / zoom;
        const ch = canvas.getHeight() / zoom;
        const ox = cw / 2 - inchesToPx(84);  // offset to center the room
        const oy = ch / 2 - inchesToPx(72);

        const placements = [
            // Room outline
            { item: find('structure', 'room-bedroom'), x: ox, y: oy },
            // Queen bed centered on back wall
            { item: find('bedroom', 'queen-bed'), x: ox + inchesToPx(54), y: oy + inchesToPx(8) },
            // Nightstands flanking bed
            { item: find('bedroom', 'nightstand'), x: ox + inchesToPx(16), y: oy + inchesToPx(16) },
            { item: find('bedroom', 'nightstand'), x: ox + inchesToPx(128), y: oy + inchesToPx(16) },
            // Dresser on opposite wall
            { item: find('bedroom', 'dresser'), x: ox + inchesToPx(54), y: oy + inchesToPx(112) },
            // Door on the right wall
            { item: find('structure', 'door-standard'), x: ox + inchesToPx(140), y: oy + inchesToPx(100) },
        ];

        placements.forEach(p => {
            if (!p.item) return;
            const w = inchesToPx(p.item.w);
            const h = inchesToPx(p.item.h);
            const group = buildFurnitureGroup(p.item, p.x + w / 2, p.y + h / 2);
            canvas.add(group);
            if (p.item.style === 'room') {
                sendRoomToBack(group);
            }
        });

        hideDropZone();
        canvas.requestRenderAll();
    }

    function init() {
        initTheme();
        initCanvas();
        initToolbar();
        initFurnitureBar();
        initPropertiesPanel();
        initImport();
        initModals();
        initTouchHandlers();
        initKeyboard();

        // Try loading saved state
        const loaded = loadState();
        if (!loaded) {
            loadExampleLayout();
            pushUndo();
        }

        updateMeasurementDisplay();
    }

    // Wait for Fabric.js to load
    function waitForFabric() {
        if (typeof fabric !== 'undefined') {
            init();
        } else {
            setTimeout(waitForFabric, 50);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForFabric);
    } else {
        waitForFabric();
    }

})();
