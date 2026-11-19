import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Form, Modal, Select } from 'antd'
import { invalidateLiveData } from '@/features/live/invalidateLiveData'
import { QueryError } from '@/shared/components/QueryError'
import { modalWidth } from '@/shared/utils/modal'
import { deliveryApi } from '../deliveryApi'
import { driverChoices, type DriverChoice } from '../driverChoices'
import { useDeliveryDrivers, useLiveTrips } from '../useLiveTrips'

/**
 * Giao một đơn cho tài xế ngay từ chi tiết đơn: thêm vào chuyến chờ xuất phát của tài xế, hoặc tạo chuyến mới.
 * Không xếp được (đơn đã ở chuyến khác, vượt sức chở…) thì hiện đúng lý do máy chủ trả về.
 */
export function AssignDriverModal({ order, onClose }: { order: { id: number; orderCode: string }; onClose: () => void }) {
  const { message } = App.useApp()
  const client = useQueryClient()
  const drivers = useDeliveryDrivers()
  const trips = useLiveTrips()
  const [value, setValue] = useState<string>()
  const choices = driverChoices(drivers.data ?? [], trips.data ?? [])
  const chosen = choices.find((choice) => choice.value === value)
  const assign = useMutation({
    mutationFn: async (choice: DriverChoice) => {
      if (choice.tripId) {
        await deliveryApi.add(choice.tripId, order.id)
        return choice.tripId
      }
      const trip = await deliveryApi.create({ driverId: choice.driverId })
      try {
        await deliveryApi.add(trip.id, order.id)
      } catch (error) {
        // Không thêm được đơn thì bỏ chuyến rỗng vừa tạo, để không sót chuyến trống trên bảng điều phối.
        await deliveryApi.cancel(trip.id).catch(() => undefined)
        throw error
      }
      return trip.id
    },
    onSuccess: (tripId, choice) => {
      message.success(`Đã giao đơn ${order.orderCode} cho ${choice.driverName} (chuyến #${tripId}).`)
      onClose()
    },
    onSettled: () => invalidateLiveData(client),
  })
  const error = drivers.error ?? trips.error
  return (
    <Modal
      open
      centered
      title={`Giao đơn ${order.orderCode} cho tài xế`}
      okText={chosen?.tripId ? `Thêm vào chuyến #${chosen.tripId}` : 'Tạo chuyến'}
      cancelText="Hủy"
      width={modalWidth.small}
      okButtonProps={{ disabled: !chosen || chosen.disabled }}
      confirmLoading={assign.isPending}
      onOk={() => chosen && assign.mutate(chosen)}
      onCancel={onClose}
    >
      {error && <QueryError error={error} onRetry={() => void (drivers.refetch(), trips.refetch())} />}
      <Form layout="vertical">
        <Form.Item label="Tài xế">
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Chọn tài xế"
            loading={drivers.isPending || trips.isPending}
            value={value}
            onChange={setValue}
            options={choices.map(({ value: key, label, disabled }) => ({ value: key, label, disabled }))}
          />
        </Form.Item>
      </Form>
      {drivers.data && !drivers.data.length && <Alert type="info" showIcon title="Chưa có tài xế đang hoạt động." />}
      {assign.error && <Alert type="error" showIcon title={assign.error.message} />}
    </Modal>
  )
}
