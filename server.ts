import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import { Resend } from "resend";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import dotenv from "dotenv";

dotenv.config();

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
            <a href="${approvalUrl}" style="display: inline-block; background: #000; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">Approve Quote Online</a>
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
    console.log("Received request to send invoice email:", req.body?.invoice?.invoiceNumber);
    const { invoice, clientEmail, appUrl } = req.body;

    if (!resend) {
      return res.status(500).json({ error: "Email service not configured. Please add RESEND_API_KEY to environment variables." });
    }

    try {
      // 1. Generate PDF
      const doc = new jsPDF();
      
      doc.setFontSize(22);
      doc.text("INVOICE", 105, 20, { align: "center" });
      
      doc.setFontSize(12);
      doc.text(`Invoice Number: ${invoice.invoiceNumber}`, 20, 40);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 48);
      doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 20, 56);
      doc.text(`Client: ${invoice.clientName}`, 20, 64);
      
      const tableData = invoice.items.map((item: any) => [
        item.description,
        `$${item.price.toLocaleString()}`
      ]);
      
      autoTable(doc, {
        startY: 80,
        head: [['Description', 'Price']],
        body: tableData,
        foot: [['Total', `$${invoice.total.toLocaleString()}`]],
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

      // 2. Send Email
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
              <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold; color: #000;">$${invoice.total.toLocaleString()}</p>
              <p style="margin: 10px 0 0; font-size: 12px; color: #888;">Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}</p>
            </div>
            <p style="color: #555; line-height: 1.6;">You can pay this invoice by replying to this email or following our standard payment procedures.</p>
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
        return res.status(400).json({ error });
      }

      res.json({ success: true, data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to generate PDF or send email." });
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
