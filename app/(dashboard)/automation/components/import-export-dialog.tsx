"use client";

import type React from "react";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAutomation } from "../contexts/automation-context";
import { useToast } from "../hooks/use-toast";
import { Download, Upload, Copy, Check, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportExportDialog({ open, onOpenChange }: ImportExportDialogProps) {
  const { flow, exportFlow, importFlowAsNew } = useAutomation();
  const { toast } = useToast();
  const [jsonText, setJsonText] = useState("");
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState("");

  const handleExport = () => {
    const json = exportFlow();
    setJsonText(json);
  };

  const handleDownload = () => {
    const json = exportFlow();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${flow.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: "Automation has been downloaded as JSON file",
    });
  };

  const handleCopy = async () => {
    const json = exportFlow();
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    toast({
      title: "Copied",
      description: "JSON copied to clipboard",
    });
  };

  const handleImport = () => {
    setImportError("");
    try {
      // Validate JSON
      const parsed = JSON.parse(jsonText);

      // Basic validation
      if (!parsed.id || !parsed.name || !Array.isArray(parsed.nodes)) {
        setImportError("Invalid automation format. Required fields: id, name, nodes");
        return;
      }

      importFlowAsNew(jsonText);
      toast({
        title: "Success",
        description: "Automation imported successfully",
      });
      onOpenChange(false);
      setJsonText("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Invalid JSON format");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setJsonText(content);
      };
      reader.readAsText(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import / Export Automation</DialogTitle>
          <DialogDescription>Export your automation to JSON format or import an existing automation</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="export" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" onClick={handleExport}>
              Export
            </TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Current automation JSON</p>
                <div className="flex gap-2">
                  <Button onClick={handleCopy} variant="outline" size="sm">
                    {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button onClick={handleDownload} variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>

              <Textarea
                value={exportFlow()}
                readOnly
                className="font-mono text-xs"
                rows={20}
                placeholder="Your automation JSON will appear here"
              />
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This JSON contains your complete automation configuration including all nodes, services, and parameters.
                Save it to backup or share your automation.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Paste automation JSON or upload a file</p>
                <Button variant="outline" size="sm" onClick={() => document.getElementById("file-upload")?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                </Button>
                <input id="file-upload" type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </div>

              <Textarea
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setImportError("");
                }}
                className="font-mono text-xs"
                rows={20}
                placeholder='Paste your automation JSON here...\n\nExample:\n{\n  "id": "flow-1",\n  "name": "My Automation",\n  "nodes": [...]\n}'
              />
            </div>

            {importError && (
              <Alert color="error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Importing will replace your current automation. Make sure to export your current work before importing.
              </AlertDescription>
            </Alert>

            <Button onClick={handleImport} className="w-full" disabled={!jsonText}>
              Import Automation
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
