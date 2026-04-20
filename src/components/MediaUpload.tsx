import React, { useState, useEffect } from "react";
import { 
  Upload, 
  X, 
  ImageIcon, 
  Video, 
  Loader2, 
  CheckCircle2,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { storage, db, handleFirestoreError, OperationType } from "../firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { AuthContext } from "../App";

interface MediaUploadProps {
  jobId: string;
  onClose?: () => void;
}

export const MediaUpload: React.FC<MediaUploadProps> = ({ jobId, onClose }) => {
  const { currentUserData, impersonatedUser } = React.useContext(AuthContext);
  const currentRole = impersonatedUser?.role || currentUserData?.role || 'team';
  const isManagerOrAdmin = currentRole === 'admin' || currentRole === 'manager';

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [existingMedia, setExistingMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const jobDoc = await getDoc(doc(db, "jobs", jobId));
        if (jobDoc.exists()) {
          setExistingMedia(jobDoc.data().media || []);
        }
      } catch (error) {
        console.error("Error fetching media:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMedia();
  }, [jobId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;
    setUploading(true);

    try {
      for (const file of files) {
        const storageRef = ref(storage, `jobs/${jobId}/${Date.now()}_${file.name}`);
        
        console.log(`Attempting to upload ${file.name} to ${storageRef.fullPath}...`);
        
        try {
          const snapshot = await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(snapshot.ref);
          
          const mediaItem = {
            url: downloadURL,
            name: file.name,
            type: file.type.startsWith("video") ? "video" : "image",
            createdAt: new Date().toISOString(),
            storagePath: storageRef.fullPath
          };
          
          await updateDoc(doc(db, "jobs", jobId), {
            media: arrayUnion(mediaItem)
          });
          
          setExistingMedia(prev => [...prev, mediaItem]);
        } catch (err: any) {
          console.error(`Error uploading ${file.name}:`, err);
          if (err.code === 'storage/unauthorized') {
            alert(`Upload failed for ${file.name}: Unauthorized. Please check your storage rules.`);
          } else if (err.message?.includes('CORS')) {
            alert(`Upload failed for ${file.name}: CORS error. Please ensure your Firebase Storage bucket allows uploads from this domain.`);
          } else {
            alert(`Upload failed for ${file.name}: ${err.message || 'Unknown error'}`);
          }
          throw err; // Stop the loop if one fails
        }
      }
      setFiles([]);
    } catch (error) {
      console.error("Batch upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  const deleteMedia = async (item: any) => {
    try {
      if (item.storagePath) {
        const storageRef = ref(storage, item.storagePath);
        await deleteObject(storageRef);
      }
      await updateDoc(doc(db, "jobs", jobId), {
        media: arrayRemove(item)
      });
      setExistingMedia(prev => prev.filter(m => m.url !== item.url));
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete media.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full h-32 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading media...
          </div>
        ) : existingMedia.length === 0 ? (
          <div className="col-span-full h-32 flex flex-col items-center justify-center text-muted-foreground glass rounded-2xl border-white/5 border-dashed">
            <ImageIcon className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm">No media uploaded yet</p>
          </div>
        ) : (
          existingMedia.map((item, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden group glass border-white/5">
              {item.type === "video" ? (
                <div className="w-full h-full bg-black flex items-center justify-center">
                  <Video className="h-8 w-8 text-white/50" />
                </div>
              ) : (
                <img src={item.url} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {isManagerOrAdmin && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-white hover:text-red-400"
                    onClick={() => deleteMedia(item)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-6 rounded-2xl border-2 border-dashed border-white/10 bg-white/5 hover:bg-white/10 transition-colors relative">
        <input 
          type="file" 
          multiple 
          accept="image/*,video/*" 
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <div className="text-center">
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-bold">Click or drag to upload job media</p>
          <p className="text-xs text-muted-foreground mt-1">Images and videos for marketing montages</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">{files.length} files selected</p>
            <Button 
              size="sm" 
              className="bg-white text-black hover:bg-white/90 rounded-xl font-bold"
              onClick={uploadFiles}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? "Uploading..." : "Start Upload"}
            </Button>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
            {files.map((file, i) => (
              <div key={i} className="flex items-center gap-3 text-xs glass p-2 rounded-lg border-white/5">
                {file.type.startsWith("video") ? <Video className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                <span className="flex-1 truncate">{file.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
