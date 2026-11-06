import { Tooltip } from 'antd'
import { MapPinned } from 'lucide-react'
import { mapsSearchUrl } from './maps'

/** Icon nhỏ cạnh địa chỉ, bấm mở Google Maps ở thẻ mới. */
export function MapLink({ address }: { address?: string | null }) {
  if (!address?.trim()) return null
  return (
    <Tooltip title="Mở bản đồ">
      <a className="af-map-link" href={mapsSearchUrl(address)} target="_blank" rel="noreferrer" aria-label={`Mở bản đồ: ${address}`}>
        <MapPinned size={15} aria-hidden />
      </a>
    </Tooltip>
  )
}
