import { PointerEvent as ReactPointerEvent, ReactNode, useEffect, useRef, useState } from 'react'
import '@fontsource/m-plus-rounded-1c/700.css'
import './App.css'
import Frame from './components/Frame'

const devMode = !window['invokeNative']
type FrameStyle = 'none' | 'soft' | 'pop'
type StampId = string
type StampInstance = { instanceId: number; stampId: StampId; x: number; y: number; scale: number; rotation: number }
type StampCategory = 'love' | 'cute' | 'food' | 'animal' | 'face' | 'other' | 'community'
type CaptionColor = 'pink' | 'hotPink' | 'red' | 'orange' | 'yellow' | 'lime' | 'green' | 'mint' | 'cyan' | 'blue' | 'navy' | 'purple' | 'lavender' | 'brown' | 'beige' | 'white' | 'gray' | 'black'
type CaptionFont = 'gothic' | 'serif' | 'rounded'
type CaptionInstance = { instanceId: number; text: string; x: number; y: number; scale: number; rotation: number; color: CaptionColor; outlineColor: CaptionColor; font: CaptionFont; outline: boolean; outlineWidth: number; boxWidth: number }
type SelectedOverlay = { kind: 'stamp' | 'caption'; id: number }
type DrawPoint = { x: number; y: number }
type DrawTool = 'pen' | 'eraser'
type DrawStroke = { points: DrawPoint[]; color: CaptionColor; width: number; opacity: number; tool: DrawTool }
type EditorSnapshot = { frame: FrameStyle; stamps: StampInstance[]; captions: CaptionInstance[]; strokes: DrawStroke[] }
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
    rounded: { label: '丸文字', css: '"M PLUS Rounded 1c", "Noto Sans JP", sans-serif', canvas: '"M PLUS Rounded 1c", "Noto Sans JP", sans-serif' }
}
type StampDefinition = { id: StampId; label: string; category: StampCategory; glyph?: string; image?: string; author?: string }
const BASE_STAMPS: StampDefinition[] = [
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

// 公募採用スタンプはここに追加。既存の基本スタンプは削除・置換しない。
const COMMUNITY_STAMPS: StampDefinition[] = [
    // 例:
    // { id: 'community-sakura-01', label: 'さくら', category: 'community', image: 'community/sakura-01.webp', author: '作者名' }
]

const STAMPS: StampDefinition[] = [...BASE_STAMPS, ...COMMUNITY_STAMPS]

const stampAssetUrl = (stamp: StampDefinition) =>
    stamp.image ? `${import.meta.env.BASE_URL.replace(/\/$/, '')}/stamps/${stamp.image}` : null

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
    const [captionDraftOutlineWidth, setCaptionDraftOutlineWidth] = useState(4)
    const [captionAdvancedOpen, setCaptionAdvancedOpen] = useState(false)
    const [captionInstances, setCaptionInstances] = useState<CaptionInstance[]>([])
    const [draggingItem, setDraggingItem] = useState<SelectedOverlay | null>(null)
    const [selectedOverlay, setSelectedOverlay] = useState<SelectedOverlay | null>(null)
    const nextOverlayId = useRef(1)
    const activePointers = useRef(new Map<number, { x: number; y: number }>())
    const gestureStart = useRef<{ distance: number; angle: number; scale: number; rotation: number } | null>(null)
    const [photoAspectRatio, setPhotoAspectRatio] = useState<number | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const saveLock = useRef(false)
    const [activeEditorTab, setActiveEditorTab] = useState<'frame' | 'stamp' | 'text' | 'draw'>('stamp')
    const [drawStrokes, setDrawStrokes] = useState<DrawStroke[]>([])
    const [drawColor, setDrawColor] = useState<CaptionColor>('hotPink')
    const [drawWidth, setDrawWidth] = useState(5)
    const [drawTool, setDrawTool] = useState<DrawTool>('pen')
    const [drawOpacity, setDrawOpacity] = useState(100)
    const [editorZoom, setEditorZoom] = useState(1)
    const [editorPan, setEditorPan] = useState({ x: 0, y: 0 })
    const [toolsCollapsed, setToolsCollapsed] = useState(false)
    const panPointer = useRef<{ id: number; startX: number; startY: number; originX: number; originY: number } | null>(null)
    const activeDrawPointer = useRef<number | null>(null)
    const [confirmExit, setConfirmExit] = useState(false)
    const [overlayToolsExpanded, setOverlayToolsExpanded] = useState(false)
    const [saveNotice, setSaveNotice] = useState<string | null>(null)
    const saveNoticeTimer = useRef<number | null>(null)
    const [stampCategory, setStampCategory] = useState<StampCategory | 'all'>('all')
    const [stampSearch, setStampSearch] = useState('')
    const [undoStack, setUndoStack] = useState<EditorSnapshot[]>([])
    const [redoStack, setRedoStack] = useState<EditorSnapshot[]>([])
    const historyLock = useRef(false)
    const historyTimer = useRef<number | null>(null)
    const lastSnapshot = useRef<string>('')
    const historyActionLock = useRef(false)

    const makeSnapshot = (): EditorSnapshot => ({
        frame: selectedFrame,
        stamps: stampInstances.map((item) => ({ ...item })),
        captions: captionInstances.map((item) => ({ ...item })),
        strokes: drawStrokes.map((stroke) => ({ ...stroke, points: stroke.points.map((point) => ({ ...point })) }))
    })

    const applySnapshot = (snapshot: EditorSnapshot) => {
        historyLock.current = true
        setSelectedFrame(snapshot.frame)
        setStampInstances(snapshot.stamps.map((item) => ({ ...item })))
        setCaptionInstances(snapshot.captions.map((item) => ({ ...item })))
        setDrawStrokes(snapshot.strokes.map((stroke) => ({ ...stroke, points: stroke.points.map((point) => ({ ...point })) })))
        setSelectedOverlay(null)
        setDraggingItem(null)
        const highestOverlayId = Math.max(
            0,
            ...snapshot.stamps.map((item) => item.instanceId),
            ...snapshot.captions.map((item) => item.instanceId)
        )
        nextOverlayId.current = highestOverlayId + 1
        activePointers.current.clear()
        gestureStart.current = null
        activeDrawPointer.current = null
        panPointer.current = null
        window.setTimeout(() => { historyLock.current = false }, 0)
    }

    const undoEditor = () => {
        if (historyActionLock.current || !undoStack.length) return
        historyActionLock.current = true
        const previous = undoStack[undoStack.length - 1]
        setUndoStack((current) => current.slice(0, -1))
        setRedoStack((current) => [...current.slice(-29), makeSnapshot()])
        applySnapshot(previous)
        window.setTimeout(() => { historyActionLock.current = false }, 60)
    }

    const redoEditor = () => {
        if (historyActionLock.current || !redoStack.length) return
        historyActionLock.current = true
        const next = redoStack[redoStack.length - 1]
        setRedoStack((current) => current.slice(0, -1))
        setUndoStack((current) => [...current.slice(-29), makeSnapshot()])
        applySnapshot(next)
        window.setTimeout(() => { historyActionLock.current = false }, 60)
    }

    useEffect(() => {
        if (!isEditing || historyLock.current) return
        if (historyTimer.current !== null) window.clearTimeout(historyTimer.current)
        historyTimer.current = window.setTimeout(() => {
            const snapshot = makeSnapshot()
            const serialized = JSON.stringify(snapshot)
            if (lastSnapshot.current && lastSnapshot.current !== serialized) {
                const previous = JSON.parse(lastSnapshot.current) as EditorSnapshot
                setUndoStack((current) => [...current.slice(-29), previous])
                setRedoStack([])
            }
            lastSnapshot.current = serialized
        }, 180)
        return () => {
            if (historyTimer.current !== null) window.clearTimeout(historyTimer.current)
        }
    }, [isEditing, selectedFrame, stampInstances, captionInstances, drawStrokes])

    useEffect(() => {
        if (isEditing) {
            lastSnapshot.current = JSON.stringify(makeSnapshot())
            setUndoStack([])
            setRedoStack([])
        }
    }, [isEditing])

    useEffect(() => {
        document.body.style.visibility = 'visible'
        return () => {
            if (historyTimer.current !== null) window.clearTimeout(historyTimer.current)
            if (saveNoticeTimer.current !== null) window.clearTimeout(saveNoticeTimer.current)
        }
    }, [])

    useEffect(() => {
        if (!isEditing) setToolsCollapsed(false)
    }, [isEditing])

    useEffect(() => {
        if (!isEditing) return
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
                event.preventDefault()
                if (event.shiftKey) redoEditor()
                else undoEditor()
            } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
                event.preventDefault()
                redoEditor()
            } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedOverlay) {
                event.preventDefault()
                deleteSelectedOverlay()
            } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && selectedOverlay) {
                event.preventDefault()
                duplicateSelectedOverlay()
            } else if (event.key === 'Escape') {
                setSelectedOverlay(null)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [isEditing, selectedOverlay, stampInstances, captionInstances, undoStack, redoStack, selectedFrame, drawStrokes])

    const frameImageSrc = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/frames/frame01-landscape.webp`

    const resetEditorState = () => {
        setSelectedFrame('none')
        setStampInstances([])
        setCaptionInstances([])
        setDrawStrokes([])
        setCaptionDraft('')
        setCaptionDraftBoxWidth(70)
        setCaptionDraftColor('pink')
        setCaptionDraftOutlineColor('white')
        setCaptionDraftFont('gothic')
        setCaptionDraftOutline(true)
        setCaptionDraftOutlineWidth(4)
        setCaptionAdvancedOpen(false)
        setSelectedOverlay(null)
        setDraggingItem(null)
        setActiveEditorTab('stamp')
        setStampCategory('all')
        setStampSearch('')
        setDrawColor('hotPink')
        setDrawWidth(5)
        setDrawTool('pen')
        setDrawOpacity(100)
        setEditorZoom(1)
        setEditorPan({ x: 0, y: 0 })
        setToolsCollapsed(false)
        setOverlayToolsExpanded(false)
        setConfirmExit(false)
        saveLock.current = false
        setIsSaving(false)
        setUndoStack([])
        setRedoStack([])
        activePointers.current.clear()
        gestureStart.current = null
        activeDrawPointer.current = null
        panPointer.current = null
        lastSnapshot.current = ''
        historyActionLock.current = false
        historyLock.current = false
        if (historyTimer.current !== null) {
            window.clearTimeout(historyTimer.current)
            historyTimer.current = null
        }
    }

    const takePhoto = () => {
        setError(null)
        if (typeof window.useCamera !== 'function') {
            setError('カメラは LB Phone 内で利用できます。')
            return
        }

        try {
            window.useCamera((url) => {
                if (saveLock.current) return
                if (typeof url === 'string' && url.trim()) {
                    setPhotoUrl(url)
                    setSourcePhotoUrl(url)
                    setSavedPhotoUrl(null)
                    setIsEditing(false)
                    resetEditorState()
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

    const resetPhotoSession = () => {
        if (saveLock.current) return
        setPhotoUrl(null)
        setSourcePhotoUrl(null)
        setSavedPhotoUrl(null)
        setIsEditing(false)
        resetEditorState()
        setPhotoAspectRatio(null)
        if (saveNoticeTimer.current !== null) {
            window.clearTimeout(saveNoticeTimer.current)
            saveNoticeTimer.current = null
        }
        setSaveNotice(null)
        setError(null)
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
                    if (saveLock.current) return
                    const selected = Array.isArray(data) ? data[0] : data
                    if (!selected || selected.isVideo || typeof selected.src !== 'string' || !selected.src.trim()) {
                        setError('写真を選択できませんでした。画像を選び直してください。')
                        return
                    }

                    setPhotoUrl(selected.src)
                    setSourcePhotoUrl(selected.src)
                    setSavedPhotoUrl(null)
                    setIsEditing(false)
                    resetEditorState()
                    setPhotoAspectRatio(null)
                    setError(null)
                }
            })
        } catch (cause) {
            console.error('[PuriPhoto] Failed to open gallery:', cause)
            setError('ギャラリーを開けませんでした。')
        }
    }

    const cancelTransientInteractions = () => {
        setDraggingItem(null)
        activePointers.current.clear()
        gestureStart.current = null
        activeDrawPointer.current = null
        panPointer.current = null
    }

    const changeEditorTab = (tab: 'frame' | 'stamp' | 'text' | 'draw') => {
        cancelTransientInteractions()
        setOverlayToolsExpanded(false)
        if (tab === 'draw') setSelectedOverlay(null)
        setActiveEditorTab(tab)
    }

    const moveOverlayItem = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!draggingItem || gestureStart.current) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (!rect.width || !rect.height) return
        const selected = draggingItem.kind === 'caption'
            ? captionInstances.find((item) => item.instanceId === draggingItem.id)
            : stampInstances.find((item) => item.instanceId === draggingItem.id)
        const scale = selected?.scale ?? 1
        const edgeMargin = Math.max(4, Math.min(18, 4 + scale * 3))
        const x = Math.max(edgeMargin, Math.min(100 - edgeMargin, ((event.clientX - rect.left) / rect.width) * 100))
        const y = Math.max(edgeMargin, Math.min(100 - edgeMargin, ((event.clientY - rect.top) / rect.height) * 100))
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

    const clampEditorPan = (x: number, y: number, zoom = editorZoom) => {
        if (zoom <= 1) return { x: 0, y: 0 }
        const limit = 42 * (zoom - 1) / zoom
        return {
            x: Math.max(-limit, Math.min(limit, x)),
            y: Math.max(-limit, Math.min(limit, y))
        }
    }

    const beginPhotoPan = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!isEditing || editorZoom <= 1 || activeEditorTab === 'draw') return
        const target = event.target as HTMLElement
        if (target.closest('[data-overlay-kind]')) return
        event.preventDefault()
        panPointer.current = {
            id: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: editorPan.x,
            originY: editorPan.y
        }
        event.currentTarget.setPointerCapture(event.pointerId)
    }

    const movePhotoPan = (event: ReactPointerEvent<HTMLDivElement>) => {
        const pan = panPointer.current
        if (!pan || pan.id !== event.pointerId) return
        event.preventDefault()
        const rect = event.currentTarget.getBoundingClientRect()
        if (!rect.width || !rect.height) return
        const x = pan.originX + ((event.clientX - pan.startX) / rect.width) * 100
        const y = pan.originY + ((event.clientY - pan.startY) / rect.height) * 100
        setEditorPan(clampEditorPan(x, y))
    }

    const endPhotoPan = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (panPointer.current?.id !== event.pointerId) return
        panPointer.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const changeEditorZoom = (zoom: number) => {
        const nextZoom = Math.max(1, Math.min(3, zoom))
        setEditorZoom(nextZoom)
        setEditorPan((current) => clampEditorPan(current.x, current.y, nextZoom))
    }

    const drawPointFromEvent = (event: ReactPointerEvent<SVGSVGElement>): DrawPoint => {
        const rect = event.currentTarget.getBoundingClientRect()
        return {
            x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
            y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
        }
    }

    const beginDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (activeEditorTab !== 'draw') return
        event.preventDefault()
        event.stopPropagation()
        if (activeDrawPointer.current !== null) return
        activeDrawPointer.current = event.pointerId
        event.currentTarget.setPointerCapture(event.pointerId)
        const point = drawPointFromEvent(event)
        setSelectedOverlay(null)
        setDrawStrokes((current) => {
            if (current.length >= 500) return current
            return [...current, { points: [point], color: drawColor, width: drawTool === 'eraser' ? Math.max(18, drawWidth * 1.6) : drawWidth, opacity: drawOpacity / 100, tool: drawTool }]
        })
    }

    const continueDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (activeDrawPointer.current !== event.pointerId || activeEditorTab !== 'draw') return
        event.preventDefault()
        const point = drawPointFromEvent(event)
        setDrawStrokes((current) => {
            if (!current.length) return current
            const next = current.slice()
            const last = next[next.length - 1]
            const previous = last.points[last.points.length - 1]
            if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.15) return current
            if (last.points.length >= 5000) return current
            next[next.length - 1] = { ...last, points: [...last.points, point] }
            return next
        })
    }

    const endDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (activeDrawPointer.current !== event.pointerId) return
        activeDrawPointer.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const addStamp = (stampId: StampId) => {
        if (!STAMPS.some((stamp) => stamp.id === stampId)) return
        setStampInstances((current) => {
            const offset = (current.length % 5) * 4
            if (current.length >= 100) return current
            return [...current, {
            instanceId: nextOverlayId.current++,
            stampId,
            x: 50 + offset,
            y: 50 + offset,
            scale: 1,
            rotation: 0
        }]
        })
    }

    const addCaption = () => {
        const text = captionDraft.trim().slice(0, 120)
        if (!text) return
        const offset = (captionInstances.length % 5) * 5
        setCaptionInstances((current) => {
            if (current.length >= 100) return current
            return [...current, {
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
            outlineWidth: captionDraftOutlineWidth,
            boxWidth: captionDraftBoxWidth
        }]
        })
        setCaptionDraft('')
    }

    const updateSelectedOverlay = (changes: { scale?: number; rotation?: number; color?: CaptionColor; outlineColor?: CaptionColor; font?: CaptionFont; outline?: boolean; outlineWidth?: number; boxWidth?: number }) => {
        if (!selectedOverlay) return
        if (selectedOverlay.kind === 'stamp') {
            setStampInstances((current) => current.map((item) =>
                item.instanceId === selectedOverlay.id ? {
                    ...item,
                    scale: changes.scale === undefined ? item.scale : Math.max(0.35, Math.min(3.5, changes.scale)),
                    rotation: changes.rotation === undefined ? item.rotation : ((changes.rotation % 360) + 360) % 360
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
                    outlineWidth: changes.outlineWidth === undefined ? item.outlineWidth : Math.max(1, Math.min(12, changes.outlineWidth)),
                    boxWidth: changes.boxWidth === undefined ? item.boxWidth : Math.max(25, Math.min(95, changes.boxWidth))
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
        setOverlayToolsExpanded(false)
    }

    const duplicateSelectedOverlay = () => {
        if (!selectedOverlay) return
        if (selectedOverlay.kind === 'stamp') {
            if (stampInstances.length >= 100) return
            const source = stampInstances.find((item) => item.instanceId === selectedOverlay.id)
            if (!source) return
            const copy = { ...source, instanceId: nextOverlayId.current++, x: Math.min(94, source.x + 5), y: Math.min(94, source.y + 5) }
            setStampInstances((current) => [...current, copy])
            setSelectedOverlay({ kind: 'stamp', id: copy.instanceId })
        } else {
            if (captionInstances.length >= 100) return
            const source = captionInstances.find((item) => item.instanceId === selectedOverlay.id)
            if (!source) return
            const copy = { ...source, instanceId: nextOverlayId.current++, x: Math.min(94, source.x + 5), y: Math.min(94, source.y + 5) }
            setCaptionInstances((current) => [...current, copy])
            setSelectedOverlay({ kind: 'caption', id: copy.instanceId })
        }
    }

    const resetSelectedOverlayTransform = () => {
        updateSelectedOverlay({ scale: 1, rotation: 0 })
    }

    const moveSelectedOverlayLayer = (direction: 'front' | 'back') => {
        if (!selectedOverlay) return
        const reorder = <T extends { instanceId: number }>(items: T[]) => {
            const index = items.findIndex((item) => item.instanceId === selectedOverlay.id)
            if (index < 0) return items
            const next = items.slice()
            const [item] = next.splice(index, 1)
            if (direction === 'front') next.push(item)
            else next.unshift(item)
            return next
        }
        if (selectedOverlay.kind === 'stamp') setStampInstances(reorder)
        else setCaptionInstances(reorder)
    }

    const clearAllDecorations = () => {
        setSelectedFrame('none')
        setStampInstances([])
        setCaptionInstances([])
        setDrawStrokes([])
        setSelectedOverlay(null)
        setDraggingItem(null)
    }

    const saveFinishedPhoto = async () => {
        if (!photoUrl || isSaving || saveLock.current) return

        saveLock.current = true
        setIsSaving(true)
        setError(null)

        try {
            if (typeof components === 'undefined' || typeof components.uploadMedia !== 'function' || typeof components.saveToGallery !== 'function') {
                throw new Error('LB Phone gallery functions are unavailable')
            }

            const loadImage = (src: string, crossOrigin = false) => new Promise<HTMLImageElement>((resolve, reject) => {
                const image = new Image()
                let settled = false
                const timeout = window.setTimeout(() => {
                    if (settled) return
                    settled = true
                    image.src = ''
                    reject(new Error('Image loading timed out during export'))
                }, 15000)
                const finish = (callback: () => void) => {
                    if (settled) return
                    settled = true
                    window.clearTimeout(timeout)
                    callback()
                }
                if (crossOrigin && /^https?:/i.test(src)) image.crossOrigin = 'anonymous'
                image.onload = () => finish(() => resolve(image))
                image.onerror = () => finish(() => reject(new Error('An image could not be loaded for export')))
                image.src = src
            })

            if (document.fonts?.ready) await document.fonts.ready
            const photo = await loadImage(photoUrl, true)
            const sourceWidth = photo.naturalWidth
            const sourceHeight = photo.naturalHeight
            if (!sourceWidth || !sourceHeight || !Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight)) {
                throw new Error('The source photo has invalid dimensions')
            }
            const maxExportEdge = 4096
            const exportScale = Math.min(1, maxExportEdge / Math.max(sourceWidth, sourceHeight))
            const width = Math.max(1, Math.round(sourceWidth * exportScale))
            const height = Math.max(1, Math.round(sourceHeight * exportScale))

            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const context = canvas.getContext('2d')
            if (!context) throw new Error('Canvas is unavailable')

            context.drawImage(photo, 0, 0, width, height)

            if (drawStrokes.length > 0) {
                // Draw freehand edits on their own transparent layer. The eraser must
                // remove only PuriPhoto drawing pixels, never pixels from the source photo.
                const drawingCanvas = document.createElement('canvas')
                drawingCanvas.width = width
                drawingCanvas.height = height
                const drawingContext = drawingCanvas.getContext('2d')
                if (!drawingContext) throw new Error('Drawing canvas is unavailable')

                drawingContext.lineCap = 'round'
                drawingContext.lineJoin = 'round'
                for (const stroke of drawStrokes) {
                    if (!stroke.points.length) continue
                    drawingContext.save()
                    drawingContext.beginPath()
                    drawingContext.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
                    drawingContext.globalAlpha = stroke.tool === 'eraser' ? 1 : stroke.opacity
                    drawingContext.strokeStyle = CAPTION_COLORS[stroke.color]
                    // Match the editor's SVG coordinate system: width 10 = 1% of the
                    // short edge. This keeps preview and exported line thickness aligned.
                    drawingContext.lineWidth = Math.max(1, Math.min(width, height) * stroke.width / 1000)
                    const first = stroke.points[0]
                    drawingContext.moveTo(width * first.x / 100, height * first.y / 100)
                    if (stroke.points.length === 1) {
                        drawingContext.lineTo(width * first.x / 100 + 0.01, height * first.y / 100 + 0.01)
                    } else {
                        for (let i = 1; i < stroke.points.length; i++) {
                            const point = stroke.points[i]
                            drawingContext.lineTo(width * point.x / 100, height * point.y / 100)
                        }
                    }
                    drawingContext.stroke()
                    drawingContext.restore()
                }
                context.drawImage(drawingCanvas, 0, 0)
            }

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
                    const assetUrl = stampAssetUrl(stamp)
                    if (assetUrl) {
                        const stampImage = await loadImage(assetUrl)
                        const naturalRatio = stampImage.naturalWidth / Math.max(1, stampImage.naturalHeight)
                        const drawHeight = stampSize
                        const drawWidth = drawHeight * naturalRatio
                        context.drawImage(stampImage, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
                    } else {
                        context.fillText(stamp.glyph, 0, 0)
                    }
                    context.restore()
                }
                context.restore()
            }

            if (captionInstances.length > 0) {
                const fontSize = Math.max(22, Math.round(Math.min(width, height) * 0.055))
                const wrapCaptionLines = (text: string, maxWidth: number) => {
                    const explicitLines = text.split('\n')
                    const wrapped: string[] = []
                    for (const explicitLine of explicitLines) {
                        if (!explicitLine) {
                            wrapped.push('')
                            continue
                        }
                        let line = ''
                        for (const char of Array.from(explicitLine)) {
                            const candidate = line + char
                            if (line && context.measureText(candidate).width > maxWidth) {
                                wrapped.push(line)
                                line = char
                            } else {
                                line = candidate
                            }
                        }
                        wrapped.push(line)
                    }
                    return wrapped
                }
                context.save()
                context.textAlign = 'center'
                context.textBaseline = 'middle'
                context.lineJoin = 'round'
                for (const item of captionInstances) {
                    context.strokeStyle = CAPTION_COLORS[item.outlineColor]
                    context.lineWidth = Math.max(1, fontSize * (item.outlineWidth ?? 4) * 0.028)
                    context.lineJoin = 'round'
                    context.miterLimit = 2
                    context.font = `700 ${fontSize}px ${CAPTION_FONTS[item.font].canvas}`
                    context.fillStyle = CAPTION_COLORS[item.color]
                    context.save()
                    context.translate(width * item.x / 100, height * item.y / 100)
                    context.rotate(item.rotation * Math.PI / 180)
                    context.scale(item.scale, item.scale)
                    const maxTextWidth = Math.max(fontSize * 2, width * item.boxWidth / 100 / Math.max(0.35, item.scale))
                    const lines = wrapCaptionLines(item.text, maxTextWidth)
                    const lineHeight = fontSize * 1.25
                    const startY = -((lines.length - 1) * lineHeight) / 2
                    lines.forEach((line, lineIndex) => {
                        const y = startY + lineIndex * lineHeight
                        if (item.outline) context.strokeText(line, 0, y)
                        // Repaint the glyph fill after the centered canvas stroke so thick
                        // Japanese outlines cannot visually intrude into the character body.
                        context.fillText(line, 0, y)
                    })
                    context.restore()
                }
                context.restore()
            }

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((result) => {
                    if (result && result.size > 0) resolve(result)
                    else reject(new Error('Canvas export failed; the photo host may block canvas access'))
                }, 'image/png')
            })
            if (blob.size > 25 * 1024 * 1024) {
                throw new Error('The finished image is too large to upload')
            }

            const uploadedUrl = await components.uploadMedia('Image', blob)
            if (typeof uploadedUrl !== 'string' || !uploadedUrl.trim()) {
                throw new Error('The finished photo upload returned no URL')
            }

            await components.saveToGallery(uploadedUrl)
            setPhotoUrl(uploadedUrl)
            setSavedPhotoUrl(uploadedUrl)
            setPhotoAspectRatio(width / height)
            setIsEditing(false)
            resetEditorState()
            setSaveNotice('ギャラリーに保存しました')
            if (saveNoticeTimer.current !== null) window.clearTimeout(saveNoticeTimer.current)
            saveNoticeTimer.current = window.setTimeout(() => {
                setSaveNotice(null)
                saveNoticeTimer.current = null
            }, 2600)
            setError(null)
        } catch (cause) {
            console.error('[PuriPhoto] Failed to save finished photo:', cause)
            const message = cause instanceof Error ? cause.message : ''
            if (message.includes('timed out')) {
                setError('画像の読み込みがタイムアウトしました。編集内容は残っています。少し待ってからもう一度保存してください。')
            } else if (message.includes('too large')) {
                setError('完成画像の容量が大きすぎます。編集内容は残っています。装飾を減らすか別の写真でお試しください。')
            } else {
                setError('保存に失敗しました。編集内容は残っています。通信状態を確認して、もう一度「完成して保存」を押してください。')
            }
        } finally {
            saveLock.current = false
            setIsSaving(false)
        }
    }

    return (
        <AppProvider>
            <main className="app">
                <div className={isEditing ? (toolsCollapsed ? 'app-wrapper editing-layout tools-collapsed' : 'app-wrapper editing-layout') : 'app-wrapper'}>
                    <header className="app-header">
                        <p className="app-eyebrow">{isEditing ? '写真をかわいく仕上げよう。' : '今日の一枚を、ここに。'}</p>
                        <h1>{isEditing ? '編集' : 'PuriPhoto'}</h1>
                    </header>

                    <section className="photo-area" aria-label={isEditing ? '編集中の写真' : '撮影した写真'}>
                        {photoUrl ? (
                            <div
                                className={isEditing && editorZoom > 1 && activeEditorTab !== 'draw' ? 'photo-zoom-viewport pannable' : 'photo-zoom-viewport'}
                                onPointerDown={beginPhotoPan}
                                onPointerMove={movePhotoPan}
                                onPointerUp={endPhotoPan}
                                onPointerCancel={endPhotoPan}
                            >
                            <div
                                className="photo-stage"
                                style={{
                                    ...(photoAspectRatio ? { aspectRatio: photoAspectRatio } : {}),
                                    transform: `translate(${editorPan.x}%, ${editorPan.y}%) scale(${editorZoom})`
                                }}
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
                                            const ratio = image.naturalWidth / image.naturalHeight
                                            setPhotoAspectRatio(ratio)
                                            setError(null)
                                        }
                                    }}
                                    onError={() => setError('写真を読み込めませんでした。撮り直すことができます。')}
                                />
                                {isEditing && (
                                    <svg
                                        className={activeEditorTab === 'draw' ? 'drawing-layer drawing-active' : 'drawing-layer'}
                                        viewBox="0 0 100 100"
                                        preserveAspectRatio="none"
                                        onPointerDown={beginDrawing}
                                        onPointerMove={continueDrawing}
                                        onPointerUp={endDrawing}
                                        onPointerCancel={endDrawing}
                                        onContextMenu={(event) => event.preventDefault()}
                                        aria-label="手書きキャンバス"
                                    >
                                        <defs>
                                            <mask id="puriphoto-drawing-mask">
                                                <rect width="100" height="100" fill="white" />
                                                {drawStrokes.filter((stroke) => stroke.tool === 'eraser').map((stroke, index) => (
                                                    <polyline
                                                        key={`erase-${index}`}
                                                        points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')}
                                                        fill="none"
                                                        stroke="black"
                                                        strokeWidth={stroke.width / 10}
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        vectorEffect="non-scaling-stroke"
                                                    />
                                                ))}
                                            </mask>
                                        </defs>
                                        <g mask="url(#puriphoto-drawing-mask)">
                                            {drawStrokes.filter((stroke) => stroke.tool !== 'eraser').map((stroke, index) => (
                                                <polyline
                                                    key={index}
                                                    points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')}
                                                    fill="none"
                                                    stroke={CAPTION_COLORS[stroke.color]}
                                                    strokeOpacity={stroke.opacity}
                                                    strokeWidth={stroke.width / 10}
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    vectorEffect="non-scaling-stroke"
                                                />
                                            ))}
                                        </g>
                                    </svg>
                                )}
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
                                            {stampAssetUrl(stamp)
                                                ? <img className="stamp-image" src={stampAssetUrl(stamp)!} alt="" draggable={false} />
                                                : (stamp.glyph ?? '★')}
                                        </span>
                                    )
                                })}
                                {isEditing && captionInstances.map((item) => (
                                    <span
                                        key={item.instanceId}
                                        className={selectedOverlay?.kind === 'caption' && selectedOverlay.id === item.instanceId ? 'caption-overlay overlay-selected' : 'caption-overlay'}
                                        data-overlay-kind="caption"
                                        data-overlay-id={item.instanceId}
                                        style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.boxWidth}%`, color: CAPTION_COLORS[item.color], fontFamily: CAPTION_FONTS[item.font].css, transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})` }}
                                        onPointerDown={(event) => {
                                            event.preventDefault()
                                            event.stopPropagation()
                                            setSelectedOverlay({ kind: 'caption', id: item.instanceId })
                                            setDraggingItem({ kind: 'caption', id: item.instanceId })
                                            event.currentTarget.setPointerCapture(event.pointerId)
                                        }}
                                        aria-label="文字。タップして選択"
                                    >
                                        {item.outline && (
                                            <span
                                                className="caption-outline-layer"
                                                aria-hidden="true"
                                                style={{
                                                    WebkitTextStroke: `${Math.max(0.02, (item.outlineWidth ?? 4) * 0.02)}em ${CAPTION_COLORS[item.outlineColor]}`
                                                }}
                                            >{item.text}</span>
                                        )}
                                        <span className="caption-fill-layer">{item.text}</span>
                                    </span>
                                ))}
                            </div>
                            </div>
                        ) : (
                            <div className="empty-state">
                                <span className="camera-mark" aria-hidden="true">◎</span>
                                <h2>まずは写真を撮ろう</h2>
                                <p>お気に入りの瞬間を<br />PuriPhotoに。</p>
                            </div>
                        )}
                    </section>

                    {isEditing && photoUrl && (
                        <div className="photo-zoom-controls" aria-label="写真の表示倍率">
                            <button type="button" onClick={() => changeEditorZoom(Math.max(1, Number((editorZoom - 0.25).toFixed(2))))} disabled={editorZoom <= 1}>−</button>
                            <input
                                type="range"
                                min="1"
                                max="3"
                                step="0.25"
                                value={editorZoom}
                                onChange={(event) => changeEditorZoom(Number(event.target.value))}
                                aria-label="写真の拡大率"
                            />
                            <button type="button" onClick={() => changeEditorZoom(Math.min(3, Number((editorZoom + 0.25).toFixed(2))))} disabled={editorZoom >= 3}>＋</button>
                            <button type="button" className="zoom-reset-button" onClick={() => { changeEditorZoom(1); setEditorPan({ x: 0, y: 0 }) }}>{Math.round(editorZoom * 100)}%</button>
                        </div>
                    )}
                    {isEditing && editorZoom > 1 && (
                        <p className="photo-pan-hint">{activeEditorTab === 'draw' ? '手書き中は写真位置を固定します。' : '写真の空いている部分をドラッグして表示位置を移動できます。'}</p>
                    )}

                    {isEditing && (
                        <div className="editor-shell-actions">
                            <button type="button" onClick={undoEditor} disabled={isSaving || !undoStack.length}>↶ 戻す</button>
                            <button type="button" onClick={redoEditor} disabled={isSaving || !redoStack.length}>↷ やり直す</button>
                            <button type="button" disabled={isSaving} onClick={() => setToolsCollapsed((value) => !value)}>
                                {toolsCollapsed ? '編集ツールを表示' : '編集ツールを折りたたむ'}
                            </button>
                            <button type="button" onClick={() => { changeEditorZoom(1); setEditorPan({ x: 0, y: 0 }) }}>
                                表示をリセット
                            </button>
                            <button type="button" className="danger-subtle" onClick={clearAllDecorations} disabled={isSaving || selectedFrame === 'none' && stampInstances.length === 0 && captionInstances.length === 0 && drawStrokes.length === 0} data-save-guard="true">
                                装飾を全消去
                            </button>
                        </div>
                    )}

                    <footer className={toolsCollapsed ? 'capture-controls collapsed-controls' : 'capture-controls'}>
                        {isEditing && (
                            <div className="editor-tabs" aria-label="編集ツール">
                                <button type="button" className={activeEditorTab === 'frame' ? 'selected' : ''} onClick={() => changeEditorTab('frame')}>フレーム</button>
                                <button type="button" className={activeEditorTab === 'stamp' ? 'selected' : ''} onClick={() => changeEditorTab('stamp')}>スタンプ</button>
                                <button type="button" className={activeEditorTab === 'text' ? 'selected' : ''} onClick={() => changeEditorTab('text')}>文字</button>
                                <button type="button" className={activeEditorTab === 'draw' ? 'selected' : ''} onClick={() => changeEditorTab('draw')}>手書き</button>
                            </div>
                        )}
                        {isEditing && selectedOverlay && activeEditorTab !== 'stamp' && (() => {
                            const selected = getSelectedOverlayValues()
                            if (!selected) return null
                            return (
                                <div className="overlay-toolbar-wrap">
                                    <div className="overlay-toolbar compact" aria-label="選択中のアイテムを編集">
                                        <button type="button" onClick={() => updateSelectedOverlay({ scale: Math.max(0.45, selected.scale - 0.15) })}>−</button>
                                        <button type="button" onClick={() => updateSelectedOverlay({ scale: Math.min(2.5, selected.scale + 0.15) })}>＋</button>
                                        <button type="button" onClick={() => updateSelectedOverlay({ rotation: selected.rotation - 15 })}>↶</button>
                                        <button type="button" onClick={() => updateSelectedOverlay({ rotation: selected.rotation + 15 })}>↷</button>
                                        <button type="button" onClick={duplicateSelectedOverlay}>⧉</button>
                                        <button type="button" className="delete-overlay-button" onClick={deleteSelectedOverlay}>🗑</button>
                                        <button type="button" onClick={() => setOverlayToolsExpanded((value) => !value)}>{overlayToolsExpanded ? '閉じる' : '詳細'}</button>
                                    </div>
                                    {overlayToolsExpanded && (
                                        <div className="overlay-toolbar-details">
                                            <button type="button" onClick={resetSelectedOverlayTransform}>サイズ・回転リセット</button>
                                            <button type="button" onClick={() => moveSelectedOverlayLayer('front')}>最前面へ</button>
                                            <button type="button" onClick={() => moveSelectedOverlayLayer('back')}>最背面へ</button>
                                        </div>
                                    )}
                                </div>
                            )
                        })()}
                        {isEditing && activeEditorTab === 'draw' && (
                            <div className="drawing-controls">
                                <div className="drawing-tool-picker" aria-label="手書きツール">
                                    <button type="button" className={drawTool === 'pen' ? 'selected' : ''} onClick={() => setDrawTool('pen')}>ペン</button>
                                    <button type="button" className={drawTool === 'eraser' ? 'selected' : ''} onClick={() => setDrawTool('eraser')}>消しゴム</button>
                                </div>
                                <div className="drawing-control-row">
                                    <span>{drawTool === 'eraser' ? '消しゴムサイズ' : 'ペン色'}</span>
                                    <div className={drawTool === 'eraser' ? 'drawing-color-picker hidden-colors' : 'drawing-color-picker'}>
                                        {(Object.keys(CAPTION_COLORS) as CaptionColor[]).map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                className={drawColor === color ? 'drawing-color selected' : 'drawing-color'}
                                                style={{ background: CAPTION_COLORS[color] }}
                                                onClick={() => setDrawColor(color)}
                                                aria-label={`ペン色 ${color}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <label className="drawing-width-control">
                                    <span>太さ {drawWidth}</span>
                                    <input type="range" min="2" max="100" step="1" value={drawWidth} onChange={(event) => setDrawWidth(Number(event.target.value))} />
                                </label>
                                {drawTool === 'pen' && (
                                    <label className="drawing-width-control">
                                        <span>透明度 {drawOpacity}%</span>
                                        <input type="range" min="10" max="100" step="5" value={drawOpacity} onChange={(event) => setDrawOpacity(Number(event.target.value))} />
                                    </label>
                                )}
                                <div className="drawing-actions">
                                    <button type="button" disabled={!drawStrokes.length} onClick={() => setDrawStrokes((current) => current.slice(0, -1))}>↶ 1つ戻す</button>
                                    <button type="button" disabled={!drawStrokes.length} onClick={() => setDrawStrokes([])}>全部消す</button>
                                </div>
                            </div>
                        )}
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
                                {(selectedOverlay?.kind === 'caption' ? (getSelectedOverlayValues() as CaptionInstance | null)?.outline : captionDraftOutline) && (
                                    <div className="caption-width-control">
                                        <span>縁取り太さ</span>
                                        <input
                                            type="range"
                                            min="1"
                                            max="12"
                                            step="1"
                                            value={selectedOverlay?.kind === 'caption' ? (getSelectedOverlayValues() as CaptionInstance | null)?.outlineWidth ?? 4 : captionDraftOutlineWidth}
                                            onChange={(event) => {
                                                const outlineWidth = Number(event.target.value)
                                                if (selectedOverlay?.kind === 'caption') updateSelectedOverlay({ outlineWidth })
                                                else setCaptionDraftOutlineWidth(outlineWidth)
                                            }}
                                        />
                                    </div>
                                )}
                                <button type="button" className="caption-advanced-toggle" onClick={() => setCaptionAdvancedOpen((value) => !value)}>
                                    {captionAdvancedOpen ? '色設定を閉じる' : '色を変更'}
                                </button>
                                {captionAdvancedOpen && (
                                    <div className="caption-advanced-panel">
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
                                        {(selectedOverlay?.kind === 'caption' ? (getSelectedOverlayValues() as CaptionInstance | null)?.outline : captionDraftOutline) && (
                                            <div className="caption-color-section">
                                                <span>縁取り色</span>
                                                <div className="caption-color-picker" aria-label="縁取り色">
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
                                                            aria-label={`縁取り色 ${color}`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        {isEditing && activeEditorTab === 'stamp' && (
                            <div className="stamp-browser-shell">
                                {selectedOverlay?.kind === 'stamp' && (() => {
                                    const selected = getSelectedOverlayValues()
                                    if (!selected) return null
                                    return (
                                        <div className="stamp-quick-actions">
                                            <button type="button" onClick={() => updateSelectedOverlay({ scale: Math.max(0.45, selected.scale - 0.15) })}>−</button>
                                            <button type="button" onClick={() => updateSelectedOverlay({ scale: Math.min(2.5, selected.scale + 0.15) })}>＋</button>
                                            <button type="button" onClick={() => updateSelectedOverlay({ rotation: selected.rotation - 15 })}>↶</button>
                                            <button type="button" onClick={() => updateSelectedOverlay({ rotation: selected.rotation + 15 })}>↷</button>
                                            <button type="button" onClick={duplicateSelectedOverlay}>⧉</button>
                                            <button type="button" className="delete-overlay-button" onClick={deleteSelectedOverlay}>🗑</button>
                                        </div>
                                    )
                                })()}
                                <div className="stamp-search-row">
                                    <input
                                        type="search"
                                        value={stampSearch}
                                        onChange={(event) => setStampSearch(event.target.value)}
                                        placeholder="スタンプを検索"
                                        aria-label="スタンプを検索"
                                    />
                                    {stampSearch && <button type="button" onClick={() => setStampSearch('')} aria-label="検索をクリア">×</button>}
                                </div>
                                <div className="stamp-categories" aria-label="スタンプカテゴリ">
                                    {([
                                        ['all', '全部'], ['love', 'ハート'], ['cute', 'かわいい'],
                                        ['food', 'フード'], ['animal', 'どうぶつ'], ['face', '顔'], ['other', 'その他'],
                                        ...(COMMUNITY_STAMPS.length > 0 ? [['community', 'みんなの'] as const] : [])
                                    ] as const).map(([id, label]) => (
                                        <button key={id} type="button" className={stampCategory === id ? 'selected' : ''} onClick={() => setStampCategory(id)}>{label}</button>
                                    ))}
                                </div>
                                <div className="stamp-picker" aria-label="スタンプを追加">
                                {STAMPS.filter((stamp) => {
                                    if (stampCategory !== 'all' && stamp.category !== stampCategory) return false
                                    const query = stampSearch.trim().toLocaleLowerCase('ja')
                                    if (!query) return true
                                    return `${stamp.label} ${stamp.author ?? ''} ${stamp.id}`.toLocaleLowerCase('ja').includes(query)
                                }).map((stamp) => (
                                    <button key={stamp.id} type="button" className="stamp-option" onClick={() => addStamp(stamp.id)}>
                                        <span>
                                            {stampAssetUrl(stamp)
                                                ? <img className="stamp-picker-image" src={stampAssetUrl(stamp)!} alt="" draggable={false} />
                                                : (stamp.glyph ?? '★')}
                                        </span>
                                        <small>{stamp.label}</small>
                                        {stamp.author && <small className="stamp-author">by {stamp.author}</small>}
                                    </button>
                                ))}
                                </div>
                            </div>
                        )}

                        {(!isEditing || error || activeEditorTab === 'draw') && (
                            <p className="capture-message" role="status" aria-live="polite">
                                {error || (
                                    isEditing
                                        ? '写真の上をマウスでドラッグして手書きできます。'
                                        : photoUrl
                                            ? '撮り直すか、この写真を編集できます。'
                                            : 'ボタンを押すとカメラが開きます。'
                                )}
                            </p>
                        )}

                        {!isEditing && (
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
                                    <>
                                        <button type="button" className="capture-button secondary-button" onClick={chooseFromGallery}>
                                            別の写真を選ぶ
                                        </button>
                                        <button type="button" className="capture-button" onClick={() => {
                                            const editingUrl = sourcePhotoUrl || photoUrl
                                            setPhotoUrl(editingUrl)
                                            setToolsCollapsed(false)
                                            setIsEditing(true)
                                        }}>
                                            編集する
                                        </button>
                                        <button type="button" className="capture-button menu-return-button" onClick={resetPhotoSession}>
                                            最初のメニューに戻る
                                        </button>
                                    </>
                                )}
                            </>
                        )}                    </footer>
                    {isEditing && (
                        <div className="editor-final-actions">
                            <button type="button" className="capture-button secondary-button" onClick={() => {
                                const dirty = selectedFrame !== 'none' || stampInstances.length > 0 || captionInstances.length > 0 || drawStrokes.length > 0
                                if (dirty) setConfirmExit(true)
                                else {
                                    setPhotoUrl(savedPhotoUrl || sourcePhotoUrl || photoUrl)
                                    setIsEditing(false)
                                }
                            }} disabled={isSaving}>
                                写真確認に戻る
                            </button>
                            <button type="button" className="capture-button" onClick={saveFinishedPhoto} disabled={isSaving}>
                                {isSaving ? '保存しています…' : '完成して保存'}
                            </button>
                        </div>
                    )}
                </div>
                {confirmExit && (
                    <div className="confirm-overlay" role="dialog" aria-modal="true">
                        <div className="confirm-card">
                            <strong>編集内容を破棄しますか？</strong>
                            <p>保存していない装飾は失われます。</p>
                            <div>
                                <button type="button" onClick={() => setConfirmExit(false)}>編集を続ける</button>
                                <button type="button" className="danger-confirm" onClick={() => {
                                    setPhotoUrl(savedPhotoUrl || sourcePhotoUrl || photoUrl)
                                    setIsEditing(false)
                                    resetEditorState()
                                }}>破棄して戻る</button>
                            </div>
                        </div>
                    </div>
                )}
                {saveNotice && <div className="save-toast" role="status">{saveNotice}</div>}
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

export default App
