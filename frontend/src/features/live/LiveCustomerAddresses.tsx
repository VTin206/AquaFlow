import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Checkbox, Form, Input, Modal, Popconfirm, Table, Tag, Tooltip } from 'antd'
import { Pencil } from 'lucide-react'
import { api } from '@/shared/api/client'
import { QueryError } from '@/shared/components/QueryError'
import { invalidateLiveData } from './invalidateLiveData'

type Address = {
  id: number
  customerId: number
  recipientName: string
  recipientPhone: string
  addressLine: string
  area: string | null
  isDefault: boolean
}
type AddressDraft = Omit<Address, 'id' | 'customerId'>

export function LiveCustomerAddresses({
  customerId,
  customerName,
  onClose,
}: {
  customerId: number
  customerName: string
  onClose: () => void
}) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<AddressDraft>()
  const [editing, setEditing] = useState<Address | null | undefined>()
  const path = `/sales/customers/${customerId}/addresses`
  const key = ['live', 'customer-addresses', customerId]
  const addresses = useQuery({ queryKey: key, queryFn: () => api.get<Address[]>(path) })
  const save = useMutation({
    mutationFn: (draft: AddressDraft) => {
      const input = {
        recipientName: draft.recipientName.trim(),
        recipientPhone: draft.recipientPhone.replace(/[\s().-]/g, ''),
        addressLine: draft.addressLine.trim(),
        area: draft.area?.trim() || null,
        isDefault: Boolean(draft.isDefault),
      }
      return editing ? api.put<Address>(`${path}/${editing.id}`, input) : api.post<Address>(path, input)
    },
    onSuccess: () => {
      void invalidateLiveData(queryClient)
      setEditing(undefined)
      message.success('Đã lưu địa chỉ.')
    },
    onError: (error: Error) => message.error(error.message),
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.delete<void>(`${path}/${id}`),
    onSuccess: () => {
      void invalidateLiveData(queryClient)
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
      <Modal title={`Địa chỉ của ${customerName}`} open onCancel={onClose} footer={<Button onClick={onClose}>Đóng</Button>} width={800}>
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
                  <>
                    <Tooltip title="Sửa">
                      <Button type="link" icon={<Pencil size={15} />} aria-label="Sửa địa chỉ" onClick={() => open(item)} />
                    </Tooltip>
                    <Popconfirm title="Xóa địa chỉ này?" onConfirm={() => remove.mutate(item.id)}>
                      <Button type="link" danger>
                        Xóa
                      </Button>
                    </Popconfirm>
                  </>
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
          <Form.Item label="Địa chỉ" name="addressLine" rules={[{ required: true }]}>
            <Input.TextArea />
          </Form.Item>
          <Form.Item label="Khu vực" name="area" rules={[{ max: 150 }]}>
            <Input />
          </Form.Item>
          <Form.Item name="isDefault" valuePropName="checked">
            <Checkbox>Địa chỉ mặc định</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
