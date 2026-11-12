import { useState } from 'react'
import { Alert, App, Button, Card, Col, Descriptions, Form, Input, InputNumber, Row, Select, Skeleton, Space, Typography } from 'antd'
import { Save } from 'lucide-react'
import { Page } from '@/shared/components/Page'
import { QueryError } from '@/shared/components/QueryError'
import { TransferQr } from '@/shared/payment/TransferQr'
import { vietQrBanks } from '@/shared/payment/vietqr'
import { useSettings, useUpdateSettings } from './settingsService'
import { Unsupported } from '@/shared/components/Unsupported'
import { ApiError } from '@/shared/api/client'
import { type SettingsSnapshot } from './settingsApi'
import { normalizeDeliveryFees, STAIR_FLOORS, type StoreSettings } from './types'
import { depositRatesLabel, useBottleDepositRates } from '@/features/live/bottleDeposits'
import { TextArea } from '@/shared/components/TextArea'
import { useConfirm } from '@/shared/components/confirm'

/** Nhóm ô trên trang, dùng để tóm tắt phần sẽ đổi trong hộp thoại xác nhận lưu. */
const settingGroups: { label: string; keys: (keyof StoreSettings)[] }[] = [
  { label: 'thông tin cửa hàng', keys: ['storeName', 'taxCode', 'address', 'phone', 'email', 'openingHours'] },
  { label: 'tài khoản chuyển khoản', keys: ['bankName', 'bankAccount', 'bankHolder'] },
  { label: 'ghi chú hóa đơn', keys: ['invoiceNote'] },
  { label: 'cảnh báo kho', keys: ['expiryWarningDays', 'defaultLowStock'] },
  { label: 'phí giao hàng', keys: ['deliveryFees'] },
]

export function SettingsPage() {
  const settingsQuery = useSettings()
  return (
    <Page title="Cài đặt cửa hàng">
      {settingsQuery.isError && !settingsQuery.data ? (
        <Card>
          <QueryError error={settingsQuery.error} onRetry={settingsQuery.refetch} />
        </Card>
      ) : settingsQuery.data ? (
        <SettingsForm
          settings={settingsQuery.data}
          reload={async () => {
            const result = await settingsQuery.refetch()
            if (!result.data || result.error) throw result.error
            return result.data
          }}
        />
      ) : (
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      )}
    </Page>
  )
}

function SettingsForm({ settings, reload }: { settings: SettingsSnapshot; reload: () => Promise<SettingsSnapshot> }) {
  const { message, modal } = App.useApp()
  const ask = useConfirm()
  const [version, setVersion] = useState(settings.version)
  const [conflict, setConflict] = useState(false)
  const [form] = Form.useForm<StoreSettings>()
  const update = useUpdateSettings()
  const [dirty, setDirty] = useState(false)
  const preview = Form.useWatch([], form) ?? settings
  const depositRates = useBottleDepositRates()
  // Đủ một ô cho mỗi lầu trên form.
  const toForm = (value: SettingsSnapshot): SettingsSnapshot =>
    value.deliveryFees ? { ...value, deliveryFees: normalizeDeliveryFees(value.deliveryFees) } : value

  return (
    <Form<StoreSettings>
      form={form}
      layout="vertical"
      disabled={update.isPending}
      initialValues={toForm(settings)}
      onValuesChange={() => setDirty(true)}
      onFinish={async (values) => {
        // Cài đặt áp dụng ngay cho mọi đơn mới, hóa đơn và mã QR chuyển khoản: liệt kê nhóm sẽ đổi trước khi lưu.
        const changed = settingGroups
          .filter((group) => group.keys.some((key) => JSON.stringify(values[key] ?? '') !== JSON.stringify(toForm(settings)[key] ?? '')))
          .map((group) => group.label)
        const ok = await ask({
          title: 'Lưu cài đặt cửa hàng?',
          content: (
            <>
              <p>Thay đổi: {changed.length ? changed.join(', ') : 'không có mục nào khác bản đang lưu'}.</p>
              <p>Áp dụng ngay cho đơn mới, hóa đơn và mã QR chuyển khoản; đơn đã tạo giữ nguyên.</p>
            </>
          ),
          okText: 'Lưu cài đặt',
        })
        if (!ok) return
        update.mutate(
          { ...values, version },
          {
            onSuccess: (saved: SettingsSnapshot) => {
              setVersion(saved.version)
              form.setFieldsValue(toForm(saved))
              setConflict(false)
              message.success('Đã lưu cài đặt cửa hàng.')
              setDirty(false)
            },
            onError: (error) => {
              if (error instanceof ApiError && error.status === 409) setConflict(true)
              else message.error(error.message)
            },
          },
        )
      }}
    >
      {conflict && (
        <Alert
          type="warning"
          showIcon
          title="Cài đặt đã được người khác thay đổi. Bản nháp của bạn vẫn được giữ."
          action={
            <Button
              onClick={() =>
                modal.confirm({
                  title: 'Bỏ bản nháp và tải cài đặt mới nhất?',
                  okText: 'Tải lại',
                  cancelText: 'Giữ bản nháp',
                  onOk: async () => {
                    try {
                      const latest = await reload()
                      form.setFieldsValue(toForm(latest))
                      setVersion(latest.version)
                      setDirty(false)
                      setConflict(false)
                    } catch (error) {
                      message.error((error as Error).message)
                      throw error
                    }
                  },
                })
              }
            >
              Tải lại
            </Button>
          }
        />
      )}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <Card className="af-card af-settings-card" title="Thông tin cửa hàng">
            <Row gutter={16}>
              <Col xs={24} md={14}>
                <Form.Item
                  name="storeName"
                  label="Tên cửa hàng"
                  rules={[{ required: true, whitespace: true, message: 'Nhập tên cửa hàng.' }, { max: 120 }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={10}>
                <Form.Item
                  name="taxCode"
                  label="Mã số thuế"
                  rules={[{ pattern: /^\d{10}(-\d{3})?$/, message: 'Gồm 10 chữ số, chi nhánh thêm -xxx.' }]}
                >
                  <Input inputMode="numeric" placeholder="Không bắt buộc" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="address"
              label="Địa chỉ"
              rules={[{ required: true, whitespace: true, message: 'Nhập địa chỉ.' }, { max: 255 }]}
            >
              <Input />
            </Form.Item>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="phone"
                  label="Số điện thoại"
                  rules={[
                    { required: true, message: 'Nhập số điện thoại.' },
                    {
                      validator: (_, value?: string) =>
                        !value || /^(?:0\d{9,10}|84\d{9,10})$/.test(value.replace(/\D/g, ''))
                          ? Promise.resolve()
                          : Promise.reject(new Error('Số điện thoại không hợp lệ.')),
                    },
                  ]}
                >
                  <Input inputMode="tel" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Email chưa đúng định dạng.' }]}>
                  <Input inputMode="email" placeholder="Không bắt buộc" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="openingHours" label="Giờ mở cửa" extra="Hiện cạnh hotline trên đầu trang đặt hàng." rules={[{ max: 100 }]}>
              <Input placeholder="Vd. 6:00 – 21:00 hằng ngày" />
            </Form.Item>
          </Card>

          <Card className="af-card af-settings-card" title="Chuyển khoản & hóa đơn">
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item
                  name="bankName"
                  label="Ngân hàng"
                  tooltip="Ngân hàng trong danh sách VietQR để tạo mã QR chuyển khoản theo đơn."
                  dependencies={['bankAccount', 'bankHolder']}
                  rules={[
                    ({ getFieldValue }) => ({
                      validator: (_, value) => {
                        const filled = [value, getFieldValue('bankAccount'), getFieldValue('bankHolder')].filter((item) =>
                          item?.trim(),
                        ).length
                        return filled === 0 || filled === 3
                          ? Promise.resolve()
                          : Promise.reject(new Error('Nhập đủ ngân hàng, số tài khoản và chủ tài khoản.'))
                      },
                    }),
                  ]}
                >
                  <Select
                    showSearch
                    allowClear
                    placeholder="Chọn ngân hàng"
                    options={vietQrBanks.map((bank) => ({ value: bank.name, label: bank.name }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="bankAccount" label="Số tài khoản" rules={[{ pattern: /^\d{6,20}$/, message: 'Chỉ gồm 6–20 chữ số.' }]}>
                  <Input inputMode="numeric" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="bankHolder" label="Chủ tài khoản" normalize={(value?: string) => value?.toUpperCase()}>
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="invoiceNote" label="Ghi chú cuối hóa đơn" rules={[{ max: 200 }]}>
              <TextArea rows={2} showCount maxLength={200} />
            </Form.Item>
          </Card>

          <Card className="af-card af-settings-card" title="Cảnh báo kho">
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="expiryWarningDays"
                  label="Cảnh báo khi hạn dùng còn dưới (ngày)"
                  tooltip="Áp dụng cho bộ lọc Sắp hết hạn ở Kho hàng và Lô hàng."
                  rules={[{ required: true }, { type: 'integer', min: 1, max: 730, message: 'Từ 1 đến 730 ngày.' }]}
                >
                  <InputNumber min={1} max={730} precision={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="defaultLowStock"
                  label="Tồn tối thiểu mặc định cho sản phẩm mới"
                  rules={[{ required: true }, { type: 'integer', min: 0, max: 1000000, message: 'Số nguyên không âm.' }]}
                >
                  <InputNumber min={0} max={1000000} precision={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} xl={9}>
          <Card className="af-card af-settings-card" title="Xem trước đầu hóa đơn">
            <div className="af-invoice-preview" aria-label="Xem trước đầu hóa đơn">
              <strong>{preview.storeName || 'Tên cửa hàng'}</strong>
              <span>{preview.address || 'Địa chỉ'}</span>
              <span>
                ĐT: {preview.phone || '—'}
                {preview.taxCode ? ` · MST: ${preview.taxCode}` : ''}
              </span>
              {preview.bankAccount && (
                <span>
                  CK: {preview.bankName} {preview.bankAccount} · {preview.bankHolder}
                </span>
              )}
              <em>{preview.invoiceNote}</em>
            </div>
          </Card>

          <Card className="af-card af-settings-card" title="Mã QR chuyển khoản (thử)">
            <TransferQr settings={preview} amount={100000} note="AF1000" size={140} />
            <p className="af-form-hint">
              Mỗi đơn có mã QR riêng với số tiền còn phải thu và nội dung là mã đơn. Quét thử bằng ứng dụng ngân hàng để kiểm tra tên tài
              khoản.
            </p>
          </Card>

          <Card className="af-card af-settings-card" title="Phí giao hàng">
            <Row gutter={12}>
              <Col xs={12}>
                <Form.Item
                  name={['deliveryFees', 'freeFromUnits']}
                  label="Miễn phí từ (bình/thùng)"
                  rules={[
                    { required: true, message: 'Nhập số bình/thùng.' },
                    { type: 'integer', min: 0, max: 1000, message: 'Từ 0 đến 1.000.' },
                  ]}
                >
                  <InputNumber min={0} max={1000} precision={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={12}>
                <Form.Item
                  name={['deliveryFees', 'smallOrderFee']}
                  label="Phí đơn ít hơn (₫)"
                  rules={[
                    { required: true, message: 'Nhập phí giao.' },
                    { type: 'integer', min: 0, max: 10000000, message: 'Từ 0 đến 10.000.000 ₫.' },
                  ]}
                >
                  <InputNumber min={0} max={10000000} step={1000} precision={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Typography.Text strong>Phụ phí thang bộ mỗi bình (₫)</Typography.Text>
            <Row gutter={8} style={{ marginTop: 8 }}>
              {Array.from({ length: STAIR_FLOORS }, (_, index) => (
                <Col xs={12} sm={6} key={index}>
                  <Form.Item
                    name={['deliveryFees', 'stairsPerJug', index]}
                    label={index === STAIR_FLOORS - 1 ? `Lầu ${index + 1}+` : `Lầu ${index + 1}`}
                    rules={[
                      { required: true, message: 'Nhập phụ phí.' },
                      { type: 'integer', min: 0, max: 1000000, message: 'Từ 0 đến 1.000.000 ₫.' },
                    ]}
                  >
                    <InputNumber min={0} max={1000000} step={1000} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              ))}
            </Row>
            <Typography.Paragraph type="secondary" className="af-form-hint">
              Áp dụng cho báo giá ở trang đặt hàng và đơn giao tận nơi tạo sau khi lưu; đơn đã tạo giữ phí cũ. Chỉ tính bình giao lên lầu
              bằng thang bộ.
            </Typography.Paragraph>
          </Card>

          <Card className="af-card af-settings-card" title="Chính sách vỏ">
            <Descriptions
              size="small"
              column={1}
              items={[
                {
                  key: 'deposit',
                  label: 'Cọc mỗi vỏ (khách chưa có vỏ)',
                  children: depositRates.isPending
                    ? 'Đang tải…'
                    : depositRates.isError
                      ? 'Không tải được danh mục loại vỏ.'
                      : depositRates.data.length
                        ? depositRatesLabel(depositRates.data)
                        : 'Chưa có loại vỏ đang lưu hành.',
                },
                { key: 'brands', label: 'Đổi bù vỏ', children: <Unsupported /> },
                { key: 'pickup', label: 'Thu hồi tận nơi', children: <Unsupported /> },
              ]}
            />
            <Typography.Paragraph type="secondary" className="af-form-hint">
              Tiền cọc sửa ở Danh mục loại vỏ (trang Khách hàng › Vỏ bình), áp dụng theo loại vỏ của sản phẩm. Đổi bù vỏ và thu hồi tận nơi
              chưa áp dụng.
            </Typography.Paragraph>
          </Card>
        </Col>
      </Row>

      <div className="af-settings-actions">
        <Space>
          <Button
            disabled={!dirty}
            onClick={() => {
              form.setFieldsValue(toForm(settings))
              setVersion(settings.version)
              setConflict(false)
              setDirty(false)
            }}
          >
            Hủy thay đổi
          </Button>
          <Button type="primary" htmlType="submit" icon={<Save size={16} />} loading={update.isPending} disabled={!dirty}>
            Lưu cài đặt
          </Button>
        </Space>
      </div>
    </Form>
  )
}
