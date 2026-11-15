import { useMutation, useQueryClient } from '@tanstack/react-query'
import { App, Descriptions, Form, InputNumber, Modal } from 'antd'
import { TextArea } from '@/shared/components/TextArea'
import { modalWidth } from '@/shared/utils/modal'
import { stockAdjustmentService } from '../stockAdjustmentService'
import type { LotItem } from '../useInventory'

type Values = { countedQuantity: number; reason: string }

/** Kiểm kê một lô: nhập số đếm thực tế; không được thấp hơn số đang giữ cho đơn. */
export function StocktakeModal({ lot, onClose }: { lot: LotItem; onClose: () => void }) {
  const [form] = Form.useForm<Values>()
  const counted = Form.useWatch('countedQuantity', form)
  const { message } = App.useApp()
  const client = useQueryClient()
  const save = useMutation({
    mutationFn: ({ countedQuantity, reason }: Values) => stockAdjustmentService.adjust(Number(lot.id), countedQuantity, reason),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ['live'] })
      message.success(`Đã điều chỉnh lô ${result.lotCode} (${result.delta > 0 ? '+' : ''}${result.delta}), chứng từ ${result.code}.`)
      onClose()
    },
    onError: (error: Error) => message.error(error.message),
  })
  const delta = typeof counted === 'number' ? counted - lot.onHand : undefined
  return (
    <Modal
      open
      centered
      title={`Kiểm kê lô ${lot.lotCode}`}
      okText="Lưu kiểm kê"
      cancelText="Hủy"
      width={modalWidth.small}
      onOk={() => form.submit()}
      onCancel={() => !save.isPending && onClose()}
      confirmLoading={save.isPending}
      okButtonProps={{ disabled: delta === 0 }}
    >
      <Descriptions
        size="small"
        column={3}
        items={[
          { key: 'product', label: 'Sản phẩm', children: lot.productName, span: 3 },
          { key: 'onHand', label: 'Tồn trên sổ', children: lot.onHand },
          { key: 'reserved', label: 'Đang giữ', children: lot.reserved },
          {
            key: 'delta',
            label: 'Chênh lệch',
            children: delta === undefined ? '—' : delta === 0 ? 'Khớp sổ' : `${delta > 0 ? '+' : ''}${delta}`,
          },
        ]}
      />
      <Form<Values>
        form={form}
        layout="vertical"
        initialValues={{ countedQuantity: lot.onHand }}
        disabled={save.isPending}
        onFinish={(values) => save.mutate(values)}
        style={{ marginTop: 16 }}
      >
        <Form.Item
          name="countedQuantity"
          label="Số đếm thực tế"
          rules={[
            { required: true, message: 'Nhập số đếm.' },
            { type: 'number', min: lot.reserved, message: `Không thấp hơn ${lot.reserved} đang giữ cho đơn.` },
          ]}
        >
          <InputNumber min={0} precision={0} style={{ width: '100%' }} autoFocus />
        </Form.Item>
        <Form.Item name="reason" label="Lý do" rules={[{ required: true, whitespace: true, message: 'Nhập lý do.' }, { max: 300 }]}>
          <TextArea maxLength={300} placeholder="Ví dụ: vỡ 2 bình khi xếp kho" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
