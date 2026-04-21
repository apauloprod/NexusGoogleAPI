import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { 
  Plus, 
  CheckSquare,
  ArrowUpRight,
  User as UserIcon,
  Clock,
  MessageSquare,
  ImageIcon,
  MoreVertical,
  FileText,
  Search,
  Filter,
  Phone,
  MapPin,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AuthContext } from "../../App";
import { useContext } from "react";
import { db, handleFirestoreError, OperationType, auth } from "../../firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, serverTimestamp, getDoc, where, limit, Timestamp, getDocs, deleteDoc } from "firebase/firestore";

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



import { formatPhoneNumber } from "../../lib/phone";

const Jobs = () => {
  const { user, currentUserData, impersonatedUser } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [viewingMediaJob, setViewingMediaJob] = useState<any>(null);
  const [isConverting, setIsConverting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState("all");

  const role = impersonatedUser?.role || currentUserData?.role || 'team';
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isManagerOrAdmin = isAdmin || isManager;
  
  const permissions = currentUserData?.permissions || {};
  const canCreateJob = isAdmin || isManager || permissions.canCreateJob;
  const canEditJob = isAdmin || isManager || permissions.canEditJob;
  const canCreateInvoice = isAdmin || isManager || permissions.canCreateInvoice;

  const handleDelete = async (id: string) => {
    if (!isManagerOrAdmin) {
      alert("You do not have permission to delete jobs. Only Admins and Managers can delete.");
      return;
    }
    if (!confirm("Are you sure you want to delete this job?")) return;
    try {
      await deleteDoc(doc(db, "jobs", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "jobs");
    }
  };

  useEffect(() => {
    const search = searchParams.get("search");
    if (search) {
      setSearchTerm(search);
    }
  }, [searchParams]);
  useEffect(() => {
    if (!user || (!currentUserData?.businessId && !impersonatedUser?.businessId)) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;

    // Fetch team members to resolve names
    const teamQ = query(collection(db, "users"), where("businessId", "==", businessId));
    getDocs(teamQ).then(snap => {
      setTeamMembers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const q = query(
      collection(db, "jobs"), 
      where("businessId", "==", businessId),
      orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setJobs(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "jobs");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, currentUserData?.businessId, impersonatedUser?.businessId]);

  const convertToInvoice = async (job: any) => {
    setIsConverting(job.id);
    try {
      const businessId = impersonatedUser?.businessId || currentUserData.businessId;
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
        businessId,
        total: job.total || 0,
        items: (job.items || []).map((i: any) => ({
          description: i.description || "",
          price: i.price || i.unitPrice || 0
        })),
        status: "sent",
        paidAmount: 0,
        dueDate: Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
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
          await fetch(`/api/send-invoice`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invoice: { id: invoiceId, ...invoiceData, dueDate: invoiceData.dueDate.toDate().toISOString() },
              clientEmail: clientData.email,
              appUrl: window.location.origin,
            }),
          });
          console.log("Invoice email sent successfully");
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
    } finally {
      setIsConverting(null);
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

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          job.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          job.quoteNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          job.id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    
    if (!matchesSearch || !matchesStatus) return false;

    // Privacy Logic:
    const role = impersonatedUser?.role || currentUserData?.role || 'staff';
    const visibility = currentUserData?.jobVisibility || 'all';
    const currentUserId = impersonatedUser?.uid || user?.uid;

    if (role !== 'admin' && role !== 'manager' && visibility === 'own') {
      return (job.assignedTeam || []).includes(currentUserId);
    }

    return true;
  }).sort((a, b) => {
    const dateA = a.scheduledAt ? a.scheduledAt.toDate().getTime() : Number.MAX_SAFE_INTEGER;
    const dateB = b.scheduledAt ? b.scheduledAt.toDate().getTime() : Number.MAX_SAFE_INTEGER;
    if (dateA !== dateB) return dateA - dateB;
    return (a.clientName || "").localeCompare(b.clientName || "");
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">Jobs</h1>
          <p className="text-muted-foreground">Track ongoing work, checklists, and project progress.</p>
        </div>
        {canCreateJob && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white text-black hover:bg-white/90 rounded-xl gap-2 font-bold">
                <Plus className="h-4 w-4" />
                New Job
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black border-white/10 text-white sm:max-w-[700px] rounded-[2rem] max-h-[90vh] overflow-y-auto">
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
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by title, client, or quote number..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white/5 border-white/10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-white/5 border-white/10">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="bg-black border-white/10">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on-hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
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
        ) : filteredJobs.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground glass rounded-2xl border-white/5">No jobs found matching your criteria.</div>
        ) : (
          filteredJobs.map((job) => (
            <div key={job.id} className="p-6 rounded-2xl glass border-white/5 flex items-center justify-between hover:border-white/10 transition-colors group">
              <div className="flex items-center gap-6">
                <div className="h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <CheckSquare className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-lg">
                      {job.items?.[0]?.description ? `${job.items[0].description}${job.items.length > 1 ? ` (+${job.items.length - 1} more)` : ''} - ` : ''}
                      {job.clientName}
                    </h3>
                    {getStatusBadge(job.status)}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="h-3 w-3" /> 
                      {job.scheduledAt ? job.scheduledAt.toDate().toLocaleString() : "Unscheduled"}
                    </span>
                    {job.clientPhone && (
                      <span className="flex items-center gap-1 border-l border-white/10 pl-4">
                        <Phone className="h-3 w-3 text-cyan-400" />
                        {formatPhoneNumber(job.clientPhone)}
                      </span>
                    )}
                    {job.clientAddress && (
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.clientAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 border-l border-white/10 pl-4 hover:text-cyan-400 transition-colors"
                      >
                        <MapPin className="h-3 w-3 text-cyan-400" />
                        {job.clientAddress}
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground mt-2">
                    <div className="flex -space-x-2 mr-2">
                      {(job.assignedTeam || []).map((memberId: string) => {
                        const member = teamMembers.find(m => m.id === memberId);
                        return (
                          <div 
                            key={memberId} 
                            title={member?.displayName || member?.email || memberId}
                            className="h-6 w-6 rounded-full border-2 border-black bg-white/10 flex items-center justify-center overflow-hidden"
                          >
                            {member?.photoURL ? (
                              <img src={member.photoURL} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                            ) : (
                              <UserIcon className="h-3 w-3" />
                            )}
                          </div>
                        );
                      })}
                      {(job.assignedTeam || []).length === 0 && <span className="text-[10px] italic">No team assigned</span>}
                    </div>
                    {(job.assignedTeam || []).length > 0 && (
                      <span className="text-[10px] font-medium text-blue-400">
                        {(job.assignedTeam || []).map((id: string) => {
                          const m = teamMembers.find(tm => tm.id === id);
                          return m?.displayName || m?.email?.split('@')[0] || id;
                        }).join(", ")}
                      </span>
                    )}
                  </div>
                  {job.quoteNumber && (
                    <div className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1">
                      Quote reference: 
                      {(impersonatedUser?.role || currentUserData?.role) === 'admin' ? (
                        <Link to={`/dashboard/quotes?search=${job.quoteNumber}`} className="text-cyan-400 hover:underline font-medium">
                          {job.quoteNumber}
                        </Link>
                      ) : (
                        <span className="font-medium">{job.quoteNumber}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
                  <div className="flex items-center gap-6">
                {isManagerOrAdmin && (
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">
                      ${job.total?.toLocaleString() || "0.00"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {job.items?.length || 0} items
                    </p>
                  </div>
                )}
                <div className="h-8 w-px bg-white/5 mx-2" />
                <div className="flex items-center gap-2">
                  {job.status !== 'completed' && canCreateInvoice && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs gap-1 hover:text-emerald-500"
                      onClick={() => convertToInvoice(job)}
                      disabled={isConverting === job.id}
                    >
                      <FileText className="h-3 w-3" />
                      {isConverting === job.id ? "Processing..." : "Invoice & Complete Job"}
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
                  {canEditJob && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-white"
                      onClick={() => setEditingJob(job)}
                    >
                      <ArrowUpRight className="h-5 w-5" />
                    </Button>
                  )}
                  {isManagerOrAdmin && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(job.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
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
