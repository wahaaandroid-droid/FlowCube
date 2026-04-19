import { AnimatePresence, motion } from 'framer-motion'

export function UIContainer({
  onReset,
  resetDisabled,
}: {
  onReset: () => void
  resetDisabled?: boolean
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
      <motion.header
        className="pointer-events-none"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="mx-auto max-w-xl text-center">
          <div className="text-xs tracking-[0.22em] text-slate-400">FLOW CUBE</div>
          <div className="mt-2 text-lg font-medium text-slate-100 sm:text-xl">3×3×3 表面グリッド</div>
          <div className="mt-2 text-sm leading-relaxed text-slate-400">
            マスを押したまま隣接マスへドラッグして線を引きます。面の境界をまたいでも連続します。
            <span className="text-slate-500">（回転: 右ドラッグ / 二本指）</span>
          </div>
        </div>
      </motion.header>

      <div className="pointer-events-auto mx-auto flex w-full max-w-xl justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
        <AnimatePresence mode="wait">
          <motion.button
            key="reset"
            type="button"
            disabled={resetDisabled}
            onClick={onReset}
            className="rounded-full border border-cyan-400/35 bg-cyan-400/10 px-5 py-2 text-sm font-medium text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.12)] backdrop-blur-md transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-40"
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25 }}
          >
            線をリセット
          </motion.button>
        </AnimatePresence>
      </div>
    </div>
  )
}
