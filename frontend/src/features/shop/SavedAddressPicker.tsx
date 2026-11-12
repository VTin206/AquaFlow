import { useQuery } from '@tanstack/react-query'
import { Button, Empty, Select, Skeleton } from 'antd'
import { Link } from 'react-router'
import { useAuth } from '@/features/auth/useAuth'
import { QueryError } from '@/shared/components/QueryError'
import { accountKey, customerAccountApi, type SavedAddress } from './customerAccountApi'

export function SavedAddressPicker({ onSelect }: { onSelect: (address: SavedAddress) => void }) {
  const { user } = useAuth()
  const query = useQuery({ queryKey: [...accountKey(user?.email), 'addresses'], queryFn: customerAccountApi.addresses })
  return <div style={{ marginBottom: 16 }}>
    {query.isPending ? <Skeleton.Input active /> : query.isError ? <QueryError error={query.error} onRetry={query.refetch} /> : !query.data.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có địa chỉ đã lưu. Bạn có thể nhập bên dưới." /> : (
      <Select aria-label="Chọn địa chỉ đã lưu" placeholder="Chọn địa chỉ đã lưu" style={{ width: '100%' }} value={null} onChange={id => { const address = query.data.find(item => item.id === id); if (address) onSelect(address) }} options={[...query.data].sort((a, b) => Number(b.isDefault) - Number(a.isDefault)).map(item => ({ value: item.id, label: `${item.isDefault ? 'Mặc định · ' : ''}${item.recipientName} · ${item.addressLine}, ${item.area}` }))} />
    )}
    <Link to="/shop/account"><Button type="link">Quản lý sổ địa chỉ</Button></Link>
  </div>
}
