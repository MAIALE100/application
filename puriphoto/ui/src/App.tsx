import { ReactNode, useEffect, useState } from 'react'
import './App.css'
import Frame from './components/Frame'

const devMode = !window['invokeNative']

const App = () => {
    const [photoUrl, setPhotoUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // App mounts after LB Phone's componentsLoaded event (or immediately in preview).
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
                // Keep the current photo if the camera closes without a new image.
                if (typeof url === 'string' && url.trim()) {
                    setPhotoUrl(url)
                    setError(null)
                }
            }, {
                default: { type: 'Photo' },
                permissions: {
                    takePhoto: true,
                    takeVideo: false,
                    takeLandscapePhoto: false
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
                        <p className="app-eyebrow">今日の一枚を、ここに。</p>
                        <h1>PuriPhoto</h1>
                    </header>

                    <section className="photo-area" aria-label="撮影した写真">
                        {photoUrl ? (
                            <img
                                className="photo-preview"
                                src={photoUrl}
                                alt="撮影した写真"
                                onError={() => setError('写真を読み込めませんでした。撮り直すことができます。')}
                            />
                        ) : (
                            <div className="empty-state">
                                <span className="camera-mark" aria-hidden="true">◎</span>
                                <h2>まずは写真を撮ろう</h2>
                                <p>お気に入りの瞬間を<br />PuriPhotoに。</p>
                            </div>
                        )}
                    </section>

                    <footer className="capture-controls">
                        <p className="capture-message" role="status" aria-live="polite">
                            {error || (photoUrl ? 'もう一度撮影して、写真を選び直せます。' : 'ボタンを押すとカメラが開きます。')}
                        </p>
                        <button type="button" className="capture-button" onClick={takePhoto}>
                            {photoUrl ? '撮り直す' : '写真を撮る'}
                        </button>
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
