import { ReactNode, useEffect, useState } from 'react'
import './App.css'
import Frame from './components/Frame'

const devMode = !window['invokeNative']
type FrameStyle = 'none' | 'soft' | 'pop'
type StampId = 'heart' | 'star' | 'crown' | 'sparkle'
const STAMPS: { id: StampId; label: string; glyph: string; x: number; y: number }[] = [
    { id: 'heart', label: 'ハート', glyph: '💗', x: 0.13, y: 0.14 },
    { id: 'star', label: '星', glyph: '⭐', x: 0.86, y: 0.14 },
    { id: 'crown', label: '王冠', glyph: '👑', x: 0.14, y: 0.85 },
    { id: 'sparkle', label: 'キラキラ', glyph: '✨', x: 0.86, y: 0.85 }
]

const App = () => {
    const [photoUrl, setPhotoUrl] = useState<string | null>(null)
    const [sourcePhotoUrl, setSourcePhotoUrl] = useState<string | null>(null)
    const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [selectedFrame, setSelectedFrame] = useState<FrameStyle>('none')
    const [selectedStamps, setSelectedStamps] = useState<StampId[]>([])
    const [photoAspectRatio, setPhotoAspectRatio] = useState<number | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        document.body.style.visibility = 'visible'
    }, [])

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
                    setSelectedStamps([])
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
                    setPhotoAspectRatio(null)
                    setError(null)
                }
            })
        } catch (cause) {
            console.error('[PuriPhoto] Failed to open gallery:', cause)
            setError('ギャラリーを開けませんでした。')
        }
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

            if (selectedStamps.length > 0) {
                const stampSize = Math.max(30, Math.round(Math.min(width, height) * 0.11))
                context.save()
                context.font = `\u0024{stampSize}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
                context.textAlign = 'center'
                context.textBaseline = 'middle'
                context.shadowColor = 'rgba(255, 105, 180, 0.65)'
                context.shadowBlur = stampSize * 0.18
                for (const stamp of STAMPS) {
                    if (!selectedStamps.includes(stamp.id)) continue
                    context.fillText(stamp.glyph, width * stamp.x, height * stamp.y)
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
            setSelectedStamps([])
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
                                {isEditing && STAMPS.filter((stamp) => selectedStamps.includes(stamp.id)).map((stamp) => (
                                    <span key={stamp.id} className={`stamp-overlay stamp-${stamp.id}`} aria-hidden="true">
                                        {stamp.glyph}
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
                            <div className="frame-picker" aria-label="フレームを選択">
                                <button className={selectedFrame === 'none' ? 'frame-option selected' : 'frame-option'} onClick={() => setSelectedFrame('none')}>なし</button>
                                <button className={selectedFrame === 'soft' ? 'frame-option selected' : 'frame-option'} onClick={() => setSelectedFrame('soft')}>フレーム1</button>
                                <button className={selectedFrame === 'pop' ? 'frame-option selected' : 'frame-option'} onClick={() => setSelectedFrame('pop')}>フレーム2</button>
                            </div>
                        )}
                        {isEditing && (
                            <div className="stamp-picker" aria-label="スタンプを選択">
                                {STAMPS.map((stamp) => (
                                    <button
                                        key={stamp.id}
                                        type="button"
                                        className={selectedStamps.includes(stamp.id) ? 'stamp-option selected' : 'stamp-option'}
                                        aria-pressed={selectedStamps.includes(stamp.id)}
                                        onClick={() => setSelectedStamps((current) =>
                                            current.includes(stamp.id)
                                                ? current.filter((id) => id !== stamp.id)
                                                : [...current, stamp.id]
                                        )}
                                    >
                                        <span>{stamp.glyph}</span>
                                        <small>{stamp.label}</small>
                                    </button>
                                ))}
                            </div>
                        )}

                        <p className="capture-message" role="status" aria-live="polite">
                            {error || (
                                isEditing
                                    ? 'フレームを選んで写真に重ねられます。'
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
                                    setPhotoUrl(sourcePhotoUrl || photoUrl)
                                    setIsEditing(true)
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

export default App
