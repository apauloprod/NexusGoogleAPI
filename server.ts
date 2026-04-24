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
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

// Initialize Firebase in Server
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let db: any = null;
if (fs.existsSync(firebaseConfigPath)) {
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

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

  // API Route to receive lead webhooks (from Facebook Ads, Zapier, Instagram)
  app.post("/api/webhook/leads/:businessId", async (req, res) => {
    const { businessId } = req.params;
    const data = req.body;
    
    console.log(`[WEBHOOK] Received lead for business ${businessId}`, data);
    
    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }

    try {
      // Map common ad webhook fields to standard request format
      const formattedRequest = {
        name: data.full_name || data.name || data.firstName || "New Lead",
        email: data.email || null,
        phone: data.phone || data.phone_number || null,
        address: data.city || data.address || null,
        services: data.interested_in ? [data.interested_in] : [],
        notes: `Source: ${data.source || "Ad Campaign"}\n${data.notes || ""}`,
        status: "pending",
        businessId: businessId,
        source: data.source || "Marketing Campaign",
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "requests"), formattedRequest);

      // If it's a Nexus CRM inquiry or has direct email flag, notify super admin
      if (resend && (businessId === "nexus-crm-id" || data._direct_email)) {
        const targetEmail = data._direct_email || "apauloprod@gmail.com";
        console.log(`[WEBHOOK] Sending notification email to ${targetEmail}`);
        
        await resend.emails.send({
          from: "Nexus CRM <onboarding@resend.dev>",
          to: targetEmail,
          subject: `New Nexus CRM Inquiry: ${formattedRequest.name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
              <h2 style="font-size: 24px; font-weight: bold; tracking-tighter: -0.025em; border-bottom: 2px solid #EEE; padding-bottom: 12px;">New Inquiry Received</h2>
              <div style="margin-top: 24px; space-y: 12px;">
                <p><strong>Name:</strong> ${formattedRequest.name}</p>
                <p><strong>Email:</strong> ${formattedRequest.email}</p>
                <p><strong>Phone:</strong> ${formattedRequest.phone}</p>
                <p><strong>Interest:</strong> ${data.interested_in || 'General Exploration'}</p>
                <p><strong>Notes:</strong><br/> ${formattedRequest.notes}</p>
              </div>
              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #EEE; font-size: 12px; color: #666;">
                <p>Sent from your Nexus CRM Landing Page</p>
              </div>
            </div>
          `
        });
      }

      res.json({ success: true, id: docRef.id });
    } catch (err: any) {
      console.error("[WEBHOOK ERROR]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // API Route to send quote email
  app.get("/api/send-quote", (req, res) => {
    console.log("GET /api/send-quote hit");
    res.json({ status: "alive", method: "GET", path: "/api/send-quote", message: "Use POST to send quotes." });
  });

  app.get("/api/send-invoice", (req, res) => {
    console.log("GET /api/send-invoice hit");
    res.json({ status: "alive", method: "GET", path: "/api/send-invoice", message: "Use POST to send invoices." });
  });

  // Helper for PDF generation server-side
  const generatePDFDocument = (type: 'INVOICE' | 'QUOTE', data: any, layout: string = 'classic') => {
    const doc = new jsPDF();
    const { businessName, businessLogo, businessDetails, items, total, notes } = data;
    const number = type === 'INVOICE' ? data.invoiceNumber : data.quoteNumber;
    const date = new Date().toLocaleDateString();
    
    if (layout === 'modern') {
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, 210, 60, 'F');
      if (businessLogo) {
        try { doc.addImage(businessLogo, 'PNG', 20, 10, 25, 25); } catch(e) {}
      }
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text(type, 190, 25, { align: "right" });
      doc.setFontSize(10);
      doc.text(`#${number}`, 190, 32, { align: "right" });
      doc.text(`Date: ${date}`, 190, 38, { align: "right" });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.text(businessName || "Your Company", 20, 75);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      if (businessDetails) {
        const detailsLines = doc.splitTextToSize(businessDetails, 80);
        doc.text(detailsLines, 20, 82);
      }
      doc.setFont("helvetica", "bold");
      doc.text("TO CLIENT", 120, 75);
      doc.setFont("helvetica", "normal");
      doc.text(data.clientName, 120, 82);

      autoTable(doc, {
        startY: 105,
        head: [['Description', 'Amount']],
        body: (items || []).map((it: any) => [it.description, `$${(it.price || it.unitPrice || 0).toLocaleString()}`]),
        foot: [['Total', `$${(total || 0).toLocaleString()}`]],
        theme: 'striped',
        headStyles: { fillColor: [0, 0, 0] },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
      });
    } else if (layout === 'minimal') {
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text((businessName || "Your Company").toUpperCase(), 20, 20);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(32);
      doc.text(`$${(total || 0).toLocaleString()}`, 20, 40);
      doc.setFontSize(10);
      doc.text(`${type} #${number}`, 20, 48);
      doc.setDrawColor(240);
      doc.line(20, 60, 190, 60);
      doc.text("CLIENT", 20, 75);
      doc.setFont("helvetica", "bold");
      doc.text(data.clientName, 20, 82);
      doc.setFont("helvetica", "normal");
      doc.text("DATE", 120, 75);
      doc.setFont("helvetica", "bold");
      doc.text(date, 120, 82);

      autoTable(doc, {
        startY: 100,
        head: [['ITEM', 'PRICE']],
        body: (items || []).map((it: any) => [(it.description || 'Service').toUpperCase(), `$${(it.price || it.unitPrice || 0).toLocaleString()}`]),
        theme: 'plain',
        headStyles: { textColor: [150, 150, 150], fontStyle: 'normal' },
        styles: { fontSize: 9 }
      });
    } else {
      // Classic
      if (businessLogo) {
        try { doc.addImage(businessLogo, 'PNG', 20, 10, 30, 30); } catch (e) {}
      }
      doc.setFontSize(22);
      doc.text(type, 200, 20, { align: "right" });
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(businessName || "Service Provider", 20, 45);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      if (businessDetails) {
        const detailsLines = doc.splitTextToSize(businessDetails, 80);
        doc.text(detailsLines, 20, 52);
      }
      doc.setFontSize(12);
      doc.text(`${type === 'INVOICE' ? 'Invoice' : 'Quote'} Number: ${number}`, 200, 45, { align: "right" });
      doc.text(`Date: ${date}`, 200, 52, { align: "right" });
      doc.setDrawColor(200);
      doc.line(20, 80, 200, 80);
      doc.setFont("helvetica", "bold");
      doc.text("Bill To:", 20, 90);
      doc.setFont("helvetica", "normal");
      doc.text(data.clientName, 20, 97);
      autoTable(doc, {
        startY: 110,
        head: [['Description', 'Price']],
        body: (items || []).map((item: any) => [item.description, `$${(item.price || item.unitPrice || 0).toLocaleString()}`]),
        foot: [['Total', `$${(total || 0).toLocaleString()}`]],
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
      });
    }

    if (notes) {
      const finalY = (doc as any).lastAutoTable?.finalY || 110;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Notes:", 20, finalY + 15);
      doc.setFont("helvetica", "normal");
      doc.text(notes, 20, finalY + 22, { maxWidth: 170 });
    }

    return doc.output("datauristring").split(",")[1];
  };

  app.post("/api/send-quote", async (req, res) => {
    console.log("Received request to send quote email:", req.body?.quote?.quoteNumber);
    const { quote, clientEmail, appUrl, layout = 'classic' } = req.body;
    const { businessName, businessDetails, businessLogo } = quote;

    if (!resend) {
      return res.status(500).json({ error: "Email service not configured. Please add RESEND_API_KEY to environment variables." });
    }

    try {
      // 1. Generate PDF
      const pdfBase64 = generatePDFDocument('QUOTE', quote, layout);

      // 2. Send Email
      const approvalUrl = `${appUrl}/#/quote/${quote.id}/approve`;
      const paymentUrl = `${appUrl}/#/pay?type=quote&id=${quote.id}`;
      
      const { data, error } = await resend.emails.send({
        from: "CRM <onboarding@resend.dev>", 
        to: [clientEmail],
        subject: `Quote #${quote.quoteNumber} from ${businessName || "CRM"}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
              <div>
                <h1 style="margin: 0; color: #333;">${businessName || "Quote"}</h1>
                <p style="color: #666; font-size: 14px; white-space: pre-line;">${businessDetails || ""}</p>
              </div>
              ${businessLogo ? `<img src="${businessLogo}" style="height: 64px; object-fit: contain;" />` : ""}
            </div>
            <h2 style="color: #333;">Hello ${quote.clientName},</h2>
            <p style="color: #555; line-height: 1.6;">Please find the attached quote <strong>#${quote.quoteNumber}</strong> for the requested services.</p>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #888; text-transform: uppercase;">Total Amount</p>
              <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold; color: #000;">$${(quote.total || quote.totalHT || 0).toLocaleString()}</p>
            </div>
            <p style="color: #555; line-height: 1.6;">To proceed with this work, please click the button below to approve the quote online:</p>
            <div style="margin: 20px 0;">
              <a href="${approvalUrl}" style="display: inline-block; background: #000; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-right: 10px;">Approve Quote Online</a>
              ${quote.paymentRequired ? `<a href="${paymentUrl}" style="display: inline-block; background: #fff; color: #000; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; border: 1px solid #000;">Pay Deposit</a>` : ""}
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
    const { invoice, clientEmail, appUrl, layout = 'classic' } = req.body;
    const { businessName, businessDetails, businessLogo } = invoice;
    console.log(`[INVOICE API] Request received for Invoice #${invoice?.invoiceNumber} to ${clientEmail}`);
    
    if (!resend) {
      console.error("[INVOICE API] Resend not configured");
      return res.status(500).json({ error: "Email service not configured. Please add RESEND_API_KEY to environment variables." });
    }

    try {
      // 1. Generate PDF
      console.log("[INVOICE API] Generating PDF...");
      const pdfBase64 = generatePDFDocument('INVOICE', invoice, layout);
      console.log("[INVOICE API] PDF generated successfully");

      // 2. Send Email
      console.log("[INVOICE API] Sending email via Resend...");
      const paymentUrl = `${appUrl}/#/pay?type=invoice&id=${invoice.id}`;
      const dueDateStr = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "N/A";
      
      const { data, error } = await resend.emails.send({
        from: "CRM <onboarding@resend.dev>",
        to: [clientEmail],
        subject: `Invoice #${invoice.invoiceNumber} from ${businessName || "CRM"}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
              <div>
                <h1 style="margin: 0; color: #333;">${businessName || "Invoice"}</h1>
                <p style="color: #666; font-size: 14px; white-space: pre-line;">${businessDetails || ""}</p>
              </div>
              ${businessLogo ? `<img src="${businessLogo}" style="height: 64px; object-fit: contain;" />` : ""}
            </div>
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
    const { amount, currency, description, metadata, successUrl, cancelUrl, businessStripeKey } = req.body;

    // Use individual business key if provided, fallback to global environment key
    const effectiveStripeKey = businessStripeKey || process.env.STRIPE_SECRET_KEY;
    
    if (!effectiveStripeKey) {
      return res.status(500).json({ error: "Stripe not configured. The business owner has not connected Stripe." });
    }

    try {
      const customStripe = new Stripe(effectiveStripeKey);
      
      const session = await customStripe.checkout.sessions.create({
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

  // AI Business Analysis Endpoint
  app.post("/api/ai/analyze", async (req, res) => {
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error("[AI ERROR] GEMINI_API_KEY is missing from environment");
      return res.status(500).json({ error: "Gemini API key not configured on server. Contact support." });
    }

    console.log(`[AI DEBUG] Analyze: Key Prefix: ${apiKey.substring(0, 4)}... Length: ${apiKey.length}`);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      res.json({ text: response.text() });
    } catch (err: any) {
      console.error("[AI ERROR] Business Analysis failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // AI Marketing Montage Endpoint
  app.post("/api/ai/generate-montage", async (req, res) => {
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("[AI ERROR] GEMINI_API_KEY is missing from environment");
      return res.status(500).json({ error: "Gemini API key not configured on server. Contact support." });
    }

    console.log(`[AI DEBUG] Montage: Key Prefix: ${apiKey.substring(0, 4)}... Length: ${apiKey.length}`);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      // Clean result text to ensure it's valid JSON
      const text = response.text().replace(/```json|```/g, '').trim();
      res.json({ plan: JSON.parse(text) });
    } catch (err: any) {
      console.error("[AI ERROR] Montage Generation failed:", err);
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
