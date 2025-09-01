// This is a clean version of the page with proper syntax
import { useState } from 'react';

export default function Page() {
  const [formData, setFormData] = useState({
    includeStackOverflowDocs: false,
    maxDocumentationSizeKB: 512
  });

  return (
    <div>
      {/* Other form fields would go here */}
      
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
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Other form fields would go here */}
    </div>
  );
}