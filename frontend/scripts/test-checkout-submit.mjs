import assert from 'node:assert/strict'
import console from 'node:console'
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { submitCheckoutOnce } = await vite.ssrLoadModule('/src/features/shop/checkoutSubmit.ts')

  let resolveRequest
  const pendingRequest = new Promise((resolve) => { resolveRequest = resolve })
  const lock = { current: false }
  const cart = [{ productId: '12', quantity: 1 }]
  let requestCount = 0
  let successCount = 0
  let displayedOrderCode
  const order = { orderCode: 'WEB-TEST-001', status: 'PENDING' }

  const firstSubmit = submitCheckoutOnce(lock, () => {
    requestCount += 1
    return pendingRequest
  }, (createdOrder) => {
    successCount += 1
    displayedOrderCode = createdOrder.orderCode
    cart.splice(0)
  }, (error) => { throw error })

  const secondSubmit = await submitCheckoutOnce(lock, async () => {
    requestCount += 1
    return order
  }, () => { successCount += 1 }, (error) => { throw error })

  assert.equal(secondSubmit, false, 'A second submit while the request is pending is ignored')
  assert.equal(requestCount, 1, 'Only one API request starts')
  assert.equal(cart.length, 1, 'The cart remains while the request is pending')
  resolveRequest(order)
  assert.equal(await firstSubmit, true)
  assert.equal(successCount, 1, 'Success is handled exactly once')
  assert.equal(displayedOrderCode, order.orderCode)
  assert.equal(cart.length, 0, 'The cart clears only after success')
  assert.equal(lock.current, false, 'The lock is released after success')
  console.log('PASS checkout double-submit: deferred request called once; success handled once; cart cleared after success')

  const retryCart = [{ productId: '12', quantity: 2 }]
  let attemptCount = 0
  let visibleError
  await submitCheckoutOnce(lock, async () => {
    attemptCount += 1
    throw new Error('API unavailable')
  }, () => {
    retryCart.splice(0)
  }, (error) => { visibleError = error.message })

  assert.equal(attemptCount, 1)
  assert.equal(visibleError, 'API unavailable')
  assert.equal(retryCart.length, 1, 'A failed request preserves the cart')
  assert.equal(lock.current, false, 'The lock is released after failure')

  let retryOrderCode
  await submitCheckoutOnce(lock, async () => {
    attemptCount += 1
    return order
  }, (createdOrder) => {
    retryOrderCode = createdOrder.orderCode
    retryCart.splice(0)
  }, (error) => { throw error })

  assert.equal(attemptCount, 2, 'A failed checkout can be retried')
  assert.equal(retryOrderCode, order.orderCode)
  assert.equal(retryCart.length, 0, 'The retried successful request clears the cart')
  console.log('PASS checkout failure/retry: error surfaced, cart preserved, lock released, retry succeeds')
} finally {
  await vite.close()
}
