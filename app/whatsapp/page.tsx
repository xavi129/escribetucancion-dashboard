"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, FileText, Send, PlusCircle } from "lucide-react"

export default function WhatsAppManagerPage() {
  // Send Message State
  const [phoneNumber, setPhoneNumber] = useState("")
  const [message, setMessage] = useState("Hola, gracias por tu pedido. Tu canción está lista.")
  const [sendLoading, setSendLoading] = useState(false)
  const [sendResult, setSendResult] = useState<any>(null)

  // Create Template State
  const [templateName, setTemplateName] = useState("notificacion_pedido_v2")
  const [templateCategory, setTemplateCategory] = useState("UTILITY")
  const [templateBody, setTemplateBody] = useState("Hola {{1}}, tu pedido #{{2}} ha sido actualizado a: {{3}}.")
  const [createLoading, setCreateLoading] = useState(false)
  const [createResult, setCreateResult] = useState<any>(null)

  const handleSendMessage = async () => {
    setSendLoading(true)
    setSendResult(null)
    try {
      const response = await fetch("/api/whatsapp/send-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, message }),
      })
      const data = await response.json()
      setSendResult(data)
    } catch (error) {
      setSendResult({ success: false, error: String(error) })
    } finally {
      setSendLoading(false)
    }
  }

  const handleCreateTemplate = async () => {
    setCreateLoading(true)
    setCreateResult(null)
    try {
      const response = await fetch("/api/whatsapp/templates/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          category: templateCategory,
          bodyText: templateBody,
          language: "es_MX"
        }),
      })
      const data = await response.json()
      setCreateResult(data)
    } catch (error) {
      setCreateResult({ success: false, error: String(error) })
    } finally {
      setCreateLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-10 space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WhatsApp Manager</h1>
          <p className="text-gray-500 mt-2">
            Gestión centralizada de comunicaciones y plantillas de WhatsApp Business.
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm font-medium">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span>API Connected</span>
        </div>
      </div>

      <Tabs defaultValue="messaging" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="messaging" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Mensajería Directa
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Gestión de Plantillas
          </TabsTrigger>
        </TabsList>

        {/* Messaging Section */}
        <TabsContent value="messaging" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Enviar Mensaje Directo</CardTitle>
              <CardDescription>
                Envía notificaciones manuales o de soporte a clientes específicos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Número de Teléfono</Label>
                  <Input
                    id="phone"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+521..."
                    className="font-mono"
                  />
                  <p className="text-xs text-gray-500">Incluye el código de país (ej. +52 para México)</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Contenido del Mensaje</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escribe tu mensaje aquí..."
                  className="min-h-[120px]"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSendMessage} disabled={sendLoading} className="w-full md:w-auto gap-2">
                  {sendLoading ? (
                    "Enviando..."
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Enviar Mensaje
                    </>
                  )}
                </Button>
              </div>

              {sendResult && (
                <div className={`p-4 rounded-md border ${sendResult.success ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                  <h4 className="font-semibold mb-2">{sendResult.success ? "Mensaje Enviado Correctamente" : "Error al Enviar"}</h4>
                  <pre className="text-xs overflow-auto max-h-40 bg-white/50 p-2 rounded">
                    {JSON.stringify(sendResult, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Section */}
        <TabsContent value="templates" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Crear Nueva Plantilla</CardTitle>
              <CardDescription>
                Registra nuevas plantillas de mensajes para su aprobación por Meta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tplName">Nombre de la Plantilla</Label>
                  <Input
                    id="tplName"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="nombre_plantilla_v1"
                    className="font-mono"
                  />
                  <p className="text-xs text-gray-500">Solo minúsculas y guiones bajos (snake_case)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tplCategory">Categoría</Label>
                  <Select value={templateCategory} onValueChange={setTemplateCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTILITY">UTILITY (Utilidad)</SelectItem>
                      <SelectItem value="MARKETING">MARKETING</SelectItem>
                      <SelectItem value="AUTHENTICATION">AUTHENTICATION (Autenticación)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tplBody">Texto de la Plantilla</Label>
                <Textarea
                  id="tplBody"
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  placeholder="Hola {{1}}, ..."
                  className="min-h-[120px] font-mono text-sm"
                />
                <p className="text-xs text-gray-500">Usa {'{{1}}'}, {'{{2}}'} para variables dinámicas.</p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleCreateTemplate} disabled={createLoading} className="w-full md:w-auto gap-2">
                  {createLoading ? (
                    "Procesando..."
                  ) : (
                    <>
                      <PlusCircle className="h-4 w-4" /> Crear Plantilla
                    </>
                  )}
                </Button>
              </div>

              {createResult && (
                <div className={`p-4 rounded-md border ${createResult.success ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                  <h4 className="font-semibold mb-2">{createResult.success ? "Plantilla Creada Correctamente" : "Error al Crear"}</h4>
                  <pre className="text-xs overflow-auto max-h-40 bg-white/50 p-2 rounded">
                    {JSON.stringify(createResult, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
