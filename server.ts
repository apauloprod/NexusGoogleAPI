import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import { Resend } from "resend";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import dotenv from "dotenv";
import Stripe from "stripe";

dotenv.config();

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

console.log("SERVER SCRIPT LOADED");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }));
  app.use(express.json());

  // Request logging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.method === "POST") {
      console.log("Body keys:", Object.keys(req.body || {}));
    }
    next();
  });

  // Health check
  app.get("/api/health", (req, res) => {
    console.log("Health check requested");
    res.json({ status: "ok", env: process.env.NODE_ENV });
  });

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  // API Route to send quote email
  app.get("/api/send-quote", (req, res) => {
    console.log("GET /api/send-quote hit");
    res.send("API is alive. Use POST to send quotes.");
  });

  app.post("/api/send-quote", async (req, res) => {
    console.log("Received request to send quote email:", req.body?.quote?.quoteNumber);
    const { quote, clientEmail, appUrl } = req.body;

    if (!resend) {
      return res.status(500).json({ error: "Email service not configured. Please add RESEND_API_KEY to environment variables." });
    }

    try {
      // 1. Generate PDF
      const doc = new jsPDF();
      
      // Add content to PDF
      doc.setFontSize(22);
      doc.text("SERVICE QUOTE", 105, 20, { align: "center" });
      
      doc.setFontSize(12);
      doc.text(`Quote Number: ${quote.quoteNumber}`, 20, 40);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 48);
      doc.text(`Client: ${quote.clientName}`, 20, 56);
      
      const tableData = quote.items.map((item: any) => [
        item.description,
        `$${item.price.toLocaleString()}`
      ]);
      
      autoTable(doc, {
        startY: 70,
        head: [['Description', 'Price']],
        body: tableData,
        foot: [['Total', `$${quote.total.toLocaleString()}`]],
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
      });
      
      if (quote.notes) {
        const finalY = (doc as any).lastAutoTable?.finalY || 70;
        doc.text("Notes:", 20, finalY + 20);
        doc.setFontSize(10);
        doc.text(quote.notes, 20, finalY + 28, { maxWidth: 170 });
      }

      const pdfBase64 = doc.output("datauristring").split(",")[1];

      // 2. Send Email
      const approvalUrl = `${appUrl}/#/quote/${quote.id}/approve`;
      const paymentUrl = `${appUrl}/#/pay?type=quote&id=${quote.id}`;
      
      const { data, error } = await resend.emails.send({
        from: "CRM <onboarding@resend.dev>", // Replace with your verified domain
        to: [clientEmail],
        subject: `Quote #${quote.quoteNumber} from CRM`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #333;">Hello ${quote.clientName},</h2>
            <p style="color: #555; line-height: 1.6;">Please find the attached quote <strong>#${quote.quoteNumber}</strong> for the requested services.</p>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #888; text-transform: uppercase;">Total Amount</p>
              <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold; color: #000;">$${quote.total.toLocaleString()}</p>
            </div>
            <p style="color: #555; line-height: 1.6;">To proceed with this work, please click the button below to approve the quote online:</p>
            <div style="margin: 20px 0;">
              <a href="${approvalUrl}" style="display: inline-block; background: #000; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-right: 10px;">Approve Quote Online</a>
              <a href="${paymentUrl}" style="display: inline-block; background: #fff; color: #000; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; border: 1px solid #000;">Pay Deposit</a>
            </div>
            <p style="color: #888; font-size: 12px; margin-top: 30px;">If you have any questions, please reply to this email.</p>
          </div>
        `,
        attachments: [
          {
            filename: `Quote_${quote.quoteNumber}.pdf`,
            content: pdfBase64,
          },
        ],
      });

      if (error) {
        return res.status(400).json({ error });
      }

      res.json({ success: true, data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to generate PDF or send email." });
    }
  });

  app.post("/api/send-invoice", async (req, res) => {
    const { invoice, clientEmail, appUrl } = req.body;
    console.log(`[INVOICE API] Request received for Invoice #${invoice?.invoiceNumber} to ${clientEmail}`);
    
    if (!resend) {
      console.error("[INVOICE API] Resend not configured");
      return res.status(500).json({ error: "Email service not configured. Please add RESEND_API_KEY to environment variables." });
    }

    try {
      // 1. Generate PDF
      console.log("[INVOICE API] Generating PDF...");
      const doc = new jsPDF();
      
      doc.setFontSize(22);
      doc.text("INVOICE", 105, 20, { align: "center" });
      
      doc.setFontSize(12);
      doc.text(`Invoice Number: ${invoice.invoiceNumber}`, 20, 40);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 48);
      
      const dueDateStr = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "N/A";
      doc.text(`Due Date: ${dueDateStr}`, 20, 56);
      doc.text(`Client: ${invoice.clientName}`, 20, 64);
      
      const tableData = (invoice.items || []).map((item: any) => [
        item.description || "Service",
        `$${(Number(item.price) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      ]);
      
      autoTable(doc, {
        startY: 80,
        head: [['Description', 'Price']],
        body: tableData,
        foot: [['Total', `$${(Number(invoice.total) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`]],
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
      });
      
      if (invoice.notes) {
        const finalY = (doc as any).lastAutoTable?.finalY || 80;
        doc.text("Notes:", 20, finalY + 20);
        doc.setFontSize(10);
        doc.text(invoice.notes, 20, finalY + 28, { maxWidth: 170 });
      }

      const pdfBase64 = doc.output("datauristring").split(",")[1];
      console.log("[INVOICE API] PDF generated successfully");

      // 2. Send Email
      console.log("[INVOICE API] Sending email via Resend...");
      const paymentUrl = `${appUrl}/#/pay?type=invoice&id=${invoice.id}`;
      
      const { data, error } = await resend.emails.send({
        from: "CRM <onboarding@resend.dev>",
        to: [clientEmail],
        subject: `Invoice #${invoice.invoiceNumber} from CRM`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #333;">Hello ${invoice.clientName},</h2>
            <p style="color: #555; line-height: 1.6;">Please find the attached invoice <strong>#${invoice.invoiceNumber}</strong> for services rendered.</p>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #888; text-transform: uppercase;">Amount Due</p>
              <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold; color: #000;">$${(Number(invoice.total) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p style="margin: 10px 0 0; font-size: 12px; color: #888;">Due Date: ${dueDateStr}</p>
            </div>
            <p style="color: #555; line-height: 1.6;">You can pay this invoice securely online by clicking the button below:</p>
            <a href="${paymentUrl}" style="display: inline-block; background: #000; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">Pay Invoice Online</a>
            <p style="color: #888; font-size: 12px; margin-top: 30px;">Thank you for your business!</p>
          </div>
        `,
        attachments: [
          {
            filename: `Invoice_${invoice.invoiceNumber}.pdf`,
            content: pdfBase64,
          },
        ],
      });

      if (error) {
        console.error("[INVOICE API] Resend error:", error);
        return res.status(400).json({ error });
      }

      console.log("[INVOICE API] Email sent successfully:", data?.id);
      res.json({ success: true, data });
    } catch (err) {
      console.error("[INVOICE API] Unexpected error:", err);
      res.status(500).json({ error: "Failed to generate PDF or send email.", details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    const { amount, currency, description, metadata, successUrl, cancelUrl } = req.body;

    if (!stripe) {
      return res.status(500).json({ error: "Stripe not configured. Please add STRIPE_SECRET_KEY to environment variables." });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"], // You can add "paypal" here if enabled in Stripe
        line_items: [
          {
            price_data: {
              currency: currency || "usd",
              product_data: {
                name: description || "Service Payment",
              },
              unit_amount: Math.round(amount * 100), // Stripe expects cents
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: metadata || {},
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      res.json({ id: session.id, url: session.url });
    } catch (err: any) {
      console.error("Stripe Session Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
