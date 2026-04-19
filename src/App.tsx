import { useCallback, useState } from 'react'
import { GameScene } from './GameScene'
import { UIContainer } from './UIContainer'

export default function App() {
  const [resetToken, setResetToken] = useState(0)

  const handleReset = useCallback(() => {
    setResetToken((t) => t + 1)
  }, [])

  return (
    <div className="relative h-[100svh] min-h-[100dvh] w-full overflow-hidden bg-[#05060a]">
      <div className="absolute inset-0 z-0">
        <GameScene n={3} resetToken={resetToken} />
      </div>
      <UIContainer onReset={handleReset} />
    </div>
  )
}
