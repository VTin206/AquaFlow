import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Col, Empty, Form, Input, InputNumber, Modal, Row, Switch, Table, Tag, Tooltip, Typography } from 'antd'
import { Pencil, Plus } from 'lucide-react'
import { useStaff } from '@/features/auth/useStaff'
import { QueryError } from '@/shared/components/QueryError'
import { modalWidth } from '@/shared/utils/modal'
import { deliveryApi, type Vehicle, type VehicleInput } from '../deliveryApi'
import { useVehicles } from '../useLiveTrips'

type Editing = { vehicle?: Vehicle } | null

/** Danh mục xe giao hàng: biển số, sức chở (kiện) và xe nào đang ở chuyến. Chỉ chủ cửa hàng thêm/sửa. */
export function VehiclesPanel() {
  const vehicles = useVehicles()
  const canEdit = useStaff()?.role === 'ADMIN'
  const [editing, setEditing] = useState<Editing>(null)
  const ownerOnly = canEdit ? undefined : 'Chỉ chủ cửa hàng thêm/sửa xe'

  return (
    <Card
      className="af-card"
      styles={{ body: { padding: 0 } }}
      title={
        <span className="af-panel-title">
          Xe giao hàng <Tag>{vehicles.data?.length ?? 0}</Tag>
        </span>
      }
      extra={
        <Tooltip title={ownerOnly}>
          <Button type="primary" icon={<Plus size={16} />} disabled={!canEdit} onClick={() => setEditing({})}>
            Thêm xe
          </Button>
        </Tooltip>
      }
    >
      {vehicles.isError ? (
        <QueryError error={vehicles.error} onRetry={vehicles.refetch} />
      ) : (
        <Table<Vehicle>
          className="af-data-table af-table-flush"
          size="middle"
          rowKey="id"
          loading={vehicles.isPending}
          dataSource={vehicles.data}
          pagination={false}
          scroll={{ x: 640 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có xe nào." /> }}
          columns={[
            {
              title: 'Biển số',
              dataIndex: 'plate',
              render: (plate: string, vehicle) => (
                <div className="af-cell-stack">
                  <span className="af-strong">{plate}</span>
                  {vehicle.name && <small>{vehicle.name}</small>}
                </div>
              ),
            },
            { title: 'Sức chở', dataIndex: 'capacity', width: 120, align: 'right', render: (capacity: number) => `${capacity} kiện` },
            {
              title: 'Tình trạng',
              key: 'state',
              width: 200,
              render: (_, vehicle) =>
                !vehicle.active ? (
                  <Typography.Text type="secondary">Ngừng sử dụng</Typography.Text>
                ) : vehicle.busyTripId != null ? (
                  <Tag color="gold">Đang ở chuyến #{vehicle.busyTripId}</Tag>
                ) : (
                  <Tag color="green">Rảnh</Tag>
                ),
            },
            {
              title: 'Thao tác',
              key: 'actions',
              width: 90,
              align: 'center',
              render: (_, vehicle) => (
                <Tooltip title={ownerOnly ?? 'Sửa xe'}>
                  <Button
                    type="text"
                    icon={<Pencil size={16} />}
                    aria-label={`Sửa xe ${vehicle.plate}`}
                    disabled={!canEdit}
                    onClick={() => setEditing({ vehicle })}
                  />
                </Tooltip>
              ),
            },
          ]}
        />
      )}
      {editing && <VehicleModal vehicle={editing.vehicle} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function VehicleModal({ vehicle, onClose }: { vehicle?: Vehicle; onClose: () => void }) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const [form] = Form.useForm<VehicleInput>()
  const save = useMutation({
    mutationFn: (values: VehicleInput) => {
      const input = { ...values, plate: values.plate.trim(), name: values.name?.trim() || undefined }
      return vehicle ? deliveryApi.updateVehicle(vehicle.id, input) : deliveryApi.createVehicle(input)
    },
    onSuccess: (saved) => {
      message.success(vehicle ? `Đã lưu xe ${saved.plate}` : `Đã thêm xe ${saved.plate}`)
      void client.invalidateQueries({ queryKey: ['live', 'delivery-vehicles'] })
      onClose()
    },
    onError: (error: Error) => message.error(error.message),
  })
  return (
    <Modal
      open
      centered
      title={vehicle ? `Sửa xe ${vehicle.plate}` : 'Thêm xe'}
      okText={vehicle ? 'Lưu' : 'Thêm xe'}
      cancelText="Hủy"
      width={modalWidth.small}
      confirmLoading={save.isPending}
      onOk={() => form.submit()}
      onCancel={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={
          vehicle
            ? { plate: vehicle.plate, name: vehicle.name ?? undefined, capacity: vehicle.capacity, active: vehicle.active }
            : undefined
        }
        onFinish={(values) => save.mutate(values)}
      >
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="plate" label="Biển số" rules={[{ required: true, whitespace: true, message: 'Nhập biển số.' }, { max: 40 }]}>
              <Input placeholder="59A-123.45" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="capacity"
              label="Sức chở (kiện)"
              tooltip="Mỗi bình, thùng hay chai trên đơn là một kiện."
              rules={[
                { required: true, message: 'Nhập sức chở.' },
                { type: 'integer', min: 1, max: 10000, message: 'Từ 1 đến 10.000 kiện.' },
              ]}
            >
              <InputNumber min={1} max={10000} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="name" label="Tên gọi (không bắt buộc)" rules={[{ max: 100 }]}>
          <Input placeholder="Xe ba gác, xe tải nhỏ…" />
        </Form.Item>
        {vehicle && (
          <Form.Item name="active" label="Đang sử dụng" valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
