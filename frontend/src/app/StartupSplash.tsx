import { Waves } from 'lucide-react'

/** Nối tiếp màn hình chờ của index.html (CSS `af-startup-*` nằm ở đó) trong lúc tải trang đầu tiên. */
export function StartupSplash() {
  return (
    <main className="af-startup">
      <div className="af-startup-body">
        <div className="af-startup-brand">
          <span className="af-startup-mark" aria-hidden>
            <Waves />
          </span>
          AquaFlow
        </div>
        <div className="af-startup-spinner" role="status" aria-label="Đang tải" />
      </div>
    </main>
  )
}
