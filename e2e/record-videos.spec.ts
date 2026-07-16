import { test, expect } from '@playwright/test';

// Configuration for video recording
test.use({
  video: {
    mode: 'on',
    size: { width: 1280, height: 720 }
  }
});

test.describe('WhatsApp App Review Videos', () => {

  test('Video 1: Send Message (whatsapp_business_messaging)', async ({ page }) => {
    // 1. Mock the API to return success
    await page.route('/api/whatsapp/send-direct', async route => {
      await new Promise(r => setTimeout(r, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { success: true, wamid: 'wamid.HBgLMTIzNDU2Nzg5MA==' }
        })
      });
    });

    // 2. Navigate to the new Manager page
    await page.goto('http://localhost:3000/whatsapp');

    // 3. Ensure we are on the Messaging tab
    await page.click('button:has-text("Mensajería Directa")');
    await page.waitForTimeout(500);

    // 4. Fill in the form
    // Note: Use updated placeholders from the professional UI
    await page.fill('input[placeholder="+521..."]', '+5215512345678');
    await page.waitForTimeout(500);

    await page.fill('textarea[placeholder="Escribe tu mensaje aquí..."]', 'Hola, este es un mensaje de prueba enviado desde nuestro panel de administración.');
    await page.waitForTimeout(1000);

    // 5. Click Send
    // Button text is now "Enviar Mensaje"
    await page.click('button:has-text("Enviar Mensaje")');

    // 6. Wait for success message
    // Success message is inside a green box
    const resultLocator = page.locator('.bg-green-50');
    await expect(resultLocator).toBeVisible();
    await expect(resultLocator).toContainText('Mensaje Enviado Correctamente');

    // 7. Hover/Focus to show it clearly
    await resultLocator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(3000);
  });

  test('Video 2: Create Template (whatsapp_business_management)', async ({ page }) => {
    // 1. Mock the API
    await page.route('/api/whatsapp/templates/create', async route => {
      await new Promise(r => setTimeout(r, 1500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            success: true,
            id: '123456789012345',
            status: 'PENDING',
            category: 'UTILITY'
          }
        })
      });
    });

    // 2. Navigate
    await page.goto('http://localhost:3000/whatsapp');

    // 3. Switch to Templates tab
    await page.click('button:has-text("Gestión de Plantillas")');
    await page.waitForTimeout(1000);

    // 4. Fill inputs
    await page.fill('input[placeholder="nombre_plantilla_v1"]', 'actualizacion_pedido_v3');
    await page.waitForTimeout(500);

    // Select Category
    // Using simple click since shadcn select triggers are buttons
    const selectTrigger = page.locator('button[role="combobox"]');
    if (await selectTrigger.isVisible()) {
        await selectTrigger.click();
        await page.waitForTimeout(200);
        // Select UTILITY
        await page.click('div[role="option"]:has-text("UTILITY")');
    }
    await page.waitForTimeout(500);

    await page.fill('textarea[placeholder*="Hola {{1}}"]', 'Hola {{1}}, te informamos que el estado de tu pedido #{{2}} ha cambiado a: {{3}}.');
    await page.waitForTimeout(1000);

    // 5. Click Create
    await page.click('button:has-text("Crear Plantilla")');

    // 6. Wait for success
    const resultLocator = page.locator('.bg-green-50').last();
    await expect(resultLocator).toBeVisible();
    await expect(resultLocator).toContainText('Plantilla Creada Correctamente');

    await page.waitForTimeout(3000);
  });
});
