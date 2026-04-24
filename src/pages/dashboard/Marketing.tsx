import React, { useState, useEffect, useContext } from "react";
import { 
  Sparkles, 
  Play, 
  Download, 
  Share2, 
  Clock, 
  CheckCircle2,
  ImageIcon,
  Video,
  Plus,
  Loader2,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, onSnapshot, query, where, orderBy, doc, getDoc, updateDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI, Type } from "@google/genai";
import { AuthContext } from "../../App";
import { useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";

const Marketing = () => {
  const { currentUserData, impersonatedUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const role = impersonatedUser?.role || currentUserData?.role || 'team';
  const isManagerOrAdmin = role === 'admin' || role === 'manager' || role === 'super-admin';

  const permissions = impersonatedUser?.permissions || currentUserData?.permissions || {};
  const hasAccess = isManagerOrAdmin || permissions.page_marketing;

  useEffect(() => {
    if (!hasAccess) {
      navigate("/dashboard");
    }
  }, [hasAccess, navigate]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingVeo, setIsGeneratingVeo] = useState(false);
  const [montagePlan, setMontagePlan] = useState<any>(null);
  const [veoVideoUrl, setVeoVideoUrl] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const generateVeoVideo = async (job: any) => {
    setIsGeneratingVeo(true);
    setMontagePlan(null);
    setVeoVideoUrl(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `A professional marketing video for a service business. 
        The video should showcase: ${job.title}. 
        Client: ${job.clientName}. 
        Style: High-end, cinematic, clean, showcasing professional service work. 
        Include text overlays about quality and reliability.`;

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-lite-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: '1080p',
          aspectRatio: '16:9'
        }
      }) as any;

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.get(operation.id || operation.name);
      }

      if (operation.response?.videos?.[0]?.uri) {
        setVeoVideoUrl(operation.response.videos[0].uri);
      }
    } catch (error) {
      console.error("Veo error:", error);
      alert("Failed to generate cinematic video. Try the AI Montage instead.");
    } finally {
      setIsGeneratingVeo(false);
    }
  };

  useEffect(() => {
    if (!currentUserData?.businessId && !impersonatedUser?.businessId) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;

    const q = query(
      collection(db, "jobs"), 
      where("businessId", "==", businessId),
      where("status", "==", "completed"),
      orderBy("updatedAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setJobs(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "jobs");
    });
    return () => unsubscribe();
  }, [currentUserData?.businessId, impersonatedUser?.businessId]);

  const generateMontage = async (job: any) => {
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // In a real app, we'd send the actual media URLs to Gemini.
      // For now, we'll simulate the analysis based on job details and mock media.
      const prompt = `
        You are a marketing expert for a service business. 
        Create a 15-second video montage plan for a completed job: "${job.title}" for client "${job.clientName}".
        The job involved: ${job.items?.map((i: any) => i.description).join(", ")}.
        
        Return a JSON object with:
        1. "vibe": A string describing the visual style (e.g., "Professional & Clean", "Energetic & Fast-paced").
        2. "musicPrompt": A prompt for a background track (e.g., "Upbeat corporate acoustic with a positive build").
        3. "slides": An array of 4-6 objects, each with:
           - "type": "image" or "video"
           - "caption": A short, punchy marketing caption
           - "duration": Duration in seconds (total should be ~15s)
           - "animation": "fade", "zoom-in", "slide-left"
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              vibe: { type: Type.STRING },
              musicPrompt: { type: Type.STRING },
              slides: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, enum: ["image", "video"] },
                    caption: { type: Type.STRING },
                    duration: { type: Type.NUMBER },
                    animation: { type: Type.STRING, enum: ["fade", "zoom-in", "slide-left"] }
                  },
                  required: ["type", "caption", "duration", "animation"]
                }
              }
            },
            required: ["vibe", "musicPrompt", "slides"]
          }
        }
      });

      const plan = JSON.parse(response.text);
      
      // Add mock media URLs to the plan
      const mediaPool = [
        "https://picsum.photos/seed/job1/1920/1080",
        "https://picsum.photos/seed/job2/1920/1080",
        "https://picsum.photos/seed/job3/1920/1080",
        "https://picsum.photos/seed/job4/1920/1080",
        "https://picsum.photos/seed/job5/1920/1080",
        "https://picsum.photos/seed/job6/1920/1080",
      ];

      plan.slides = plan.slides.map((slide: any, i: number) => ({
        ...slide,
        url: job.media?.[i]?.url || mediaPool[i % mediaPool.length]
      }));

      setMontagePlan(plan);
      setSelectedJob(job);
      setCurrentSlide(0);
      setIsPlaying(true);
    } catch (error) {
      console.error("Error generating montage:", error);
      alert("Failed to generate montage. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    let timer: any;
    if (isPlaying && montagePlan) {
      const currentDuration = montagePlan.slides[currentSlide].duration * 1000;
      timer = setTimeout(() => {
        if (currentSlide < montagePlan.slides.length - 1) {
          setCurrentSlide(prev => prev + 1);
        } else {
          setIsPlaying(false);
        }
      }, currentDuration);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentSlide, montagePlan]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">AI Marketing</h1>
          <p className="text-muted-foreground">Turn your completed jobs into high-impact marketing videos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Completed Jobs
          </h2>
          <div className="grid gap-3">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground glass rounded-2xl border-white/5">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading jobs...
              </div>
            ) : jobs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground glass rounded-2xl border-white/5">
                No completed jobs found.
              </div>
            ) : (
              jobs.map((job) => (
                <div 
                  key={job.id} 
                  className={cn(
                    "p-4 rounded-2xl glass border-white/5 cursor-pointer transition-all hover:border-white/20",
                    selectedJob?.id === job.id ? "border-white/30 bg-white/5" : ""
                  )}
                  onClick={() => generateMontage(job)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold truncate pr-2">{job.title}</h3>
                    <Sparkles className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <span>{job.clientName}</span>
                    <span>{job.updatedAt?.toDate().toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 h-8 text-[10px] uppercase font-bold border-white/10 hover:bg-white/5"
                      onClick={(e) => {
                        e.stopPropagation();
                        generateMontage(job);
                      }}
                      disabled={isGenerating || isGeneratingVeo}
                    >
                      AI Montage
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 h-8 text-[10px] uppercase font-bold border-white/10 hover:bg-white/5"
                      onClick={(e) => {
                        e.stopPropagation();
                        generateVeoVideo(job);
                      }}
                      disabled={isGenerating || isGeneratingVeo}
                    >
                      Cinematic
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="aspect-video glass rounded-[2.5rem] border-white/5 overflow-hidden relative flex items-center justify-center bg-black/40 group">
            {isGenerating || isGeneratingVeo ? (
              <div className="text-center space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 blur-2xl bg-amber-500/20 animate-pulse" />
                  <Loader2 className="h-12 w-12 animate-spin mx-auto text-amber-500 relative" />
                </div>
                <div>
                  <p className="text-xl font-bold tracking-tighter">
                    {isGenerating ? "Gemini is crafting your montage..." : "Veo is generating your cinematic video..."}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isGenerating ? "Analyzing job photos and generating marketing copy" : "This may take a minute. We're creating a high-end marketing asset."}
                  </p>
                </div>
              </div>
            ) : veoVideoUrl ? (
              <>
                <video 
                  src={veoVideoUrl} 
                  controls 
                  autoPlay 
                  loop 
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-6 right-6 flex gap-2">
                  <Button size="sm" className="bg-white text-black hover:bg-white/90 rounded-xl gap-2 font-bold">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </div>
              </>
            ) : montagePlan ? (
              <>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlide}
                    initial={{ opacity: 0, scale: montagePlan.slides[currentSlide].animation === 'zoom-in' ? 1.1 : 1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute inset-0"
                  >
                    <img 
                      src={montagePlan.slides[currentSlide].url} 
                      alt="Montage Slide"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="absolute bottom-12 left-12 right-12"
                    >
                      <Badge className="mb-4 bg-white/10 backdrop-blur-md border-white/20 text-[10px] uppercase tracking-[0.2em]">
                        {selectedJob?.title}
                      </Badge>
                      <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white drop-shadow-2xl leading-tight">
                        {montagePlan.slides[currentSlide].caption}
                      </h2>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>

                {/* Progress Bar */}
                <div className="absolute top-6 left-6 right-6 flex gap-1.5 z-20">
                  {montagePlan.slides.map((_, i) => (
                    <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: i < currentSlide ? "100%" : i === currentSlide ? "100%" : "0%" }}
                        transition={{ duration: i === currentSlide ? montagePlan.slides[i].duration : 0.1, ease: "linear" }}
                        className="h-full bg-white"
                      />
                    </div>
                  ))}
                </div>

                {/* Controls Overlay */}
                <div className="absolute inset-0 flex items-center justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-12 w-12 rounded-full bg-black/20 backdrop-blur-md border border-white/10"
                    onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-12 w-12 rounded-full bg-black/20 backdrop-blur-md border border-white/10"
                    onClick={() => {
                      if (currentSlide < montagePlan.slides.length - 1) {
                        setCurrentSlide(prev => prev + 1);
                      } else {
                        setCurrentSlide(0);
                        setIsPlaying(true);
                      }
                    }}
                  >
                    {currentSlide === montagePlan.slides.length - 1 ? <Play className="h-6 w-6" /> : <ChevronRight className="h-6 w-6" />}
                  </Button>
                </div>

                <div className="absolute bottom-6 right-6 flex gap-2">
                  <Button size="sm" className="bg-white text-black hover:bg-white/90 rounded-xl gap-2 font-bold">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                  <Button size="sm" variant="outline" className="glass border-white/10 rounded-xl gap-2 font-bold">
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center space-y-4">
                <div className="h-20 w-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                  <Play className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold tracking-tighter">Select a job to generate a montage</p>
                  <p className="text-sm text-muted-foreground">We'll use AI to create a professional marketing video from your job photos.</p>
                </div>
              </div>
            )}
          </div>

          {montagePlan && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="p-6 rounded-3xl glass border-white/5">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  AI Creative Direction
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Visual Vibe</p>
                    <p className="font-bold text-lg">{montagePlan.vibe}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Music Style</p>
                    <p className="font-bold">{montagePlan.musicPrompt}</p>
                  </div>
                </div>
              </div>
              <div className="p-6 rounded-3xl glass border-white/5">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Montage Timeline
                </h3>
                <div className="space-y-3">
                  {montagePlan.slides.map((slide: any, i: number) => (
                    <div 
                      key={i} 
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-xl transition-colors",
                        currentSlide === i ? "bg-white/10" : ""
                      )}
                    >
                      <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{slide.caption}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">{slide.duration}s • {slide.animation}</p>
                      </div>
                      {currentSlide === i && (
                        <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Marketing;
