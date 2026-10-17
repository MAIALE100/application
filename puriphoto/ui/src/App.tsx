import { PointerEvent as ReactPointerEvent, ReactNode, useEffect, useRef, useState } from 'react'
import './App.css'
import Frame from './components/Frame'

const resourceName = typeof window.GetParentResourceName === 'function' ? window.GetParentResourceName() : 'puriphoto'
const puriPhotoResourceName = 'puriphoto'
const isTopLevelPuriPhotoNui = window.location.hostname === 'cfx-nui-puriphoto'
const devMode = !window['invokeNative'] && !isTopLevelPuriPhotoNui
type FrameStyle = 'none' | 'soft' | 'pop'
type StampId = 'heart' | 'pinkHeart' | 'brokenHeart' | 'star' | 'sparkle' | 'crown' | 'ribbon' | 'flower' | 'cherryBlossom' | 'tulip' | 'sunflower' | 'butterfly' | 'cherry' | 'strawberry' | 'peach' | 'cake' | 'candy' | 'lollipop' | 'iceCream' | 'donut' | 'coffee' | 'cat' | 'dog' | 'bear' | 'rabbit' | 'panda' | 'chick' | 'frog' | 'smile' | 'loveFace' | 'kiss' | 'cool' | 'party' | 'fire' | 'rainbow' | 'cloud' | 'sun' | 'moon' | 'music' | 'note' | 'camera' | 'gift' | 'balloon' | 'clover' | 'diamond' | 'hundred'
type StampInstance = { instanceId: number; stampId: StampId; x: number; y: number; scale: number; rotation: number }
type StampCategory = 'love' | 'cute' | 'food' | 'animal' | 'face' | 'other'
type CaptionColor = 'pink' | 'hotPink' | 'red' | 'orange' | 'yellow' | 'lime' | 'green' | 'mint' | 'cyan' | 'blue' | 'navy' | 'purple' | 'lavender' | 'brown' | 'beige' | 'white' | 'gray' | 'black'
type CaptionFont = 'gothic' | 'serif' | 'rounded'
type CaptionInstance = { instanceId: number; text: string; x: number; y: number; scale: number; rotation: number; color: CaptionColor; outlineColor: CaptionColor; font: CaptionFont; outline: boolean; boxWidth: number }
type SelectedOverlay = { kind: 'stamp' | 'caption'; id: number }
const CAPTION_COLORS: Record<CaptionColor, string> = {
    pink: '#e98bb7',
    hotPink: '#e83e8c',
    red: '#e5484d',
    orange: '#f28c38',
    yellow: '#f1c83b',
    lime: '#a8d84e',
    green: '#42a66b',
    mint: '#70d6b5',
    cyan: '#55c7d9',
    blue: '#3b68c7',
    navy: '#344b78',
    purple: '#8b5cc7',
    lavender: '#b79ae3',
    brown: '#8b6048',
    beige: '#d8b98d',
    white: '#ffffff',
    gray: '#8a8588',
    black: '#1f1b1e'
}
const CAPTION_FONTS: Record<CaptionFont, { label: string; css: string; canvas: string }> = {
    gothic: { label: 'ゴシック', css: '"Noto Sans JP", sans-serif', canvas: '"Noto Sans JP", sans-serif' },
    serif: { label: '明朝', css: '"Noto Serif JP", "Yu Mincho", serif', canvas: '"Noto Serif JP", "Yu Mincho", serif' },
    rounded: { label: '丸文字', css: '"Arial Rounded MT Bold", "Trebuchet MS", "Noto Sans JP", sans-serif', canvas: '"Arial Rounded MT Bold", "Trebuchet MS", "Noto Sans JP", sans-serif' }
}
const STAMPS: { id: StampId; label: string; glyph: string; category: StampCategory }[] = [
    { id: 'heart', label: 'ハート', glyph: '❤️' , category: 'love' },
    { id: 'pinkHeart', label: 'ピンク', glyph: '💗' , category: 'love' },
    { id: 'brokenHeart', label: '失恋', glyph: '💔' , category: 'love' },
    { id: 'star', label: '星', glyph: '⭐' , category: 'cute' },
    { id: 'sparkle', label: 'キラキラ', glyph: '✨' , category: 'cute' },
    { id: 'crown', label: '王冠', glyph: '👑' , category: 'cute' },
    { id: 'ribbon', label: 'リボン', glyph: '🎀' , category: 'cute' },
    { id: 'flower', label: '花', glyph: '🌸' , category: 'cute' },
    { id: 'cherryBlossom', label: '桜', glyph: '🌺' , category: 'cute' },
    { id: 'tulip', label: 'チューリップ', glyph: '🌷' , category: 'cute' },
    { id: 'sunflower', label: 'ひまわり', glyph: '🌻' , category: 'cute' },
    { id: 'butterfly', label: '蝶', glyph: '🦋' , category: 'cute' },
    { id: 'cherry', label: 'さくらんぼ', glyph: '🍒' , category: 'food' },
    { id: 'strawberry', label: 'いちご', glyph: '🍓' , category: 'food' },
    { id: 'peach', label: '桃', glyph: '🍑' , category: 'food' },
    { id: 'cake', label: 'ケーキ', glyph: '🍰' , category: 'food' },
    { id: 'candy', label: 'キャンディ', glyph: '🍬' , category: 'food' },
    { id: 'lollipop', label: 'ペロペロ', glyph: '🍭' , category: 'food' },
    { id: 'iceCream', label: 'アイス', glyph: '🍦' , category: 'food' },
    { id: 'donut', label: 'ドーナツ', glyph: '🍩' , category: 'food' },
    { id: 'coffee', label: 'コーヒー', glyph: '☕' , category: 'food' },
    { id: 'cat', label: 'ねこ', glyph: '🐱' , category: 'animal' },
    { id: 'dog', label: 'いぬ', glyph: '🐶' , category: 'animal' },
    { id: 'bear', label: 'くま', glyph: '🐻' , category: 'animal' },
    { id: 'rabbit', label: 'うさぎ', glyph: '🐰' , category: 'animal' },
    { id: 'panda', label: 'パンダ', glyph: '🐼' , category: 'animal' },
    { id: 'chick', label: 'ひよこ', glyph: '🐥' , category: 'animal' },
    { id: 'frog', label: 'かえる', glyph: '🐸' , category: 'animal' },
    { id: 'smile', label: 'スマイル', glyph: '😊' , category: 'face' },
    { id: 'loveFace', label: 'ラブ', glyph: '😍' , category: 'face' },
    { id: 'kiss', label: 'キス', glyph: '😘' , category: 'face' },
    { id: 'cool', label: 'クール', glyph: '😎' , category: 'face' },
    { id: 'party', label: 'パーティ', glyph: '🥳' , category: 'face' },
    { id: 'fire', label: '炎', glyph: '🔥' , category: 'other' },
    { id: 'rainbow', label: '虹', glyph: '🌈' , category: 'other' },
    { id: 'cloud', label: '雲', glyph: '☁️' , category: 'other' },
    { id: 'sun', label: '太陽', glyph: '☀️' , category: 'other' },
    { id: 'moon', label: '月', glyph: '🌙' , category: 'other' },
    { id: 'music', label: '音楽', glyph: '🎵' , category: 'other' },
    { id: 'note', label: '音符', glyph: '🎶' , category: 'other' },
    { id: 'camera', label: 'カメラ', glyph: '📷' , category: 'other' },
    { id: 'gift', label: 'プレゼント', glyph: '🎁' , category: 'other' },
    { id: 'balloon', label: '風船', glyph: '🎈' , category: 'other' },
    { id: 'clover', label: 'クローバー', glyph: '🍀' , category: 'other' },
    { id: 'diamond', label: 'ダイヤ', glyph: '💎' , category: 'other' },
    { id: 'hundred', label: '100', glyph: '💯' , category: 'other' }
]

const StandaloneEditorLayer = () => {
    const [photoUrl, setPhotoUrl] = useState<string | null>(null)

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            const data = event.data
            if (!data || typeof data !== 'object') return
            if (data.action === 'puriphoto:showStandaloneEditor' && typeof data.photoUrl === 'string') {
                setPhotoUrl(data.photoUrl)
            } else if (data.action === 'puriphoto:hideStandaloneEditor') {
                setPhotoUrl(null)
            }
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [])

    const isTopLevelPuriPhotoNui = window.location.hostname === 'cfx-nui-puriphoto'
    if (!isTopLevelPuriPhotoNui || !photoUrl) return null

    return (
        <main className="standalone-editor-layer">
            <section className="standalone-editor-card">
                <div className="standalone-editor-title">PuriPhoto EDIT PREVIEW</div>
                <img src={photoUrl} className="standalone-editor-photo" alt="編集中の写真" />
                <div className="standalone-editor-hint">右のスマホから編集できます</div>
            </section>
        </main>
    )
}

const App = () => {
    const [photoUrl, setPhotoUrl] = useState<string | null>(null)
    const [sourcePhotoUrl, setSourcePhotoUrl] = useState<string | null>(null)
    const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [selectedFrame, setSelectedFrame] = useState<FrameStyle>('none')
    const [stampInstances, setStampInstances] = useState<StampInstance[]>([])
    const [captionDraft, setCaptionDraft] = useState('')
    const [captionDraftBoxWidth, setCaptionDraftBoxWidth] = useState(70)
    const [captionDraftColor, setCaptionDraftColor] = useState<CaptionColor>('pink')
    const [captionDraftOutlineColor, setCaptionDraftOutlineColor] = useState<CaptionColor>('white')
    const [captionDraftFont, setCaptionDraftFont] = useState<CaptionFont>('gothic')
    const [captionDraftOutline, setCaptionDraftOutline] = useState(true)
    const [captionInstances, setCaptionInstances] = useState<CaptionInstance[]>([])
    const [draggingItem, setDraggingItem] = useState<SelectedOverlay | null>(null)
    const [selectedOverlay, setSelectedOverlay] = useState<SelectedOverlay | null>(null)
    const nextOverlayId = useRef(1)
    const activePointers = useRef(new Map<number, { x: number; y: number }>())
    const gestureStart = useRef<{ distance: number; angle: number; scale: number; rotation: number } | null>(null)
    const [photoAspectRatio, setPhotoAspectRatio] = useState<number | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [activeEditorTab, setActiveEditorTab] = useState<'frame' | 'stamp' | 'text'>('stamp')
    const [stampCategory, setStampCategory] = useState<StampCategory | 'all'>('all')

    useEffect(() => {
        document.body.style.visibility = 'visible'
    }, [])

    const showStandaloneEditor = (url: string) => {
        if (devMode) return
        fetch(`https://${puriPhotoResourceName}/puriphoto:showStandaloneEditor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify({ photoUrl: url })
        }).catch(() => undefined)
    }

    const hideStandaloneEditor = () => {
        if (devMode) return
        fetch(`https://${puriPhotoResourceName}/puriphoto:hideStandaloneEditor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: '{}'
        }).catch(() => undefined)
    }

    const frameImageSrc = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/frames/frame01-landscape.webp`

    const takePhoto = () => {
        setError(null)
        if (typeof window.useCamera !== 'function') {
            setError('カメラは LB Phone 内で利用できます。')
            return
        }

        try {
            window.useCamera((url) => {
                if (typeof url === 'string' && url.trim()) {
                    setPhotoUrl(url)
                    setSourcePhotoUrl(url)
                    setSavedPhotoUrl(null)
                    setIsEditing(false)
                    setSelectedFrame('none')
                    setStampInstances([])
                    setCaptionDraft('')
                    setCaptionInstances([])
                    setSelectedOverlay(null)
                    setPhotoAspectRatio(null)
                    setError(null)
                }
            }, {
                default: { type: 'Photo' },
                permissions: {
                    takePhoto: true,
                    takeVideo: false,
                    takeLandscapePhoto: true
                },
                saveToGallery: false
            })
        } catch {
            setError('カメラを開けませんでした。もう一度お試しください。')
        }
    }

    const chooseFromGallery = () => {
        setError(null)

        if (typeof components === 'undefined' || typeof components.setGallery !== 'function') {
            setError('ギャラリーは LB Phone 内で利用できます。')
            return
        }

        try {
            components.setGallery({
                includeImages: true,
                includeVideos: false,
                allowExternal: false,
                multiSelect: false,
                onSelect: (data) => {
                    const selected = Array.isArray(data) ? data[0] : data
                    if (!selected || selected.isVideo || typeof selected.src !== 'string' || !selected.src.trim()) {
                        setError('写真を選択できませんでした。画像を選び直してください。')
                        return
                    }

                    setPhotoUrl(selected.src)
                    setSourcePhotoUrl(selected.src)
                    setSavedPhotoUrl(null)
                    setIsEditing(false)
                    setSelectedFrame('none')
                    setStampInstances([])
                    setPhotoAspectRatio(null)
                    setError(null)
                }
            })
        } catch (cause) {
            console.error('[PuriPhoto] Failed to open gallery:', cause)
            setError('ギャラリーを開けませんでした。')
        }
    }

    const moveOverlayItem = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!draggingItem || gestureStart.current) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (!rect.width || !rect.height) return
        const x = Math.max(4, Math.min(96, ((event.clientX - rect.left) / rect.width) * 100))
        const y = Math.max(4, Math.min(96, ((event.clientY - rect.top) / rect.height) * 100))
        if (draggingItem.kind === 'caption') {
            setCaptionInstances((current) => current.map((item) =>
                item.instanceId === draggingItem.id ? { ...item, x, y } : item
            ))
        } else {
            setStampInstances((current) => current.map((item) =>
                item.instanceId === draggingItem.id ? { ...item, x, y } : item
            ))
        }
    }

    const beginStagePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
        activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-overlay-kind]')
        if (!target) return

        const kind = target.dataset.overlayKind as 'stamp' | 'caption' | undefined
        const id = Number(target.dataset.overlayId)
        if (!kind || !Number.isFinite(id)) return

        const overlay = { kind, id } as SelectedOverlay
        setSelectedOverlay(overlay)

        if (activePointers.current.size === 2) {
            const points = [...activePointers.current.values()]
            const dx = points[1].x - points[0].x
            const dy = points[1].y - points[0].y
            const selected = kind === 'stamp'
                ? stampInstances.find((item) => item.instanceId === id)
                : captionInstances.find((item) => item.instanceId === id)
            if (!selected) return

            gestureStart.current = {
                distance: Math.max(1, Math.hypot(dx, dy)),
                angle: Math.atan2(dy, dx) * 180 / Math.PI,
                scale: selected.scale,
                rotation: selected.rotation
            }
            setDraggingItem(null)
        }
    }

    const updateStagePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!activePointers.current.has(event.pointerId)) return
        activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

        const gesture = gestureStart.current
        if (!gesture || !selectedOverlay || activePointers.current.size < 2) return

        const points = [...activePointers.current.values()]
        const dx = points[1].x - points[0].x
        const dy = points[1].y - points[0].y
        const distance = Math.max(1, Math.hypot(dx, dy))
        const angle = Math.atan2(dy, dx) * 180 / Math.PI
        updateSelectedOverlay({
            scale: Math.max(0.35, Math.min(3.5, gesture.scale * distance / gesture.distance)),
            rotation: gesture.rotation + (angle - gesture.angle)
        })
    }

    const endStagePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
        activePointers.current.delete(event.pointerId)
        if (activePointers.current.size < 2) gestureStart.current = null
        setDraggingItem(null)
    }

    const handleStageWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        if (!selectedOverlay) return
        event.preventDefault()

        const selected = getSelectedOverlayValues()
        if (!selected) return

        if (event.shiftKey) {
            const direction = event.deltaY < 0 ? 8 : -8
            updateSelectedOverlay({ rotation: selected.rotation + direction })
        } else {
            const direction = event.deltaY < 0 ? 0.1 : -0.1
            updateSelectedOverlay({ scale: Math.max(0.35, Math.min(3.5, selected.scale + direction)) })
        }
    }

    const addStamp = (stampId: StampId) => {
        const offset = (stampInstances.length % 5) * 4
        setStampInstances((current) => [...current, {
            instanceId: nextOverlayId.current++,
            stampId,
            x: 50 + offset,
            y: 50 + offset,
            scale: 1,
            rotation: 0
        }])
    }

    const addCaption = () => {
        const text = captionDraft.trim().slice(0, 120)
        if (!text) return
        const offset = (captionInstances.length % 5) * 5
        setCaptionInstances((current) => [...current, {
            instanceId: nextOverlayId.current++,
            text,
            x: 50,
            y: Math.min(85, 45 + offset),
            scale: 1,
            rotation: 0,
            color: captionDraftColor,
            outlineColor: captionDraftOutlineColor,
            font: captionDraftFont,
            outline: captionDraftOutline,
            boxWidth: captionDraftBoxWidth
        }])
        setCaptionDraft('')
    }

    const updateSelectedOverlay = (changes: { scale?: number; rotation?: number; color?: CaptionColor; outlineColor?: CaptionColor; font?: CaptionFont; outline?: boolean; boxWidth?: number }) => {
        if (!selectedOverlay) return
        if (selectedOverlay.kind === 'stamp') {
            setStampInstances((current) => current.map((item) =>
                item.instanceId === selectedOverlay.id ? {
                    ...item,
                    scale: changes.scale ?? item.scale,
                    rotation: changes.rotation ?? item.rotation
                } : item
            ))
        } else {
            setCaptionInstances((current) => current.map((item) =>
                item.instanceId === selectedOverlay.id ? {
                    ...item,
                    scale: changes.scale ?? item.scale,
                    rotation: changes.rotation ?? item.rotation,
                    color: changes.color ?? item.color,
                    outlineColor: changes.outlineColor ?? item.outlineColor,
                    font: changes.font ?? item.font,
                    outline: changes.outline ?? item.outline,
                    boxWidth: changes.boxWidth ?? item.boxWidth
                } : item
            ))
        }
    }

    const getSelectedOverlayValues = () => {
        if (!selectedOverlay) return null
        return selectedOverlay.kind === 'stamp'
            ? stampInstances.find((item) => item.instanceId === selectedOverlay.id) ?? null
            : captionInstances.find((item) => item.instanceId === selectedOverlay.id) ?? null
    }

    const deleteSelectedOverlay = () => {
        if (!selectedOverlay) return
        if (selectedOverlay.kind === 'stamp') {
            setStampInstances((current) => current.filter((item) => item.instanceId !== selectedOverlay.id))
        } else {
            setCaptionInstances((current) => current.filter((item) => item.instanceId !== selectedOverlay.id))
        }
        setDraggingItem(null)
        setSelectedOverlay(null)
    }

    const saveFinishedPhoto = async () => {
        if (!photoUrl || isSaving) return

        setIsSaving(true)
        setError(null)

        try {
            if (typeof components === 'undefined' || typeof components.uploadMedia !== 'function' || typeof components.saveToGallery !== 'function') {
                throw new Error('LB Phone gallery functions are unavailable')
            }

            const loadImage = (src: string, crossOrigin = false) => new Promise<HTMLImageElement>((resolve, reject) => {
                const image = new Image()
                if (crossOrigin && /^https?:/i.test(src)) image.crossOrigin = 'anonymous'
                image.onload = () => resolve(image)
                image.onerror = () => reject(new Error('An image could not be loaded for export'))
                image.src = src
            })

            const photo = await loadImage(photoUrl, true)
            const width = photo.naturalWidth
            const height = photo.naturalHeight
            if (!width || !height) throw new Error('The source photo has invalid dimensions')

            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const context = canvas.getContext('2d')
            if (!context) throw new Error('Canvas is unavailable')

            context.drawImage(photo, 0, 0, width, height)

            if (selectedFrame === 'soft') {
                const framePath = photoAspectRatio !== null ? photoAspectRatio : width / height
                const frameSrc = framePath > 1
                    ? frameImageSrc
                    : `${import.meta.env.BASE_URL.replace(/\/$/, '')}/frames/frame01-portrait.webp`
                const frameImage = await loadImage(frameSrc)
                context.drawImage(frameImage, 0, 0, width, height)
            } else if (selectedFrame === 'pop') {
                const borderWidth = Math.max(12, Math.round(Math.min(width, height) * 0.035))
                context.save()
                context.lineWidth = borderWidth
                context.strokeStyle = 'rgba(169, 72, 117, 0.9)'
                context.setLineDash([borderWidth * 1.1, borderWidth * 0.65])
                context.strokeRect(borderWidth / 2, borderWidth / 2, width - borderWidth, height - borderWidth)
                context.restore()
            }

            if (stampInstances.length > 0) {
                const stampSize = Math.max(30, Math.round(Math.min(width, height) * 0.11))
                context.save()
                context.font = `${stampSize}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
                context.textAlign = 'center'
                context.textBaseline = 'middle'
                context.shadowColor = 'rgba(255, 105, 180, 0.65)'
                context.shadowBlur = stampSize * 0.18
                for (const item of stampInstances) {
                    const stamp = STAMPS.find((candidate) => candidate.id === item.stampId)
                    if (!stamp) continue
                    context.save()
                    context.translate(width * item.x / 100, height * item.y / 100)
                    context.rotate(item.rotation * Math.PI / 180)
                    context.scale(item.scale, item.scale)
                    context.fillText(stamp.glyph, 0, 0)
                    context.restore()
                }
                context.restore()
            }

            if (captionInstances.length > 0) {
                const fontSize = Math.max(22, Math.round(Math.min(width, height) * 0.055))
                context.save()
                context.textAlign = 'center'
                context.textBaseline = 'middle'
                context.lineWidth = Math.max(3, fontSize * 0.14)
                context.lineJoin = 'round'
                for (const item of captionInstances) {
                    context.strokeStyle = CAPTION_COLORS[item.outlineColor]
                    context.font = `700 ${fontSize}px ${CAPTION_FONTS[item.font].canvas}`
                    context.fillStyle = CAPTION_COLORS[item.color]
                    context.save()
                    context.translate(width * item.x / 100, height * item.y / 100)
                    context.rotate(item.rotation * Math.PI / 180)
                    context.scale(item.scale, item.scale)
                    const lines = item.text.split('\n')
                    const lineHeight = fontSize * 1.25
                    const startY = -((lines.length - 1) * lineHeight) / 2
                    lines.forEach((line, lineIndex) => {
                        const y = startY + lineIndex * lineHeight
                        if (item.outline) context.strokeText(line, 0, y)
                        context.fillText(line, 0, y)
                    })
                    context.restore()
                }
                context.restore()
            }

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((result) => {
                    if (result) resolve(result)
                    else reject(new Error('Canvas export failed; the photo host may block canvas access'))
                }, 'image/png')
            })

            const uploadedUrl = await components.uploadMedia('Image', blob)
            if (typeof uploadedUrl !== 'string' || !uploadedUrl.trim()) {
                throw new Error('The finished photo upload returned no URL')
            }

            await components.saveToGallery(uploadedUrl)
            setPhotoUrl(uploadedUrl)
            setSavedPhotoUrl(uploadedUrl)
            setPhotoAspectRatio(width / height)
            setSelectedFrame('none')
            setStampInstances([])
            setIsEditing(false)
            setError(null)
        } catch (cause) {
            console.error('[PuriPhoto] Failed to save finished photo:', cause)
            setError('完成画像を保存できませんでした。LB Phoneの画像アップロード設定、または写真URLの読み込み権限を確認してください。')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <AppProvider>
            <main className="app">
                <div className="app-wrapper">
                    <header className="app-header">
                        <p className="app-eyebrow">{isEditing ? '写真をかわいく仕上げよう。' : '今日の一枚を、ここに。'}</p>
                        <h1>{isEditing ? '編集' : 'PuriPhoto'}</h1>
                    </header>

                    <section className="photo-area" aria-label={isEditing ? '編集中の写真' : '撮影した写真'}>
                        {photoUrl ? (
                            <div
                                className="photo-stage"
                                style={photoAspectRatio ? { aspectRatio: photoAspectRatio } : undefined}
                                onPointerDownCapture={beginStagePointer}
                                onPointerMoveCapture={updateStagePointer}
                                onPointerUpCapture={endStagePointer}
                                onPointerCancelCapture={endStagePointer}
                                onPointerMove={moveOverlayItem}
                                onWheel={handleStageWheel}
                                onPointerDown={(event) => {
                                    if (event.target === event.currentTarget) setSelectedOverlay(null)
                                }}
                            >
                                <img
                                    className="photo-preview"
                                    src={photoUrl}
                                    alt={isEditing ? '編集中の写真' : '撮影した写真'}
                                    onLoad={(event) => {
                                        const image = event.currentTarget
                                        if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                                            setPhotoAspectRatio(image.naturalWidth / image.naturalHeight)
                                        }
                                    }}
                                    onError={() => setError('写真を読み込めませんでした。撮り直すことができます。')}
                                />
                                {isEditing && selectedFrame !== 'none' && (
                                    selectedFrame === 'soft' && photoAspectRatio !== null
                                        ? <img
                                            className="frame-image-overlay"
                                            src={photoAspectRatio > 1
                                                ? frameImageSrc
                                                : `${import.meta.env.BASE_URL.replace(/\/$/, '')}/frames/frame01-portrait.webp`}
                                            alt=""
                                            aria-hidden="true"
                                        />
                                        : <div className={`frame-overlay frame-${selectedFrame}`} aria-hidden="true" />
                                )}
                                {isEditing && stampInstances.map((item) => {
                                    const stamp = STAMPS.find((candidate) => candidate.id === item.stampId)
                                    if (!stamp) return null
                                    return (
                                        <span
                                            key={item.instanceId}
                                            className={selectedOverlay?.kind === 'stamp' && selectedOverlay.id === item.instanceId ? 'stamp-overlay overlay-selected' : 'stamp-overlay'}
                                            data-overlay-kind="stamp"
                                            data-overlay-id={item.instanceId}
                                            style={{ left: `${item.x}%`, top: `${item.y}%`, transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})` }}
                                            onPointerDown={(event) => {
                                                event.preventDefault()
                                                event.stopPropagation()
                                                setSelectedOverlay({ kind: 'stamp', id: item.instanceId })
                                                setDraggingItem({ kind: 'stamp', id: item.instanceId })
                                                event.currentTarget.setPointerCapture(event.pointerId)
                                            }}
                                            aria-label={`${stamp.label}。タップして選択`}
                                        >
                                            {stamp.glyph}
                                        </span>
                                    )
                                })}
                                {isEditing && captionInstances.map((item) => (
                                    <span
                                        key={item.instanceId}
                                        className={selectedOverlay?.kind === 'caption' && selectedOverlay.id === item.instanceId ? 'caption-overlay overlay-selected' : 'caption-overlay'}
                                        data-overlay-kind="caption"
                                        data-overlay-id={item.instanceId}
                                        style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.boxWidth}%`, color: CAPTION_COLORS[item.color], fontFamily: CAPTION_FONTS[item.font].css, WebkitTextStroke: item.outline ? `0.08em ${CAPTION_COLORS[item.outlineColor]}` : '0', transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})` }}
                                        onPointerDown={(event) => {
                                            event.preventDefault()
                                            event.stopPropagation()
                                            setSelectedOverlay({ kind: 'caption', id: item.instanceId })
                                            setDraggingItem({ kind: 'caption', id: item.instanceId })
                                            event.currentTarget.setPointerCapture(event.pointerId)
                                        }}
                                        aria-label="文字。タップして選択"
                                    >
                                        {item.text}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <span className="camera-mark" aria-hidden="true">◎</span>
                                <h2>まずは写真を撮ろう</h2>
                                <p>お気に入りの瞬間を<br />PuriPhotoに。</p>
                            </div>
                        )}
                    </section>

                    <footer className="capture-controls">
                        {isEditing && (
                            <div className="editor-tabs" aria-label="編集ツール">
                                <button type="button" className={activeEditorTab === 'frame' ? 'selected' : ''} onClick={() => setActiveEditorTab('frame')}>フレーム</button>
                                <button type="button" className={activeEditorTab === 'stamp' ? 'selected' : ''} onClick={() => setActiveEditorTab('stamp')}>スタンプ</button>
                                <button type="button" className={activeEditorTab === 'text' ? 'selected' : ''} onClick={() => setActiveEditorTab('text')}>文字</button>
                            </div>
                        )}
                        {isEditing && selectedOverlay && (() => {
                            const selected = getSelectedOverlayValues()
                            if (!selected) return null
                            return (
                                <div className="overlay-toolbar" aria-label="選択中のアイテムを編集">
                                    <button type="button" onClick={() => updateSelectedOverlay({ scale: Math.max(0.45, selected.scale - 0.15) })}>− 小さく</button>
                                    <button type="button" onClick={() => updateSelectedOverlay({ scale: Math.min(2.5, selected.scale + 0.15) })}>＋ 大きく</button>
                                    <button type="button" onClick={() => updateSelectedOverlay({ rotation: selected.rotation - 15 })}>↶ 回転</button>
                                    <button type="button" onClick={() => updateSelectedOverlay({ rotation: selected.rotation + 15 })}>↷ 回転</button>
                                    <button type="button" className="delete-overlay-button" onClick={deleteSelectedOverlay}>🗑 削除</button>
                                </div>
                            )
                        })()}
                        {isEditing && activeEditorTab === 'frame' && (
                            <div className="frame-picker" aria-label="フレームを選択">
                                <button className={selectedFrame === 'none' ? 'frame-option selected' : 'frame-option'} onClick={() => setSelectedFrame('none')}>なし</button>
                                <button className={selectedFrame === 'soft' ? 'frame-option selected' : 'frame-option'} onClick={() => setSelectedFrame('soft')}>フレーム1</button>
                                <button className={selectedFrame === 'pop' ? 'frame-option selected' : 'frame-option'} onClick={() => setSelectedFrame('pop')}>フレーム2</button>
                            </div>
                        )}
                        {isEditing && activeEditorTab === 'text' && (
                            <div className="caption-input-wrap">
                                <span>{selectedOverlay?.kind === 'caption' ? '選択中の文字を編集' : '文字入れ（何個でも追加できます）'}</span>
                                <div className="caption-input-row">
                                    <textarea
                                        className="caption-input"
                                        maxLength={120}
                                        rows={2}
                                        value={captionDraft}
                                        onChange={(event) => setCaptionDraft(event.target.value)}
                                        placeholder={'例：最高の\n一枚！'}
                                    />
                                    <button type="button" className="caption-add-button" onClick={addCaption} disabled={!captionDraft.trim()}>追加</button>
                                </div>
                                <div className="caption-width-control">
                                    <span>文字枠の幅</span>
                                    <input
                                        type="range"
                                        min="25"
                                        max="95"
                                        step="5"
                                        value={selectedOverlay?.kind === 'caption' ? (getSelectedOverlayValues() as CaptionInstance | null)?.boxWidth ?? 70 : captionDraftBoxWidth}
                                        onChange={(event) => {
                                            const boxWidth = Number(event.target.value)
                                            if (selectedOverlay?.kind === 'caption') updateSelectedOverlay({ boxWidth })
                                            else setCaptionDraftBoxWidth(boxWidth)
                                        }}
                                    />
                                </div>
                                <div className="caption-style-row" aria-label="文字フォント">
                                    {(Object.keys(CAPTION_FONTS) as CaptionFont[]).map((font) => (
                                        <button key={font} type="button" className={(selectedOverlay?.kind === 'caption' ? (getSelectedOverlayValues() as CaptionInstance | null)?.font === font : captionDraftFont === font) ? 'caption-style-button selected' : 'caption-style-button'} onClick={() => {
                                            if (selectedOverlay?.kind === 'caption') updateSelectedOverlay({ font })
                                            else setCaptionDraftFont(font)
                                        }}>
                                            {CAPTION_FONTS[font].label}
                                        </button>
                                    ))}
                                    <button type="button" className={(selectedOverlay?.kind === 'caption' ? (getSelectedOverlayValues() as CaptionInstance | null)?.outline : captionDraftOutline) ? 'caption-style-button selected' : 'caption-style-button'} onClick={() => {
                                        if (selectedOverlay?.kind === 'caption') {
                                            const selected = getSelectedOverlayValues() as CaptionInstance | null
                                            if (selected) updateSelectedOverlay({ outline: !selected.outline })
                                        } else setCaptionDraftOutline((value) => !value)
                                    }}>
                                        縁取り
                                    </button>
                                </div>
                                <span className="caption-color-label">文字色</span>
                                <div className="caption-color-picker" aria-label="文字色">
                                    {(Object.keys(CAPTION_COLORS) as CaptionColor[]).map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            className={(selectedOverlay?.kind === 'caption' ? (getSelectedOverlayValues() as CaptionInstance | null)?.color === color : captionDraftColor === color) ? 'caption-color selected' : 'caption-color'}
                                            style={{ background: CAPTION_COLORS[color] }}
                                            onClick={() => {
                                                if (selectedOverlay?.kind === 'caption') updateSelectedOverlay({ color })
                                                else setCaptionDraftColor(color)
                                            }}
                                            aria-label={`文字色 ${color}`}
                                        />
                                    ))}
                                </div>
                                <div className="caption-color-section">
                                    <span>文字枠の色</span>
                                    <div className="caption-color-picker" aria-label="文字枠の色">
                                        {(Object.keys(CAPTION_COLORS) as CaptionColor[]).map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                className={(selectedOverlay?.kind === 'caption' ? (getSelectedOverlayValues() as CaptionInstance | null)?.outlineColor === color : captionDraftOutlineColor === color) ? 'caption-color selected' : 'caption-color'}
                                                style={{ background: CAPTION_COLORS[color] }}
                                                onClick={() => {
                                                    if (selectedOverlay?.kind === 'caption') updateSelectedOverlay({ outlineColor: color })
                                                    else setCaptionDraftOutlineColor(color)
                                                }}
                                                aria-label={`文字枠色 ${color}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        {isEditing && activeEditorTab === 'stamp' && (
                            <>
                                <div className="stamp-categories" aria-label="スタンプカテゴリ">
                                    {([
                                        ['all', '全部'], ['love', 'ハート'], ['cute', 'かわいい'],
                                        ['food', 'フード'], ['animal', 'どうぶつ'], ['face', '顔'], ['other', 'その他']
                                    ] as const).map(([id, label]) => (
                                        <button key={id} type="button" className={stampCategory === id ? 'selected' : ''} onClick={() => setStampCategory(id)}>{label}</button>
                                    ))}
                                </div>
                                <div className="stamp-picker" aria-label="スタンプを追加">
                                {STAMPS.filter((stamp) => stampCategory === 'all' || stamp.category === stampCategory).map((stamp) => (
                                    <button key={stamp.id} type="button" className="stamp-option" onClick={() => addStamp(stamp.id)}>
                                        <span>{stamp.glyph}</span>
                                        <small>{stamp.label}</small>
                                    </button>
                                ))}
                                </div>
                            </>
                        )}

                        <p className="capture-message" role="status" aria-live="polite">
                            {error || (
                                isEditing
                                    ? 'クリックで選択・ドラッグで移動。ホイールで拡大縮小、Shift＋ホイールで回転。'
                                    : photoUrl
                                        ? '撮り直すか、この写真を編集できます。'
                                        : 'ボタンを押すとカメラが開きます。'
                            )}
                        </p>

                        {isEditing ? (
                            <>
                                <button type="button" className="capture-button" onClick={saveFinishedPhoto} disabled={isSaving}>
                                    {isSaving ? '保存しています…' : '完成して保存'}
                                </button>
                                <button type="button" className="capture-button secondary-button" onClick={() => {
                                    setPhotoUrl(savedPhotoUrl || sourcePhotoUrl || photoUrl)
                                    setIsEditing(false)
                                    hideStandaloneEditor()
                                }} disabled={isSaving}>
                                    写真確認に戻る
                                </button>
                            </>
                        ) : (
                            <>
                                <button type="button" className="capture-button" onClick={takePhoto}>
                                    {photoUrl ? '撮り直す' : '写真を撮る'}
                                </button>
                                {!photoUrl && (
                                    <button type="button" className="capture-button secondary-button" onClick={chooseFromGallery}>
                                        ギャラリーから選ぶ
                                    </button>
                                )}
                                {photoUrl && (
                                    <button type="button" className="capture-button" onClick={() => {
                                    const editingUrl = sourcePhotoUrl || photoUrl
                                    setPhotoUrl(editingUrl)
                                    setIsEditing(true)
                                    showStandaloneEditor(editingUrl)
                                }}>
                                        編集する
                                    </button>
                                )}
                            </>
                        )}
                    </footer>
                </div>
            </main>
        </AppProvider>
    )
}

const AppProvider = ({ children }: { children: ReactNode }) => {
    useEffect(() => {
        if (!devMode) return
        const handleResize = () => {
            const { innerWidth, innerHeight } = window
            document.documentElement.style.fontSize =
                27.6 / 59 < innerWidth / innerHeight ? '1.66vh' : '3.4vw'
        }
        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    return devMode ? (
        <div className="dev-wrapper"><Frame>{children}</Frame></div>
    ) : <>{children}</>
}

const Root = () => {
    if (isTopLevelPuriPhotoNui) {
        return <StandaloneEditorLayer />
    }

    return <App />
}

export default Root
