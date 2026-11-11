import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Checkbox, Form, Input, Modal, Popconfirm, Table, Tag, Tooltip } from 'antd'
import { Pencil } from 'lucide-react'
import { demoAddressApi } from '@/features/customers/demoAddressApi'
import { customerKeys } from '@/features/customers/useCustomers'
import { api } from '@/shared/api/client'
import { useIsDemo } from '@/shared/features'
import { QueryError } from '@/shared/components/QueryError'
import { invalidateLiveData } from './invalidateLiveData'
import { modalWidth } from '@/shared/utils/modal'
import { WardSelect } from '@/shared/address/WardSelect'
import { TextArea } from '@/shared/components/TextArea'

export type Address = {
  id: number
  customerId: number
  recipientName: string
  recipientPhone: string
  addressLine: string
  area: string | null
  isDefault: boolean
}
export type AddressDraft = Omit<Address, 'id' | 'customerId'>

export function LiveCustomerAddresses({
  customerId,
  customerName,
  onClose,
}: {
  customerId: number | string
  customerName: string
  onClose: () => void
}) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<AddressDraft>()
  const [editing, setEditing] = useState<Address | null | undefined>()
  const demo = useIsDemo()
  const path = `/sales/customers/${customerId}/addresses`
  const source = demo
    ? demoAddressApi(String(customerId))
    : {
        list: () => api.get<Address[]>(path),
        create: (input: AddressDraft) => api.post<Address>(path, input),
        update: (id: number, input: AddressDraft) => api.put<Address>(`${path}/${id}`, input),
        remove: (id: number) => api.delete<void>(`${path}/${id}`),
      }
  const key = ['live', 'customer-addresses', customerId]
  const addresses = useQuery({ queryKey: key, queryFn: () => source.list() })
  const save = useMutation({
    mutationFn: (draft: AddressDraft) => {
      const input = {
        recipientName: draft.recipientName.trim(),
        recipientPhone: draft.recipientPhone.replace(/[\s().-]/g, ''),
        addressLine: draft.addressLine.trim(),
        area: draft.area?.trim() || null,
        isDefault: Boolean(draft.isDefault),
      }
      return editing ? source.update(editing.id, input) : source.create(input)
    },
    onSuccess: () => {
      void invalidateLiveData(queryClient)
      void queryClient.invalidateQueries({ queryKey: customerKeys.all })
      setEditing(undefined)
      message.success('Đã lưu địa chỉ.')
    },
    onError: (error: Error) => message.error(error.message),
  })
  const remove = useMutation({
    mutationFn: (id: number) => source.remove(id),
    onSuccess: () => {
      void invalidateLiveData(queryClient)
      void queryClient.invalidateQueries({ queryKey: customerKeys.all })
      message.success('Đã xóa địa chỉ.')
    },
    onError: (error: Error) => message.error(error.message),
  })
  const open = (address: Address | null) => {
    setEditing(address)
    form.setFieldsValue(address ?? { recipientName: '', recipientPhone: '', addressLine: '', area: null, isDefault: false })
  }

  return (
    <>
      <Modal
        title={`Địa chỉ của ${customerName}`}
        open
        onCancel={onClose}
        footer={<Button onClick={onClose}>Đóng</Button>}
        width={modalWidth.medium}
      >
        <Button type="primary" onClick={() => open(null)} style={{ marginBottom: 16 }}>
          Thêm địa chỉ
        </Button>
        {addresses.isError ? (
          <QueryError error={addresses.error} onRetry={addresses.refetch} />
        ) : (
          <Table<Address>
            rowKey="id"
            loading={addresses.isPending}
            dataSource={addresses.data ?? []}
            pagination={false}
            scroll={{ x: 650 }}
            columns={[
              { title: 'Người nhận', dataIndex: 'recipientName' },
              { title: 'Điện thoại', dataIndex: 'recipientPhone' },
              { title: 'Địa chỉ', dataIndex: 'addressLine' },
              { title: 'Mặc định', dataIndex: 'isDefault', render: (value: boolean) => (value ? <Tag color="blue">Có</Tag> : '—') },
              {
                title: 'Thao tác',
                render: (_: unknown, item: Address) => (
                  <span className="af-row-actions">
                    <Tooltip title="Sửa">
                      <Button size="small" icon={<Pencil size={15} />} aria-label="Sửa địa chỉ" onClick={() => open(item)} />
                    </Tooltip>
                    <Popconfirm title="Xóa địa chỉ này?" onConfirm={() => remove.mutate(item.id)}>
                      <Button size="small" type="text" danger>
                        Xóa
                      </Button>
                    </Popconfirm>
                  </span>
                ),
              },
            ]}
          />
        )}
      </Modal>
      <Modal
        title={editing ? 'Sửa địa chỉ' : 'Thêm địa chỉ'}
        open={editing !== undefined}
        onCancel={() => setEditing(undefined)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        width={modalWidth.small}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(draft) => save.mutate(draft)}>
          <Form.Item label="Người nhận" name="recipientName" rules={[{ required: true, max: 150 }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="Điện thoại"
            name="recipientPhone"
            rules={[{ required: true }, { pattern: /^(0|\+84)[0-9]{9,10}$/, message: 'Số điện thoại không hợp lệ.' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Phường/Xã" name="area" rules={[{ max: 150 }]}>
            <WardSelect />
          </Form.Item>
          <Form.Item label="Địa chỉ" name="addressLine" rules={[{ required: true }, { max: 255 }]}>
            <TextArea maxLength={255} />
          </Form.Item>
          <Form.Item name="isDefault" valuePropName="checked">
            <Checkbox>Địa chỉ mặc định</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
