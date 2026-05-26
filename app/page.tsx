'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  AlertCircle, 
  Loader2, 
  Search, 
  Filter, 
  Warehouse, 
  Package, 
  ShoppingBag, 
  ArrowRight,
  TrendingUp,
  MapPin
} from 'lucide-react'

interface ProductStock {
  warehouseId: string
  warehouseName: string
  total: number
  available: number
}

interface Product {
  id: string
  name: string
  sku: string
  image?: string
  stocks: ProductStock[]
}

export default function Home() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reservingId, setReservingId] = useState<string | null>(null)

  // Advanced search and filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('all')
  const [selectedWarehouses, setSelectedWarehouses] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        const productsRes = await fetch('/api/products')

        if (!productsRes.ok) {
          throw new Error('Failed to fetch product data')
        }

        const productsData = await productsRes.json()
        setProducts(productsData)

        // Set default selected warehouse for each product (prefer one with stock)
        const defaults: Record<string, string> = {}
        productsData.forEach((p: Product) => {
          if (p.stocks.length > 0) {
            const hasStock = p.stocks.find((s) => s.available > 0)
            defaults[p.id] = hasStock ? hasStock.warehouseId : p.stocks[0].warehouseId
          }
        })
        setSelectedWarehouses(defaults)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleReserve = async (productId: string, warehouseId: string) => {
    setReservingId(`${productId}-${warehouseId}`)
    setError(null)
    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          warehouseId,
          quantity: 1,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          setError('Not enough stock available in selected warehouse.')
        } else {
          setError(data.error || 'Failed to create reservation')
        }
        return
      }

      router.push(`/checkout/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setReservingId(null)
    }
  }

  // Filter products based on search query and warehouse availability
  const filteredProducts = products.filter((product) => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesWarehouse = 
      selectedWarehouseFilter === 'all' ||
      product.stocks.some(
        (s) => s.warehouseId === selectedWarehouseFilter && s.available > 0
      )

    return matchesSearch && matchesWarehouse
  })

  // Get unique warehouses list for filter dropdown
  const allWarehouses = Array.from(
    new Map(
      products.flatMap((p) => p.stocks.map((s) => [s.warehouseId, s.warehouseName]))
    ).entries()
  ).map(([id, name]) => ({ id, name }))

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 gap-4">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-t-2 border-indigo-500 animate-spin"></div>
          <ShoppingBag className="w-6 h-6 text-indigo-400 absolute" />
        </div>
        <p className="text-slate-400 font-medium animate-pulse">Loading Allo inventory systems...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-12 relative overflow-x-hidden">
      {/* Decorative Radial Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
        
        {/* Sleek App Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6 border-b border-slate-900 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                <TrendingUp className="w-3 h-3" /> Live Inventory
              </span>
              <span className="bg-slate-900 text-slate-400 border border-slate-800 px-3 py-1 rounded-full text-xs font-semibold">
                v1.5.0
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-indigo-300 tracking-tight">
              Allo Reservations
            </h1>
            <p className="text-slate-400 mt-2 text-md max-w-xl">
              High-concurrency global fulfillment engine. Instantly hold and lock inventory items from regional distribution centers.
            </p>
          </div>
          
          <div className="flex items-center gap-3 text-slate-400 text-sm bg-slate-900/50 backdrop-blur-md border border-slate-800/80 px-4 py-2.5 rounded-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="font-medium text-slate-300">All systems operational</span>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <Alert className="mb-8 bg-rose-500/10 border border-rose-500/30 text-rose-200 shadow-lg backdrop-blur-md rounded-2xl p-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <AlertCircle className="h-5 w-5 text-rose-400" />
            <AlertDescription className="font-medium">{error}</AlertDescription>
          </Alert>
        )}

        {/* Search & Filters Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-10 items-center justify-between p-4 bg-slate-900/30 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-xl">
          {/* Search bar */}
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search products by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 transition-all text-sm"
            />
          </div>

          {/* Warehouse Dropdown filter */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider hidden md:block">Fulfillment:</span>
            <div className="relative w-full md:w-56">
              <Filter className="absolute left-4 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
              <select
                value={selectedWarehouseFilter}
                onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
                className="w-full pl-11 pr-10 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 transition-all text-sm appearance-none cursor-pointer"
              >
                <option value="all">All Warehouses</option>
                {allWarehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-4.5 pointer-events-none border-l border-slate-800 pl-3">
                <span className="border-t-4 border-l-4 border-r-4 border-transparent border-t-slate-500 block"></span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((product) => {
            const selectedWhId = selectedWarehouses[product.id] || (product.stocks[0]?.warehouseId)
            const activeStock = product.stocks.find((s) => s.warehouseId === selectedWhId) || product.stocks[0]
            const availablePercentage = activeStock ? Math.round((activeStock.available / activeStock.total) * 100) : 0

            return (
              <Card 
                key={product.id} 
                className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 overflow-hidden hover:scale-[1.02] hover:border-slate-700/80 hover:shadow-[0_0_35px_rgba(99,102,241,0.12)] transition-all duration-300 ease-out flex flex-col justify-between rounded-2xl"
              >
                {/* Product Image and SKU Tag */}
                <div className="aspect-[4/3] relative overflow-hidden bg-slate-950/60 group">
                  <div className="absolute top-4 left-4 z-20">
                    <span className="bg-slate-950/80 backdrop-blur-md text-indigo-300 border border-indigo-500/20 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-widest uppercase">
                      {product.sku}
                    </span>
                  </div>
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-950">
                      <Package className="w-12 h-12" />
                    </div>
                  )}
                  {/* Bottom glass reflection gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/0 to-transparent"></div>
                </div>

                {/* Card Header Info */}
                <CardHeader className="pt-5 pb-2 px-6">
                  <CardTitle className="text-xl font-bold text-white tracking-tight leading-snug line-clamp-1">
                    {product.name}
                  </CardTitle>
                  <CardDescription className="text-slate-500 text-xs flex items-center gap-1.5 mt-1 font-medium">
                    <Warehouse className="w-3.5 h-3.5 text-indigo-400" /> Multi-Warehouse Restocking Enabled
                  </CardDescription>
                </CardHeader>

                {/* Card Content & Action Area */}
                <CardContent className="space-y-6 px-6 pb-6 pt-2 flex-grow flex flex-col justify-between">
                  {/* Warehouse Selector Segmented Tab */}
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block">
                      Select Fulfillment Node:
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-1 rounded-xl border border-slate-900">
                      {product.stocks.map((stock) => {
                        const isSelected = selectedWhId === stock.warehouseId
                        return (
                          <button
                            key={stock.warehouseId}
                            type="button"
                            onClick={() => setSelectedWarehouses(prev => ({ ...prev, [product.id]: stock.warehouseId }))}
                            className={`flex flex-col items-center justify-center p-2.5 rounded-lg border transition-all duration-200 text-center gap-0.5 ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-500 text-white font-medium shadow-md shadow-indigo-600/10'
                                : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                            }`}
                          >
                            <span className="text-[11px] font-bold tracking-tight truncate w-full">
                              {stock.warehouseName.replace('Warehouse ', '')}
                            </span>
                            <span className={`text-[9px] font-extrabold tracking-wide ${
                              isSelected 
                                ? 'text-indigo-200' 
                                : stock.available > 0 
                                  ? 'text-emerald-500' 
                                  : 'text-rose-500'
                            }`}>
                              {stock.available > 0 ? `${stock.available} Left` : 'Sold Out'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Stock Level Bar & Visual Progress */}
                  {activeStock && (
                    <div className="space-y-2 bg-slate-950/40 p-4 rounded-xl border border-slate-900/50">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="font-semibold truncate max-w-[130px]">{activeStock.warehouseName}</span>
                        </span>
                        <span className={`font-extrabold ${
                          activeStock.available > 15 
                            ? 'text-emerald-400' 
                            : activeStock.available > 0 
                              ? 'text-amber-400' 
                              : 'text-rose-400'
                        }`}>
                          {activeStock.available} / {activeStock.total} Available
                        </span>
                      </div>
                      
                      {/* Visual progress bar */}
                      <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800/40">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            activeStock.available === 0 
                              ? 'bg-rose-500 w-0' 
                              : availablePercentage > 50 
                                ? 'bg-gradient-to-r from-emerald-500 to-indigo-500' 
                                : 'bg-gradient-to-r from-amber-500 to-orange-500'
                          }`}
                          style={{ width: `${Math.max(activeStock.available > 0 ? 5 : 0, Math.min(100, availablePercentage))}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Single Glowing Action Button */}
                  <div>
                    {activeStock && (
                      <Button
                        onClick={() => handleReserve(product.id, activeStock.warehouseId)}
                        disabled={activeStock.available === 0 || reservingId === `${product.id}-${activeStock.warehouseId}`}
                        className={`w-full h-12 rounded-xl font-bold transition-all duration-300 shadow-md ${
                          activeStock.available === 0
                            ? 'bg-slate-800 text-slate-500 border border-slate-900 cursor-not-allowed hover:bg-slate-800'
                            : reservingId === `${product.id}-${activeStock.warehouseId}`
                              ? 'bg-indigo-900/30 text-indigo-400 border border-indigo-700/50 cursor-wait'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/10 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]'
                        }`}
                      >
                        {reservingId === `${product.id}-${activeStock.warehouseId}` ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                            Locking Reservation...
                          </span>
                        ) : activeStock.available === 0 ? (
                          'Unavailable'
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            Reserve from {activeStock.warehouseName.replace('Warehouse ', '')} 
                            <ArrowRight className="w-4 h-4 text-indigo-300 group-hover:translate-x-1 transition-transform" />
                          </span>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Empty Search Results */}
        {filteredProducts.length === 0 && !error && (
          <div className="text-center py-20 bg-slate-900/20 border border-slate-900/60 rounded-3xl backdrop-blur-md">
            <Package className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-300">No products matching filters</h3>
            <p className="text-slate-500 mt-2 text-sm max-w-md mx-auto">
              We couldn't find any products matching your current search parameters. Try clearing your search query or selecting "All Warehouses".
            </p>
            <Button 
              onClick={() => { setSearchQuery(''); setSelectedWarehouseFilter('all'); }} 
              className="mt-6 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
            >
              Reset Filters
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
