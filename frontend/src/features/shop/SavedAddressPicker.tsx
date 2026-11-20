import { useQuery } from '@tanstack/react-query'
import { Button, Select, Skeleton } from 'antd'
import { Link } from 'react-router'
import { useAuth } from '@/features/auth/useAuth'
import { QueryError } from '@/shared/components/QueryError'
import { accountKey, customerAccountApi, type SavedAddress } from './customerAccountApi'

/**
 * Ô chọn địa chỉ trong sổ địa chỉ của khách. `current` là địa chỉ đang nằm trong form:
 * trùng với địa chỉ nào trong sổ thì ô hiện địa chỉ đó, để khách thấy mình đang dùng địa chỉ đã lưu.
 */
export function SavedAddressPicker({
  onSelect,
  current,
}: {
  onSelect: (address: SavedAddress) => void
  current?: { address?: string; area?: string }
}) {
  const { user } = useAuth()
  const query = useQuery({ queryKey: [...accountKey(user?.email), 'addresses'], queryFn: customerAccountApi.addresses })
  const selected = query.data?.find(
    (item) => item.addressLine.trim() === current?.address?.trim() && item.area.trim() === current?.area?.trim(),
  )
  return (
    <div className="af-saved-address">
      {query.isPending ? (
        <Skeleton.Input active />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={query.refetch} />
      ) : !query.data.length ? (
        <>
          <span className="af-saved-address-empty">Chưa có địa chỉ đã lưu.</span>
          <Link to="/shop/account">
            <Button type="link">Quản lý sổ địa chỉ</Button>
          </Link>
        </>
      ) : (
        <Select
          aria-label="Chọn địa chỉ đã lưu"
          placeholder="Chọn địa chỉ đã lưu"
          // Danh sách xổ xuống rộng theo chữ để thấy đủ địa chỉ dài (tối đa bằng khung trang).
          popupMatchSelectWidth={false}
          styles={{ popup: { root: { maxWidth: 'min(640px, calc(100vw - 32px))' } } }}
          // Lối quản lý sổ địa chỉ nằm cuối danh sách, để ô chọn chiếm hết hàng.
          popupRender={(menu) => (
            <>
              {menu}
              <Link to="/shop/account" className="af-saved-address-manage">
                Quản lý sổ địa chỉ
              </Link>
            </>
          )}
          value={selected?.id ?? null}
          onChange={(id) => {
            const address = query.data.find((item) => item.id === id)
            if (address) onSelect(address)
          }}
          options={[...query.data]
            .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
            .map((item) => ({
              value: item.id,
              label: `${item.isDefault ? 'Mặc định · ' : ''}${item.recipientName} · ${item.addressLine}, ${item.area}`,
            }))}
        />
      )}
    </div>
  )
}
