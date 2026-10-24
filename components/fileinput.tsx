"use client";

import React, { useState, useRef, ChangeEvent, DragEvent } from "react";

export default function VideoUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [resolution, setResolution] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLVideoElement>(null);

  const MAX_SIZE = 100 * 1024 * 1024; // max 100 mb
  const ACCEPT_MIME = ["video/mp4", "video/quicktime", "video/webm"];

  // Handle file validation
  const handleFileValidation = (selectedFile: File) => {
    setError(null);
    setUploadProgress(0);

    if (!ACCEPT_MIME.includes(selectedFile.type)) {
      setError("Invalid file type! Please upload MP4, MOV, or WEBM.");
      return;
    }

    if (selectedFile.size > MAX_SIZE) {
      setError("Max size exceeds 100MB!");
      return;
    }

    setFile(selectedFile);
    const preview = URL.createObjectURL(selectedFile);
    setVideoSrc(preview);
  };

  // Handle file change
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileValidation(e.target.files[0]);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileValidation(e.dataTransfer.files[0]);
    }
  };

  // Extract video metadata
  const handleVideoMetadata = () => {
    if (videoInputRef.current) {
      setDuration(videoInputRef.current.duration);
      setResolution({
        width: videoInputRef.current.videoWidth,
        height: videoInputRef.current.videoHeight,
      });
    }
  };

  // Clear selected file
  const handleRemove = () => {
    setFile(null);
    setVideoSrc(null);
    setDuration(null);
    setResolution(null);
    setError(null);
    setUploadProgress(0);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle Multipart Upload
  const handleUploadSubmit = async () => {
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(0);

    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const totalParts = Math.ceil(file.size / CHUNK_SIZE);

    try {
      // 1. Initialize Multipart Upload
      const intres = await fetch("http://localhost:2017/uplaod/initial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json", // Fixed typo from Contet-Type
        },
        body: JSON.stringify({
          filename: file.name,
          filetype: file.type,
        }),
      });

      if (!intres.ok) {
        throw new Error("Init upload failed");
      }

      const initData = await intres.json();
      const uploadId = initData.Id || initData.data?.Id;
      const filekey = initData.filekey || initData.data?.filekey;

      // 2. Request Presigned URLs for chunks
      const urlsRes = await fetch(
        "http://localhost:2017/uplaod/presigned-url",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filekey,
            uploadId,
            totalpart: totalParts, // Matching backend param name
          }),
        },
      );

      if (!urlsRes.ok) {
        throw new Error("Failed to get presigned URL for chunks");
      }

      const urlsData = await urlsRes.json();
      const parturls: { partnumber: number; presignedUrl: string }[] =
        urlsData.parts || urlsData.data?.parts;

      // 3. Upload each chunk directly to RustFS
      // 3. Upload each chunk directly to RustFS
      const uploadparts: { partnumber: number; etag: string }[] = [];
      let uploadbytes = 0;

      for (let i = 0; i < totalParts; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const partnumber = i + 1;

        const targeturl = parturls.find(
          (p) => p.partnumber === partnumber,
        )?.presignedUrl;

        if (!targeturl)
          throw new Error(`Target URL not found for part ${partnumber}`);

        const chunkres = await fetch(targeturl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: chunk,
        });

        if (!chunkres.ok) {
          const errorText = await chunkres.text();
          console.error(`Chunk ${partnumber} failed:`, errorText);
          throw new Error(`Failed to upload chunk ${partnumber}`);
        }

        const etag = chunkres.headers.get("etag") || "";
        uploadparts.push({
          partnumber: partnumber,
          etag: etag.replace(/"/g, ""),
        });

        uploadbytes += chunk.size;
        const progressper = Math.round((uploadbytes / file.size) * 100);
        setUploadProgress(progressper);
      }

      // 4. Complete Multipart Upload
      const completemulti = await fetch(
        "http://localhost:2017/uplaod/complete",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filekey,
            uploadId,
            parts: uploadparts,
          }),
        },
      );

      if (!completemulti.ok) throw new Error("Failed to finalize upload");

      setIsUploading(false);
      setUploadProgress(100);
    } catch (error: any) {
      setError(error.message || "Upload failed");
      setIsUploading(false);
      console.log("Multipart upload failed", error);
    }
  };

  // Helper function to format size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Helper function for time min:sec
  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800">
      <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-2">
        Upload Video
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
        Select or drag and drop your video file. Supported formats: MP4, MOV,
        WEBM (Max 100MB).
      </p>

      {/* Dropzone Area */}
      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
            isDragging
              ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20"
              : "border-zinc-300 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-zinc-50 dark:bg-zinc-800/50"
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Drag and drop your video here, or{" "}
              <span className="text-indigo-600 dark:text-indigo-400 underline">
                browse
              </span>
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              MP4, MOV, or WEBM up to 100MB
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      ) : (
        /* Preview & Details Area */
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
            <video
              ref={videoInputRef}
              src={videoSrc!}
              controls
              onLoadedMetadata={handleVideoMetadata}
              className="w-full h-full object-contain"
            />
          </div>

          {/* Metadata Card */}
          <div className="bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/60 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                File Name:
              </span>
              <span className="text-zinc-800 dark:text-zinc-200 truncate max-w-[250px]">
                {file.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                Size:
              </span>
              <span className="text-zinc-800 dark:text-zinc-200">
                {formatFileSize(file.size)}
              </span>
            </div>
            {duration && (
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                  Duration:
                </span>
                <span className="text-zinc-800 dark:text-zinc-200">
                  {formatDuration(duration)}
                </span>
              </div>
            )}
            {resolution && (
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                  Resolution:
                </span>
                <span className="text-zinc-800 dark:text-zinc-200">
                  {resolution.width} x {resolution.height}
                </span>
              </div>
            )}
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleRemove}
              disabled={isUploading}
              className="flex-1 py-2.5 px-4 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-50"
            >
              Choose Different File
            </button>
            <button
              onClick={handleUploadSubmit}
              disabled={isUploading || uploadProgress === 100}
              className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUploading
                ? "Uploading..."
                : uploadProgress === 100
                  ? "Uploaded Successfully!"
                  : "Upload Video"}
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
          <svg
            className="w-5 h-5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
