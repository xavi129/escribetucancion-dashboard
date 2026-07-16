"use client"

import { useState } from "react"
import { Store, CreditCard, Building2, ShoppingBag, Check, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

type PaymentMethod = "stripe" | "transfer" | "oxxo" | null

type SpotifyUpsellProps = {
  orderId: string
  customerName: string
  onClose?: () => void
}

export default function SpotifyUpsell({ orderId, customerName, onClose }: SpotifyUpsellProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method)
    setErrorMessage(null)
  }

  const handleConfirmPayment = async () => {
    if (!selectedMethod) {
      setErrorMessage("Por favor selecciona un método de pago")
      return
    }

    setIsProcessing(true)
    setErrorMessage(null)

    try {
      if (selectedMethod === "stripe") {
        // Redirigir a Stripe
        window.open("https://buy.stripe.com/9AQbLD5HXdWC3wQeV5", "_blank")
        
        // Mostrar mensaje para que confirmen después del pago
        setShowSuccess(true)
        setTimeout(() => {
          if (onClose) onClose()
        }, 3000)
      } else {
        // Para transferencia y OXXO, registrar el pago pendiente
        const response = await fetch("/api/orders/spotify-upgrade", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId,
            paymentMethod: selectedMethod,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Error al procesar la solicitud")
        }

        setShowSuccess(true)
        setTimeout(() => {
          if (onClose) onClose()
        }, 3000)
      }
    } catch (error) {
      console.error("Error al procesar pago:", error)
      setErrorMessage(error instanceof Error ? error.message : "Error al procesar el pago")
    } finally {
      setIsProcessing(false)
    }
  }

  if (showSuccess) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">¡Solicitud Registrada!</h3>
            <p className="text-gray-600">
              {selectedMethod === "stripe"
                ? "Una vez confirmado tu pago, distribuiremos tu canción en las plataformas."
                : "Hemos registrado tu solicitud. Una vez confirmado el pago, distribuiremos tu canción."}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center mb-2">
          <Store className="h-8 w-8 text-purple-600 mr-2" />
          <CardTitle className="text-2xl">¡Hola {customerName}!</CardTitle>
        </div>
        <CardDescription className="text-base">
          Esperamos que hayas disfrutado tu canción personalizada 🎵
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Oferta Principal */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            ¿Quieres distribuir tu canción en plataformas de streaming?
          </h2>
          <p className="text-gray-600 mb-2">
            Por solo <span className="font-bold text-purple-600">$99 MXN</span> adicionales, podemos distribuir tu
            canción personalizada en las principales plataformas de streaming como Spotify, Apple Music y YouTube Music.
          </p>
          <p className="text-sm text-purple-600 mt-2">
            ¡Comparte tu canción con todo el mundo y haz que cualquiera pueda escucharla en sus plataformas favoritas!
            🎵🌎
          </p>
        </div>

        {/* Beneficios */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Store className="h-5 w-5 text-purple-600 mr-2" />
            <h3 className="font-medium text-purple-800">Beneficios de la distribución digital:</h3>
          </div>
          <ul className="text-sm text-gray-700 space-y-2 ml-7 list-disc">
            <li>
              Tu canción estará disponible en <strong>Spotify, Apple Music y YouTube Music</strong>
            </li>
            <li>Podrás compartir enlaces oficiales con amigos y familiares</li>
            <li>Tu canción aparecerá en los resultados de búsqueda de las plataformas</li>
          </ul>
        </div>

        {/* Opciones de Pago */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-800 text-lg">Selecciona tu método de pago:</h3>

          {/* Tarjeta de Crédito/Débito - Stripe */}
          <div
            onClick={() => handlePaymentMethodSelect("stripe")}
            className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
              selectedMethod === "stripe"
                ? "border-purple-500 bg-purple-50"
                : "border-gray-200 hover:border-purple-300"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <CreditCard className="h-6 w-6 text-purple-600 mt-1" />
                <div>
                  <h4 className="font-semibold text-gray-800">Tarjeta de Crédito/Débito</h4>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Instantáneo
                    </Badge>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      Seguro
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Procesador: Stripe</p>
                </div>
              </div>
              {selectedMethod === "stripe" && (
                <Check className="h-6 w-6 text-purple-600" />
              )}
            </div>
          </div>

          {/* Transferencia Bancaria */}
          <div
            onClick={() => handlePaymentMethodSelect("transfer")}
            className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
              selectedMethod === "transfer"
                ? "border-purple-500 bg-purple-50"
                : "border-gray-200 hover:border-purple-300"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <Building2 className="h-6 w-6 text-purple-600 mt-1" />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-800">Transferencia Bancaria</h4>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 mt-2">
                    ⚠️ Revisión manual antes de iniciar
                  </Badge>
                  
                  {selectedMethod === "transfer" && (
                    <div className="mt-3 space-y-2 text-sm bg-white p-3 rounded border border-gray-200">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-medium">CLABE:</span>
                        <span className="font-mono">000000000000000000</span>
                        
                        <span className="font-medium">Banco:</span>
                        <span>Spin by OXXO</span>
                        
                        <span className="font-medium">Beneficiario:</span>
                        <span>Productor - Titular de ejemplo</span>
                        
                        <span className="font-medium">Concepto:</span>
                        <span>Upgrade Spotify - Pedido #{orderId.slice(0, 8)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {selectedMethod === "transfer" && (
                <Check className="h-6 w-6 text-purple-600" />
              )}
            </div>
          </div>

          {/* OXXO */}
          <div
            onClick={() => handlePaymentMethodSelect("oxxo")}
            className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
              selectedMethod === "oxxo"
                ? "border-purple-500 bg-purple-50"
                : "border-gray-200 hover:border-purple-300"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <ShoppingBag className="h-6 w-6 text-purple-600 mt-1" />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-800">Pago en OXXO</h4>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-700 mt-2">
                    Disponible en: México
                  </Badge>
                  
                  {selectedMethod === "oxxo" && (
                    <div className="mt-3 space-y-2 text-sm bg-white p-3 rounded border border-gray-200">
                      <p className="font-medium">Código de depósito:</p>
                      <p className="text-2xl font-mono font-bold text-center py-2 bg-gray-50 rounded">
                        2242 1700 2013 9466
                      </p>
                      <p className="text-xs text-gray-600">
                        Muestra este código de depósito en efectivo en la caja de cualquier tienda OXXO
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {selectedMethod === "oxxo" && (
                <Check className="h-6 w-6 text-purple-600" />
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <Alert variant="destructive">
            <X className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleConfirmPayment}
            disabled={!selectedMethod || isProcessing}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                {selectedMethod === "stripe" ? "Ir a pagar" : "Confirmar solicitud"}
              </>
            )}
          </Button>
          
          {onClose && (
            <Button onClick={onClose} variant="outline" size="lg">
              Ahora no
            </Button>
          )}
        </div>

        {/* Footer Note */}
        <p className="text-xs text-center text-gray-500 pt-2">
          Una vez confirmado tu pago, procesaremos la distribución de tu canción en 24-48 horas.
        </p>
      </CardContent>
    </Card>
  )
}

