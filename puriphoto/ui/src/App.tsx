import { ReactNode, useEffect, useState } from 'react'
import './App.css'
import Frame from './components/Frame'

const devMode = !window['invokeNative']
type FrameStyle = 'none' | 'soft' | 'pop'

const App = () => {
    const [photoUrl, setPhotoUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [selectedFrame, setSelectedFrame] = useState<FrameStyle>('none')

    useEffect(() => {
        document.body.style.visibility = 'visible'
    }, [])

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
                    setIsEditing(false)
                    setSelectedFrame('none')
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
                            <div className="photo-stage">
                                <img
                                    className="photo-preview"
                                    src={photoUrl}
                                    alt={isEditing ? '編集中の写真' : '撮影した写真'}
                                    onError={() => setError('写真を読み込めませんでした。撮り直すことができます。')}
                                />
                                {isEditing && selectedFrame !== 'none' && (
                                    <div className={`frame-overlay frame-${selectedFrame}`} aria-hidden="true" />
                                )}
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
                            <button type="button" className="capture-button" onClick={() => setIsEditing(false)}>
                                写真確認に戻る
                            </button>
                        ) : (
                            <>
                                <button type="button" className="capture-button" onClick={takePhoto}>
                                    {photoUrl ? '撮り直す' : '写真を撮る'}
                                </button>
                                {photoUrl && (
                                    <button type="button" className="capture-button" onClick={() => setIsEditing(true)}>
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
