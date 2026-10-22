import { Alert } from 'antd'
import { Link } from 'react-router'
import { Page } from '../../shared/components/Page'

export function UnavailablePage() {
  return <Page title="Chức năng đang phát triển" description="Luồng này hiện chỉ hoạt động với dữ liệu mẫu.">
    <Alert type="info" showIcon title="Chưa kết nối backend" description={<>Phiên đăng nhập thật hiện hỗ trợ danh mục <Link to="/products">Sản phẩm</Link>, <Link to="/suppliers">Nhà cung cấp</Link> và <Link to="/customers">Khách hàng</Link>. Hãy dùng bản xem thử nếu muốn khám phá các màn còn lại.</>} />
  </Page>
}
