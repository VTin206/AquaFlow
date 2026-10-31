import { Tooltip } from 'antd'

type BarChartProps = {
  /** `title` là nhãn đầy đủ cho tooltip; mặc định dùng `label`. */
  data: { label: string; value: number; title?: string }[]
  formatValue: (value: number) => string
  height?: number
}

/** Biểu đồ cột đơn giản, không cần thư viện biểu đồ. Cột cuối (gần nhất) được tô đậm. */
export function BarChart({ data, formatValue, height = 200 }: BarChartProps) {
  const max = Math.max(...data.map((item) => item.value), 1)
  // Nhiều cột (ví dụ 30 ngày) thì thu hẹp để vừa khung, nhãn hiện cách quãng; tooltip vẫn có đủ ngày.
  const dense = data.length > 14
  const labelStep = dense ? Math.ceil(data.length / 10) : 1
  return (
    <div className="af-chart-scroll" tabIndex={0} role="region" aria-label="Biểu đồ doanh thu, cuộn ngang để xem thêm ngày">
      <div
        className="af-bar-chart"
        style={{ height, minWidth: data.length * (dense ? 20 : 44), gap: dense ? 4 : undefined }}
        role="img"
        aria-label={`Biểu đồ cột. ${data.map((item) => `${item.title ?? item.label}: ${formatValue(item.value)}`).join('; ')}`}
      >
        {data.map((item, index) => (
          <Tooltip key={item.label} title={`${item.title ?? item.label}: ${formatValue(item.value)}`}>
            <div className="af-bar-column">
              <div
                className={`af-bar ${index === data.length - 1 ? 'is-latest' : ''}`}
                style={{ height: `${(Math.max(0, item.value) / max) * 100}%` }}
              />
              {(index % labelStep === 0 || index === data.length - 1) && <span className="af-bar-label">{item.label}</span>}
            </div>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
