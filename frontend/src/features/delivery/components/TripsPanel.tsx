import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { QueryError } from '@/shared/components/QueryError'
import { currency } from '@/shared/utils/format'
import { useOrderList } from '@/features/orders/orderData'
import { knownAmountDue } from '@/features/orders/types'
import type { DeliveryTrip } from '../deliveryApi'
import { stopOrderId, useTripBackend } from '../tripBackend'
import { toWaitingOrder } from '../waitingOrders'
import { useTripCreatedNotice } from '../useTripCreatedNotice'
import { CreateTripModal } from './CreateTripModal'
import { TripDrawer } from './TripDrawer'
import { TripsList } from './TripsList'
import { WaitingOrdersCard, type WaitingOrder } from './WaitingOrdersCard'

/** Xếp đơn chờ giao vào chuyến và theo dõi các chuyến. */
export function TripsPanel() {
  const [searchParams] = useSearchParams()
  const notifyCreated = useTripCreatedNotice()
  const backend = useTripBackend()
  const tripsQuery = backend.useTrips()
  const availableQuery = backend.useAvailable()
  const ordersQuery = useOrderList()
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [tripId, setTripId] = useState<number | null>(() => {
    const value = Number(searchParams.get('tripId'))
    return Number.isSafeInteger(value) && value > 0 ? value : null
  })

  const orders = ordersQuery.data ?? []
  const orderOf = (id: string) => orders.find((order) => order.id === id)
  const waiting: WaitingOrder[] = (availableQuery.data ?? []).map((item) => toWaitingOrder(item, orderOf(String(item.id))))
  const chosen = waiting.filter((order) => selected.includes(order.id))
  const dueLabel = (trip: DeliveryTrip) => {
    const dues = trip.orders.map((stop) => {
      const order = orderOf(stopOrderId(stop))
      return order ? knownAmountDue(order) : null
    })
    const sum = dues.reduce<number>((total, due) => total + (due ?? 0), 0)
    return `Cần thu ${dues.includes(null) ? 'từ ' : ''}${currency(sum)}`
  }

  return (
    <>
      <WaitingOrdersCard
        orders={waiting}
        loading={availableQuery.isPending}
        selected={selected}
        onSelect={setSelected}
        onCreate={() => setCreating(true)}
        error={
          availableQuery.isError && availableQuery.error ? (
            <QueryError error={availableQuery.error} onRetry={availableQuery.refetch} />
          ) : undefined
        }
      />

      <div className="af-section-heading">
        <h2>Chuyến giao</h2>
      </div>
      {tripsQuery.isError && tripsQuery.error ? (
        <QueryError error={tripsQuery.error} onRetry={tripsQuery.refetch} />
      ) : (
        <TripsList trips={tripsQuery.data ?? []} loading={tripsQuery.isPending} dueLabel={dueLabel} onOpen={setTripId} />
      )}

      {creating && (
        <CreateTripModal
          orders={chosen}
          onClose={() => setCreating(false)}
          onCreated={(id, failed) => {
            setCreating(false)
            setSelected([])
            setTripId(id)
            notifyCreated(id, chosen.length, failed)
          }}
        />
      )}
      {tripId !== null && <TripDrawer key={tripId} tripId={tripId} onClose={() => setTripId(null)} />}
    </>
  )
}
