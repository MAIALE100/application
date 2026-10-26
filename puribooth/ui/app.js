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
        whiten: 5,
        rosy: 4,
        stickers: [],
        texts: [],
        strokes: [],
        armedStamp: null,
        armedText: false,
        drawing: false,
        drawEnabled: false,
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

    const drawCover = (image, x, y, w, h, transform = null) => {
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

        ctx.drawImage(
            image,
            sx, sy, cropW, cropH,
            x, y, w, h
        )
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
        const del = document.getElementById('deleteSelectedButton')
        const hasSelection = Boolean(state.selectedDecoration)

        if (undo) undo.disabled = state.history.length === 0
        if (redo) redo.disabled = state.future.length === 0
        if (rotateLeft) rotateLeft.disabled = !hasSelection
        if (shrink) shrink.disabled = !hasSelection
        if (grow) grow.disabled = !hasSelection
        if (rotateRight) rotateRight.disabled = !hasSelection
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

    const decorationHitTest = point => {
        for (let i = state.texts.length - 1; i >= 0; i--) {
            const item = state.texts[i]
            ctx.save()
            ctx.font = `900 ${item.size}px "Noto Sans JP",sans-serif`
            const metrics = ctx.measureText(item.value)
            ctx.restore()
            const halfW = Math.max(item.size, metrics.width) * .55
            const halfH = item.size * .7
            if (
                point.x >= item.x - halfW
                && point.x <= item.x + halfW
                && point.y >= item.y - halfH
                && point.y <= item.y + halfH
            ) {
                return { type: 'text', index: i }
            }
        }

        for (let i = state.stickers.length - 1; i >= 0; i--) {
            const item = state.stickers[i]
            const radius = item.size * .58
            const dx = point.x - item.x
            const dy = point.y - item.y
            if ((dx * dx + dy * dy) <= radius * radius) {
                return { type: 'sticker', index: i }
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

    const drawPhotos = () => {
        ctx.save()
        ctx.filter = photoFilter()

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
                        state.photoTransforms[i]
                    )
            )
        } else if (state.layout === 'strip') {
            const width = 300
            for (let i = 0; i < 4; i++) {
                if (state.images[i]) {
                    drawCover(
                        state.images[i],
                        width * i, 0, width, 900,
                        state.photoTransforms[i]
                    )
                }
            }
        } else if (state.layout === 'hero') {
            if (state.images[0]) {
                drawCover(
                    state.images[0],
                    0, 0, 800, 900,
                    state.photoTransforms[0]
                )
            }
            for (let i = 1; i < 4; i++) {
                if (state.images[i]) {
                    drawCover(
                        state.images[i],
                        800, (i - 1) * 300, 400, 300,
                        state.photoTransforms[i]
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
                    state.photoTransforms[selectedIndex]
                )
            }
        }

        ctx.restore()

        if (state.warmth > 0) {
            ctx.save()
            ctx.globalCompositeOperation = 'soft-light'
            ctx.globalAlpha = Math.min(.22, state.warmth / 120)
            ctx.fillStyle = '#ff9a62'
            ctx.fillRect(0, 0, 1200, 900)
            ctx.restore()
        }

        if (state.glow > 0 && beautyBufferCtx) {
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
            ctx.globalAlpha = Math.min(.22, state.glow / 130)
            ctx.filter =
                `blur(${Math.max(1, state.glow / 8)}px)`
            ctx.drawImage(beautyBuffer, 0, 0)
            ctx.restore()
        }

        if (state.whiten > 0) {
            ctx.save()
            ctx.globalCompositeOperation = 'screen'
            ctx.globalAlpha = Math.min(.16, state.whiten / 150)
            ctx.fillStyle = '#fff8fb'
            ctx.fillRect(0, 0, 1200, 900)
            ctx.restore()
        }

        if (state.rosy > 0) {
            ctx.save()
            ctx.globalCompositeOperation = 'soft-light'
            ctx.globalAlpha = Math.min(.14, state.rosy / 140)
            ctx.fillStyle = '#ff6f9f'
            ctx.fillRect(0, 0, 1200, 900)
            ctx.restore()
        }
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
            ctx.fillText('フレシティプリ', 48, 66)
        } else if (state.frame === 'hearts') {
            ctx.strokeStyle = '#ff77b7'
            ctx.lineWidth = 28
            ctx.strokeRect(14, 14, 1172, 872)
            ctx.font = '42px sans-serif'
            for (let x = 42; x < 1160; x += 90) {
                ctx.fillText(x % 180 === 42 ? '♡' : '♥', x, 62)
                ctx.fillText(x % 180 === 42 ? '♥' : '♡', x, 878)
            }
        }

        ctx.restore()
    }

    const drawDecorations = () => {
        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        state.stickers.forEach(item => {
            ctx.save()
            ctx.translate(item.x, item.y)
            ctx.rotate((Number(item.rotation) || 0) * Math.PI / 180)
            ctx.font = `${item.size}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`
            ctx.fillText(item.value, 0, 0)
            ctx.restore()
        })

        state.texts.forEach(item => {
            ctx.save()
            ctx.translate(item.x, item.y)
            ctx.rotate((Number(item.rotation) || 0) * Math.PI / 180)
            ctx.font = `900 ${item.size}px "Noto Sans JP",sans-serif`
            ctx.lineWidth = Math.max(4, item.size * .09)
            ctx.strokeStyle = '#fff'
            ctx.strokeText(item.value, 0, 0)
            ctx.fillStyle = item.color
            ctx.fillText(item.value, 0, 0)
            ctx.restore()
        })
        ctx.restore()

        state.strokes.forEach(stroke => {
            if (!stroke.points.length) return
            ctx.save()
            ctx.strokeStyle = stroke.color
            ctx.lineWidth = stroke.width
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.beginPath()
            stroke.points.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y)
                else ctx.lineTo(point.x, point.y)
            })
            ctx.stroke()
            ctx.restore()
        })

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
                ctx.font = `900 ${selected.size}px "Noto Sans JP",sans-serif`
                const width = Math.max(selected.size, ctx.measureText(selected.value).width) + 28
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

    const render = () => {
        ctx.save()
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        drawPhotos()
        drawFrame()
        drawDecorations()
        ctx.restore()
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
        state.drawEnabled = false
        state.selectedDecoration = null
        state.draggingDecoration = false
        state.dragHistoryCaptured = false

        if (!recordHistory) {
            state.history = []
            state.future = []
        }

        document.querySelectorAll('[data-stamp]').forEach(button => button.classList.remove('active'))
        document.getElementById('drawToggle').textContent = 'ペン：オン'
        toolStatus.textContent = recordHistory ? '装飾をリセットしました' : '編集できます'
        updateHistoryButtons()
        render()
    }

    const setTab = tab => {
        document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === tab))
        document.querySelectorAll('[data-page]').forEach(page => page.classList.toggle('active', page.dataset.page === tab))
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
        state.whiten = 5
        state.rosy = 4

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
            whiten: 5,
            rosy: 4
        }

        Object.entries(defaultRanges).forEach(([id, value]) => {
            const input = document.getElementById(id)
            if (input) input.value = value
        })

        setTab('layout')
        resetPhotoTransforms()
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
    bindRange('whiten', 'whiten')
    bindRange('rosy', 'rosy')

    document.querySelectorAll('[data-preset]').forEach(button => {
        button.addEventListener('click', () => {
            const preset = button.dataset.preset
            const values = {
                natural: [104, 103, 104, 0, 3, 2, 1, 1],
                puri: [118, 102, 116, .6, 10, 16, 8, 7],
                y2k: [112, 112, 135, .25, 13, 12, 5, 4],
                mono: [108, 122, 0, .15, 0, 4, 2, 0],
                soft: [124, 96, 118, 1.1, 12, 22, 10, 8],
                cool: [110, 108, 116, .25, 0, 6, 4, 0],
                night: [128, 110, 112, .35, 6, 14, 7, 4]
            }[preset]
            if (!values) return
            ;[
                state.brightness,
                state.contrast,
                state.saturation,
                state.softness,
                state.warmth,
                state.glow,
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
                'whiten',
                'rosy'
            ].forEach((id, i) => {
                document.getElementById(id).value = values[i]
            })
            toolStatus.textContent = `${preset.toUpperCase()} を適用しました`
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

    document.getElementById('drawToggle').addEventListener('click', event => {
        state.drawEnabled = !state.drawEnabled
        state.armedStamp = null
        state.armedText = false
        event.currentTarget.textContent = state.drawEnabled ? 'ペン：オフ' : 'ペン：オン'
        toolStatus.textContent = state.drawEnabled ? '写真上をドラッグして落書き' : 'ペンを停止しました'
    })

    document.getElementById('clearDrawButton').addEventListener('click', () => {
        if (!state.strokes.length) return
        pushDecorationHistory()
        state.strokes = []
        state.selectedDecoration = null
        updateHistoryButtons()
        toolStatus.textContent = '落書きを消しました'
        render()
    })

    const canvasPoint = event => {
        const rect = canvas.getBoundingClientRect()
        return {
            x: (event.clientX - rect.left) / rect.width * canvas.width,
            y: (event.clientY - rect.top) / rect.height * canvas.height
        }
    }

    canvas.addEventListener('pointerdown', event => {
        const point = canvasPoint(event)

        if (state.drawEnabled) {
            pushDecorationHistory()
            state.selectedDecoration = null
            state.drawing = true
            canvas.setPointerCapture(event.pointerId)
            const stroke = {
                color: document.getElementById('drawColor').value,
                width: Number(document.getElementById('drawWidth').value),
                points: [point]
            }
            state.activeStroke = stroke
            state.strokes.push(stroke)
            updateHistoryButtons()
            render()
            return
        }

        if (state.armedStamp) {
            pushDecorationHistory()
            state.stickers.push({
                value: state.armedStamp,
                x: point.x,
                y: point.y,
                size: Number(document.getElementById('stampSize').value),
                rotation: 0
            })
            state.armedStamp = null
            state.selectedDecoration = {
                type: 'sticker',
                index: state.stickers.length - 1
            }
            document.querySelectorAll('[data-stamp]').forEach(item => item.classList.remove('active'))
            toolStatus.textContent = 'スタンプを配置しました。ドラッグで移動できます'
            updateHistoryButtons()
            render()
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
                    rotation: 0
                })
                state.armedText = false
                state.selectedDecoration = {
                    type: 'text',
                    index: state.texts.length - 1
                }
                toolStatus.textContent = '文字を配置しました。ドラッグで移動できます'
                updateHistoryButtons()
                render()
            }
            return
        }

        const hit = decorationHitTest(point)
        state.selectedDecoration = hit
        updateHistoryButtons()

        if (hit) {
            const item = selectedDecorationItem()
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
            state.activeStroke.points.push(point)
            render()
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
            render()
        }
    })

    const finishStroke = event => {
        state.drawing = false
        state.activeStroke = null
        state.draggingDecoration = false

        if (
            event.pointerId !== undefined
            && canvas.hasPointerCapture(event.pointerId)
        ) {
            canvas.releasePointerCapture(event.pointerId)
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
        render()
    }

    document.getElementById('shrinkSelectedButton').addEventListener('click', () => {
        resizeSelectedDecoration(.86)
    })

    document.getElementById('growSelectedButton').addEventListener('click', () => {
        resizeSelectedDecoration(1.16)
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
        render()
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

        try {
            state.selectedDecoration = null
            updateHistoryButtons()
            render()

            const image = canvas.toDataURL('image/jpeg', .92)
            const result = await post('puriboothFinish', { boothId: state.boothId, image })
            if (!result.ok) throw new Error(result.error || 'finish_failed')
            app.classList.add('hidden')
        } catch (error) {
            state.selectedDecoration = previousSelection
            updateHistoryButtons()
            render()
            console.error('[puribooth] finish failed', error)
            toolStatus.textContent = '保存に失敗しました。もう一度お試しください。'
        } finally {
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
})()
