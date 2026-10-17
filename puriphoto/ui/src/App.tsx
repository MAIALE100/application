import { ReactNode, useEffect, useRef, useState } from 'react'
import './App.css'
import Frame from './components/Frame'

const devMode = !window?.['invokeNative']

const App = () => {
    const [gameRender, setGameRender] = useState(false)
    const [notificationText, setNotificationText] = useState('Notification text')
    const [photoUrl, setPhotoUrl] = useState<string | null>(null)

    const appDiv = useRef(null)

    useEffect(() => {
        if (devMode) {
            document.body.style.visibility = 'visible'
            return
        }
    }, [])

    useEffect(() => {
        if (notificationText === '') setNotificationText('Notification text')
    }, [notificationText])

    return (
        <AppProvider>
            <div className="app" ref={appDiv}>
                <div className="app-wrapper">

                    {photoUrl && (
    <img
    src={photoUrl}
    alt="PuriPhoto"
    style={{
        width: '100%',
        maxHeight: '400px',
        objectFit: 'contain'
    }}
/>
)}
</div>
            </div>
        </AppProvider>
    )
}

const Header = () => {
    const [direction, setDirection] = useState('N')

    useEffect(() => {
        if (devMode) return

        fetchNui<string>('getDirection').then(setDirection)
        useNuiEvent('updateDirection', setDirection)
    }, [])

    return (
        <div className="header">
            <div className="title">Custom App Template</div>
            <div className="subtitle">React TS</div>
            <a className="subtitle">{direction}</a>
        </div>
    )
}

const GameRender = ({ remove }: { remove: (photo?: string, blob?: Blob) => void }) => {
    const aspectRatio = 9 / 18

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const gameRenderRef = useRef<ReturnType<typeof components.createGameRender>>(null)

    useEffect(() => {
        if (!canvasRef.current) return

        const gameRender = components.createGameRender(canvasRef.current)

        gameRenderRef.current = gameRender

        gameRender.resizeByAspect(aspectRatio)

        fetchNui('toggleCamera', true)

        const checkDestroyedInterval = setInterval(() => {
            if (gameRender.destroyed) remove()
        }, 1000)

        return () => {
            fetchNui('toggleCamera', false)

            if (checkDestroyedInterval) clearInterval(checkDestroyedInterval)

            gameRenderRef.current?.destroy()
        }
    }, [canvasRef.current])

    return (
        <div
            className="gamerender-blur"
            onClick={() => {
                remove()
            }}
        >
            <div
                className="gamerender-container"
                style={{
                    aspectRatio: aspectRatio
                }}
                onClick={(event) => {
                    event.stopPropagation()

                    const gameRender = gameRenderRef.current

                    if (!gameRender || gameRender.destroyed) return

                    gameRender.takePhoto().then((blob) => {
                        const url = URL.createObjectURL(blob)

                        remove(url, blob)
                    })
                }}
            >
                <canvas
                    style={{
                        width: '100%',
                        height: '100%'
                    }}
                    ref={canvasRef}
                />
            </div>
        </div>
    )
}

const AppProvider = ({ children }: { children: ReactNode }) => {
    if (devMode) {
        const handleResize = () => {
            const { innerWidth, innerHeight } = window

            const aspectRatio = innerWidth / innerHeight
            const phoneAspectRatio = 27.6 / 59

            if (phoneAspectRatio < aspectRatio) {
                document.documentElement.style.fontSize = '1.66vh'
            } else {
                document.documentElement.style.fontSize = '3.4vw'
            }
        }

        useEffect(() => {
            window.addEventListener('resize', handleResize)

            return () => {
                window.removeEventListener('resize', handleResize)
            }
        }, [])

        handleResize()

        return (
            <div className="dev-wrapper">
                <Frame>{children}</Frame>
            </div>
        )
    } else return children
}

export default App
