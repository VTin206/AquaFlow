import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, LoaderCircle, type LucideIcon, RotateCw } from 'lucide-react'

// Ba trạng thái dùng chung khi hiển thị dữ liệu: đang tải, lỗi, không có dữ liệu.

export function LoadingState({ label = 'Đang tải dữ liệu...' }: { label?: string }) {
  return (
    <div className="empty-state" role="status" aria-live="polite">
      <LoaderCircle size={22} className="spin" />
      <span>{label}</span>
    </div>
  )
}

type ErrorStateProps = { title?: string; message: string; onRetry?: () => void }

export function ErrorState({ title = 'Không tải được dữ liệu', message, onRetry }: ErrorStateProps) {
  return (
    <div className="empty-state error-state" role="alert">
      <AlertTriangle size={22} />
      <strong>{title}</strong>
      <span>{message}</span>
      {onRetry && (
        <button className="button button-secondary" onClick={onRetry}>
          <RotateCw size={15} /> Thử lại
        </button>
      )}
    </div>
  )
}

type QueryStatus = { isPending: boolean; error: Error | null; refetch: () => unknown }

/** Thay nội dung trang khi dữ liệu đang tải hoặc tải lỗi. Dùng với kết quả của useQuery. */
export function QueryFallback({ query }: { query: QueryStatus }) {
  return (
    <div className="page-content subpage-content">
      <div className="surface">
        {query.isPending ? <LoadingState /> : <ErrorState message={query.error?.message ?? 'Đã xảy ra lỗi.'} onRetry={() => query.refetch()} />}
      </div>
    </div>
  )
}

type EmptyStateProps = { icon?: LucideIcon; title: string; description?: string; action?: ReactNode }

export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Icon size={22} />
      <strong>{title}</strong>
      {description && <span>{description}</span>}
      {action}
    </div>
  )
}
