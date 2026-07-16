"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, type Resolver } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"
import { supabase, type Order } from "@/lib/supabase"

// Define the form schema with Zod
const formSchema = z.object({
  transaction_id: z.string().optional().nullable(),
  customer_name: z.string().min(1, "Customer name is required"),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email("Invalid email address").optional().nullable(),
  country: z.string().optional().nullable(),
  song_type: z.string().optional().nullable(),
  purpose: z.string().optional().nullable(),
  occasion: z.string().optional().nullable(),
  include_name: z.boolean().optional().nullable(),
  person_name: z.string().optional().nullable(),
  relationship: z.string().optional().nullable(),
  genre: z.string().optional().nullable(),
  song_references: z.string().optional().nullable(),
  voice_gender: z.string().optional().nullable(),
  styles: z.string().optional().nullable(),
  details: z.string().optional().nullable(),
  delivery_type: z.string().optional().nullable(),
  payment_method: z.string().optional().nullable(),
  base_price: z.preprocess((val) => (val === "" ? null : Number(val)), z.number().min(0).nullable()),
  delivery_extra: z.preprocess((val) => (val === "" ? null : Number(val)), z.number().min(0).nullable()),
  total_price: z.preprocess((val) => (val === "" ? null : Number(val)), z.number().min(0).nullable()),
  payment_status: z.string(),
  status: z.string(),
  spotify_upload: z.boolean().optional().nullable(),
  video: z.boolean().optional().nullable(),
  responder_auto: z.boolean().optional().nullable(),
  generated_lyric: z.string().optional().nullable(),
  generated_style: z.string().optional().nullable(),
  audio_url: z.string().optional().nullable(),
  spotify_song_name: z.string().optional().nullable(),
  lyric_revision_count: z.number().int().min(0).nullable(),
})

type TransactionFormProps = {
  transaction: Order | null
  onClose: (refreshData?: boolean) => void
}

export default function TransactionForm({ transaction, onClose }: TransactionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize the form with default values or existing transaction data
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as Resolver<z.infer<typeof formSchema>, any>,
    defaultValues: transaction
      ? {
          // Map transaction fields to the form schema types to avoid nullable issues
          transaction_id: transaction.transaction_id ?? null,
          customer_name: transaction.customer_name ?? "",
          whatsapp: transaction.whatsapp ?? null,
          email: transaction.email ?? null,
          country: transaction.country ?? null,
          song_type: transaction.song_type ?? null,
          purpose: transaction.purpose ?? null,
          occasion: transaction.occasion ?? null,
          include_name: transaction.include_name ?? false,
          person_name: transaction.person_name ?? null,
          relationship: transaction.relationship ?? null,
          genre: transaction.genre ?? null,
          song_references: transaction.song_references ?? null,
          voice_gender: transaction.voice_gender ?? null,
          styles: transaction.styles ?? null,
          details: transaction.details ?? null,
          delivery_type: transaction.delivery_type ?? null,
          payment_method: transaction.payment_method ?? null,
          base_price: transaction.base_price ?? null,
          delivery_extra: transaction.delivery_extra ?? null,
          total_price: transaction.total_price ?? null,
          payment_status: transaction.payment_status ?? "pending",
          status: transaction.status ?? "new",
          spotify_upload: transaction.spotify_upload ?? false,
          video: transaction.video ?? false,
          responder_auto: transaction.responder_auto ?? false,
          generated_lyric: transaction.generated_lyric ?? null,
          generated_style: transaction.generated_style ?? null,
          audio_url: transaction.audio_url ?? null,
          spotify_song_name: transaction.spotify_song_name ?? null,
          lyric_revision_count: transaction.lyric_revision_count ?? null,
        }
      : {
          transaction_id: null,
          customer_name: "",
          whatsapp: null,
          email: null,
          country: null,
          song_type: null,
          purpose: null,
          occasion: null,
          include_name: false,
          person_name: null,
          relationship: null,
          genre: null,
          song_references: null,
          voice_gender: null,
          styles: null,	
          details: null,
          delivery_type: null,
          payment_method: null,
          base_price: null,
          delivery_extra: null,
          total_price: null,
          payment_status: "pending",
          status: "new",
          spotify_upload: false,
          video: false,
          responder_auto: false,
          generated_lyric: null,
          generated_style: null,
          audio_url: null,
          spotify_song_name: null,
          lyric_revision_count: null,
        },
  })

  // Watch price fields to calculate total
  const basePrice = form.watch("base_price")
  const deliveryExtra = form.watch("delivery_extra")

  // Calculate total price when base price or delivery extra changes
  const calculateTotal = () => {
    const base = basePrice || 0
    const extra = deliveryExtra || 0
    form.setValue("total_price", base + extra)
  }

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true)

    try {
      if (transaction) {
        // Update existing order
        const { error } = await supabase.from("orders").update(values).eq("id", transaction.id)

        if (error) throw error
      } else {
        // Create new order
        const { error } = await supabase.from("orders").insert(values)

        if (error) throw error
      }

      onClose(true) // Close form and refresh data
    } catch (error) {
      console.error("Error saving transaction:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs defaultValue="customer" className="w-full">
          <TabsList className="grid grid-cols-5 mb-4">
            <TabsTrigger value="customer">Customer Info</TabsTrigger>
            <TabsTrigger value="song">Song Details</TabsTrigger>
            <TabsTrigger value="payment">Payment</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="status">Status</TabsTrigger>
          </TabsList>

          <TabsContent value="customer" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="transaction_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Auto-generated" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormDescription>Optional unique identifier for this transaction</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name*</FormLabel>
                    <FormControl>
                      <Input required {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>

          <TabsContent value="song" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="song_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Song Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select song type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="original">Original</SelectItem>
                        <SelectItem value="cover">Cover</SelectItem>
                        <SelectItem value="remix">Remix</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purpose</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select purpose" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="gift">Gift</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="occasion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Occasion</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select occasion" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="birthday">Birthday</SelectItem>
                        <SelectItem value="anniversary">Anniversary</SelectItem>
                        <SelectItem value="wedding">Wedding</SelectItem>
                        <SelectItem value="graduation">Graduation</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="include_name"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value || false} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Include Name in Song</FormLabel>
                      <FormDescription>Whether to include a specific person's name in the song</FormDescription>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="person_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Person's Name</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormDescription>Name to include in the song (if applicable)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="relationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormDescription>Relationship to the person (if applicable)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="genre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Genre</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select genre" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pop">Pop</SelectItem>
                        <SelectItem value="rock">Rock</SelectItem>
                        <SelectItem value="hiphop">Hip Hop</SelectItem>
                        <SelectItem value="rnb">R&B</SelectItem>
                        <SelectItem value="country">Country</SelectItem>
                        <SelectItem value="electronic">Electronic</SelectItem>
                        <SelectItem value="jazz">Jazz</SelectItem>
                        <SelectItem value="classical">Classical</SelectItem>
                        <SelectItem value="folk">Folk</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="voice_gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voice Gender</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select voice gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="any">Any</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="song_references"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel>Song References</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter song references or inspiration"
                        className="min-h-[80px]"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="styles"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel>Styles</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormDescription>Specific styles or influences for the song</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="details"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel>Additional Details</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any additional details or requirements"
                        className="min-h-[120px]"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>

          <TabsContent value="payment" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="delivery_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select delivery type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="express" className="font-medium text-red-600">
                          Express (Priority)
                        </SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="credit_card">Credit Card</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="crypto">Cryptocurrency</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="base_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        {...field}
                        value={field.value === null ? "" : field.value}
                        onChange={(e) => {
                          field.onChange(e.target.value === "" ? null : Number.parseFloat(e.target.value))
                          setTimeout(calculateTotal, 0)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="delivery_extra"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Extra</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        {...field}
                        value={field.value === null ? "" : field.value}
                        onChange={(e) => {
                          field.onChange(e.target.value === "" ? null : Number.parseFloat(e.target.value))
                          setTimeout(calculateTotal, 0)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="total_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        {...field}
                        value={field.value === null ? "" : field.value}
                        readOnly
                        className="bg-muted"
                      />
                    </FormControl>
                    <FormDescription>Automatically calculated from base price and delivery extra</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="refunded">Refunded</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>

          <TabsContent value="production" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="spotify_song_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spotify Song Name</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="Nombre final enviado a Spotify" />
                    </FormControl>
                    <FormDescription>Solo completar si la canción será publicada en Spotify</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="audio_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Audio URL</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="https://..." />
                    </FormControl>
                    <FormDescription>URL devuelta por Suno o subida manualmente</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lyric_revision_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lyric Revision Count</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : Number.parseInt(e.target.value, 10))}
                      />
                    </FormControl>
                    <FormDescription>Total de revisiones solicitadas para la letra</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="generated_style"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Generated Style</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      placeholder="Respuesta del modelo sobre el estilo generado"
                      className="min-h-[80px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="generated_lyric"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Generated Lyric</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      placeholder="Letra generada automáticamente"
                      className="min-h-[160px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="early_lead">Early Lead</SelectItem>
                        <SelectItem value="lead">Lead</SelectItem>
                        <SelectItem value="lead_or_early_lead">Lead + Early Lead</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="spotify_upload"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Spotify Upload</FormLabel>
                      <FormDescription>Marcar si la canción ha sido subida a Spotify</FormDescription>
                    </div>
                    <FormControl>
                      <Checkbox
                        checked={field.value || false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="video"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Video Generation</FormLabel>
                      <FormDescription>Marcar si la orden incluye generación de video (Deluxe)</FormDescription>
                    </div>
                    <FormControl>
                      <Checkbox
                        checked={field.value || false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="responder_auto"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Responder automático</FormLabel>
                      <FormDescription>Activa o desactiva el envío automático de respuestas</FormDescription>
                    </div>
                    <FormControl>
                      <Checkbox checked={field.value || false} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onClose()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {transaction ? "Update" : "Create"} Order
          </Button>
        </div>
      </form>
    </Form>
  )
}
