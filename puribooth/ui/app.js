(() => {
    const app = document.getElementById('app')
    const themeSetup = document.getElementById('themeSetup')
    const themeStatus = document.getElementById('themeStatus')
    const backgroundUrl = document.getElementById('backgroundUrl')
    const floorUrl = document.getElementById('floorUrl')
    const backgroundPreview = document.getElementById('backgroundPreview')
    const floorPreview = document.getElementById('floorPreview')
    const canvas = document.getElementById('canvas')
    const ctx = canvas.getContext('2d')
    const beautyBuffer = document.createElement('canvas')
    beautyBuffer.width = canvas.width
    beautyBuffer.height = canvas.height
    const beautyBufferCtx = beautyBuffer.getContext('2d')

    // Photo/beauty/frame rendering is expensive. Cache that static layer so
    // decoration dragging and erasing only redraw the lightweight overlay.
    const baseLayer = document.createElement('canvas')
    baseLayer.width = canvas.width
    baseLayer.height = canvas.height
    const baseLayerCtx = baseLayer.getContext('2d')
    let baseLayerValid = false
    const boothLabel = document.getElementById('boothLabel')
    const shotCount = document.getElementById('shotCount')
    const canvasHint = document.getElementById('canvasHint')
    const toolStatus = document.getElementById('toolStatus')
    const shootHudMain = document.getElementById('shootHudMain')
    const shootHudSecondary = document.getElementById('shootHudSecondary')
    const shootHudCountdown = document.getElementById('shootHudCountdown')
    const shootSafeFrame = document.getElementById('shootSafeFrame')
    const shootHudTimers = {
        main: null,
        secondary: null,
        countdown: null
    }

    const showShootHudLine = (slot, text) => {
        const element =
            slot === 'countdown'
                ? shootHudCountdown
                : slot === 'secondary'
                    ? shootHudSecondary
                    : shootHudMain

        if (!element) return

        const key =
            slot === 'countdown'
                ? 'countdown'
                : slot === 'secondary'
                    ? 'secondary'
                    : 'main'

        element.textContent = String(text || '')
        element.classList.toggle('visible', Boolean(text))

        if (shootHudTimers[key]) {
            clearTimeout(shootHudTimers[key])
        }

        shootHudTimers[key] = setTimeout(() => {
            element.classList.remove('visible')
            element.textContent = ''
            shootHudTimers[key] = null
        }, 170)
    }

    const state = {
        boothId: null,
        shots: [],
        images: [],
        layout: 'grid',
        singleShot: 0,
        frame: 'pink',
        brightness: 112,
        contrast: 102,
        saturation: 112,
        softness: 0.5,
        warmth: 8,
        glow: 8,
        skinSmooth: 5,
        whiten: 5,
        rosy: 4,
        previewOriginal: false,
        previewFaceOriginal: false,
        activeTab: 'layout',
        exporting: false,
        faceEditShot: 0,
        faceSlot: 0,
        faceTargets: Array.from(
            { length: 4 },
            () => Array.from(
                { length: 6 },
                () => ({
                    enabled: false,
                    x: 50,
                    y: 30,
                    size: 22,
                    eye: 0,
                    slim: 0,
                    bright: 0,
                    rosy: 0
                })
            )
        ),
        stickers: [],
        texts: [],
        strokes: [],
        armedStamp: null,
        armedText: false,
        textStyle: 'puri',
        textFont: 'heisei',
        repeatStamp: false,
        drawing: false,
        drawEnabled: false,
        drawStyle: 'pen',
        activeStroke: null,
        history: [],
        future: [],
        selectedDecoration: null,
        draggingDecoration: false,
        dragHistoryCaptured: false,
        dragOffset: { x: 0, y: 0 },
        photoEditShot: 0,
        photoTransforms: Array.from({ length: 4 }, () => ({
            zoom: 1,
            panX: 0,
            panY: 0
        })),
        theme: {
            backgroundPreset: 'pink',
            floorPreset: 'pink'
        }
    }

    const parentResource = () => typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'puribooth'

    const post = async (name, data = {}) => {
        const response = await fetch(`https://${parentResource()}/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(data)
        })
        return response.json()
    }

    const safeHttpUrl = value => {
        const text = String(value || '').trim()
        if (!text) return ''
        try {
            const parsed = new URL(text)
            return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null
        } catch {
            return null
        }
    }

    const applyThemePreview = (target, preset, rawUrl) => {
        const safe = safeHttpUrl(rawUrl)
        target.className = `theme-mini-preview ${preset || 'pink'}`
        target.style.backgroundImage = ''
        if (safe) {
            target.style.backgroundImage = `url("${safe.replace(/"/g, '%22')}")`
            target.className = 'theme-mini-preview custom'
        }
    }

    const themeLabel = value => ({
        pink: 'ピンク',
        white: 'ホワイト',
        y2k: 'Y2K',
        black: 'ブラック',
        hearts: 'ハート',
        mint: 'ミント',
        lavender: 'ラベンダー',
        sky: 'スカイ',
        none: 'なし'
    })[String(value || '').toLowerCase()] || String(value || '')

    const refreshThemeStatus = () => {
        const bgUrl = safeHttpUrl(backgroundUrl.value)
        const floorImageUrl = safeHttpUrl(floorUrl.value)

        if (bgUrl === null || floorImageUrl === null) {
            themeStatus.textContent = 'URLは http:// または https:// の画像アドレスだけ使用できます'
            themeStatus.classList.add('error')
            return false
        }

        themeStatus.classList.remove('error')
        themeStatus.textContent =
            `背景：${bgUrl ? '画像URL' : themeLabel(state.theme.backgroundPreset)} / 床：${floorImageUrl ? '画像URL' : themeLabel(state.theme.floorPreset)}`

        applyThemePreview(backgroundPreview, state.theme.backgroundPreset, backgroundUrl.value)
        applyThemePreview(floorPreview, state.theme.floorPreset, floorUrl.value)
        return true
    }

    const resetThemeSetup = () => {
        state.theme.backgroundPreset = 'pink'
        state.theme.floorPreset = 'pink'
        backgroundUrl.value = ''
        floorUrl.value = ''

        document.querySelectorAll('[data-theme-target]').forEach(group => {
            group.querySelectorAll('[data-theme-value]').forEach(button => {
                button.classList.toggle('active', button.dataset.themeValue === 'pink')
            })
        })

        refreshThemeStatus()
    }

    const drawThemePreset = (ctx2d, preset, width, height) => {
        const name = String(preset || 'pink').toLowerCase()

        if (name === 'none') {
            ctx2d.clearRect(0, 0, width, height)
            return
        }

        if (name === 'white') {
            const gradient = ctx2d.createLinearGradient(0, 0, width, height)
            gradient.addColorStop(0, '#ffffff')
            gradient.addColorStop(1, '#eee9f0')
            ctx2d.fillStyle = gradient
            ctx2d.fillRect(0, 0, width, height)
            return
        }

        if (name === 'black') {
            const gradient = ctx2d.createRadialGradient(
                width * .5, height * .2, 20,
                width * .5, height * .5, width * .8
            )
            gradient.addColorStop(0, '#4b2440')
            gradient.addColorStop(.45, '#21151f')
            gradient.addColorStop(1, '#0f0d11')
            ctx2d.fillStyle = gradient
            ctx2d.fillRect(0, 0, width, height)
            return
        }

        if (name === 'y2k') {
            const gradient = ctx2d.createLinearGradient(0, 0, width, height)
            gradient.addColorStop(0, '#ff73c6')
            gradient.addColorStop(.34, '#79e8ff')
            gradient.addColorStop(.67, '#b79aff')
            gradient.addColorStop(1, '#fff37c')
            ctx2d.fillStyle = gradient
            ctx2d.fillRect(0, 0, width, height)

            ctx2d.fillStyle = 'rgba(255,255,255,.88)'
            for (let i = 0; i < 28; i++) {
                const x = ((i * 197) % width)
                const y = ((i * 313) % height)
                const radius = 3 + (i % 4) * 2
                ctx2d.beginPath()
                ctx2d.arc(x, y, radius, 0, Math.PI * 2)
                ctx2d.fill()
            }
            return
        }

        if (name === 'mint') {
            const gradient = ctx2d.createLinearGradient(0, 0, width, height)
            gradient.addColorStop(0, '#d8fff1')
            gradient.addColorStop(.5, '#98e9d1')
            gradient.addColorStop(1, '#d8f7ff')
            ctx2d.fillStyle = gradient
            ctx2d.fillRect(0, 0, width, height)
            return
        }

        if (name === 'lavender') {
            const gradient = ctx2d.createLinearGradient(0, 0, width, height)
            gradient.addColorStop(0, '#f1ddff')
            gradient.addColorStop(.48, '#c8b1ff')
            gradient.addColorStop(1, '#ffdff5')
            ctx2d.fillStyle = gradient
            ctx2d.fillRect(0, 0, width, height)
            return
        }

        if (name === 'sky') {
            const gradient = ctx2d.createLinearGradient(0, 0, width, height)
            gradient.addColorStop(0, '#dff7ff')
            gradient.addColorStop(.52, '#9bdcff')
            gradient.addColorStop(1, '#f8fbff')
            ctx2d.fillStyle = gradient
            ctx2d.fillRect(0, 0, width, height)

            ctx2d.fillStyle = 'rgba(255,255,255,.82)'
            for (const [x, y, rx, ry] of [
                [.18,.22,.10,.035],
                [.48,.65,.12,.04],
                [.78,.30,.09,.03]
            ]) {
                ctx2d.beginPath()
                ctx2d.ellipse(
                    width * x,
                    height * y,
                    width * rx,
                    height * ry,
                    0,
                    0,
                    Math.PI * 2
                )
                ctx2d.fill()
            }
            return
        }

        if (name === 'hearts') {
            ctx2d.fillStyle = '#ffd7ea'
            ctx2d.fillRect(0, 0, width, height)
            ctx2d.fillStyle = '#ff69aa'
            ctx2d.font = '72px sans-serif'
            ctx2d.textAlign = 'center'
            ctx2d.textBaseline = 'middle'
            for (let y = 70; y < height; y += 160) {
                for (let x = 70; x < width; x += 160) {
                    ctx2d.fillText('♥', x + ((y / 160) % 2) * 50, y)
                }
            }
            return
        }

        const gradient = ctx2d.createLinearGradient(0, 0, width, height)
        gradient.addColorStop(0, '#ffd3e9')
        gradient.addColorStop(.48, '#ff9dcc')
        gradient.addColorStop(1, '#f7d6ff')
        ctx2d.fillStyle = gradient
        ctx2d.fillRect(0, 0, width, height)

        ctx2d.fillStyle = 'rgba(255,255,255,.88)'
        for (const [x, y, r] of [
            [.18, .22, 24], [.76, .68, 18], [.53, .38, 12], [.34, .82, 14]
        ]) {
            ctx2d.beginPath()
            ctx2d.arc(width * x, height * y, r, 0, Math.PI * 2)
            ctx2d.fill()
        }
    }

    const renderThemeSurface = async (preset, rawUrl, kind) => {
        const safe = safeHttpUrl(rawUrl)
        if (safe === null) throw new Error('invalid_url')

        if (!safe && String(preset || '').toLowerCase() === 'none') {
            return { enabled: false, image: '' }
        }

        const surfaceCanvas = document.createElement('canvas')
        const isFloor = kind === 'floor'
        surfaceCanvas.width = 1280
        surfaceCanvas.height = isFloor ? 640 : 720
        const surfaceCtx = surfaceCanvas.getContext('2d')
        const targetWidth = surfaceCanvas.width
        const targetHeight = surfaceCanvas.height

        if (safe) {
            const image = await loadImage(safe)
            const srcRatio = image.width / image.height
            const dstRatio = targetWidth / targetHeight
            let sx = 0, sy = 0, sw = image.width, sh = image.height

            if (srcRatio > dstRatio) {
                sw = image.height * dstRatio
                sx = (image.width - sw) / 2
            } else {
                sh = image.width / dstRatio
                sy = (image.height - sh) / 2
            }

            surfaceCtx.drawImage(
                image,
                sx, sy, sw, sh,
                0, 0, targetWidth, targetHeight
            )
        } else {
            drawThemePreset(
                surfaceCtx,
                preset,
                targetWidth,
                targetHeight
            )
        }

        try {
            return {
                enabled: true,
                image: surfaceCanvas.toDataURL('image/jpeg', .9)
            }
        } catch {
            throw new Error('image_host_blocks_conversion')
        }
    }

    const loadImage = (src) => new Promise((resolve, reject) => {
        const image = new Image()
        image.crossOrigin = 'anonymous'
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('image_load_failed'))
        image.src = src
    })

    const getCoverGeometry = (image, x, y, w, h, transform = null) => {
        const srcRatio = image.width / image.height
        const dstRatio = w / h
        let baseW = image.width
        let baseH = image.height

        if (srcRatio > dstRatio) {
            baseW = image.height * dstRatio
        } else {
            baseH = image.width / dstRatio
        }

        const zoom = Math.max(
            1,
            Math.min(2.4, Number(transform?.zoom) || 1)
        )
        const cropW = baseW / zoom
        const cropH = baseH / zoom
        const panX = Math.max(-1, Math.min(1, Number(transform?.panX) || 0))
        const panY = Math.max(-1, Math.min(1, Number(transform?.panY) || 0))

        const minCenterX = cropW / 2
        const maxCenterX = image.width - cropW / 2
        const minCenterY = cropH / 2
        const maxCenterY = image.height - cropH / 2
        const centerX =
            image.width / 2
            + panX * Math.max(0, (maxCenterX - minCenterX) / 2)
        const centerY =
            image.height / 2
            + panY * Math.max(0, (maxCenterY - minCenterY) / 2)

        const sx = Math.max(
            0,
            Math.min(image.width - cropW, centerX - cropW / 2)
        )
        const sy = Math.max(
            0,
            Math.min(image.height - cropH, centerY - cropH / 2)
        )

        return { x, y, w, h, sx, sy, cropW, cropH }
    }

    const faceBuffer = document.createElement('canvas')
    const faceBufferCtx = faceBuffer.getContext('2d')

    const mapFaceTargetToCanvas = (image, target, geometry) => {
        const sourceX = image.width * (Number(target.x) || 0) / 100
        const sourceY = image.height * (Number(target.y) || 0) / 100

        if (
            sourceX < geometry.sx
            || sourceX > geometry.sx + geometry.cropW
            || sourceY < geometry.sy
            || sourceY > geometry.sy + geometry.cropH
        ) return null

        const x =
            geometry.x
            + (sourceX - geometry.sx) / geometry.cropW * geometry.w
        const y =
            geometry.y
            + (sourceY - geometry.sy) / geometry.cropH * geometry.h
        const faceH =
            Math.max(
                18,
                image.height
                * Math.max(8, Math.min(45, Number(target.size) || 22))
                / 100
                / geometry.cropH
                * geometry.h
            )
        const faceW = faceH * .78

        return { x, y, faceW, faceH }
    }

    const applyOneFaceBeauty = (image, target, geometry) => {
        if (!target?.enabled) return

        const mapped = mapFaceTargetToCanvas(image, target, geometry)
        if (!mapped || mapped.faceH < 18) return

        const { x: cx, y: cy, faceW, faceH } = mapped

        ctx.save()
        ctx.beginPath()
        ctx.rect(
            geometry.x,
            geometry.y,
            geometry.w,
            geometry.h
        )
        ctx.clip()

        const regionW = Math.max(32, faceW * 1.65)
        const regionH = Math.max(36, faceH * 1.55)
        const rx = cx - regionW / 2
        const ry = cy - regionH * .48

        faceBuffer.width = Math.max(1, Math.ceil(regionW))
        faceBuffer.height = Math.max(1, Math.ceil(regionH))
        faceBufferCtx.clearRect(0, 0, faceBuffer.width, faceBuffer.height)
        faceBufferCtx.drawImage(
            canvas,
            rx, ry, regionW, regionH,
            0, 0, faceBuffer.width, faceBuffer.height
        )

        const slim = Math.max(0, Math.min(45, Number(target.slim) || 0))
        if (slim > 0) {
            const scaleX = 1 - (slim / 45) * .22
            ctx.save()
            ctx.filter = 'none'
            ctx.beginPath()
            ctx.ellipse(
                cx,
                cy + faceH * .05,
                faceW * .56,
                faceH * .60,
                0,
                0,
                Math.PI * 2
            )
            ctx.clip()
            ctx.globalAlpha = .94
            ctx.drawImage(
                faceBuffer,
                0, 0, faceBuffer.width, faceBuffer.height,
                rx + regionW * (1 - scaleX) / 2,
                ry,
                regionW * scaleX,
                regionH
            )
            ctx.restore()

            faceBufferCtx.clearRect(0, 0, faceBuffer.width, faceBuffer.height)
            faceBufferCtx.drawImage(
                canvas,
                rx, ry, regionW, regionH,
                0, 0, faceBuffer.width, faceBuffer.height
            )
        }

        const eye = Math.max(0, Math.min(60, Number(target.eye) || 0))
        if (eye > 0) {
            const factor = 1 + (eye / 60) * .52
            const eyeY = cy - faceH * .13
            const eyeOffset = faceW * .22
            const eyeW = Math.max(8, faceW * .29)
            const eyeH = Math.max(6, faceH * .17)
            const bufferScaleX = faceBuffer.width / regionW
            const bufferScaleY = faceBuffer.height / regionH

            ;[-1, 1].forEach(side => {
                const eyeX = cx + side * eyeOffset
                const localX = (eyeX - rx) * bufferScaleX
                const localY = (eyeY - ry) * bufferScaleY
                const srcW = eyeW / factor * bufferScaleX
                const srcH = eyeH / factor * bufferScaleY

                ctx.save()
                ctx.filter = 'none'
                ctx.beginPath()
                ctx.ellipse(
                    eyeX,
                    eyeY,
                    eyeW * .56,
                    eyeH * .62,
                    0,
                    0,
                    Math.PI * 2
                )
                ctx.clip()
                ctx.drawImage(
                    faceBuffer,
                    localX - srcW / 2,
                    localY - srcH / 2,
                    srcW,
                    srcH,
                    eyeX - eyeW / 2,
                    eyeY - eyeH / 2,
                    eyeW,
                    eyeH
                )
                ctx.restore()
            })
        }

        const bright = Math.max(0, Math.min(40, Number(target.bright) || 0))
        if (bright > 0) {
            ctx.save()
            ctx.filter = 'none'
            ctx.globalCompositeOperation = 'screen'
            ctx.globalAlpha = (bright / 40) * .34
            ctx.fillStyle = '#fff7f3'
            ctx.beginPath()
            ctx.ellipse(
                cx,
                cy,
                faceW * .58,
                faceH * .62,
                0,
                0,
                Math.PI * 2
            )
            ctx.fill()
            ctx.restore()
        }

        const rosy = Math.max(0, Math.min(40, Number(target.rosy) || 0))
        if (rosy > 0) {
            const alpha = (rosy / 40) * .42
            ;[-1, 1].forEach(side => {
                const cheekX = cx + side * faceW * .24
                const cheekY = cy + faceH * .13
                const radius = Math.max(7, faceW * .22)
                const gradient = ctx.createRadialGradient(
                    cheekX, cheekY, 0,
                    cheekX, cheekY, radius
                )
                gradient.addColorStop(0, `rgba(255,88,130,${alpha})`)
                gradient.addColorStop(1, 'rgba(255,88,130,0)')
                ctx.save()
                ctx.filter = 'none'
                ctx.globalCompositeOperation = 'screen'
                ctx.fillStyle = gradient
                ctx.fillRect(
                    cheekX - radius,
                    cheekY - radius,
                    radius * 2,
                    radius * 2
                )
                ctx.restore()
            })
        }

        ctx.restore()
    }

    const applyFaceBeautyForShot = (image, shotIndex, geometry) => {
        const targets = state.faceTargets[shotIndex]
        if (!Array.isArray(targets)) return
        targets.forEach(target => applyOneFaceBeauty(image, target, geometry))
    }

    const drawCover = (
        image,
        x,
        y,
        w,
        h,
        transform = null,
        shotIndex = null
    ) => {
        const geometry = getCoverGeometry(image, x, y, w, h, transform)

        ctx.drawImage(
            image,
            geometry.sx,
            geometry.sy,
            geometry.cropW,
            geometry.cropH,
            x, y, w, h
        )

        if (
            shotIndex !== null
            && !state.previewOriginal
            && !state.previewFaceOriginal
            && Array.isArray(state.faceTargets[shotIndex])
        ) {
            applyFaceBeautyForShot(image, shotIndex, geometry)
        }

        return geometry
    }

    const getLayoutCells = () => {
        if (state.layout === 'grid') {
            return [
                { shot: 0, x: 0, y: 0, w: 600, h: 450 },
                { shot: 1, x: 600, y: 0, w: 600, h: 450 },
                { shot: 2, x: 0, y: 450, w: 600, h: 450 },
                { shot: 3, x: 600, y: 450, w: 600, h: 450 }
            ]
        }

        if (state.layout === 'strip') {
            return [0, 1, 2, 3].map(shot => ({
                shot,
                x: shot * 300,
                y: 0,
                w: 300,
                h: 900
            }))
        }

        if (state.layout === 'hero') {
            return [
                { shot: 0, x: 0, y: 0, w: 800, h: 900 },
                { shot: 1, x: 800, y: 0, w: 400, h: 300 },
                { shot: 2, x: 800, y: 300, w: 400, h: 300 },
                { shot: 3, x: 800, y: 600, w: 400, h: 300 }
            ]
        }

        const shot =
            state.images[state.singleShot]
                ? state.singleShot
                : 0

        return [{ shot, x: 0, y: 0, w: 1200, h: 900 }]
    }

    const drawFaceGuide = () => {
        if (
            state.activeTab !== 'face'
            || state.exporting
            || state.previewOriginal
        ) return

        const shotIndex = Math.max(
            0,
            Math.min(3, Number(state.faceEditShot) || 0)
        )
        const target =
            state.faceTargets[shotIndex]?.[state.faceSlot]
        const image = state.images[shotIndex]
        const cell =
            getLayoutCells().find(item => item.shot === shotIndex)

        if (!target?.enabled || !image || !cell) return

        const geometry = getCoverGeometry(
            image,
            cell.x, cell.y, cell.w, cell.h,
            state.photoTransforms[shotIndex]
        )
        const mapped = mapFaceTargetToCanvas(image, target, geometry)
        if (!mapped) return

        ctx.save()
        ctx.filter = 'none'
        ctx.setLineDash([10, 7])
        ctx.lineWidth = 4
        ctx.strokeStyle = '#67f2bd'
        ctx.shadowColor = '#000'
        ctx.shadowBlur = 5
        ctx.beginPath()
        ctx.ellipse(
            mapped.x,
            mapped.y,
            mapped.faceW * .52,
            mapped.faceH * .58,
            0,
            0,
            Math.PI * 2
        )
        ctx.stroke()

        ctx.setLineDash([])
        ctx.fillStyle = 'rgba(22,18,24,.82)'
        ctx.font = '700 24px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const label = `顔${state.faceSlot + 1}`
        ctx.fillText(
            label,
            mapped.x,
            mapped.y - mapped.faceH * .72
        )
        ctx.restore()
    }

    const photoFilter = () =>
        `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%) blur(${state.softness}px)`

    const cloneDecorations = () => ({
        stickers: state.stickers.map(item => ({ ...item })),
        texts: state.texts.map(item => ({ ...item })),
        strokes: state.strokes.map(stroke => ({
            ...stroke,
            points: stroke.points.map(point => ({ ...point }))
        }))
    })

    const updateHistoryButtons = () => {
        const undo = document.getElementById('undoButton')
        const redo = document.getElementById('redoButton')
        const rotateLeft = document.getElementById('rotateLeftButton')
        const shrink = document.getElementById('shrinkSelectedButton')
        const grow = document.getElementById('growSelectedButton')
        const rotateRight = document.getElementById('rotateRightButton')
        const sendBackward = document.getElementById('sendBackwardButton')
        const bringForward = document.getElementById('bringForwardButton')
        const duplicate = document.getElementById('duplicateSelectedButton')
        const del = document.getElementById('deleteSelectedButton')
        const hasSelection = Boolean(state.selectedDecoration)

        if (undo) undo.disabled = state.history.length === 0
        if (redo) redo.disabled = state.future.length === 0
        if (rotateLeft) rotateLeft.disabled = !hasSelection
        if (shrink) shrink.disabled = !hasSelection
        if (grow) grow.disabled = !hasSelection
        if (rotateRight) rotateRight.disabled = !hasSelection
        if (sendBackward) sendBackward.disabled = !hasSelection
        if (bringForward) bringForward.disabled = !hasSelection
        if (duplicate) duplicate.disabled = !hasSelection
        if (del) del.disabled = !hasSelection
    }

    const restoreDecorations = snapshot => {
        state.stickers = snapshot.stickers.map(item => ({ ...item }))
        state.texts = snapshot.texts.map(item => ({ ...item }))
        state.strokes = snapshot.strokes.map(stroke => ({
            ...stroke,
            points: stroke.points.map(point => ({ ...point }))
        }))
        state.selectedDecoration = null
        state.draggingDecoration = false
        updateHistoryButtons()
        render()
    }

    const pushDecorationHistory = () => {
        state.history.push(cloneDecorations())
        if (state.history.length > 30) state.history.shift()
        state.future = []
        updateHistoryButtons()
    }

    const undoDecoration = () => {
        if (!state.history.length) return
        state.future.push(cloneDecorations())
        restoreDecorations(state.history.pop())
        toolStatus.textContent = '装飾を1つ戻しました'
    }

    const redoDecoration = () => {
        if (!state.future.length) return
        state.history.push(cloneDecorations())
        restoreDecorations(state.future.pop())
        toolStatus.textContent = '装飾をやり直しました'
    }

    const decorationEntries = () => {
        const entries = []
        state.stickers.forEach((item, index) => {
            entries.push({
                type: 'sticker',
                index,
                item,
                z: Number.isFinite(Number(item.z)) ? Number(item.z) : index
            })
        })
        state.texts.forEach((item, index) => {
            entries.push({
                type: 'text',
                index,
                item,
                z: Number.isFinite(Number(item.z))
                    ? Number(item.z)
                    : state.stickers.length + index + 100
            })
        })
        return entries.sort((a, b) => a.z - b.z)
    }

    const nextDecorationZ = () => {
        const entries = decorationEntries()
        if (!entries.length) return 1
        return Math.max(...entries.map(entry => entry.z)) + 1
    }

    const decorationHitTest = point => {
        const entries = decorationEntries().reverse()

        for (const entry of entries) {
            const item = entry.item

            if (entry.type === 'text') {
                ctx.save()
                const preset = setCanvasTextFont(item, item.size)
                const metrics = ctx.measureText(item.value)
                const measuredWidth = metrics.width * preset.scaleX
                ctx.restore()
                const halfW = Math.max(item.size, measuredWidth) * .55
                const halfH = item.size * .7
                if (
                    point.x >= item.x - halfW
                    && point.x <= item.x + halfW
                    && point.y >= item.y - halfH
                    && point.y <= item.y + halfH
                ) {
                    return { type: 'text', index: entry.index }
                }
            } else {
                const radius = item.size * .58
                const dx = point.x - item.x
                const dy = point.y - item.y
                if ((dx * dx + dy * dy) <= radius * radius) {
                    return { type: 'sticker', index: entry.index }
                }
            }
        }

        return null
    }

    const selectedDecorationItem = () => {
        const selected = state.selectedDecoration
        if (!selected) return null
        if (selected.type === 'text') return state.texts[selected.index] || null
        if (selected.type === 'sticker') return state.stickers[selected.index] || null
        return null
    }

    const applySkinBeauty = () => {
        if (
            state.skinSmooth <= 0
            && state.whiten <= 0
            && state.rosy <= 0
        ) return

        let imageData
        let smoothedData = null

        try {
            imageData =
                ctx.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                )

            if (state.skinSmooth > 0 && beautyBufferCtx) {
                beautyBufferCtx.save()
                beautyBufferCtx.clearRect(
                    0,
                    0,
                    beautyBuffer.width,
                    beautyBuffer.height
                )
                beautyBufferCtx.filter =
                    `blur(${Math.max(
                        .75,
                        state.skinSmooth / 6
                    )}px)`
                beautyBufferCtx.drawImage(canvas, 0, 0)
                beautyBufferCtx.restore()
                smoothedData =
                    beautyBufferCtx.getImageData(
                        0,
                        0,
                        beautyBuffer.width,
                        beautyBuffer.height
                    ).data
            }
        } catch (_) {
            return
        }

        const data = imageData.data
        const smoothStrength =
            Math.max(
                0,
                Math.min(1, state.skinSmooth / 30)
            ) * .62
        const whitenStrength =
            Math.max(0, Math.min(1, state.whiten / 25)) * .34
        const rosyStrength =
            Math.max(0, Math.min(1, state.rosy / 25)) * .32

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i]
            const g = data[i + 1]
            const b = data[i + 2]

            if (r < 55 || g < 28 || b < 18) continue

            const cb =
                128
                - .168736 * r
                - .331264 * g
                + .5 * b
            const cr =
                128
                + .5 * r
                - .418688 * g
                - .081312 * b

            const isSkin =
                cb >= 72
                && cb <= 132
                && cr >= 128
                && cr <= 184
                && (cr - cb) >= 10
                && r > g + 3
                && r > b + 7

            if (!isSkin) continue

            if (smoothStrength > 0 && smoothedData) {
                const sr = smoothedData[i]
                const sg = smoothedData[i + 1]
                const sb = smoothedData[i + 2]
                const detailDelta =
                    Math.abs(r - sr)
                    + Math.abs(g - sg)
                    + Math.abs(b - sb)

                const edgeGuard =
                    detailDelta > 135
                        ? .12
                        : detailDelta > 90
                            ? .38
                            : detailDelta > 55
                                ? .68
                                : 1
                const mix =
                    smoothStrength * edgeGuard

                data[i] =
                    r + (sr - r) * mix
                data[i + 1] =
                    g + (sg - g) * mix
                data[i + 2] =
                    b + (sb - b) * mix
            }

            if (whitenStrength > 0) {
                data[i] =
                    Math.min(
                        255,
                        data[i]
                        + (246 - data[i]) * whitenStrength
                    )
                data[i + 1] =
                    Math.min(
                        255,
                        data[i + 1]
                        + (240 - data[i + 1])
                        * whitenStrength
                        * .92
                    )
                data[i + 2] =
                    Math.min(
                        255,
                        data[i + 2]
                        + (235 - data[i + 2])
                        * whitenStrength
                        * .82
                    )
            }

            if (rosyStrength > 0) {
                data[i] =
                    Math.min(
                        255,
                        data[i] + 24 * rosyStrength
                    )
                data[i + 1] =
                    Math.max(
                        0,
                        data[i + 1] - 4 * rosyStrength
                    )
                data[i + 2] =
                    Math.min(
                        255,
                        data[i + 2] + 9 * rosyStrength
                    )
            }
        }

        ctx.putImageData(imageData, 0, 0)
    }

    const drawPhotos = () => {
        ctx.save()
        ctx.filter = state.previewOriginal ? 'none' : photoFilter()

        if (state.layout === 'grid') {
            const cells = [
                [0, 0, 600, 450], [600, 0, 600, 450],
                [0, 450, 600, 450], [600, 450, 600, 450]
            ]
            cells.forEach((cell, i) =>
                state.images[i]
                    && drawCover(
                        state.images[i],
                        ...cell,
                        state.photoTransforms[i],
                        i
                    )
            )
        } else if (state.layout === 'strip') {
            const width = 300
            for (let i = 0; i < 4; i++) {
                if (state.images[i]) {
                    drawCover(
                        state.images[i],
                        width * i, 0, width, 900,
                        state.photoTransforms[i],
                        i
                    )
                }
            }
        } else if (state.layout === 'hero') {
            if (state.images[0]) {
                drawCover(
                    state.images[0],
                    0, 0, 800, 900,
                    state.photoTransforms[0],
                    0
                )
            }
            for (let i = 1; i < 4; i++) {
                if (state.images[i]) {
                    drawCover(
                        state.images[i],
                        800, (i - 1) * 300, 400, 300,
                        state.photoTransforms[i],
                        i
                    )
                }
            }
        } else {
            const selectedIndex =
                state.images[state.singleShot]
                    ? state.singleShot
                    : 0
            const selected = state.images[selectedIndex]
            if (selected) {
                drawCover(
                    selected,
                    0, 0, 1200, 900,
                    state.photoTransforms[selectedIndex],
                    selectedIndex
                )
            }
        }

        ctx.restore()

        if (!state.previewOriginal && state.warmth !== 0) {
            ctx.save()
            ctx.globalCompositeOperation = 'soft-light'
            ctx.globalAlpha = Math.min(.22, Math.abs(state.warmth) / 120)
            ctx.fillStyle = state.warmth > 0 ? '#ff9a62' : '#74bfff'
            ctx.fillRect(0, 0, 1200, 900)
            ctx.restore()
        }

        if (!state.previewOriginal && state.glow > 0 && beautyBufferCtx) {
            beautyBufferCtx.save()
            beautyBufferCtx.clearRect(
                0,
                0,
                beautyBuffer.width,
                beautyBuffer.height
            )
            beautyBufferCtx.drawImage(canvas, 0, 0)
            beautyBufferCtx.restore()

            ctx.save()
            ctx.globalCompositeOperation = 'screen'
            ctx.globalAlpha = Math.min(.5, state.glow / 60)
            ctx.filter =
                `blur(${Math.max(1.5, state.glow / 5)}px)`
            ctx.drawImage(beautyBuffer, 0, 0)
            ctx.restore()
        }

        if (!state.previewOriginal) {
            applySkinBeauty()
        }

        drawFaceGuide()
    }

    const drawFrame = () => {
        ctx.save()
        ctx.lineJoin = 'round'

        if (state.frame === 'pink') {
            ctx.strokeStyle = '#ff8ec4'
            ctx.lineWidth = 30
            ctx.strokeRect(15, 15, 1170, 870)
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 8
            ctx.strokeRect(38, 38, 1124, 824)
        } else if (state.frame === 'white') {
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 42
            ctx.strokeRect(21, 21, 1158, 858)
        } else if (state.frame === 'black') {
            ctx.strokeStyle = '#171219'
            ctx.lineWidth = 34
            ctx.strokeRect(17, 17, 1166, 866)
        } else if (state.frame === 'y2k') {
            const gradient = ctx.createLinearGradient(0, 0, 1200, 900)
            gradient.addColorStop(0, '#ff65c6')
            gradient.addColorStop(.35, '#76e8ff')
            gradient.addColorStop(.7, '#b088ff')
            gradient.addColorStop(1, '#fff476')
            ctx.strokeStyle = gradient
            ctx.lineWidth = 38
            ctx.strokeRect(19, 19, 1162, 862)
            ctx.font = '900 30px sans-serif'
            ctx.fillStyle = '#fff'
            ctx.fillText('FLEPURI', 48, 66)
        } else if (state.frame === 'hearts') {
            ctx.strokeStyle = '#ff77b7'
            ctx.lineWidth = 28
            ctx.strokeRect(14, 14, 1172, 872)
            ctx.font = '42px sans-serif'
            for (let x = 42; x < 1160; x += 90) {
                ctx.fillText(x % 180 === 42 ? '♡' : '♥', x, 62)
                ctx.fillText(x % 180 === 42 ? '♥' : '♡', x, 878)
            }
        } else if (state.frame === 'sparkle') {
            const gradient = ctx.createLinearGradient(0, 0, 1200, 900)
            gradient.addColorStop(0, '#ff6fbe')
            gradient.addColorStop(.35, '#8be9ff')
            gradient.addColorStop(.7, '#ba8cff')
            gradient.addColorStop(1, '#fff2a6')
            ctx.strokeStyle = gradient
            ctx.lineWidth = 34
            ctx.strokeRect(17, 17, 1166, 866)
            ctx.fillStyle = '#fff'
            ctx.font = '42px sans-serif'
            const stars = [
                [58, 60, '✦'], [1140, 62, '✧'],
                [64, 842, '✧'], [1135, 840, '✦'],
                [600, 54, '✦'], [600, 846, '✧']
            ]
            stars.forEach(([x, y, mark]) => ctx.fillText(mark, x, y))
        } else if (state.frame === 'polaroid') {
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 44
            ctx.strokeRect(22, 22, 1156, 856)
            ctx.fillStyle = '#fff'
            ctx.fillRect(0, 815, 1200, 85)
            ctx.fillStyle = '#5a4755'
            ctx.font = '700 28px "Noto Sans JP",sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('FLEPURI', 600, 858)
        } else if (state.frame === 'ribbon') {
            ctx.strokeStyle = '#ff9dca'
            ctx.lineWidth = 32
            ctx.strokeRect(16, 16, 1168, 868)
            ctx.font = '54px "Apple Color Emoji","Segoe UI Emoji",sans-serif'
            ctx.fillText('🎀', 62, 66)
            ctx.fillText('🎀', 1138, 66)
            ctx.fillText('🎀', 62, 848)
            ctx.fillText('🎀', 1138, 848)
        }

        ctx.restore()
    }

    const textFontPreset = value => {
        const preset = String(value || 'heisei')
        const fonts = {
            heisei: {
                family: '"HeiseiJoshi","Yu Gothic","Meiryo",sans-serif',
                weight: 400,
                italic: false,
                scaleX: 1
            },
            hitori: {
                family: '"HitoriGothic","Yu Gothic","Meiryo",sans-serif',
                weight: 400,
                italic: false,
                scaleX: 1
            },
            hachi: {
                family: '"HachiMaruPop","Hiragino Maru Gothic ProN","Yu Gothic","Meiryo",sans-serif',
                weight: 400,
                italic: false,
                scaleX: 1
            }
        }
        return fonts[preset] || fonts.heisei
    }

    const setCanvasTextFont = (item, size) => {
        const preset = textFontPreset(item?.font)
        ctx.font = `${preset.italic ? 'italic ' : ''}${preset.weight} ${size}px ${preset.family}`
        return preset
    }

    const drawStyledText = item => {
        const style = item.style || 'puri'
        const size = Number(item.size) || 64
        const fontPreset = setCanvasTextFont(item, size)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.scale(fontPreset.scaleX, 1)

        if (style === 'simple') {
            ctx.fillStyle = item.color
            ctx.fillText(item.value, 0, 0)
            return
        }

        if (style === 'outline') {
            ctx.lineJoin = 'round'
            ctx.lineWidth = Math.max(7, size * .14)
            ctx.strokeStyle = '#fff'
            ctx.strokeText(item.value, 0, 0)
            ctx.lineWidth = Math.max(2, size * .035)
            ctx.strokeStyle = 'rgba(36,21,33,.35)'
            ctx.strokeText(item.value, 0, 0)
            ctx.fillStyle = item.color
            ctx.fillText(item.value, 0, 0)
            return
        }

        if (style === 'neon') {
            ctx.lineJoin = 'round'
            ctx.shadowColor = item.color
            ctx.shadowBlur = Math.max(12, size * .28)
            ctx.lineWidth = Math.max(5, size * .08)
            ctx.strokeStyle = item.color
            ctx.strokeText(item.value, 0, 0)
            ctx.shadowBlur = Math.max(6, size * .12)
            ctx.fillStyle = '#fff'
            ctx.fillText(item.value, 0, 0)
            return
        }

        if (style === 'y2k') {
            const width = Math.max(size * 3, ctx.measureText(item.value).width)
            const gradient = ctx.createLinearGradient(-width / 2, 0, width / 2, 0)
            gradient.addColorStop(0, '#ff5dbb')
            gradient.addColorStop(.34, '#65dcff')
            gradient.addColorStop(.67, '#a98cff')
            gradient.addColorStop(1, '#ffe878')
            ctx.lineJoin = 'round'
            ctx.lineWidth = Math.max(8, size * .14)
            ctx.strokeStyle = '#fff'
            ctx.strokeText(item.value, 0, 0)
            ctx.fillStyle = gradient
            ctx.fillText(item.value, 0, 0)
            return
        }

        // Default purikura lettering: white sticker outline + soft pink shadow.
        ctx.lineJoin = 'round'
        ctx.shadowColor = 'rgba(255,65,151,.40)'
        ctx.shadowBlur = Math.max(6, size * .11)
        ctx.shadowOffsetY = Math.max(2, size * .035)
        ctx.lineWidth = Math.max(9, size * .16)
        ctx.strokeStyle = '#fff'
        ctx.strokeText(item.value, 0, 0)
        ctx.shadowColor = 'transparent'
        ctx.lineWidth = Math.max(2, size * .035)
        ctx.strokeStyle = 'rgba(255,255,255,.95)'
        ctx.strokeText(item.value, 0, 0)
        ctx.fillStyle = item.color
        ctx.fillText(item.value, 0, 0)
    }

    const configureStrokeContext = stroke => {
        ctx.strokeStyle = stroke.color
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        if (stroke.style === 'marker') {
            ctx.globalAlpha = .48
            ctx.lineWidth = stroke.width * 1.8
        } else if (stroke.style === 'neon') {
            ctx.lineWidth = stroke.width
            ctx.shadowColor = stroke.color
            ctx.shadowBlur = Math.max(10, stroke.width * 1.6)
        } else {
            ctx.lineWidth = stroke.width
        }
    }

    const appendInterpolatedStrokePoint = (stroke, point) => {
        const points = stroke.points
        const last = points[points.length - 1]
        if (!last) {
            points.push(point)
            return
        }

        const dx = point.x - last.x
        const dy = point.y - last.y
        const distance = Math.hypot(dx, dy)
        if (distance < .2) return

        const spacing = Math.max(
            1.5,
            Math.min(5, (Number(stroke.width) || 10) * .24)
        )
        const steps = Math.max(1, Math.ceil(distance / spacing))

        for (let i = 1; i <= steps; i++) {
            points.push({
                x: last.x + dx * i / steps,
                y: last.y + dy * i / steps
            })
        }
    }

    const drawStrokePath = stroke => {
        const points = stroke.points
        if (!points.length) return

        ctx.save()
        configureStrokeContext(stroke)
        ctx.beginPath()

        if (points.length === 1) {
            ctx.moveTo(points[0].x, points[0].y)
            ctx.lineTo(points[0].x + .01, points[0].y + .01)
        } else {
            ctx.moveTo(points[0].x, points[0].y)

            for (let i = 1; i < points.length - 1; i++) {
                const current = points[i]
                const next = points[i + 1]
                const midX = (current.x + next.x) / 2
                const midY = (current.y + next.y) / 2
                ctx.quadraticCurveTo(
                    current.x,
                    current.y,
                    midX,
                    midY
                )
            }

            const last = points[points.length - 1]
            ctx.lineTo(last.x, last.y)
        }

        ctx.stroke()
        ctx.restore()
    }

    const drawStrokeIncrement = (stroke, fromIndex) => {
        const points = stroke.points
        if (points.length < 2) return

        const start = Math.max(0, fromIndex - 1)
        ctx.save()
        configureStrokeContext(stroke)
        ctx.beginPath()
        ctx.moveTo(points[start].x, points[start].y)

        for (let i = start + 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y)
        }

        ctx.stroke()
        ctx.restore()
    }

    const drawDecorations = () => {
        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        decorationEntries().forEach(entry => {
            const item = entry.item
            ctx.save()
            ctx.translate(item.x, item.y)
            ctx.rotate((Number(item.rotation) || 0) * Math.PI / 180)

            if (entry.type === 'sticker') {
                ctx.font = `${item.size}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`
                ctx.fillText(item.value, 0, 0)
            } else {
                drawStyledText(item)
            }
            ctx.restore()
        })
        ctx.restore()

        state.strokes.forEach(drawStrokePath)

        const selected = selectedDecorationItem()
        if (selected) {
            ctx.save()
            ctx.setLineDash([12, 8])
            ctx.lineWidth = 4
            ctx.strokeStyle = '#ffffff'
            ctx.shadowColor = '#ff4fa3'
            ctx.shadowBlur = 8

            ctx.translate(selected.x, selected.y)
            ctx.rotate((Number(selected.rotation) || 0) * Math.PI / 180)

            if (state.selectedDecoration.type === 'sticker') {
                const radius = selected.size * .68
                ctx.strokeRect(
                    -radius,
                    -radius,
                    radius * 2,
                    radius * 2
                )
            } else {
                const preset = setCanvasTextFont(selected, selected.size)
                const width = Math.max(selected.size, ctx.measureText(selected.value).width * preset.scaleX) + 28
                const height = selected.size * 1.5
                ctx.strokeRect(
                    -width / 2,
                    -height / 2,
                    width,
                    height
                )
            }

            ctx.restore()
        }
    }

    const cacheBaseLayer = () => {
        if (!baseLayerCtx) return
        baseLayerCtx.clearRect(0, 0, baseLayer.width, baseLayer.height)
        baseLayerCtx.drawImage(canvas, 0, 0)
        baseLayerValid = true
    }

    const render = () => {
        ctx.save()
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        drawPhotos()
        drawFrame()
        cacheBaseLayer()
        drawDecorations()
        ctx.restore()
    }

    const renderDecorationsOnly = () => {
        if (!baseLayerValid) {
            render()
            return
        }

        ctx.save()
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(baseLayer, 0, 0)
        drawDecorations()
        ctx.restore()
    }

    let decorationRenderFrame = 0
    const scheduleDecorationRender = () => {
        if (decorationRenderFrame) return
        decorationRenderFrame = requestAnimationFrame(() => {
            decorationRenderFrame = 0
            renderDecorationsOnly()
        })
    }

    const resetDecorations = (recordHistory = true) => {
        if (
            recordHistory
            && (
                state.stickers.length
                || state.texts.length
                || state.strokes.length
            )
        ) {
            pushDecorationHistory()
        }

        state.stickers = []
        state.texts = []
        state.strokes = []
        state.armedStamp = null
        state.armedText = false
        state.textStyle = 'puri'
        state.textFont = 'heisei'
        state.repeatStamp = false
        state.drawEnabled = false
        state.drawStyle = 'pen'
        state.selectedDecoration = null
        state.draggingDecoration = false
        state.dragHistoryCaptured = false

        if (!recordHistory) {
            state.history = []
            state.future = []
        }

        document.querySelectorAll('[data-stamp]').forEach(button => button.classList.remove('active'))
        document.querySelectorAll('[data-text-style]').forEach(button => {
            button.classList.toggle('active', button.dataset.textStyle === 'puri')
        })
        document.querySelectorAll('[data-text-font]').forEach(button => {
            button.classList.toggle('active', button.dataset.textFont === 'heisei')
        })
        document.querySelectorAll('[data-draw-style]').forEach(button => {
            button.classList.toggle('active', button.dataset.drawStyle === 'pen')
        })
        const stampRepeatButton = document.getElementById('stampRepeatButton')
        if (stampRepeatButton) {
            stampRepeatButton.textContent = '連続配置：OFF'
            stampRepeatButton.classList.remove('active')
        }
        document.getElementById('drawToggle').textContent = 'ペン：オン'
        toolStatus.textContent = recordHistory ? '装飾をリセットしました' : '編集できます'
        updateHistoryButtons()
        render()
    }

    const setTab = tab => {
        state.activeTab = tab
        document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === tab))
        document.querySelectorAll('[data-page]').forEach(page => page.classList.toggle('active', page.dataset.page === tab))
        if (tab === 'face') refreshFaceControls()
        render()
    }

    document.querySelectorAll('[data-tab]').forEach(button => {
        button.addEventListener('click', () => setTab(button.dataset.tab))
    })

    document.querySelectorAll('[data-layout]').forEach(button => {
        button.addEventListener('click', () => {
            state.layout = button.dataset.layout
            document.querySelectorAll('[data-layout]').forEach(item => item.classList.toggle('active', item === button))
            render()
        })
    })

    document.getElementById('singleShot').addEventListener('input', event => {
        state.singleShot = Number(event.target.value)
        if (state.layout === 'single') render()
    })

    const refreshPhotoTransformControls = () => {
        const index = Math.max(
            0,
            Math.min(3, Number(state.photoEditShot) || 0)
        )
        const transform =
            state.photoTransforms[index]
            || { zoom: 1, panX: 0, panY: 0 }

        document.querySelectorAll('[data-photo-shot]').forEach(button => {
            const buttonIndex = Number(button.dataset.photoShot)
            button.classList.toggle(
                'active',
                buttonIndex === index
            )
            button.disabled = !state.images[buttonIndex]
        })

        const zoom = document.getElementById('photoZoom')
        const panX = document.getElementById('photoPanX')
        const panY = document.getElementById('photoPanY')
        const status = document.getElementById('photoAdjustStatus')

        if (zoom) zoom.value = Math.round(transform.zoom * 100)
        if (panX) panX.value = Math.round(transform.panX * 100)
        if (panY) panY.value = Math.round(transform.panY * 100)
        if (status) {
            status.textContent =
                `${index + 1}枚目：拡大 ${Math.round(transform.zoom * 100)}% / 左右 ${Math.round(transform.panX * 100)} / 上下 ${Math.round(transform.panY * 100)}`
        }
    }

    const resetPhotoTransforms = () => {
        state.photoEditShot = 0
        state.photoTransforms =
            Array.from(
                { length: 4 },
                () => ({ zoom: 1, panX: 0, panY: 0 })
            )
        refreshPhotoTransformControls()
    }


    const makeFaceTarget = () => ({
        enabled: false,
        x: 50,
        y: 30,
        size: 22,
        eye: 0,
        slim: 0,
        bright: 0,
        rosy: 0
    })

    const resetFaceTargets = () => {
        state.faceEditShot = 0
        state.faceSlot = 0
        state.faceTargets =
            Array.from(
                { length: 4 },
                () => Array.from(
                    { length: 6 },
                    () => makeFaceTarget()
                )
            )
        refreshFaceControls()
    }

    const currentFaceTarget = () =>
        state.faceTargets[state.faceEditShot]?.[state.faceSlot] || null

    const refreshFaceControls = () => {
        const shotIndex = Math.max(
            0,
            Math.min(3, Number(state.faceEditShot) || 0)
        )
        const slotIndex = Math.max(
            0,
            Math.min(5, Number(state.faceSlot) || 0)
        )
        const target =
            state.faceTargets[shotIndex]?.[slotIndex]
            || makeFaceTarget()

        document.querySelectorAll('[data-face-shot]').forEach(button => {
            const index = Number(button.dataset.faceShot)
            button.classList.toggle('active', index === shotIndex)
            button.disabled = !state.images[index]
        })

        document.querySelectorAll('[data-face-slot]').forEach(button => {
            const index = Number(button.dataset.faceSlot)
            const saved = state.faceTargets[shotIndex]?.[index]
            button.classList.toggle('active', index === slotIndex)
            button.classList.toggle('configured', Boolean(saved?.enabled))
        })

        const values = {
            faceX: target.x,
            faceY: target.y,
            faceSize: target.size,
            faceEye: target.eye,
            faceSlim: target.slim,
            faceBright: target.bright,
            faceRosy: target.rosy
        }

        Object.entries(values).forEach(([id, value]) => {
            const input = document.getElementById(id)
            if (input) input.value = value
        })

        const enableButton = document.getElementById('faceEnableButton')
        if (enableButton) {
            enableButton.textContent =
                target.enabled
                    ? 'この顔補正を使わない'
                    : 'この顔補正を使う'
            enableButton.classList.toggle('active', target.enabled)
        }

        const status = document.getElementById('faceStatus')
        if (status) {
            status.textContent = target.enabled
                ? `${shotIndex + 1}枚目 / 顔${slotIndex + 1}：登録済み｜目 ${target.eye} / 小顔 ${target.slim} / 明るさ ${target.bright} / 血色 ${target.rosy}`
                : `${shotIndex + 1}枚目 / 顔${slotIndex + 1}：未登録。写真内の顔をクリックしてください。`
        }
    }

    const placeFaceTargetAtCanvasPoint = point => {
        const cell =
            getLayoutCells().find(item =>
                point.x >= item.x
                && point.x <= item.x + item.w
                && point.y >= item.y
                && point.y <= item.y + item.h
            )

        if (!cell) return false

        const image = state.images[cell.shot]
        if (!image) return false

        const geometry = getCoverGeometry(
            image,
            cell.x, cell.y, cell.w, cell.h,
            state.photoTransforms[cell.shot]
        )
        const sourceX =
            geometry.sx
            + (point.x - cell.x) / cell.w * geometry.cropW
        const sourceY =
            geometry.sy
            + (point.y - cell.y) / cell.h * geometry.cropH

        state.faceEditShot = cell.shot
        const target =
            state.faceTargets[cell.shot]?.[state.faceSlot]
        if (!target) return false

        target.enabled = true
        target.x = Math.max(
            0,
            Math.min(100, sourceX / image.width * 100)
        )
        target.y = Math.max(
            0,
            Math.min(100, sourceY / image.height * 100)
        )

        refreshFaceControls()
        toolStatus.textContent =
            `${cell.shot + 1}枚目の顔${state.faceSlot + 1}を登録しました`
        render()
        return true
    }


    const resetEditorSessionState = () => {
        state.layout = 'grid'
        state.singleShot = 0
        state.frame = 'pink'
        state.brightness = 112
        state.contrast = 102
        state.saturation = 112
        state.softness = .5
        state.warmth = 8
        state.glow = 8
        state.skinSmooth = 5
        state.whiten = 5
        state.rosy = 4
        state.previewOriginal = false
        state.previewFaceOriginal = false
        state.activeTab = 'layout'
        state.exporting = false

        document.querySelectorAll('[data-layout]').forEach(button => {
            button.classList.toggle(
                'active',
                button.dataset.layout === 'grid'
            )
        })
        document.querySelectorAll('[data-frame]').forEach(button => {
            button.classList.toggle(
                'active',
                button.dataset.frame === 'pink'
            )
        })

        const singleShot = document.getElementById('singleShot')
        if (singleShot) singleShot.value = 0

        const defaultRanges = {
            brightness: 112,
            contrast: 102,
            saturation: 112,
            softness: .5,
            warmth: 8,
            glow: 8,
            skinSmooth: 5,
            whiten: 5,
            rosy: 4
        }

        Object.entries(defaultRanges).forEach(([id, value]) => {
            const input = document.getElementById(id)
            if (input) input.value = value
        })

        resetPhotoTransforms()
        resetFaceTargets()
        setTab('layout')
        resetDecorations(false)
    }

    document.querySelectorAll('[data-photo-shot]').forEach(button => {
        button.addEventListener('click', () => {
            const index = Number(button.dataset.photoShot)
            if (!state.images[index]) return
            state.photoEditShot = index
            refreshPhotoTransformControls()
        })
    })

    const bindPhotoTransformRange = (id, key, divisor = 100) => {
        document.getElementById(id).addEventListener('input', event => {
            const index = state.photoEditShot
            const transform = state.photoTransforms[index]
            if (!transform) return
            transform[key] = Number(event.target.value) / divisor
            refreshPhotoTransformControls()
            render()
        })
    }

    bindPhotoTransformRange('photoZoom', 'zoom', 100)
    bindPhotoTransformRange('photoPanX', 'panX', 100)
    bindPhotoTransformRange('photoPanY', 'panY', 100)

    document.getElementById('photoResetCurrent').addEventListener('click', () => {
        state.photoTransforms[state.photoEditShot] = {
            zoom: 1,
            panX: 0,
            panY: 0
        }
        refreshPhotoTransformControls()
        toolStatus.textContent =
            `${state.photoEditShot + 1}枚目の位置調整をリセットしました`
        render()
    })

    document.getElementById('photoResetAll').addEventListener('click', () => {
        resetPhotoTransforms()
        toolStatus.textContent = '4枚すべての位置調整をリセットしました'
        render()
    })

    document.querySelectorAll('[data-face-shot]').forEach(button => {
        button.addEventListener('click', () => {
            const index = Number(button.dataset.faceShot)
            if (!state.images[index]) return
            state.faceEditShot = index
            refreshFaceControls()
            render()
        })
    })

    document.querySelectorAll('[data-face-slot]').forEach(button => {
        button.addEventListener('click', () => {
            state.faceSlot = Math.max(
                0,
                Math.min(5, Number(button.dataset.faceSlot) || 0)
            )
            refreshFaceControls()
            render()
        })
    })

    document.getElementById('faceEnableButton').addEventListener('click', () => {
        const target = currentFaceTarget()
        if (!target) return
        target.enabled = !target.enabled
        refreshFaceControls()
        toolStatus.textContent =
            target.enabled
                ? `顔${state.faceSlot + 1}の補正を有効にしました`
                : `顔${state.faceSlot + 1}の補正を無効にしました`
        render()
    })

    const bindFaceRange = (id, key) => {
        document.getElementById(id).addEventListener('input', event => {
            const target = currentFaceTarget()
            if (!target) return

            if (!target.enabled) {
                toolStatus.textContent =
                    '先に写真内の顔をクリックして登録してください'
                refreshFaceControls()
                return
            }

            target[key] = Number(event.target.value)
            refreshFaceControls()
            render()
        })
    }

    bindFaceRange('faceX', 'x')
    bindFaceRange('faceY', 'y')
    bindFaceRange('faceSize', 'size')
    bindFaceRange('faceEye', 'eye')
    bindFaceRange('faceSlim', 'slim')
    bindFaceRange('faceBright', 'bright')
    bindFaceRange('faceRosy', 'rosy')

    const applyFacePreset = (name, values) => {
        const target = currentFaceTarget()
        if (!target) return
        target.enabled = true
        target.eye = values.eye
        target.slim = values.slim
        target.bright = values.bright
        target.rosy = values.rosy
        refreshFaceControls()
        toolStatus.textContent =
            `顔${state.faceSlot + 1}に「${name}」を適用しました`
        render()
    }

    document.querySelectorAll('[data-face-preset]').forEach(button => {
        button.addEventListener('click', () => {
            const preset = button.dataset.facePreset
            const values = {
                natural: { eye: 12, slim: 8, bright: 6, rosy: 4 },
                strong: { eye: 34, slim: 25, bright: 15, rosy: 13 },
                max: { eye: 50, slim: 36, bright: 23, rosy: 21 }
            }[preset]
            if (!values) return
            applyFacePreset(button.textContent.trim(), values)
        })
    })

    document.getElementById('faceResetCurrent').addEventListener('click', () => {
        if (!state.faceTargets[state.faceEditShot]) return
        state.faceTargets[state.faceEditShot][state.faceSlot] =
            makeFaceTarget()
        refreshFaceControls()
        toolStatus.textContent =
            `顔${state.faceSlot + 1}の補正をリセットしました`
        render()
    })

    const copyFaceValues = (source, target) => {
        target.eye = source.eye
        target.slim = source.slim
        target.bright = source.bright
        target.rosy = source.rosy
    }

    document.getElementById('faceCopyShot').addEventListener('click', () => {
        const source = currentFaceTarget()
        if (!source?.enabled) {
            toolStatus.textContent = '先に基準にする顔を登録してください'
            return
        }

        let copied = 0
        state.faceTargets[state.faceEditShot].forEach((target, index) => {
            if (index === state.faceSlot || !target.enabled) return
            copyFaceValues(source, target)
            copied++
        })

        toolStatus.textContent =
            copied > 0
                ? `同じ写真の${copied}人へ顔補正を反映しました`
                : 'この写真には他の登録済み顔がありません'
        render()
    })


    const compareFaceButton =
        document.getElementById('compareFaceButton')

    if (compareFaceButton) {
        const setFaceOriginalPreview = value => {
            state.previewFaceOriginal = value
            compareFaceButton.classList.toggle('active', value)
            compareFaceButton.textContent =
                value
                    ? '顔補正前を表示中'
                    : '押して顔補正前を確認'
            render()
        }

        compareFaceButton.addEventListener('pointerdown', event => {
            event.preventDefault()
            compareFaceButton.setPointerCapture?.(event.pointerId)
            setFaceOriginalPreview(true)
        })

        ;['pointerup', 'pointercancel', 'pointerleave'].forEach(name => {
            compareFaceButton.addEventListener(
                name,
                () => setFaceOriginalPreview(false)
            )
        })
    }

    document.getElementById('faceCopyPerson').addEventListener('click', () => {
        const source = currentFaceTarget()
        if (!source?.enabled) {
            toolStatus.textContent = '先に基準にする顔を登録してください'
            return
        }

        let copied = 0
        state.faceTargets.forEach((targets, shotIndex) => {
            if (shotIndex === state.faceEditShot) return
            const target = targets[state.faceSlot]
            if (!target?.enabled) return
            copyFaceValues(source, target)
            copied++
        })

        toolStatus.textContent =
            copied > 0
                ? `顔${state.faceSlot + 1}の設定を他の${copied}枚へ反映しました`
                : `他の写真に登録済みの顔${state.faceSlot + 1}がありません`
        render()
    })

    document.getElementById('faceCopyAll').addEventListener('click', () => {
        const source = currentFaceTarget()
        if (!source?.enabled) {
            toolStatus.textContent = '先に基準にする顔を登録してください'
            return
        }

        let copied = 0
        state.faceTargets.forEach((targets, shotIndex) => {
            targets.forEach((target, slotIndex) => {
                if (
                    shotIndex === state.faceEditShot
                    && slotIndex === state.faceSlot
                ) return
                if (!target.enabled) return
                copyFaceValues(source, target)
                copied++
            })
        })

        toolStatus.textContent =
            copied > 0
                ? `全写真の登録済み${copied}人へ顔補正を反映しました`
                : 'ほかに登録済みの顔がありません'
        render()
    })

    const bindRange = (id, key) => {
        document.getElementById(id).addEventListener('input', event => {
            state[key] = Number(event.target.value)
            render()
        })
    }
    bindRange('brightness', 'brightness')
    bindRange('contrast', 'contrast')
    bindRange('saturation', 'saturation')
    bindRange('softness', 'softness')
    bindRange('warmth', 'warmth')
    bindRange('glow', 'glow')
    bindRange('skinSmooth', 'skinSmooth')
    bindRange('whiten', 'whiten')
    bindRange('rosy', 'rosy')

    const compareBeautyButton =
        document.getElementById('compareBeautyButton')

    if (compareBeautyButton) {
        const setOriginalPreview = value => {
            state.previewOriginal = value
            compareBeautyButton.classList.toggle(
                'active',
                value
            )
            compareBeautyButton.textContent =
                value
                    ? '補正前を表示中'
                    : '押して補正前を確認'
            render()
        }

        compareBeautyButton.addEventListener(
            'pointerdown',
            event => {
                event.preventDefault()
                compareBeautyButton.setPointerCapture?.(
                    event.pointerId
                )
                setOriginalPreview(true)
            }
        )

        ;[
            'pointerup',
            'pointercancel',
            'pointerleave'
        ].forEach(name => {
            compareBeautyButton.addEventListener(
                name,
                () => setOriginalPreview(false)
            )
        })
    }

    document.querySelectorAll('[data-preset]').forEach(button => {
        button.addEventListener('click', () => {
            const preset = button.dataset.preset
            const values = {
                natural: [104, 103, 104, 0, 3, 0, 2, 0, 0],
                puri: [116, 104, 116, .35, 9, 10, 13, 7, 5],
                y2k: [109, 118, 140, .15, 12, 4, 5, 3, 1],
                mono: [106, 126, 0, .10, 0, 0, 2, 1, 0],
                soft: [114, 100, 110, .40, 7, 8, 16, 6, 4],
                cool: [106, 112, 112, .10, -14, 2, 4, 2, 0],
                night: [114, 116, 106, .15, 4, 5, 7, 4, 2]
            }[preset]
            if (!values) return
            ;[
                state.brightness,
                state.contrast,
                state.saturation,
                state.softness,
                state.warmth,
                state.glow,
                state.skinSmooth,
                state.whiten,
                state.rosy
            ] = values
            ;[
                'brightness',
                'contrast',
                'saturation',
                'softness',
                'warmth',
                'glow',
                'skinSmooth',
                'whiten',
                'rosy'
            ].forEach((id, i) => {
                document.getElementById(id).value = values[i]
            })
            toolStatus.textContent = `${button.textContent.trim()} を適用しました`
            render()
        })
    })

    document.querySelectorAll('[data-frame]').forEach(button => {
        button.addEventListener('click', () => {
            state.frame = button.dataset.frame
            document.querySelectorAll('[data-frame]').forEach(item => item.classList.toggle('active', item === button))
            render()
        })
    })

    document.querySelectorAll('[data-stamp]').forEach(button => {
        button.addEventListener('click', () => {
            state.armedStamp = button.dataset.stamp
            state.armedText = false
            state.drawEnabled = false
            document.querySelectorAll('[data-stamp]').forEach(item => item.classList.toggle('active', item === button))
            toolStatus.textContent = `${state.armedStamp} を置く場所を写真上でクリック`
        })
    })

    const stampRepeatButton = document.getElementById('stampRepeatButton')
    stampRepeatButton?.addEventListener('click', () => {
        state.repeatStamp = !state.repeatStamp
        stampRepeatButton.classList.toggle('active', state.repeatStamp)
        stampRepeatButton.textContent =
            state.repeatStamp ? '連続配置：ON' : '連続配置：OFF'
        toolStatus.textContent =
            state.repeatStamp ? '同じスタンプを続けて配置できます' : 'スタンプは1回ずつ配置します'
    })

    document.querySelectorAll('[data-text-value]').forEach(button => {
        button.addEventListener('click', () => {
            document.getElementById('textInput').value =
                button.dataset.textValue || ''
            toolStatus.textContent = '定型メッセージを入力しました'
        })
    })

    document.querySelectorAll('[data-text-preset="date"]').forEach(button => {
        button.addEventListener('click', () => {
            const now = new Date()
            const text =
                `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`
            document.getElementById('textInput').value = text
            toolStatus.textContent = '今日の日付を入力しました'
        })
    })

    document.querySelectorAll('[data-text-color]').forEach(button => {
        button.addEventListener('click', () => {
            const color = button.dataset.textColor
            document.getElementById('textColor').value = color
            document.querySelectorAll('[data-text-color]').forEach(item => {
                item.classList.toggle('active', item === button)
            })
            const item = selectedDecorationItem()
            if (state.selectedDecoration?.type === 'text' && item) {
                pushDecorationHistory()
                item.color = color
                updateHistoryButtons()
                render()
            }
        })
    })

    document.querySelectorAll('[data-text-style]').forEach(button => {
        button.addEventListener('click', () => {
            state.textStyle = button.dataset.textStyle || 'puri'
            document.querySelectorAll('[data-text-style]').forEach(item => {
                item.classList.toggle('active', item === button)
            })
            const item = selectedDecorationItem()
            if (state.selectedDecoration?.type === 'text' && item) {
                pushDecorationHistory()
                item.style = state.textStyle
                updateHistoryButtons()
                toolStatus.textContent = '選択中の文字スタイルを変更しました'
                render()
            }
        })
    })

    document.querySelectorAll('[data-text-font]').forEach(button => {
        button.addEventListener('click', () => {
            state.textFont = button.dataset.textFont || 'heisei'
            document.querySelectorAll('[data-text-font]').forEach(item => {
                item.classList.toggle('active', item === button)
            })
            const item = selectedDecorationItem()
            if (state.selectedDecoration?.type === 'text' && item) {
                pushDecorationHistory()
                item.font = state.textFont
                updateHistoryButtons()
                toolStatus.textContent = '選択中のフォントを変更しました'
                render()
            } else {
                toolStatus.textContent = `${button.textContent.trim()}を選びました`
            }
        })
    })

    document.querySelectorAll('[data-draw-style]').forEach(button => {
        button.addEventListener('click', () => {
            state.drawStyle = button.dataset.drawStyle || 'pen'
            document.querySelectorAll('[data-draw-style]').forEach(item => {
                item.classList.toggle('active', item === button)
            })
            const toggle = document.getElementById('drawToggle')
            if (toggle) {
                toggle.textContent = state.drawEnabled
                    ? `${button.textContent.trim()}：オフ`
                    : `${button.textContent.trim()}：オン`
            }
            toolStatus.textContent =
                state.drawStyle === 'eraser'
                    ? '消しゴムでなぞった落書きだけ消せます'
                    : `${button.textContent.trim()}で落書きできます`
        })
    })

    document.getElementById('armTextButton').addEventListener('click', () => {
        const value = document.getElementById('textInput').value.trim()
        if (!value) {
            toolStatus.textContent = '先に文字を入力してください'
            return
        }
        state.armedText = true
        state.armedStamp = null
        state.drawEnabled = false
        toolStatus.textContent = '文字を置く場所を写真上でクリック'
    })

    document.getElementById('updateSelectedTextButton').addEventListener('click', () => {
        const selected = state.selectedDecoration
        const item = selectedDecorationItem()
        const value = document.getElementById('textInput').value.trim()

        if (selected?.type !== 'text' || !item) {
            toolStatus.textContent = '先に写真上の文字を選択してください'
            return
        }
        if (!value) {
            toolStatus.textContent = '更新する文字を入力してください'
            return
        }

        pushDecorationHistory()
        item.value = value
        item.color = document.getElementById('textColor').value
        item.size = Number(document.getElementById('textSize').value)
        item.style = state.textStyle
        item.font = state.textFont
        updateHistoryButtons()
        toolStatus.textContent = '選択中の文字を更新しました'
        render()
    })

    document.getElementById('drawToggle').addEventListener('click', event => {
        state.drawEnabled = !state.drawEnabled
        state.armedStamp = null
        state.armedText = false
        const activeLabel =
            document.querySelector('[data-draw-style].active')?.textContent?.trim()
            || 'ペン'
        event.currentTarget.textContent =
            state.drawEnabled
                ? `${activeLabel}：オフ`
                : `${activeLabel}：オン`
        toolStatus.textContent =
            state.drawEnabled
                ? (state.drawStyle === 'eraser'
                    ? '写真上をなぞって落書きを部分消し'
                    : '写真上をドラッグして落書き')
                : '落書きツールを停止しました'
    })

    document.getElementById('clearDrawButton').addEventListener('click', () => {
        if (!state.strokes.length) return
        pushDecorationHistory()
        state.strokes = []
        state.selectedDecoration = null
        updateHistoryButtons()
        toolStatus.textContent = '落書きを消しました'
        renderDecorationsOnly()
    })

    const pointSegmentDistanceSq = (point, start, end) => {
        const vx = end.x - start.x
        const vy = end.y - start.y
        const wx = point.x - start.x
        const wy = point.y - start.y
        const lengthSq = vx * vx + vy * vy

        if (lengthSq <= .0001) {
            return wx * wx + wy * wy
        }

        const t = Math.max(
            0,
            Math.min(1, (wx * vx + wy * vy) / lengthSq)
        )
        const dx = point.x - (start.x + vx * t)
        const dy = point.y - (start.y + vy * t)
        return dx * dx + dy * dy
    }

    const eraseStrokeSegment = (start, end) => {
        const radius =
            Math.max(
                12,
                Number(document.getElementById('drawWidth')?.value || 10) * 1.7
            )
        let changed = false
        const nextStrokes = []

        state.strokes.forEach(stroke => {
            let current = []
            const strokeRadius =
                radius + Math.max(1, Number(stroke.width) || 1) * .55
            const radiusSq = strokeRadius * strokeRadius

            const flush = () => {
                if (current.length > 1) {
                    nextStrokes.push({
                        ...stroke,
                        points: current
                    })
                }
                current = []
            }

            stroke.points.forEach(strokePoint => {
                if (
                    pointSegmentDistanceSq(
                        strokePoint,
                        start,
                        end
                    ) <= radiusSq
                ) {
                    changed = true
                    flush()
                } else {
                    current.push(strokePoint)
                }
            })
            flush()
        })

        if (changed) {
            state.strokes = nextStrokes
        }
        return changed
    }

    let lastEraserPoint = null
    let pendingEraserPoint = null
    let eraserFrame = 0

    const flushEraser = () => {
        if (!lastEraserPoint || !pendingEraserPoint) return false
        const changed =
            eraseStrokeSegment(
                lastEraserPoint,
                pendingEraserPoint
            )
        lastEraserPoint = pendingEraserPoint
        pendingEraserPoint = null
        if (changed) renderDecorationsOnly()
        return changed
    }

    const scheduleEraser = point => {
        pendingEraserPoint = point
        if (eraserFrame) return

        eraserFrame = requestAnimationFrame(() => {
            eraserFrame = 0
            flushEraser()
        })
    }

    const canvasPoint = event => {
        const rect = canvas.getBoundingClientRect()
        return {
            x: (event.clientX - rect.left) / rect.width * canvas.width,
            y: (event.clientY - rect.top) / rect.height * canvas.height
        }
    }

    canvas.addEventListener('pointerdown', event => {
        const point = canvasPoint(event)

        if (state.activeTab === 'face') {
            event.preventDefault()
            placeFaceTargetAtCanvasPoint(point)
            return
        }

        if (state.drawEnabled) {
            pushDecorationHistory()
            state.selectedDecoration = null
            state.drawing = true
            canvas.setPointerCapture(event.pointerId)

            if (state.drawStyle === 'eraser') {
                state.activeStroke = { style: 'eraser', points: [point] }
                lastEraserPoint = point
                pendingEraserPoint = null
                eraseStrokeSegment(point, point)
                updateHistoryButtons()
                renderDecorationsOnly()
                return
            }

            const stroke = {
                color: document.getElementById('drawColor').value,
                width: Number(document.getElementById('drawWidth').value),
                style: state.drawStyle,
                points: [point]
            }
            state.activeStroke = stroke
            state.strokes.push(stroke)
            updateHistoryButtons()
            renderDecorationsOnly()
            return
        }

        if (state.armedStamp) {
            pushDecorationHistory()
            state.stickers.push({
                value: state.armedStamp,
                x: point.x,
                y: point.y,
                size: Number(document.getElementById('stampSize').value),
                rotation: 0,
                z: nextDecorationZ()
            })
            if (!state.repeatStamp) {
                state.armedStamp = null
                document.querySelectorAll('[data-stamp]').forEach(item => item.classList.remove('active'))
            }
            state.selectedDecoration = {
                type: 'sticker',
                index: state.stickers.length - 1
            }
            toolStatus.textContent = state.repeatStamp
                ? 'スタンプを配置しました。連続配置中です'
                : 'スタンプを配置しました。ドラッグで移動できます'
            updateHistoryButtons()
            renderDecorationsOnly()
            return
        }

        if (state.armedText) {
            const value = document.getElementById('textInput').value.trim()
            if (value) {
                pushDecorationHistory()
                state.texts.push({
                    value,
                    x: point.x,
                    y: point.y,
                    size: Number(document.getElementById('textSize').value),
                    color: document.getElementById('textColor').value,
                    style: state.textStyle,
                    font: state.textFont,
                    rotation: 0,
                    z: nextDecorationZ()
                })
                state.armedText = false
                state.selectedDecoration = {
                    type: 'text',
                    index: state.texts.length - 1
                }
                toolStatus.textContent = '文字を配置しました。ドラッグで移動できます'
                updateHistoryButtons()
                renderDecorationsOnly()
            }
            return
        }

        const hit = decorationHitTest(point)
        state.selectedDecoration = hit
        updateHistoryButtons()

        if (hit) {
            const item = selectedDecorationItem()
            if (hit.type === 'text' && item) {
                state.textStyle = item.style || 'puri'
                state.textFont = item.font || 'heisei'
                const textInput = document.getElementById('textInput')
                const textSize = document.getElementById('textSize')
                const textColor = document.getElementById('textColor')
                if (textInput) textInput.value = item.value || ''
                if (textSize) textSize.value = String(Number(item.size) || 64)
                if (textColor) textColor.value = item.color || '#ff4fa3'
                document.querySelectorAll('[data-text-style]').forEach(button => {
                    button.classList.toggle('active', button.dataset.textStyle === state.textStyle)
                })
                document.querySelectorAll('[data-text-font]').forEach(button => {
                    button.classList.toggle('active', button.dataset.textFont === state.textFont)
                })
            }
            state.draggingDecoration = true
            state.dragHistoryCaptured = false
            state.dragOffset = {
                x: point.x - item.x,
                y: point.y - item.y
            }
            canvas.setPointerCapture(event.pointerId)
            toolStatus.textContent = '選択中。ドラッグで移動、右の「選択を削除」で消せます'
        } else {
            toolStatus.textContent = '編集できます'
        }

        render()
    })

    canvas.addEventListener('pointermove', event => {
        const point = canvasPoint(event)

        if (state.drawing && state.activeStroke) {
            const stroke = state.activeStroke
            const events =
                typeof event.getCoalescedEvents === 'function'
                    ? event.getCoalescedEvents()
                    : []

            if (stroke.style === 'eraser') {
                // Only the latest pointer position matters. One RAF processes
                // the whole traveled segment, preventing event-backlog lag.
                const latest =
                    events.length
                        ? canvasPoint(events[events.length - 1])
                        : point
                scheduleEraser(latest)
                return
            }

            const before = stroke.points.length
            if (events.length) {
                events.forEach(sample => {
                    appendInterpolatedStrokePoint(
                        stroke,
                        canvasPoint(sample)
                    )
                })
            } else {
                appendInterpolatedStrokePoint(stroke, point)
            }

            drawStrokeIncrement(stroke, before)
            return
        }

        if (state.draggingDecoration && state.selectedDecoration) {
            const item = selectedDecorationItem()
            if (!item) return

            if (!state.dragHistoryCaptured) {
                pushDecorationHistory()
                state.dragHistoryCaptured = true
            }

            item.x = Math.max(
                0,
                Math.min(canvas.width, point.x - state.dragOffset.x)
            )
            item.y = Math.max(
                0,
                Math.min(canvas.height, point.y - state.dragOffset.y)
            )
            scheduleDecorationRender()
        }
    })

    const finishStroke = event => {
        const finishedDrawing = state.drawing
        const wasEraser = state.activeStroke?.style === 'eraser'

        if (wasEraser) {
            if (eraserFrame) {
                cancelAnimationFrame(eraserFrame)
                eraserFrame = 0
            }
            flushEraser()
            lastEraserPoint = null
            pendingEraserPoint = null
        }

        state.drawing = false
        state.activeStroke = null
        state.draggingDecoration = false

        if (
            event.pointerId !== undefined
            && canvas.hasPointerCapture(event.pointerId)
        ) {
            canvas.releasePointerCapture(event.pointerId)
        }

        if (finishedDrawing) {
            render()
        } else if (decorationRenderFrame) {
            cancelAnimationFrame(decorationRenderFrame)
            decorationRenderFrame = 0
            renderDecorationsOnly()
        }
    }
    canvas.addEventListener('pointerup', finishStroke)
    canvas.addEventListener('pointercancel', finishStroke)

    document.querySelectorAll('[data-theme-target]').forEach(group => {
        const target = group.dataset.themeTarget

        group.querySelectorAll('[data-theme-value]').forEach(button => {
            button.addEventListener('click', () => {
                const value = button.dataset.themeValue || 'pink'

                group.querySelectorAll('[data-theme-value]').forEach(item => {
                    item.classList.toggle('active', item === button)
                })

                if (target === 'background') {
                    state.theme.backgroundPreset = value
                    backgroundUrl.value = ''
                } else {
                    state.theme.floorPreset = value
                    floorUrl.value = ''
                }

                refreshThemeStatus()
            })
        })
    })

    backgroundUrl.addEventListener('input', refreshThemeStatus)
    floorUrl.addEventListener('input', refreshThemeStatus)

    document.getElementById('themeConfirmButton').addEventListener('click', async event => {
        if (!refreshThemeStatus()) return

        const button = event.currentTarget
        button.disabled = true

        try {
            themeStatus.classList.remove('error')
            themeStatus.textContent = '背景・床をゲーム用テクスチャに変換中…'

            const [backgroundSurface, floorSurface] = await Promise.all([
                renderThemeSurface(
                    state.theme.backgroundPreset,
                    backgroundUrl.value,
                    'background'
                ),
                renderThemeSurface(
                    state.theme.floorPreset,
                    floorUrl.value,
                    'floor'
                )
            ])

            const result = await post('puriboothThemeConfirm', {
                background: backgroundSurface,
                floor: floorSurface
            })

            if (!result.ok) throw new Error(result.error || 'theme_failed')
            themeSetup.classList.add('hidden')
        } catch (error) {
            console.error('[puribooth] theme confirm failed', error)
            themeStatus.classList.add('error')
            themeStatus.textContent =
                error?.message === 'image_host_blocks_conversion'
                    || error?.message === 'image_load_failed'
                    ? 'この画像URLはゲーム用変換に対応していません。画像の直リンクか別の画像ホストをお試しください。'
                    : '背景・床の設定に失敗しました'
        } finally {
            button.disabled = false
        }
    })

    document.getElementById('themeCancelButton').addEventListener('click', async () => {
        await post('puriboothThemeCancel')
        themeSetup.classList.add('hidden')
    })

    document.getElementById('undoButton').addEventListener('click', undoDecoration)
    document.getElementById('redoButton').addEventListener('click', redoDecoration)
    const rotateSelectedDecoration = degrees => {
        const item = selectedDecorationItem()
        if (!item) return

        pushDecorationHistory()
        item.rotation =
            ((Number(item.rotation) || 0) + degrees + 360) % 360

        toolStatus.textContent = degrees < 0
            ? '選択した装飾を左へ回転しました'
            : '選択した装飾を右へ回転しました'
        updateHistoryButtons()
        render()
    }

    document.getElementById('rotateLeftButton').addEventListener('click', () => {
        rotateSelectedDecoration(-15)
    })

    document.getElementById('rotateRightButton').addEventListener('click', () => {
        rotateSelectedDecoration(15)
    })

    const moveSelectedLayer = direction => {
        const item = selectedDecorationItem()
        if (!item) return

        const entries = decorationEntries()
        if (!entries.length) return

        pushDecorationHistory()
        const values = entries.map(entry => entry.z)
        item.z =
            direction > 0
                ? Math.max(...values) + 1
                : Math.min(...values) - 1

        toolStatus.textContent =
            direction > 0
                ? '選択した装飾を前面へ移動しました'
                : '選択した装飾を背面へ移動しました'
        updateHistoryButtons()
        renderDecorationsOnly()
    }

    document.getElementById('sendBackwardButton').addEventListener('click', () => {
        moveSelectedLayer(-1)
    })

    document.getElementById('bringForwardButton').addEventListener('click', () => {
        moveSelectedLayer(1)
    })

    const resizeSelectedDecoration = factor => {
        const item = selectedDecorationItem()
        if (!item) return

        pushDecorationHistory()
        item.size = Math.max(
            24,
            Math.min(260, Math.round(item.size * factor))
        )
        toolStatus.textContent = factor < 1
            ? '選択した装飾を小さくしました'
            : '選択した装飾を大きくしました'
        updateHistoryButtons()
        renderDecorationsOnly()
    }

    document.getElementById('shrinkSelectedButton').addEventListener('click', () => {
        resizeSelectedDecoration(.86)
    })

    document.getElementById('growSelectedButton').addEventListener('click', () => {
        resizeSelectedDecoration(1.16)
    })

    document.getElementById('duplicateSelectedButton').addEventListener('click', () => {
        const selected = state.selectedDecoration
        const item = selectedDecorationItem()
        if (!selected || !item) return

        pushDecorationHistory()

        if (selected.type === 'sticker') {
            state.stickers.push({
                ...item,
                x: Math.min(canvas.width, item.x + 36),
                y: Math.min(canvas.height, item.y + 36),
                z: nextDecorationZ()
            })
            state.selectedDecoration = {
                type: 'sticker',
                index: state.stickers.length - 1
            }
        } else if (selected.type === 'text') {
            state.texts.push({
                ...item,
                x: Math.min(canvas.width, item.x + 36),
                y: Math.min(canvas.height, item.y + 36),
                z: nextDecorationZ()
            })
            state.selectedDecoration = {
                type: 'text',
                index: state.texts.length - 1
            }
        }

        updateHistoryButtons()
        toolStatus.textContent = '選択した装飾を複製しました'
        renderDecorationsOnly()
    })

    document.getElementById('deleteSelectedButton').addEventListener('click', () => {
        const selected = state.selectedDecoration
        if (!selected) return

        pushDecorationHistory()

        if (selected.type === 'sticker') {
            state.stickers.splice(selected.index, 1)
        } else if (selected.type === 'text') {
            state.texts.splice(selected.index, 1)
        }

        state.selectedDecoration = null
        updateHistoryButtons()
        toolStatus.textContent = '選択した装飾を削除しました'
        renderDecorationsOnly()
    })

    window.addEventListener('keydown', event => {
        const target = event.target
        const isTyping =
            target instanceof HTMLInputElement
            || target instanceof HTMLTextAreaElement
            || target?.isContentEditable

        if ((event.ctrlKey || event.metaKey) && !isTyping) {
            if (event.key.toLowerCase() === 'z') {
                event.preventDefault()
                if (event.shiftKey) {
                    redoDecoration()
                } else {
                    undoDecoration()
                }
                return
            }

            if (event.key.toLowerCase() === 'y') {
                event.preventDefault()
                redoDecoration()
                return
            }
        }

        if (!isTyping && (event.key === 'Delete' || event.key === 'Backspace')) {
            if (!state.selectedDecoration) return
            event.preventDefault()
            document.getElementById('deleteSelectedButton')?.click()
            return
        }

        if (!isTyping && event.key === 'Escape') {
            state.armedStamp = null
            state.armedText = false
            state.selectedDecoration = null
            state.draggingDecoration = false
            document.querySelectorAll('[data-stamp]').forEach(item => item.classList.remove('active'))
            updateHistoryButtons()
            toolStatus.textContent = '選択を解除しました'
            render()
        }
    })

    document.getElementById('resetButton').addEventListener('click', () => resetDecorations(true))

    document.getElementById('cancelButton').addEventListener('click', async () => {
        await post('puriboothCancel')
        app.classList.add('hidden')
    })

    document.getElementById('finishButton').addEventListener('click', async event => {
        const button = event.currentTarget
        button.disabled = true
        button.textContent = '書き出し中…'
        const previousSelection = state.selectedDecoration
        const previousExporting = state.exporting

        try {
            state.selectedDecoration = null
            state.exporting = true
            updateHistoryButtons()
            render()

            const image = canvas.toDataURL('image/jpeg', .92)
            const result = await post('puriboothFinish', { boothId: state.boothId, image })
            if (!result.ok) throw new Error(result.error || 'finish_failed')
            state.exporting = previousExporting
            app.classList.add('hidden')
        } catch (error) {
            state.selectedDecoration = previousSelection
            state.exporting = previousExporting
            updateHistoryButtons()
            render()
            console.error('[puribooth] finish failed', error)
            toolStatus.textContent = '保存に失敗しました。もう一度お試しください。'
        } finally {
            state.exporting = previousExporting
            button.disabled = false
            button.textContent = 'PuriPhotoへ送る'
        }
    })

    window.addEventListener('keydown', event => {
        const tag = document.activeElement?.tagName
        const typing =
            tag === 'INPUT'
            || tag === 'TEXTAREA'

        if ((event.ctrlKey || event.metaKey) && !typing) {
            const key = event.key.toLowerCase()

            if (key === 'z' && !event.shiftKey) {
                event.preventDefault()
                undoDecoration()
                return
            }

            if (key === 'y' || (key === 'z' && event.shiftKey)) {
                event.preventDefault()
                redoDecoration()
                return
            }
        }

        if (event.key === 'Delete' && !typing && state.selectedDecoration) {
            event.preventDefault()
            document.getElementById('deleteSelectedButton').click()
        }

        if (event.key === 'Escape' && !typing) {
            state.selectedDecoration = null
            state.draggingDecoration = false
            updateHistoryButtons()
            render()
        }
    })

    window.addEventListener('message', async event => {
        const data = event.data
        if (!data) return

        if (data.action === 'shootHudLine') {
            showShootHudLine(data.slot, data.text)
            return
        }

        if (data.action === 'shootSafeFrame') {
            shootSafeFrame?.classList.toggle('visible', data.visible === true)
            return
        }

        if (data.action === 'openTheme') {
            app.classList.add('hidden')
            resetThemeSetup()
            themeSetup.classList.remove('hidden')
            return
        }

        if (data.action === 'closeTheme') {
            themeSetup.classList.add('hidden')
            return
        }

        if (data.action === 'resetTheme') {
            resetThemeSetup()
            themeSetup.classList.add('hidden')
            return
        }

        if (data.action === 'close') {
            app.classList.add('hidden')
            themeSetup.classList.add('hidden')
            return
        }

        if (data.action !== 'open') return

        themeSetup.classList.add('hidden')
        state.boothId = data.boothId
        state.shots = Array.isArray(data.shots) ? data.shots.slice(0, 4) : []
        boothLabel.textContent = data.label || 'プリクラ'
        shotCount.textContent = `${state.shots.length}枚撮影`
        canvasHint.textContent = '本物のプリクラみたいに、ここで仕上げてからPuriPhotoへ'

        try {
            state.images = await Promise.all(state.shots.map(loadImage))
            resetEditorSessionState()
            app.classList.remove('hidden')
            render()
        } catch (error) {
            console.error('[puribooth] image load failed', error)
            toolStatus.textContent = '撮影画像を読み込めませんでした'
            app.classList.remove('hidden')
        }
    })

    if (document.fonts?.ready) {
        document.fonts.ready.then(() => render()).catch(() => {})
    }
})()
