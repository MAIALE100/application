(() => {
    const app = document.getElementById('app')
    const canvas = document.getElementById('canvas')
    const ctx = canvas.getContext('2d')
    const boothLabel = document.getElementById('boothLabel')
    const shotCount = document.getElementById('shotCount')
    const canvasHint = document.getElementById('canvasHint')
    const toolStatus = document.getElementById('toolStatus')

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
        stickers: [],
        texts: [],
        strokes: [],
        armedStamp: null,
        armedText: false,
        drawing: false,
        drawEnabled: false,
        activeStroke: null
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

    const loadImage = (src) => new Promise((resolve, reject) => {
        const image = new Image()
        image.crossOrigin = 'anonymous'
        image.onload = () => resolve(image)
        image.onerror = reject
        image.src = src
    })

    const drawCover = (image, x, y, w, h) => {
        const srcRatio = image.width / image.height
        const dstRatio = w / h
        let sx = 0, sy = 0, sw = image.width, sh = image.height

        if (srcRatio > dstRatio) {
            sw = image.height * dstRatio
            sx = (image.width - sw) / 2
        } else {
            sh = image.width / dstRatio
            sy = (image.height - sh) / 2
        }

        ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h)
    }

    const photoFilter = () =>
        `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%) blur(${state.softness}px)`

    const drawPhotos = () => {
        ctx.save()
        ctx.filter = photoFilter()

        if (state.layout === 'grid') {
            const cells = [
                [0, 0, 600, 450], [600, 0, 600, 450],
                [0, 450, 600, 450], [600, 450, 600, 450]
            ]
            cells.forEach((cell, i) => state.images[i] && drawCover(state.images[i], ...cell))
        } else if (state.layout === 'strip') {
            const width = 300
            for (let i = 0; i < 4; i++) {
                if (state.images[i]) drawCover(state.images[i], width * i, 0, width, 900)
            }
        } else if (state.layout === 'hero') {
            if (state.images[0]) drawCover(state.images[0], 0, 0, 800, 900)
            for (let i = 1; i < 4; i++) {
                if (state.images[i]) drawCover(state.images[i], 800, (i - 1) * 300, 400, 300)
            }
        } else {
            const selected = state.images[state.singleShot] || state.images[0]
            if (selected) drawCover(selected, 0, 0, 1200, 900)
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
            ctx.fillText('FLECITY PURI', 48, 66)
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
            ctx.font = `${item.size}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`
            ctx.fillText(item.value, item.x, item.y)
        })

        state.texts.forEach(item => {
            ctx.font = `900 ${item.size}px "Noto Sans JP",sans-serif`
            ctx.lineWidth = Math.max(4, item.size * .09)
            ctx.strokeStyle = '#fff'
            ctx.strokeText(item.value, item.x, item.y)
            ctx.fillStyle = item.color
            ctx.fillText(item.value, item.x, item.y)
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

    const resetDecorations = () => {
        state.stickers = []
        state.texts = []
        state.strokes = []
        state.armedStamp = null
        state.armedText = false
        state.drawEnabled = false
        document.querySelectorAll('[data-stamp]').forEach(button => button.classList.remove('active'))
        document.getElementById('drawToggle').textContent = 'ペン ON'
        toolStatus.textContent = '装飾をリセットしました'
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

    document.querySelectorAll('[data-preset]').forEach(button => {
        button.addEventListener('click', () => {
            const preset = button.dataset.preset
            const values = {
                natural: [104, 103, 104, 0, 3],
                puri: [118, 102, 116, .6, 10],
                y2k: [112, 112, 135, .25, 13],
                mono: [108, 122, 0, .15, 0]
            }[preset]
            if (!values) return
            ;[state.brightness, state.contrast, state.saturation, state.softness, state.warmth] = values
            ;['brightness','contrast','saturation','softness','warmth'].forEach((id, i) => {
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
        event.currentTarget.textContent = state.drawEnabled ? 'ペン OFF' : 'ペン ON'
        toolStatus.textContent = state.drawEnabled ? '写真上をドラッグして落書き' : 'ペンを停止しました'
    })

    document.getElementById('clearDrawButton').addEventListener('click', () => {
        state.strokes = []
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
            state.drawing = true
            canvas.setPointerCapture(event.pointerId)
            const stroke = {
                color: document.getElementById('drawColor').value,
                width: Number(document.getElementById('drawWidth').value),
                points: [point]
            }
            state.activeStroke = stroke
            state.strokes.push(stroke)
            render()
            return
        }

        if (state.armedStamp) {
            state.stickers.push({
                value: state.armedStamp,
                x: point.x,
                y: point.y,
                size: Number(document.getElementById('stampSize').value)
            })
            state.armedStamp = null
            document.querySelectorAll('[data-stamp]').forEach(item => item.classList.remove('active'))
            toolStatus.textContent = 'スタンプを配置しました'
            render()
            return
        }

        if (state.armedText) {
            const value = document.getElementById('textInput').value.trim()
            if (value) {
                state.texts.push({
                    value,
                    x: point.x,
                    y: point.y,
                    size: Number(document.getElementById('textSize').value),
                    color: document.getElementById('textColor').value
                })
                state.armedText = false
                toolStatus.textContent = '文字を配置しました'
                render()
            }
        }
    })

    canvas.addEventListener('pointermove', event => {
        if (!state.drawing || !state.activeStroke) return
        state.activeStroke.points.push(canvasPoint(event))
        render()
    })

    const finishStroke = event => {
        if (!state.drawing) return
        state.drawing = false
        state.activeStroke = null
        if (event.pointerId !== undefined && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    }
    canvas.addEventListener('pointerup', finishStroke)
    canvas.addEventListener('pointercancel', finishStroke)

    document.getElementById('resetButton').addEventListener('click', resetDecorations)

    document.getElementById('cancelButton').addEventListener('click', async () => {
        await post('puriboothCancel')
        app.classList.add('hidden')
    })

    document.getElementById('finishButton').addEventListener('click', async event => {
        const button = event.currentTarget
        button.disabled = true
        button.textContent = '書き出し中…'
        try {
            render()
            const image = canvas.toDataURL('image/jpeg', .92)
            const result = await post('puriboothFinish', { boothId: state.boothId, image })
            if (!result.ok) throw new Error(result.error || 'finish_failed')
            app.classList.add('hidden')
        } catch (error) {
            console.error('[puribooth] finish failed', error)
            toolStatus.textContent = '保存に失敗しました。もう一度お試しください。'
        } finally {
            button.disabled = false
            button.textContent = 'PuriPhotoへ送る'
        }
    })

    window.addEventListener('message', async event => {
        const data = event.data
        if (!data || data.action !== 'open') {
            if (data?.action === 'close') app.classList.add('hidden')
            return
        }

        state.boothId = data.boothId
        state.shots = Array.isArray(data.shots) ? data.shots.slice(0, 4) : []
        boothLabel.textContent = data.label || 'PURI'
        shotCount.textContent = `${state.shots.length} SHOTS`
        canvasHint.textContent = '本物のプリクラみたいに、ここで仕上げてからPuriPhotoへ'

        try {
            state.images = await Promise.all(state.shots.map(loadImage))
            resetDecorations()
            app.classList.remove('hidden')
            render()
        } catch (error) {
            console.error('[puribooth] image load failed', error)
            toolStatus.textContent = '撮影画像を読み込めませんでした'
            app.classList.remove('hidden')
        }
    })
})()
