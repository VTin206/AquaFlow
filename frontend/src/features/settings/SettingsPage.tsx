import { useState } from 'react'
import { Alert, App, Button, Card, Col, Descriptions, Form, Input, InputNumber, Row, Select, Skeleton, Space, Typography } from 'antd'
import { Save } from 'lucide-react'
import { Page } from '@/shared/components/Page'
import { QueryError } from '@/shared/components/QueryError'
import { TransferQr } from '@/shared/payment/TransferQr'
import { vietQrBanks } from '@/shared/payment/vietqr'
import {
  DEPOSIT_PER_BOTTLE,
  EXCHANGEABLE_BRANDS,
  FREE_DELIVERY_MIN_UNITS,
  PICKUP_FEE,
  PICKUP_FEE_BELOW,
  SMALL_ORDER_FEE,
  stairsSurcharge,
} from '@/shared/policy'
import { currency } from '@/shared/utils/format'
import { useSettings, useUpdateSettings } from './settingsService'
import { useIsDemo } from '@/shared/features'
import { Unsupported } from '@/shared/components/Unsupported'
import { ApiError } from '@/shared/api/client'
import { type SettingsSnapshot } from './settingsApi'
import type { StoreSettings } from './types'

export function SettingsPage() {
  const settingsQuery = useSettings()
  return (
    <Page title="Cài đặt cửa hàng" description="Thông tin in trên hóa đơn, phiếu giao và các ngưỡng cảnh báo kho.">
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
  const demo = useIsDemo()
  const [version, setVersion] = useState(settings.version)
  const [conflict, setConflict] = useState(false)
  const [form] = Form.useForm<StoreSettings>()
  const update = useUpdateSettings()
  const [dirty, setDirty] = useState(false)
  const preview = Form.useWatch([], form) ?? settings

  return (
    <Form<StoreSettings>
      form={form}
      layout="vertical"
      disabled={update.isPending}
      initialValues={settings}
      onValuesChange={() => setDirty(true)}
      onFinish={(values) =>
        update.mutate(
          { ...values, version },
          {
            onSuccess: (saved: SettingsSnapshot) => {
              setVersion(saved.version)
              form.setFieldsValue(saved)
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
      }
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
                      form.setFieldsValue(latest)
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
              <Input.TextArea rows={2} showCount maxLength={200} />
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

          <Card className="af-card af-settings-card" title="Chính sách vỏ & giao hàng">
            <Descriptions
              size="small"
              column={1}
              items={[
                { key: 'deposit', label: 'Cọc vỏ (khách chưa có vỏ)', children: demo ? `${currency(DEPOSIT_PER_BOTTLE)}/vỏ` : <Unsupported /> },
                { key: 'brands', label: 'Đổi bù vỏ', children: demo ? EXCHANGEABLE_BRANDS.join(', ') : <Unsupported /> },
                { key: 'pickup', label: 'Thu hồi tận nơi', children: demo ? `${currency(PICKUP_FEE)}/lần khi dưới ${PICKUP_FEE_BELOW} vỏ` : <Unsupported /> },
                {
                  key: 'delivery',
                  label: 'Phí giao',
                  children: demo ? `Miễn phí từ ${FREE_DELIVERY_MIN_UNITS} bình/thùng; ít hơn ${currency(SMALL_ORDER_FEE.min)}–${currency(SMALL_ORDER_FEE.max)}` : <Unsupported />,
                },
                {
                  key: 'stairs',
                  label: 'Thang bộ / bình',
                  children: demo ? [1, 2, 3, 4].map((floor) => `L${floor}: ${currency(stairsSurcharge(floor, 1))}`).join(' · ') : <Unsupported />,
                },
              ]}
            />
            <Typography.Paragraph type="secondary" className="af-form-hint">
              {demo ? 'Mức mẫu tham khảo chính sách công khai của iWater. Nhóm cần chốt chính sách thật trước khi cho chỉnh ở đây.' : 'Backend chưa trả về các mức này. Nhóm cần chốt chính sách thật trước khi cho xem và chỉnh ở đây.'}
            </Typography.Paragraph>
          </Card>
        </Col>
      </Row>

      <div className="af-settings-actions">
        <Space>
          <Button
            disabled={!dirty}
            onClick={() => {
              form.setFieldsValue(settings)
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
