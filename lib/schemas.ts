import { z } from 'zod'

export const createReservationSchema = z.object({
  productId: z.string().min(1, 'Product ID required'),
  warehouseId: z.string().min(1, 'Warehouse ID required'),
  quantity: z.number().int().positive('Quantity must be positive'),
})

export const confirmReservationSchema = z.object({
  // No additional body required
})

export const releaseReservationSchema = z.object({
  // No additional body required
})

export type CreateReservationInput = z.infer<typeof createReservationSchema>
export type ConfirmReservationInput = z.infer<typeof confirmReservationSchema>
export type ReleaseReservationInput = z.infer<typeof releaseReservationSchema>
