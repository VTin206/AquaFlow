import { Card, Empty } from 'antd'
import { Link } from 'react-router'
import { Page } from '@/shared/components/Page'
import { UNSUPPORTED_HINT } from '@/shared/components/Unsupported'

/** Trang chưa có API BE: giữ tiêu đề như bản dùng thử, không hiện dữ liệu giả. */
export function UnavailablePage({ title }: { title: string }) {
  return (
    <Page title={title} description={UNSUPPORTED_HINT}>
      <Card>
        <Empty
          description={<>
            <strong>Chưa hỗ trợ</strong>
            <div className="af-text-muted">
              Hiện đã dùng được <Link to="/orders">Đơn hàng</Link>, <Link to="/inventory">Kho hàng</Link>, <Link to="/products">Sản phẩm</Link>, <Link to="/suppliers">Nhà cung cấp</Link> và <Link to="/customers">Khách hàng</Link>.
            </div>
          </>}
        />
      </Card>
    </Page>
  )
}
