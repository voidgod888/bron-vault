"use client"

import React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Image from "next/image"

interface FileContentDialogProps {
  selectedFile: { deviceId: string; filePath: string; fileName: string } | null
  onClose: () => void
  fileContent: string
  isLoadingFile: boolean
  selectedFileType: 'text' | 'image' | null
  deviceName?: string
}

export function FileContentDialog({
  selectedFile,
  onClose,
  fileContent,
  isLoadingFile,
  selectedFileType,
  deviceName,
}: FileContentDialogProps) {
  if (!selectedFile) return null

  return (
    <Dialog open={!!selectedFile} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] glass-modal">
        <DialogHeader>
          <DialogTitle className="text-foreground">{selectedFile.fileName}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Device: {deviceName}
          </DialogDescription>
        </DialogHeader>
        <div className="h-[60vh] w-full overflow-y-auto overflow-x-auto relative">
          {isLoadingFile ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-foreground">Loading file content...</p>
            </div>
          ) : selectedFileType === 'image' ? (
            <div className="overflow-x-auto w-full h-full relative">
              {/* Use standard img for blob URLs created with URL.createObjectURL since Next.js Image component requires external domains to be configured or static imports */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={fileContent} 
                alt={selectedFile.fileName} 
                className="max-w-full max-h-full object-contain mx-auto"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <pre className="text-xs whitespace-pre-wrap font-mono bg-card/50 p-4 rounded border border-border text-foreground min-w-max">
                {fileContent}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
