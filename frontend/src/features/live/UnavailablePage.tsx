import { Alert } from 'antd'
import { Link } from 'react-router'
import { Page } from '../../shared/components/Page'

export function UnavailablePage() {
  return <Page title="Chức năng đang phát triển" description="Luồng này hiện chỉ hoạt động với dữ liệu mẫu.">
    <Alert type="info" showIcon title="Chức năng chưa khả dụng" description={<>Bạn có thể quản lý <Link to="/products">Sản phẩm</Link>, <Link to="/suppliers">Nhà cung cấp</Link>, <Link to="/customers">Khách hàng</Link> và xem <Link to="/orders">Đơn hàng</Link>. Hãy dùng bản xem thử nếu muốn khám phá các màn còn lại.</>} />
  </Page>
}
