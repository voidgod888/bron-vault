"use client";

import React, { useState, useEffect } from "react";
import { Search, Trash2, Clock, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface SavedSearch {
  id: number;
  name: string;
  query: string;
  search_type: string;
  created_at: string;
}

interface SavedSearchesProps {
  onSelectSearch: (query: string, type: "domain" | "keyword") => void;
  currentQuery?: string;
  currentType?: "domain" | "keyword";
}

export function SavedSearches({ onSelectSearch, currentQuery, currentType }: SavedSearchesProps) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [newSearchName, setNewSearchName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSearches();
    }
  }, [isOpen]);

  const fetchSearches = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/saved-searches");
      if (res.ok) {
        const data = await res.json();
        setSearches(data);
      }
    } catch (error) {
      console.error("Failed to load saved searches", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!newSearchName.trim() || !currentQuery || !currentType) return;

    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSearchName,
          query: currentQuery,
          search_type: currentType,
        }),
      });

      if (res.ok) {
        toast.success("Search saved successfully");
        setNewSearchName("");
        setIsSaveDialogOpen(false);
        fetchSearches(); // Refresh list if needed
      } else {
        toast.error("Failed to save search");
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/saved-searches?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSearches(searches.filter((s) => s.id !== id));
        toast.success("Saved search deleted");
      }
    } catch (error) {
      toast.error("Failed to delete search");
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Bookmark className="h-4 w-4" />
              Saved Searches
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Saved Searches</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[300px] pr-4">
              {isLoading ? (
                <div className="text-center py-4 text-muted-foreground">Loading...</div>
              ) : searches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No saved searches found.
                </div>
              ) : (
                <div className="space-y-2">
                  {searches.map((search) => (
                    <Card
                      key={search.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        onSelectSearch(search.query, search.search_type as "domain" | "keyword");
                        setIsOpen(false);
                      }}
                    >
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-sm">{search.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {search.search_type}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {search.query}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => handleDelete(search.id, e)}
                          aria-label={`Delete saved search ${search.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {currentQuery && (
          <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title="Save current search"
                aria-label="Save current search"
              >
                 <Bookmark className="h-4 w-4 text-muted-foreground hover:text-primary" />
              </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Save Search</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                            placeholder="e.g. Production servers"
                            value={newSearchName}
                            onChange={(e) => setNewSearchName(e.target.value)}
                        />
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Saving search for: <span className="font-mono font-medium">{currentQuery}</span> ({currentType})
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={!newSearchName.trim()}>Save</Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </>
  );
}
