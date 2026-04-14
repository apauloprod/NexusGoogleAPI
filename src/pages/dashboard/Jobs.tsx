import React, { useState, useEffect } from "react";
import { 
  Plus, 
  CheckSquare,
  ArrowUpRight,
  User as UserIcon,
  Clock,
  MessageSquare,
  ImageIcon,
  MoreVertical,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db, handleFirestoreError, OperationType, auth } from "../../firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, serverTimestamp, getDoc } from "firebase/firestore";

import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { JobForm } from "../../components/forms/JobForm";
import { MediaUpload } from "../../components/MediaUpload";
import { cn } from "@/lib/utils";

const Jobs = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [viewingMediaJob, setViewingMediaJob] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setJobs(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "jobs");
    });
    return () => unsubscribe();
  }, []);

  const convertToInvoice = async (job: any) => {
    try {
      let invoiceNumber = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
      if (job.quoteNumber) {
        // Extract the numeric part from Q-0001 and use it for INV-0001
        const match = job.quoteNumber.match(/\d+/);
        if (match) {
          invoiceNumber = `INV-${match[0]}`;
        }
      }

      const clientDoc = await getDoc(doc(db, "clients", job.clientId));
      const clientData = clientDoc.exists() ? clientDoc.data() : null;

      const invoiceData = {
        invoiceNumber: invoiceNumber,
        clientId: job.clientId,
        clientName: job.clientName,
        total: job.total || 0,
        items: job.items || [],
        status: "sent",
        paidAmount: 0,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        jobId: job.id,
        quoteNumber: job.quoteNumber || "",
        notes: job.notes || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "invoices"), invoiceData);
      const invoiceId = docRef.id;

      // Log activity
      await addDoc(collection(db, "activities"), {
        description: `Generated invoice ${invoiceNumber} for ${job.title}`,
        userName: auth.currentUser?.displayName || "User",
        userId: auth.currentUser?.uid,
        createdAt: serverTimestamp()
      });
      
      // Send Email with PDF
      if (clientData?.email) {
        try {
          const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
          
          if (!window.location.hostname.includes("github.io") || import.meta.env.VITE_API_URL) {
            await fetch(`${apiUrl}/api/send-invoice`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                invoice: { id: invoiceId, ...invoiceData, dueDate: invoiceData.dueDate.toISOString() },
                clientEmail: clientData.email,
                appUrl: window.location.origin,
              }),
            });
            console.log("Invoice email sent successfully");
          }
        } catch (emailErr) {
          console.error("Failed to send invoice email:", emailErr);
        }
      }

      // Update job status
      const jobRef = doc(db, "jobs", job.id);
      await updateDoc(jobRef, {
        status: "completed",
        updatedAt: serverTimestamp(),
      });

      // Update client status to returning
      const clientRef = doc(db, "clients", job.clientId);
      await updateDoc(clientRef, {
        status: "returning",
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "invoices");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Completed</Badge>;
      case 'on-hold':
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">On Hold</Badge>;
      case 'cancelled':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Cancelled</Badge>;
      default:
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Active</Badge>;
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">Jobs</h1>
          <p className="text-muted-foreground">Track ongoing work, checklists, and project progress.</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-white text-black hover:bg-white/90 rounded-xl gap-2 font-bold">
              <Plus className="h-4 w-4" />
              New Job
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold tracking-tighter">Create New Job</DialogTitle>
            </DialogHeader>
            <div className="pt-4">
              <JobForm 
                onSuccess={() => setIsAddDialogOpen(false)} 
                onCancel={() => setIsAddDialogOpen(false)} 
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!editingJob} onOpenChange={(open) => !open && setEditingJob(null)}>
        <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tighter">Edit Job</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            {editingJob && (
              <JobForm 
                initialData={editingJob}
                onSuccess={() => setEditingJob(null)} 
                onCancel={() => setEditingJob(null)} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingMediaJob} onOpenChange={(open) => !open && setViewingMediaJob(null)}>
        <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tighter">Job Media</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            {viewingMediaJob && (
              <MediaUpload 
                jobId={viewingMediaJob.id} 
                onClose={() => setViewingMediaJob(null)} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">
        {loading ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground">Loading jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground glass rounded-2xl border-white/5">No active jobs found.</div>
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="p-6 rounded-2xl glass border-white/5 flex items-center justify-between hover:border-white/10 transition-colors group">
              <div className="flex items-center gap-6">
                <div className="h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <CheckSquare className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-lg">{job.title}</h3>
                    {getStatusBadge(job.status)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" /> {job.clientName}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Last updated {job.updatedAt?.toDate().toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-lg font-bold text-white">
                    ${job.total?.toLocaleString() || "0.00"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {job.items?.length || 0} items
                  </p>
                </div>
                <div className="h-8 w-px bg-white/5 mx-2" />
                <div className="flex items-center gap-2">
                  {job.status !== 'completed' && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs gap-1 hover:text-emerald-500"
                      onClick={() => convertToInvoice(job)}
                    >
                      <FileText className="h-3 w-3" />
                      Invoice
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-white"
                    onClick={() => setViewingMediaJob(job)}
                  >
                    <ImageIcon className="h-5 w-5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-white"
                    onClick={() => setEditingJob(job)}
                  >
                    <ArrowUpRight className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Jobs;
