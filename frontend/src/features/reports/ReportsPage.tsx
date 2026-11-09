import { useIsDemo } from '@/shared/features'
import { demoReportApi } from './demoReportApi'
import { LiveReportsPage } from './LiveReportsPage'
import { reportApi } from './reportApi'

/** Một trang báo cáo cho cả bản dùng thử và tài khoản thật; chỉ khác nguồn số liệu. */
export function ReportsPage() {
  const demo = useIsDemo()
  return <LiveReportsPage source={demo ? demoReportApi : reportApi} scope={demo ? 'demo' : 'live'} />
}
