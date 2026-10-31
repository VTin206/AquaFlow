import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Form, Input, InputNumber, Modal, Select, Space } from 'antd'
import { QueryError } from '@/shared/components/QueryError'
import { useConfirmDiscard } from '@/shared/hooks/useConfirmDiscard'
import { currency } from '@/shared/utils/format'
import { catalogApi } from './catalogApi'
import { customerApi } from './customerApi'
import { invalidateLiveData } from './invalidateLiveData'
import { orderApi, type LiveOrder, type OrderInput } from './orderApi'
import { useStaff } from '@/features/auth/useStaff'

type Draft = {
  customerId?: number
  addressId?: number
  recipientName?: string
  recipientPhone?: string
  deliveryAddress?: string
  deliveryArea?: string
  fulfillmentType: OrderInput['fulfillmentType']
  channel: OrderInput['channel']
  items: { productId: number; quantity: number }[]
  note?: string
}

const text = (value?: string) => value?.trim() || null
const phone = (value?: string) => value?.replace(/[\s().-]/g, '') || null

const toInput = (draft: Draft): OrderInput => {
  const delivery = draft.fulfillmentType === 'DELIVERY'
  return {
    customerId: draft.customerId ?? null,
    channel: draft.channel,
    fulfillmentType: draft.fulfillmentType,
    recipientName: text(draft.recipientName),
    recipientPhone: phone(draft.recipientPhone),
    deliveryAddress: delivery ? text(draft.deliveryAddress) : null,
    deliveryArea: delivery ? text(draft.deliveryArea) : null,
    items: draft.items.map(({ productId, quantity }) => ({ productId, quantity })),
    note: text(draft.note),
  }
}

/** Nhân viên tạo đơn (điện thoại, tại quầy, tin nhắn); đơn mới ở trạng thái chờ xác nhận, chưa giữ hàng. */
export function LiveOrderDraftModal({
  onClose,
  onCreated,
  defaultCustomer,
}: {
  onClose: () => void
  onCreated: (order: LiveOrder) => void
  defaultCustomer?: { id: number; name: string; phone?: string }
}) {
  const [form] = Form.useForm<Draft>()
  const cancel = useConfirmDiscard(form, onClose)
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const staff = useStaff()
  const products = useQuery({ queryKey: ['live', 'catalog'], queryFn: catalogApi.products })
  const customers = useQuery({ queryKey: ['live', 'order-customers', staff?.name, staff?.role], queryFn: customerApi.list })
  const customerId = Form.useWatch('customerId', form)
  const addresses = useQuery({
    queryKey: ['live', 'order-addresses', staff?.name, staff?.role, customerId],
    queryFn: () => customerApi.addresses(customerId!),
    enabled: customerId != null,
  })
  const method = Form.useWatch('fulfillmentType', form) ?? 'DELIVERY'
  const items: Partial<Draft['items'][number]>[] = Form.useWatch('items', form) ?? []
  const total = items.reduce(
    (sum, item) => sum + (products.data?.find((product) => product.id === item?.productId)?.salePrice ?? 0) * (item?.quantity ?? 0),
    0,
  )
  const create = useMutation({
    mutationFn: (draft: Draft) => orderApi.create(toInput(draft)),
    onSuccess: (order) => {
      void invalidateLiveData(queryClient)
      message.success(`Đã tạo đơn ${order.orderCode}. Đơn đang chờ xác nhận.`)
      onCreated(order)
    },
    onError: (error: Error) => message.error(error.message),
  })
  return (
    <Modal
      open
      title="Tạo đơn hàng"
      width={740}
      onCancel={create.isPending ? undefined : cancel}
      maskClosable={!create.isPending}
      footer={null}
    >
      {products.isError ? (
        <QueryError error={products.error} onRetry={products.refetch} />
      ) : (
        <Form
          form={form}
          name="live-order"
          layout="vertical"
          scrollToFirstError={{ focus: true }}
          disabled={create.isPending}
          initialValues={{
            fulfillmentType: 'DELIVERY',
            channel: 'PHONE',
            items: [{ quantity: 1 }],
            ...(defaultCustomer && {
              customerId: defaultCustomer.id,
              recipientName: defaultCustomer.name,
              recipientPhone: defaultCustomer.phone,
            }),
          }}
          onFinish={(draft) => create.mutate(draft)}
        >
          <Form.Item name="fulfillmentType" label="Hình thức nhận" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'DELIVERY', label: 'Giao tận nơi' },
                { value: 'COUNTER', label: 'Tại quầy' },
              ]}
            />
          </Form.Item>
          <Form.Item name="channel" label="Kênh tiếp nhận" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'PHONE', label: 'Điện thoại' },
                { value: 'COUNTER', label: 'Tại quầy' },
                { value: 'MESSAGE', label: 'Tin nhắn' },
              ]}
            />
          </Form.Item>
          {customers.isError && (
            <Alert
              type="warning"
              title="Không tải được hồ sơ khách hàng. Bạn vẫn có thể điền thông tin bên dưới."
              action={<Button onClick={() => void customers.refetch()}>Thử lại</Button>}
            />
          )}
          <Form.Item name="customerId" label="Khách hàng đã lưu (không bắt buộc)">
            <Select
              allowClear
              loading={customers.isPending}
              showSearch={{ optionFilterProp: 'label' }}
              options={(customers.data ?? []).map((customer) => ({
                value: customer.id,
                label: `${customer.fullName} · ${customer.phone ?? 'Chưa có điện thoại'}`,
              }))}
              onChange={(id) => {
                const customer = customers.data?.find((item) => item.id === id)
                form.setFieldsValue({
                  recipientName: customer?.fullName ?? '',
                  recipientPhone: customer?.phone ?? '',
                  addressId: undefined,
                  deliveryAddress: '',
                  deliveryArea: '',
                })
              }}
            />
          </Form.Item>
          {method === 'DELIVERY' && customerId != null && (
            <>
              {addresses.isError && (
                <Alert
                  type="warning"
                  title="Không tải được địa chỉ đã lưu."
                  action={<Button onClick={() => void addresses.refetch()}>Thử lại</Button>}
                />
              )}
              <Form.Item name="addressId" label="Địa chỉ đã lưu">
                <Select
                  allowClear
                  loading={addresses.isFetching}
                  options={(addresses.data ?? []).map((address) => ({
                    value: address.id,
                    label: `${address.addressLine}${address.isDefault ? ' · Mặc định' : ''}`,
                  }))}
                  onChange={(id) => {
                    const address = addresses.data?.find((item) => item.id === id)
                    if (address)
                      form.setFieldsValue({
                        recipientName: address.recipientName,
                        recipientPhone: address.recipientPhone,
                        deliveryAddress: address.addressLine,
                        deliveryArea: address.area ?? '',
                      })
                  }}
                />
              </Form.Item>
            </>
          )}
          <Form.Item
            name="recipientName"
            label="Tên người nhận"
            rules={[
              { required: method === 'DELIVERY', whitespace: true, message: 'Nhập tên người nhận.' },
              { max: 150, message: 'Tối đa 150 ký tự.' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="recipientPhone"
            label="Số điện thoại"
            rules={[
              { required: method === 'DELIVERY', message: 'Nhập số điện thoại.' },
              {
                pattern: /^(0|\+84)[0-9]{9,10}$/,
                transform: (v?: string) => v?.replace(/[\s().-]/g, ''),
                message: 'Số điện thoại không hợp lệ.',
              },
            ]}
          >
            <Input inputMode="tel" />
          </Form.Item>
          {method === 'DELIVERY' && (
            <>
              <Form.Item
                name="deliveryAddress"
                label="Địa chỉ giao"
                rules={[
                  { required: true, whitespace: true, message: 'Nhập địa chỉ giao.' },
                  { max: 255, message: 'Tối đa 255 ký tự.' },
                ]}
              >
                <Input.TextArea rows={2} />
              </Form.Item>
              <Form.Item name="deliveryArea" label="Khu vực (không bắt buộc)" rules={[{ max: 150, message: 'Tối đa 150 ký tự.' }]}>
                <Input placeholder="Phường / quận" />
              </Form.Item>
            </>
          )}
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <div className="af-order-line-form" key={field.key}>
                    <Form.Item
                      name={[field.name, 'productId']}
                      label={`Sản phẩm ${index + 1}`}
                      rules={[
                        { required: true, message: 'Chọn sản phẩm.' },
                        {
                          validator: (_, value) =>
                            value === undefined ||
                            items.filter((item, other) => other !== field.name && item?.productId === value).length === 0
                              ? Promise.resolve()
                              : Promise.reject(new Error('Sản phẩm đã có ở dòng khác; tăng số lượng thay vì thêm dòng.')),
                        },
                      ]}
                    >
                      <Select
                        loading={products.isPending}
                        showSearch={{ optionFilterProp: 'label' }}
                        options={(products.data ?? []).map((product) => ({
                          value: product.id,
                          label: `${product.sku} · ${product.name} · ${currency(product.salePrice)}`,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'quantity']}
                      label="Số lượng"
                      rules={[
                        { required: true, message: 'Nhập số lượng.' },
                        { type: 'integer', min: 1, message: 'Nhập số nguyên dương.' },
                      ]}
                    >
                      <InputNumber min={1} precision={0} />
                    </Form.Item>
                    <Button danger disabled={fields.length === 1} onClick={() => remove(field.name)}>
                      Xóa
                    </Button>
                  </div>
                ))}
                <Button type="dashed" block onClick={() => add({ quantity: 1 })}>
                  Thêm sản phẩm
                </Button>
              </>
            )}
          </Form.List>
          <Form.Item name="note" label="Ghi chú" rules={[{ max: 500, message: 'Tối đa 500 ký tự.' }]} style={{ marginTop: 16 }}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <div className="af-order-summary">
            <span>Tiền hàng dự kiến</span>
            <strong>{currency(total)}</strong>
          </div>
          <p className="af-form-hint">
            Đơn mới ở trạng thái chờ xác nhận. Tồn kho được kiểm tra và giữ hàng khi xác nhận đơn. Tổng tiền cuối cùng do hệ thống tính.
          </p>
          <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={cancel} disabled={create.isPending}>
              Đóng
            </Button>
            <Button type="primary" htmlType="submit" disabled={products.isPending} loading={create.isPending}>
              Tạo đơn
            </Button>
          </Space>
        </Form>
      )}
    </Modal>
  )
}
