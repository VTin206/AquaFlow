import { Tooltip } from 'antd'

type BarChartProps = {
  data: { label: string; value: number }[]
  formatValue: (value: number) => string
  height?: number
}

/** Biểu đồ cột đơn giản, không cần thư viện biểu đồ. Cột cuối (gần nhất) được tô đậm. */
export function BarChart({ data, formatValue, height = 200 }: BarChartProps) {
  const max = Math.max(...data.map((item) => item.value), 1)
  return (
    <div className="af-bar-chart" style={{ height }} role="img" aria-label="Biểu đồ cột">
      {data.map((item, index) => (
        <Tooltip key={item.label} title={`${item.label}: ${formatValue(item.value)}`}>
          <div className="af-bar-column">
            <div className={`af-bar ${index === data.length - 1 ? 'is-latest' : ''}`} style={{ height: `${(item.value / max) * 100}%` }} />
            <span className="af-bar-label">{item.label}</span>
          </div>
        </Tooltip>
      ))}
    </div>
  )
}
