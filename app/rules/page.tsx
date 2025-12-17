"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import ClientLayoutWithSidebar from "@/components/client-layout-with-sidebar";

interface DetectionRule {
  id: number;
  name: string;
  pattern: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  created_at: string;
}

export default function RulesPage() {
  const [rules, setRules] = useState<DetectionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    pattern: "",
    severity: "medium",
    description: "",
  });

  // Test regex state
  const [testString, setTestString] = useState("");
  const [testResult, setTestResult] = useState<boolean | null>(null);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const res = await fetch("/api/rules");
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      }
    } catch (error) {
      toast.error("Failed to load rules");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRule),
      });

      if (res.ok) {
        toast.success("Rule created successfully");
        setIsDialogOpen(false);
        setNewRule({ name: "", pattern: "", severity: "medium", description: "" });
        fetchRules();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create rule");
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;
    try {
      const res = await fetch(`/api/rules?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setRules(rules.filter((r) => r.id !== id));
        toast.success("Rule deleted");
      }
    } catch (error) {
      toast.error("Failed to delete rule");
    }
  };

  const runTest = () => {
    try {
      const regex = new RegExp(newRule.pattern);
      setTestResult(regex.test(testString));
    } catch (e) {
      setTestResult(false);
      toast.error("Invalid Regex");
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "high": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "medium": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "low": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default: return "bg-gray-500/10 text-gray-500";
    }
  };

  return (
    <AuthGuard>
      <ClientLayoutWithSidebar>
        <div className="flex flex-col min-h-screen bg-transparent">
          <main className="flex-1 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Detection Rules</h1>
                  <p className="text-muted-foreground">
                    Manage custom Regex rules to flag suspicious content in logs.
                  </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Rule
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create Detection Rule</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Name</label>
                          <Input
                            value={newRule.name}
                            onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                            placeholder="e.g. AWS Key Pattern"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Severity</label>
                          <Select
                            value={newRule.severity}
                            onValueChange={(val) => setNewRule({ ...newRule, severity: val })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Regex Pattern</label>
                        <Input
                          value={newRule.pattern}
                          onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                          placeholder="e.g. AKIA[0-9A-Z]{16}"
                          className="font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Description</label>
                        <Textarea
                          value={newRule.description}
                          onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                          placeholder="What does this rule detect?"
                        />
                      </div>

                      {/* Test Section */}
                      <div className="p-4 bg-muted/30 rounded-lg border space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-medium">Test Regex</label>
                            {testResult !== null && (
                                <Badge variant={testResult ? "default" : "destructive"} className={testResult ? "bg-green-500" : ""}>
                                    {testResult ? "Match Found" : "No Match"}
                                </Badge>
                            )}
                        </div>
                        <div className="flex gap-2">
                             <Input
                                value={testString}
                                onChange={(e) => setTestString(e.target.value)}
                                placeholder="Paste text to test against pattern..."
                             />
                             <Button variant="secondary" onClick={runTest} disabled={!newRule.pattern}>Test</Button>
                        </div>
                      </div>

                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreate} disabled={!newRule.name || !newRule.pattern}>
                        Save Rule
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {loading ? (
                <div className="text-center py-10">Loading rules...</div>
              ) : rules.length === 0 ? (
                <div className="text-center py-10 border rounded-lg bg-card/50">
                  <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No detection rules defined</h3>
                  <p className="text-muted-foreground mt-2">
                    Create rules to automatically flag sensitive data in logs.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {rules.map((rule) => (
                    <Card key={rule.id} className="glass-card">
                      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                        <CardTitle className="text-base font-semibold truncate pr-4">
                          {rule.name}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className={`${getSeverityColor(rule.severity)} capitalize`}
                        >
                          {rule.severity}
                        </Badge>
                      </CardHeader>
                      <CardContent>
                        <div className="mt-2 space-y-2">
                          <code className="block w-full rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground overflow-x-auto">
                            {rule.pattern}
                          </code>
                          <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                            {rule.description || "No description provided."}
                          </p>
                        </div>
                        <div className="mt-4 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(rule.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </ClientLayoutWithSidebar>
    </AuthGuard>
  );
}
