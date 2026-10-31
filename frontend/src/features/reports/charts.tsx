import type { ReactNode } from 'react'
import { Grid } from 'antd'
import { Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { compactCurrency, currency } from '@/shared/utils/format'
import type { RevenueBucket } from './periods'
import type { DriverReportRow, ProductReportRow } from './reportService'

// Màu lấy từ biến CSS nên biểu đồ tự đổi theo chế độ sáng/tối.
const axisTick = { fill: 'var(--af-text-tertiary)', fontSize: 12 }
const hoverCursor = { fill: 'var(--af-surface-hover)' }

/** Nhãn trục danh mục một dòng, cắt bớt nếu dài (Recharts mặc định tự xuống dòng). */
function CategoryTick({ x, y, payload, maxLength }: { x?: number | string; y?: number | string; payload?: { value: string }; maxLength: number }) {
  const value = payload?.value ?? ''
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill="var(--af-text)" fontSize={13}>
      <title>{value}</title>
      {value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value}
    </text>
  )
}

type LegendItem = { label: string; color: string; line?: boolean }

/** Chú thích đặt trên biểu đồ; dấu đường cho chuỗi vẽ bằng đường, ô vuông cho chuỗi vẽ bằng cột. */
function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="af-chart-legend">
      {items.map((item) => (
        <li key={item.label}>
          <i className={item.line ? 'is-line' : undefined} style={{ background: item.color }} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

function ChartTooltip({ title, rows }: { title: ReactNode; rows: (LegendItem & { value: ReactNode })[] }) {
  return (
    <div className="af-chart-tooltip">
      <strong>{title}</strong>
      {rows.map((row) => (
        <div key={row.label} className="af-chart-tooltip-row">
          <i className={row.line ? 'is-line' : undefined} style={{ background: row.color }} aria-hidden />
          <span>{row.label}</span>
          <b>{row.value}</b>
        </div>
      ))}
    </div>
  )
}

const revenueSeries = { label: 'Doanh thu thuần', color: 'var(--af-chart-bar)' }
const collectedSeries = { label: 'Tiền thực thu', color: 'var(--af-money-paid)', line: true }

/** Doanh thu (cột) và tiền thực thu (đường) cùng một trục tiền: khoảng cách giữa hai là tiền chưa thu hoặc thu nợ cũ. */
export function RevenueChart({ data }: { data: RevenueBucket[] }) {
  const dots = data.length <= 14
  return (
    <div className="af-chart">
      <ChartLegend items={[revenueSeries, collectedSeries]} />
      <div role="img" aria-label={`Biểu đồ doanh thu và tiền thu. ${data.map((bucket) => `${bucket.title}: doanh thu ${compactCurrency(bucket.revenue)}, thu ${compactCurrency(bucket.collected)}`).join('; ')}`}>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--af-border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--af-border-strong)' }} tick={axisTick} minTickGap={16} />
            <YAxis tickFormatter={compactCurrency} width={60} tickLine={false} axisLine={false} tick={axisTick} />
            <Tooltip
              cursor={hoverCursor}
              content={({ active, payload }) => {
                const bucket = active ? (payload?.[0]?.payload as RevenueBucket | undefined) : undefined
                return bucket ? (
                  <ChartTooltip
                    title={bucket.title}
                    rows={[
                      { ...revenueSeries, value: currency(bucket.revenue) },
                      { ...collectedSeries, value: currency(bucket.collected) },
                    ]}
                  />
                ) : null
              }}
            />
            <Bar dataKey="revenue" fill={revenueSeries.color} activeBar={{ fill: 'var(--af-chart-bar-hover)' }} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
            <Line
              dataKey="collected"
              type="linear"
              stroke={collectedSeries.color}
              strokeWidth={2}
              dot={dots ? { r: 4, fill: collectedSeries.color, stroke: 'var(--af-surface)', strokeWidth: 2 } : false}
              activeDot={{ r: 5, fill: collectedSeries.color, stroke: 'var(--af-surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const TOP_PRODUCTS = 8

/** Top sản phẩm theo doanh thu, thanh ngang để tên dài vẫn đọc được. */
export function TopProductsChart({ rows }: { rows: ProductReportRow[] }) {
  // Màn hẹp thu cột tên lại để thanh còn đủ dài mà so.
  const wide = Grid.useBreakpoint().md !== false
  const data = rows.filter((row) => row.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, TOP_PRODUCTS)
  return (
    <div role="img" aria-label={`Sản phẩm doanh thu cao nhất. ${data.map((row) => `${row.name}: ${compactCurrency(row.revenue)}`).join('; ')}`}>
      <ResponsiveContainer width="100%" height={data.length * 36 + 8}>
        <BarChart layout="vertical" data={data} margin={{ top: 4, right: 56, bottom: 4, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis type="category" dataKey="name" width={wide ? 230 : 120} tickLine={false} axisLine={false} tick={(props) => <CategoryTick {...props} maxLength={wide ? 30 : 15} />} />
          <Tooltip
            cursor={hoverCursor}
            content={({ active, payload }) => {
              const row = active ? (payload?.[0]?.payload as ProductReportRow | undefined) : undefined
              return row ? (
                <ChartTooltip
                  title={row.name}
                  rows={[
                    { label: 'Doanh thu', color: 'var(--af-primary)', value: currency(row.revenue) },
                    { label: 'Đã bán', color: 'transparent', value: `${row.sold} ${row.unit}` },
                  ]}
                />
              ) : null
            }}
          />
          <Bar dataKey="revenue" fill="var(--af-primary)" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
            <LabelList dataKey="revenue" position="right" formatter={(value) => compactCurrency(Number(value))} style={{ fill: 'var(--af-text-secondary)', fontSize: 12 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Màu trạng thái: luôn đi kèm chú thích và số trên từng đoạn, không chỉ dựa vào màu.
// Số trên đoạn dùng màu nền (trắng khi sáng, tối khi tối) để đủ tương phản với màu trạng thái của từng chế độ.
const deliverySeries = [
  { key: 'onTime', label: 'Đúng hẹn', color: 'var(--af-money-paid)' },
  { key: 'late', label: 'Trễ hẹn', color: 'var(--af-warning)' },
  { key: 'failed', label: 'Thất bại', color: 'var(--af-danger)' },
] as const

type DriverBar = { driver: string; onTime: number; late: number; failed: number }

/** Lượt giao của từng tài xế: đúng hẹn + trễ hẹn = giao thành công, cộng thêm lần thất bại. */
export function DriverDeliveryChart({ rows }: { rows: DriverReportRow[] }) {
  const wide = Grid.useBreakpoint().md !== false
  const data: DriverBar[] = rows.map((row) => ({ driver: row.driver, onTime: Math.max(0, row.delivered - row.late), late: row.late, failed: row.failed }))
  return (
    <div className="af-chart">
      <ChartLegend items={[...deliverySeries]} />
      <div role="img" aria-label={`Lượt giao theo tài xế. ${data.map((row) => `${row.driver}: ${row.onTime} đúng hẹn, ${row.late} trễ hẹn, ${row.failed} thất bại`).join('; ')}`}>
        <ResponsiveContainer width="100%" height={data.length * 44 + 8}>
          <BarChart layout="vertical" data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }} barCategoryGap={10}>
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis type="category" dataKey="driver" width={wide ? 130 : 96} tickLine={false} axisLine={false} tick={(props) => <CategoryTick {...props} maxLength={wide ? 18 : 12} />} />
            <Tooltip
              cursor={hoverCursor}
              content={({ active, payload }) => {
                const row = active ? (payload?.[0]?.payload as DriverBar | undefined) : undefined
                return row ? <ChartTooltip title={row.driver} rows={deliverySeries.map((series) => ({ ...series, value: row[series.key] }))} /> : null
              }}
            />
            {deliverySeries.map((series) => (
              // Viền màu nền tạo khe 2px giữa các đoạn.
              <Bar key={series.key} dataKey={series.key} stackId="trips" fill={series.color} stroke="var(--af-surface)" strokeWidth={2} maxBarSize={24} isAnimationActive={false}>
                <LabelList
                  dataKey={series.key}
                  content={({ x, y, width, height, value }) => {
                    // Đoạn quá hẹp thì bỏ số để không dính vào đoạn bên cạnh; tooltip vẫn có đủ.
                    if (!Number(value) || Number(width) < 22) return null
                    return (
                      <text x={Number(x) + Number(width) / 2} y={Number(y) + Number(height) / 2} dy={4} textAnchor="middle" fill="var(--af-surface)" fontSize={12} fontWeight={600}>
                        {value}
                      </text>
                    )
                  }}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Thanh tỉ lệ giữa các phần của một tổng (ví dụ tiền mặt / chuyển khoản), kèm phần trăm. */
export function ShareBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0)
  if (!total) return null
  const percent = (value: number) => Math.round((Math.max(0, value) / total) * 100)
  return (
    <div className="af-share">
      <div className="af-share-bar" role="img" aria-label={parts.map((part) => `${part.label} ${percent(part.value)}%`).join(', ')}>
        {parts.map((part) => (part.value > 0 ? <span key={part.label} style={{ flexGrow: part.value, background: part.color }} /> : null))}
      </div>
      <ul className="af-chart-legend">
        {parts.map((part) => (
          <li key={part.label}>
            <i style={{ background: part.color }} aria-hidden />
            {part.label} <b>{percent(part.value)}%</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Số kèm thanh nhỏ phía dưới để so độ lớn giữa các dòng trong bảng. */
export function InlineBar({ value, max, children }: { value: number; max: number; children: ReactNode }) {
  return (
    <div className="af-inline-bar">
      <span>{children}</span>
      <i style={{ width: `${max > 0 ? (Math.max(0, value) / max) * 100 : 0}%` }} aria-hidden />
    </div>
  )
}
