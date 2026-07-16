import { NextResponse } from 'next/server'
import { getTemplates, seedDefaultTemplates } from '@/lib/template-service'

/**
 * GET /api/inbox/templates
 * 
 * Get all message templates organized by category.
 */
export async function GET() {
  try {
    const categories = await getTemplates()

    // If no templates exist, seed defaults
    if (categories.length === 0) {
      await seedDefaultTemplates()
      const seededCategories = await getTemplates()
      return NextResponse.json({
        success: true,
        categories: seededCategories,
      })
    }

    return NextResponse.json({
      success: true,
      categories,
    })
  } catch (error) {
    console.error('[Templates API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al cargar templates' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/inbox/templates/seed
 * 
 * Seed default templates (admin only).
 */
export async function POST() {
  try {
    await seedDefaultTemplates()
    
    return NextResponse.json({
      success: true,
      message: 'Templates seeded successfully',
    })
  } catch (error) {
    console.error('[Templates API] Seed error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear templates' },
      { status: 500 }
    )
  }
}
