import { Component, type ReactNode } from 'react'
import { fontSizes } from './typography'

type Props = { children: ReactNode; homeHref?: string }
type State = { failed: boolean; loadFailed: boolean }

/** Native HTML fallback also works when the router, theme or Ant Design provider fails. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, loadFailed: false }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? `${error.name} ${error.message}` : String(error)
    return { failed: true, loadFailed: /ChunkLoadError|Loading chunk|dynamically imported module|module script|Importing a module|CSS chunk/i.test(message) }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <section role="alert" aria-labelledby="af-recovery-title" style={{ maxWidth: 600, margin: '48px auto', padding: 24, border: '1px solid #cbd5e1', borderRadius: 16, background: '#fff', color: '#172b4d', fontFamily: 'system-ui, sans-serif', lineHeight: 1.6 }}>
      <p style={{ color: '#205b96', fontWeight: 700 }}>AquaFlow</p>
      <h1 id="af-recovery-title" style={{ fontSize: fontSizes['3xl'] }}>{this.state.loadFailed ? 'Không tải được trang' : 'Trang gặp sự cố'}</h1>
      <p>{this.state.loadFailed ? 'Kết nối có thể bị gián đoạn hoặc ứng dụng vừa được cập nhật. Kiểm tra mạng rồi tải lại trang.' : 'Không thể hiển thị nội dung lúc này. Bạn có thể thử lại hoặc quay về trang chính.'}</p>
      <p>Nội dung đang nhập có thể cần nhập lại. Nếu vừa gửi yêu cầu, hãy kiểm tra kết quả trước khi gửi lần nữa.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        {!this.state.loadFailed && <button type="button" onClick={() => this.setState({ failed: false, loadFailed: false })} style={{ padding: '10px 16px', cursor: 'pointer' }}>Thử lại</button>}
        <button type="button" onClick={() => window.location.reload()} style={{ padding: '10px 16px', cursor: 'pointer' }}>Tải lại trang</button>
        <a href={this.props.homeHref ?? '/'} style={{ color: '#205b96', textDecoration: 'underline' }}>Về trang chính</a>
      </div>
    </section>
  }
}
