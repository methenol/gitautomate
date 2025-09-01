// This is a clean version of the page component with proper syntax and indentation
import { useState } from 'react';

// Import necessary components (adjust imports as needed for your project)
import { Button, FormField, FormItem, FormLabel, FormDescription, FormControl, Switch, Input, Dialog, DialogContent, DialogFooter } from '@/components/ui';

export default function Page() {
  const [formData, setFormData] = useState({
    includeStackOverflowDocs: false,
    maxDocumentationSizeKB: 512,
    documentationSources: 'github-only' as 'github-only' | 'multi-source',
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1>GitAutomate</h1>
          
          {/* Settings Button */}
          <Button onClick={() => setIsSettingsOpen(true)}>Documentation Settings</Button>

          {/* Documentation Settings Dialog */}
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogContent>
              <form className="space-y-6">
                <h3 className="text-lg font-semibold mb-4">Documentation Preferences</h3>
                
                <FormField
                  control={formData as any}
                  name="documentationSources"
                  render={() => (
                    <FormItem>
                      <FormLabel>Documentation Sources</FormLabel>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="sources" 
                            value="github-only"
                            checked={formData.documentationSources === 'github-only'}
                            onChange={(e) => setFormData({...formData, documentationSources: 'github-only'})}
                          />
                          <span>GitHub-only (README files)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="sources" 
                            value="multi-source"
                            checked={formData.documentationSources === 'multi-source'}
                            onChange={(e) => setFormData({...formData, documentationSources: 'multi-source'})}
                          />
                          <span>Multi-source (GitHub, official sites, MDN)</span>
                        </label>
                      </div>
                      <FormDescription>
                        Multi-source includes GitHub, official websites, MDN, and Stack Overflow.
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={formData as any}
                  name="includeStackOverflowDocs"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Include Stack Overflow</FormLabel>
                        <FormDescription>Add community Q&A and examples from Stack Overflow.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(value) => setFormData({...formData, includeStackOverflowDocs: value})}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={formData as any}
                  name="maxDocumentationSizeKB"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Documentation Size</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="512 KB"
                          value={field.value}
                          onChange={(e) => setFormData({...formData, maxDocumentationSizeKB: parseInt(e.target.value || '512')})}
                        />
                      </FormControl>
                      <FormDescription>Maximum size per library documentation file. 100-1024 KB.</FormDescription>
                    </FormItem>
                  )}
                />

                <DialogFooter className="flex justify-end">
                  <Button type="submit" onClick={() => setIsSettingsOpen(false)}>Save Settings</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Main content would go here */}
        </div>
      </main>
    </div>
  );
}