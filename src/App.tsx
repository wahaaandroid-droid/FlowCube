import { useCallback, useState } from 'react'
import { GameScene } from './GameScene'
import { UIContainer } from './UIContainer'

export default function App() {
  const [resetToken, setResetToken] = useState(0)

  const handleReset = useCallback(() => {
    setResetToken((t) => t + 1)
  }, [])

  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-[#05060a]">
      <GameScene n={3} resetToken={resetToken} />
      <UIContainer onReset={handleReset} />
    </div>
  )
}
