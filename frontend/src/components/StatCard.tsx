import { Activity, ArrowUpRight, Ellipsis, type LucideIcon } from 'lucide-react'

type StatCardProps = {
  label: string
  value: string
  delta: string
  detail: string
  icon: LucideIcon
  tone: string
  trend: 'up' | 'warning'
}

export function StatCard({ label, value, delta, detail, icon: Icon, tone, trend }: StatCardProps) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}>
        <Icon size={19} strokeWidth={2} />
      </div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small className={trend === 'up' ? 'positive' : 'warning'}>
          {trend === 'up' ? <ArrowUpRight size={12} /> : <Activity size={12} />}
          {delta} <em>{detail}</em>
        </small>
      </div>
      <button className="stat-more" aria-label={`Xem ${label}`}>
        <Ellipsis size={18} />
      </button>
    </article>
  )
}
