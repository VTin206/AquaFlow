import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Col, Form, Input, Modal, Row, Select } from 'antd'
import { ModalTotalFooter } from '@/shared/components/ModalTotalFooter'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { modalWidth } from '@/shared/utils/modal'
import { useTripBackend, type CreateResult } from '../tripBackend'
import type { WaitingOrder } from './WaitingOrdersCard'
import { driverLabel, suggestVehicle, vehicleBlocker, vehicleLabel } from '../vehiclePlan'

type Values = { driverId?: number; vehicle?: string; vehicleId?: number }

/** Tạo chuyến rồi thêm lần lượt từng đơn; đơn nào lỗi thì báo lại, các đơn khác vẫn ở trên chuyến. */
export function CreateTripModal({
  orders,
  onClose,
  onCreated,
}: {
  orders: WaitingOrder[]
  onClose: () => void
  onCreated: (tripId: number, failed: CreateResult['failed']) => void
}) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const backend = useTripBackend()
  const [form] = Form.useForm<Values>()
  const drivers = backend.useDrivers()
  const vehicles = backend.useVehicles()
  const units = orders.reduce((sum, order) => sum + order.units, 0)
  const fleet = (vehicles.data ?? []).filter((vehicle) => vehicle.active)
  const vehicleId: number | undefined = Form.useWatch('vehicleId', form)
  const chosen = fleet.find((vehicle) => vehicle.id === vehicleId)
  const blocker = chosen && vehicleBlocker(chosen, units)
  // Chọn xe theo cỡ hàng: gợi ý sẵn xe nhỏ nhất còn rảnh mà chở đủ, trừ khi người dùng đã tự chọn.
  const suggested = suggestVehicle(fleet, units)
  const suggestedId = suggested?.id
  useEffect(() => {
    if (suggestedId && !form.isFieldTouched('vehicleId')) form.setFieldValue('vehicleId', suggestedId)
  }, [suggestedId, form])
  const due = orders.reduce((sum, order) => sum + (order.due ?? 0), 0)
  const create = useMutation({
    mutationFn: (values: Values) => backend.ops.create(values, orders),
    onSuccess: ({ tripId, failed }) => onCreated(tripId, failed),
    onError: (error: Error) => message.error(error.message),
    onSettled: () => backend.ops.refresh(client),
  })

  return (
    <Modal
      open
      title={`Tạo chuyến giao · ${orders.length} đơn`}
      okText="Tạo chuyến"
      cancelText="Hủy"
      width={modalWidth.small}
      footer={(_, { OkBtn, CancelBtn }) => (
        <ModalTotalFooter label="Hàng cần giao · tiền cần thu" value={`${units} kiện · ${currency(due)}`}>
          <CancelBtn />
          <OkBtn />
        </ModalTotalFooter>
      )}
      confirmLoading={create.isPending}
      okButtonProps={{ disabled: Boolean(blocker) }}
      onOk={() => form.submit()}
      onCancel={onClose}
    >
      <Form form={form} layout="vertical" onFinish={(values) => create.mutate(values)}>
        {/* Chọn xe theo cỡ hàng trước, rồi tới tài xế; tài xế có thể chọn sau, khi xuất kho mới bắt buộc. */}
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            {fleet.length ? (
              <Form.Item
                name="vehicleId"
                label="Xe"
                validateStatus={blocker ? 'error' : undefined}
                help={blocker ? `Xe ${chosen?.plate} ${blocker}` : undefined}
              >
                <Select
                  allowClear
                  placeholder="Không dùng xe trong danh sách"
                  popupMatchSelectWidth={false}
                  options={fleet.map((vehicle) => ({
                    value: vehicle.id,
                    label: vehicleLabel(vehicle, units),
                    disabled: Boolean(vehicleBlocker(vehicle, units)),
                  }))}
                />
              </Form.Item>
            ) : (
              <Form.Item name="vehicle" label="Biển số xe" rules={[{ max: 40 }]}>
                <Input placeholder={vehicles.isPending ? 'Đang tải danh sách xe…' : 'Không bắt buộc'} />
              </Form.Item>
            )}
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="driverId" label="Tài xế">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                loading={drivers.isPending}
                popupMatchSelectWidth={false}
                placeholder="Chọn sau cũng được"
                options={drivers.data?.map((driver) => ({
                  value: driver.id,
                  label: driverLabel(driver),
                  disabled: driver.busyTripId != null,
                }))}
              />
            </Form.Item>
          </Col>
        </Row>
        {fleet.length > 0 && !suggested && (
          <Alert
            type="warning"
            showIcon
            title={`Không còn xe rảnh chở đủ ${units} kiện. Bỏ bớt đơn hoặc chia thành nhiều chuyến.`}
            style={{ marginBottom: 16 }}
          />
        )}
        {drivers.isError && drivers.error && <QueryError error={drivers.error} onRetry={drivers.refetch} />}
        {drivers.data && !drivers.data.length && <Alert type="info" title="Chưa có tài xế đang hoạt động." style={{ marginBottom: 16 }} />}
      </Form>
      <h4 className="af-trip-stops-title">Đơn trên chuyến</h4>
      <ul className="af-trip-stops">
        {orders.map((order, index) => (
          <li key={order.id}>
            <span className="af-trip-stop-index">{index + 1}</span>
            <div className="af-cell-stack">
              <span>
                {order.code} · {order.customer}
              </span>
              <small>{order.address}</small>
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
