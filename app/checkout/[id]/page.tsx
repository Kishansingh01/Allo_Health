'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Timer, 
  Package, 
  MapPin, 
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  CreditCard
} from 'lucide-react'

interface ReservationDetail {
  id: string
  productName: string
  productSku: string
  productImage?: string
  warehouseName: string
  warehouseLocation: string
  quantity: number
  status: 'PENDING' | 'CONFIRMED' | 'RELEASED'
  expiresAt: string
  confirmedAt?: string
  releasedAt?: string
  createdAt: string
}

export default function CheckoutPage() {
  const router = useRouter()
  const params = useParams()
  const reservationId = params.id as string

  const [reservation, setReservation] = useState<ReservationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [percentRemaining, setPercentRemaining] = useState<number>(100)
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    const fetchReservation = async () => {
      try {
        const response = await fetch(`/api/reservations/${reservationId}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError('Reservation not found')
          } else {
            setError('Failed to fetch reservation')
          }
          return
        }

        const data = await response.json()
        setReservation(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchReservation()
  }, [reservationId])

  useEffect(() => {
    if (!reservation || reservation.status !== 'PENDING') {
      return
    }

    const updateTimer = () => {
      const now = new Date().getTime()
      const expiryTime = new Date(reservation.expiresAt).getTime()
      const createdAtTime = new Date(reservation.createdAt).getTime()
      const difference = expiryTime - now

      if (difference <= 0) {
        setTimeRemaining('Expired')
        setPercentRemaining(0)
        setIsExpired(true)
        return
      }

      // Calculate timer percentage
      const totalDuration = expiryTime - createdAtTime
      const duration = totalDuration > 0 ? totalDuration : 10 * 60 * 1000
      const percent = Math.max(0, Math.min(100, (difference / duration) * 100))
      setPercentRemaining(percent)

      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((difference % (1000 * 60)) / 1000)

      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`)
      setIsExpired(false)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [reservation])

  const handleConfirm = async () => {
    if (!reservation) return

    setConfirming(true)
    setError(null)
    try {
      const response = await fetch(`/api/reservations/${reservationId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 410) {
          setError('Reservation has expired')
          setIsExpired(true)
        } else if (response.status === 409) {
          setError('Reservation is no longer available')
        } else {
          setError(data.error || 'Failed to confirm reservation')
        }
        return
      }

      setReservation((prev) =>
        prev ? { ...prev, status: 'CONFIRMED', confirmedAt: new Date().toISOString() } : null
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setConfirming(false)
    }
  }

  const handleCancel = async () => {
    if (!reservation) return

    setReleasing(true)
    setError(null)
    try {
      const response = await fetch(`/api/reservations/${reservationId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to cancel reservation')
        return
      }

      setReservation((prev) =>
        prev ? { ...prev, status: 'RELEASED', releasedAt: new Date().toISOString() } : null
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setReleasing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 gap-4">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-t-2 border-indigo-500 animate-spin"></div>
          <Timer className="w-6 h-6 text-indigo-400 absolute" />
        </div>
        <p className="text-slate-400 font-medium animate-pulse">Loading reservation details...</p>
      </div>
    )
  }

  if (!reservation) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 py-16 relative">
        <div className="max-w-2xl mx-auto px-4 relative z-10">
          <Alert className="bg-rose-500/10 border border-rose-500/30 text-rose-200 shadow-xl rounded-2xl p-4">
            <AlertCircle className="h-5 w-5 text-rose-400" />
            <AlertDescription className="font-semibold">{error || 'Reservation session not found'}</AlertDescription>
          </Alert>
          <Button 
            className="mt-6 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl px-6 h-11" 
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Storefront
          </Button>
        </div>
      </main>
    )
  }

  const isPending = reservation.status === 'PENDING'
  const isConfirmed = reservation.status === 'CONFIRMED'
  const isReleased = reservation.status === 'RELEASED'

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-12 relative overflow-x-hidden">
      {/* Background radial glows */}
      <div className="absolute top-[-10%] left-[-20%] w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-20%] w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="max-w-2xl mx-auto px-4 relative z-10">
        
        {/* Sleek Breadcrumbs/Nav */}
        <div className="flex items-center gap-2 mb-8 text-xs text-slate-500 font-bold uppercase tracking-widest">
          <button onClick={() => router.push('/')} className="hover:text-indigo-400 transition-colors flex items-center gap-1">
            Storefront
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
          <span className="text-slate-300">Checkout</span>
        </div>

        {/* Global Page Title */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Fulfillment Checkout</h1>
            <p className="text-slate-400 text-sm mt-1">Review details and secure your inventory allocation.</p>
          </div>
          
          <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border shadow-sm ${
            isConfirmed 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : isReleased 
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
          }`}>
            {reservation.status}
          </span>
        </div>

        {/* Error Callout */}
        {error && (
          <Alert className="mb-6 bg-rose-500/10 border border-rose-500/30 text-rose-200 rounded-2xl p-4 shadow-lg backdrop-blur-md">
            <AlertCircle className="h-5 w-5 text-rose-400" />
            <AlertDescription className="font-semibold">{error}</AlertDescription>
          </Alert>
        )}

        {/* Major Checkout Glass Card */}
        <Card className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl">
          
          {/* Reservation Timer Header for Pending Orders */}
          {isPending && (
            <div className="bg-slate-950/60 border-b border-slate-800/60 p-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400 font-semibold flex items-center gap-2">
                  <Timer className="w-4 h-4 text-amber-400 animate-pulse" /> Temporary Inventory Reservation Lock
                </span>
                <span className={`font-mono text-xl font-black tracking-wider ${
                  isExpired || timeRemaining === 'Expired' ? 'text-rose-400' : 'text-amber-400'
                }`}>
                  {timeRemaining}
                </span>
              </div>
              
              {/* Shrunking visual timer bar */}
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(245,158,11,0.2)] ${
                    percentRemaining < 20 
                      ? 'bg-gradient-to-r from-rose-500 to-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]' 
                      : 'bg-gradient-to-r from-amber-500 to-orange-500'
                  }`}
                  style={{ width: `${percentRemaining}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                To prevent stock hoarding, this item is locked for you for 10 minutes. If purchase is not finished within this window, the lock expires and stock restocks automatically.
              </p>
            </div>
          )}

          <CardContent className="p-6 md:p-8 space-y-8">
            
            {/* Order/Receipt Identification */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-6 border-b border-slate-800/40">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Allocation Token</span>
                <p className="font-mono text-slate-300 font-bold text-sm tracking-wide break-all select-all">{reservation.id}</p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Allocation Date</span>
                <p className="text-slate-400 font-medium text-xs">
                  {new Date(reservation.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Product Itinerary (Receipt Row) */}
            <div className="flex gap-6 p-4 bg-slate-950/40 rounded-2xl border border-slate-900/60 items-center">
              {reservation.productImage ? (
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-950 flex-shrink-0 border border-slate-800">
                  <img
                    src={reservation.productImage}
                    alt={reservation.productName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-950 flex-shrink-0 border border-slate-800 flex items-center justify-center text-slate-700">
                  <Package className="w-8 h-8" />
                </div>
              )}
              
              <div className="flex-1 space-y-1">
                <span className="bg-slate-900 text-indigo-300 border border-indigo-500/10 px-2.5 py-0.5 rounded text-[9px] font-extrabold tracking-widest uppercase inline-block">
                  {reservation.productSku}
                </span>
                <h3 className="font-bold text-lg text-white leading-snug tracking-tight">{reservation.productName}</h3>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-500 text-xs font-semibold uppercase">Quantity:</span>
                  <span className="bg-slate-900 border border-slate-800 text-slate-200 px-3 py-1 rounded-lg text-xs font-black">
                    {reservation.quantity} Unit{reservation.quantity > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Shipping / Fulfillment Route */}
            <div className="bg-slate-950/30 p-5 rounded-2xl border border-slate-850 space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 block">Origin Fulfillment Center</span>
              <div className="flex gap-4 items-start">
                <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 p-2.5 rounded-xl">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-200 text-sm">{reservation.warehouseName}</h4>
                  <p className="text-xs text-slate-400">{reservation.warehouseLocation}</p>
                </div>
              </div>
            </div>

            {/* Status Tracking Feedbacks (Celebration or Cancel Boxes) */}
            {isConfirmed && (
              <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3 animate-in zoom-in-95 duration-300">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                  <div>
                    <h4 className="font-bold text-emerald-300 text-md">Inventory Allocation Secured!</h4>
                    {reservation.confirmedAt && (
                      <p className="text-[11px] text-slate-400">
                        Secured at {new Date(reservation.confirmedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed pl-10">
                  ✓ The requested units have been permanently deducted from warehouse stock. Shipping labels have been generated and sent to {reservation.warehouseName}. Thank you!
                </p>
                <div className="pl-10 pt-2 flex items-center gap-2 text-xs text-emerald-400 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Encrypted Concurrency Locked Transaction Complete
                </div>
              </div>
            )}

            {isReleased && (
              <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-2 animate-in zoom-in-95 duration-300">
                <div className="flex items-center gap-3">
                  <XCircle className="w-7 h-7 text-rose-400" />
                  <div>
                    <h4 className="font-bold text-rose-300 text-md">Reservation Hold Cancelled</h4>
                    {reservation.releasedAt && (
                      <p className="text-[11px] text-slate-400">
                        Released at {new Date(reservation.releasedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed pl-10">
                  The temporary reservation hold has been released. The reserved units have been successfully restored and put back in stock at {reservation.warehouseName} for other shoppers.
                </p>
              </div>
            )}

            {/* Action Buttons Zone */}
            {isPending && (
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  onClick={handleConfirm}
                  disabled={confirming || isExpired}
                  className="flex-1 h-12 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/15 hover:shadow-[0_0_20px_rgba(99,102,241,0.45)] transition-all duration-300 flex items-center justify-center gap-2 text-sm"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Securing Stock...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 text-indigo-200" />
                      Confirm Purchase
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={handleCancel}
                  disabled={releasing}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl font-semibold border-slate-800 bg-transparent hover:bg-slate-900/60 hover:text-slate-100 text-slate-400 transition-all text-sm"
                >
                  {releasing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Releasing hold...
                    </>
                  ) : (
                    'Release Hold'
                  )}
                </Button>
              </div>
            )}

            {/* Inactive Back buttons */}
            {(isConfirmed || isReleased) && (
              <div className="pt-2">
                <Button 
                  onClick={() => router.push('/')} 
                  className="w-full h-12 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Return to Storefront
                </Button>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </main>
  )
}
