'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AnimatePresence, motion } from 'framer-motion';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  runGenerateArchitecture,
  runGenerateTasks,
  runResearchTask,
  runGenerateFileStructure,
} from './actions';
import { runGenerateAgentsMd } from '@/app/actions';
import type { Task } from '@/types';
import {
  getRepositories,
  createImplementationPlanIssues,
} from './github-actions';
import type { Repository } from './github-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bot,
  ChevronRight,
  FileText,
  Github,
  ListChecks,
  LoaderCircle,
  Settings,
  Wrench,
  CheckCircle2,
  ExternalLink,
  FilePenLine,
  Download,
  ServerOff,
  KeyRound,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { Label } from '@/components/ui/label';

const settingsSchema = z.object({
  githubToken: z.string().optional(),
  llmModel: z.string().optional(),
  apiKey: z.string().optional(),
  apiBase: z.string().optional(),
  useTDD: z.boolean().default(false),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

type LoadingStates = {
  repos: boolean;
  arch: boolean;
  tasks: boolean;
  researching: boolean;
  issue: boolean;
  exporting: boolean;
};

type TaskLoadingStates = {
  [taskTitle: string]: boolean;
};


const LOCAL_MODE_REPO_ID = 'local-mode';
const LOCAL_MODE_REPO: Repository = {
  owner: '',
  name: 'Local Mode (Export Only)',
  full_name: LOCAL_MODE_REPO_ID,
};


export default function Home() {
  const { toast } = useToast();
  const [githubToken, setGithubToken] = useState<string>('');
  const [llmModel, setLlmModel] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [apiBase, setApiBase] = useState<string>('');
  const [useTDD, setUseTDD] = useState<boolean>(false);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [repositories, setRepositories] = useState<Repository[]>([LOCAL_MODE_REPO]);
  const [selectedRepo, setSelectedRepo] = useState<string>(LOCAL_MODE_REPO_ID);
  const [prd, setPrd] = useState<string>('');
  const [architecture, setArchitecture] = useState<string>('');
  const [specifications, setSpecifications] = useState<string>('');
  const [fileStructure, setFileStructure] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [finalIssueURL, setFinalIssueURL] = useState('');

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editedTaskDetails, setEditedTaskDetails] = useState('');
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [researchProgress, setResearchProgress] = useState(0);

  const [loading, setLoading] = useState<LoadingStates>({
    repos: false,
    arch: false,
    tasks: false,
    researching: false,
    issue: false,
    exporting: false,
  });
  
  const [taskLoading, setTaskLoading] = useState<TaskLoadingStates>({});

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      githubToken: '',
      llmModel: '',
      apiKey: '',
      apiBase: '',
      useTDD: false,
    },
  });




  // Load settings from server-side storage on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const settings = await response.json();
          
          console.log(`[DEBUG] Loading settings from server, llmModel: "${settings.llmModel}"`);
          setGithubToken(settings.githubToken || '');
          setLlmModel(settings.llmModel || '');
          setApiKey(settings.apiKey || '');
          setApiBase(settings.apiBase || '');
          setUseTDD(settings.useTDD || false);

          form.setValue('githubToken', settings.githubToken || '');
          form.setValue('llmModel', settings.llmModel || '');
          form.setValue('apiKey', settings.apiKey || '');
          form.setValue('apiBase', settings.apiBase || '');
          form.setValue('useTDD', settings.useTDD || false);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        // Continue with empty settings if load fails
      }
    };
    
    loadSettings();
  }, [form]);


  useEffect(() => {
    if (githubToken) {
      const fetchRepos = async () => {
        setLoading((prev) => ({ ...prev, repos: true }));
        try {
          const repos = await getRepositories(githubToken);
          setRepositories([LOCAL_MODE_REPO, ...repos]);
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: (error as Error).message,
          });
          setRepositories([LOCAL_MODE_REPO]);
        } finally {
          setLoading((prev) => ({ ...prev, repos: false }));
        }
      };
      fetchRepos();
    } else {
        setRepositories([LOCAL_MODE_REPO]);
    }
  }, [githubToken, toast]);

  const handleSaveSettings = async (values: SettingsFormValues) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          githubToken: values.githubToken || '',
          llmModel: values.llmModel || '',
          apiKey: values.apiKey || '',
          apiBase: values.apiBase || '',
          useTDD: values.useTDD,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      // Update local state after successful save
      console.log(`[DEBUG] Saving settings, llmModel: "${values.llmModel}"`);
      setGithubToken(values.githubToken || '');
      setLlmModel(values.llmModel || '');
      setApiKey(values.apiKey || '');
      setApiBase(values.apiBase || '');
      setUseTDD(values.useTDD);
      
      setIsSettingsOpen(false);
      toast({ title: 'Success', description: 'Settings saved securely.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
      });
    }
  };

  const handleGenerateArchitecture = async () => {
    setLoading((prev) => ({ ...prev, arch: true }));
    setArchitecture('');
    setSpecifications('');
    setFileStructure('');
    setTasks([]);
    setFinalIssueURL('');
    try {
      console.log(`[DEBUG] Calling runGenerateArchitecture with llmModel: "${llmModel}"`);
      console.log(`[DEBUG] Page.tsx - model parameter being passed: "${llmModel}"`);
      const result = await runGenerateArchitecture({ prd }, { apiKey: apiKey, model: llmModel, apiBase: apiBase });
      setArchitecture(result.architecture);
      setSpecifications(result.specifications);

      // Automatically generate file structure after architecture/specs
      const fileStructResult = await runGenerateFileStructure(
        { prd, architecture: result.architecture, specifications: result.specifications },
        { apiKey: apiKey, model: llmModel, apiBase: apiBase }
      );
      setFileStructure(fileStructResult.fileStructure || '');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Architecture/File Structure Generation Failed',
        description: (error as Error).message,
      });
    } finally {
      setLoading((prev) => ({ ...prev, arch: false }));
    }
  };

  // REMOVED: handleGenerateFileStructure and all fileStruct loading logic, as file structure is now generated automatically after architecture/specs.

  const researchSingleTask = useCallback(async (task: Task) => {
    setTaskLoading(prev => ({ ...prev, [task.title]: true }));
    try {
      const result = await runResearchTask(
        { title: task.title, architecture, fileStructure, specifications },
        { apiKey: apiKey, model: llmModel, apiBase: apiBase, useTDD }
      );
      const formattedDetails = `### Context\n${result.context}\n\n### Implementation Steps\n${result.implementationSteps}\n\n### Acceptance Criteria\n${result.acceptanceCriteria}`;
      setTasks(currentTasks =>
        currentTasks.map(t => t.title === task.title ? { ...t, details: formattedDetails } : t)
      );
      if (selectedTask?.title === task.title) {
        setEditedTaskDetails(formattedDetails);
      }
    } catch (researchError) {
      const errorMessage = `Failed to research task: ${(researchError as Error).message}`;
      setTasks(currentTasks =>
        currentTasks.map(t => t.title === task.title ? { ...t, details: errorMessage } : t)
      );
       if (selectedTask?.title === task.title) {
        setEditedTaskDetails(errorMessage);
      }
    } finally {
      setTaskLoading(prev => ({ ...prev, [task.title]: false }));
    }
  }, [architecture, fileStructure, specifications, apiKey, llmModel, useTDD, selectedTask?.title]);


  const handleGenerateTasks = async () => {
    setLoading((prev) => ({ ...prev, tasks: true, researching: false }));
    setTasks([]);
    setFinalIssueURL('');
    setResearchProgress(0);

    try {
      const result = await runGenerateTasks(
        { architecture, specifications, fileStructure },
        { apiKey: apiKey, model: llmModel, apiBase: apiBase, useTDD }
      );
      const initialTasks = result.tasks;

      if (!initialTasks || initialTasks.length === 0) {
        toast({
          title: 'No tasks generated',
          description: 'The AI could not generate a task list. Try adjusting the PRD or architecture.',
        });
        setLoading((prev) => ({ ...prev, tasks: false }));
        return;
      }
      
      const tasksWithPlaceholders = initialTasks.map((t) => ({ ...t, details: 'Researching...' }));
      setTasks(tasksWithPlaceholders);
      setLoading((prev) => ({ ...prev, tasks: false, researching: true }));
      
      for (let i = 0; i < initialTasks.length; i++) {
        await researchSingleTask(initialTasks[i]);
        setResearchProgress(((i + 1) / initialTasks.length) * 100);
      }
      
      toast({ title: 'Task research complete!', description: 'All tasks have been detailed.' });

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Task Generation Failed',
        description: (error as Error).message,
      });
      setTasks([]);
    } finally {
      setLoading((prev) => ({ ...prev, tasks: false, researching: false }));
    }
  };


  const handleCreateIssue = async () => {
    setLoading((prev) => ({ ...prev, issue: true }));
    setFinalIssueURL('');
    try {
      if (!githubToken || !selectedRepo || tasks.length === 0 || selectedRepo === LOCAL_MODE_REPO_ID) {
        toast({
          variant: 'destructive',
          title: 'Cannot Create Issues',
          description: 'Please ensure you have selected a repository and generated tasks.',
        });
        setLoading((prev) => ({ ...prev, issue: false }));
        return;
      }
      
      const result = await createImplementationPlanIssues(
        githubToken,
        selectedRepo,
        prd,
        architecture,
        specifications,
        fileStructure,
        tasks
      );

      setFinalIssueURL(result.html_url);
      toast({
        title: 'GitHub Issues Created!',
        description: 'The implementation plan and sub-tasks are in your repository.',
        action: (
          <a href={result.html_url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">View Plan Issue</Button>
          </a>
        ),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Issue Creation Failed',
        description: (error as Error).message,
      });
    } finally {
      setLoading((prev) => ({ ...prev, issue: false }));
    }
  };

  /**
 * Helper function to get descriptive error message for export failures
 */
const getExportErrorDescription = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message.includes('AGENTS.md generation') 
      ? error.message 
      : 'There was an error creating the zip file.';
  }
  return 'An unknown error occurred during export.';
};

const handleExportData = async () => {
    if (tasks.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nothing to Export',
        description: 'Please generate tasks first.',
      });
      return;
    }

    setLoading((prev) => ({ ...prev, exporting: true }));

    try {
      const zip = new JSZip();
      const docsFolder = zip.folder('docs');
      const tasksFolder = zip.folder('tasks');

      if (!docsFolder || !tasksFolder) {
        throw new Error('Could not create folders in zip file.');
      }

      // Add docs
      docsFolder.file('PRD.md', prd);
      docsFolder.file('ARCHITECTURE.md', architecture);
      docsFolder.file('SPECIFICATION.md', specifications);
      docsFolder.file('FILE_STRUCTURE.md', fileStructure);

      // Create main tasks file
      const mainTasksContent = tasks.map((task, index) => `- [ ] task-${(index + 1).toString().padStart(3, '0')}: ${task.title}`).join('\n');
      tasksFolder.file('tasks.md', `# Task List\n\n${mainTasksContent}`);

      // Create individual task files
      tasks.forEach((task, index) => {
        const taskNumber = (index + 1).toString().padStart(3, '0');
        tasksFolder.file(`task-${taskNumber}.md`, `# ${task.title}\n\n${task.details}`);
      });

      // Generate and add AGENTS.md file at the root of zip
      const agentsMdResult = await runGenerateAgentsMd(
        {
          prd,
          architecture, 
          specifications,
          fileStructure,
          tasks: tasks.map((task, index) => `### Task ${index + 1}: ${task.title}\n${task.details}`).join('\n\n')
        },
        { apiKey: apiKey, model: llmModel, apiBase: apiBase }
      );
      
      // Add AGENTS.md at the root level (not inside any subfolder)
      zip.file('AGENTS.md', agentsMdResult.agentsMdContent);
      
      // Add additional copies of AGENTS.md to specified locations
      zip.file('.openhands/microagents/repo.md', agentsMdResult.agentsMdContent);
      zip.file('.github/copilot-instructions.md', agentsMdResult.agentsMdContent);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, 'gitautomate-export.zip');

      toast({
        title: 'Export Successful',
        description: 'Your project data has been downloaded as a zip file with AGENTS.md.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export Failed', 
        description: getExportErrorDescription(error),
      });
      console.error('Export error:', error);
    } finally {
      setLoading((prev) => ({ ...prev, exporting: false }));
    }
  };
  
  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setEditedTaskDetails(task.details);
    setIsTaskDetailOpen(true);
  };
  
  const handleSaveTaskDetails = () => {
    if (!selectedTask) return;
    const updatedTasks = tasks.map(task => 
      task.title === selectedTask.title 
        ? { ...task, details: editedTaskDetails } 
        : task
    );
    setTasks(updatedTasks);
    setIsTaskDetailOpen(false);
    setSelectedTask(null);
    toast({ title: "Task updated", description: "Your changes have been saved." });
  };
  
  const isResearchFailed = (details: string) => details.startsWith('Failed to research task');


  const cardAnimation = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: 'easeOut' },
  };

  const LoadingSpinner = ({ text }: { text: string }) => (
    <div className="flex items-center justify-center gap-2 text-muted-foreground">
      <LoaderCircle className="h-5 w-5 animate-spin" />
      <span>{text}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">GitAutomate</h1>
          </div>
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription>
                  Configure your API keys and select your preferred AI model. Your Google AI API Key from the .env file will be used if left blank here.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSaveSettings)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="githubToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GitHub Token</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="ghp_... (optional)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="llmModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LLM Model</FormLabel>
                        <FormControl>
                          <Input placeholder="provider/model format" {...field} />
                        </FormControl>
                        <FormDescription>
                          Enter the provider/model in format "provider/model"
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LLM API Key</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="API key (optional, can use env vars)" {...field} />
                        </FormControl>
                        <FormDescription>
                          API key for your LLM provider (optional if using environment variables)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="apiBase"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LLM API Base URL</FormLabel>
                        <FormControl>
                          <Input placeholder="Custom API base URL (optional)" {...field} />
                        </FormControl>
                        <FormDescription>
                          Custom endpoint URL for self-hosted or alternative providers (optional)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="useTDD"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Use TDD
                          </FormLabel>
                          <FormDescription>
                           Generate tasks and implementation steps using Test-Driven Development.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit">Save Settings</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <AnimatePresence>
            {/* Step 1: Configuration & Repo Selection */}
            <motion.div key="step1" {...cardAnimation}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Github className="h-6 w-6 text-accent" />
                    <span>Step 1: Select Repository</span>
                  </CardTitle>
                  <CardDescription>
                    Choose a repository to create issues in, or use local mode to just export data.
                    {!githubToken && " You'll need to set your GitHub token to see your repos."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading.repos ? (
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <Select
                      value={selectedRepo}
                      onValueChange={setSelectedRepo}
                      disabled={repositories.length <= 1 && !githubToken}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a repository..." />
                      </SelectTrigger>
                      <SelectContent>
                        {repositories.map((repo) => (
                          <SelectItem key={repo.full_name} value={repo.full_name}>
                             <div className="flex items-center gap-2">
                              {repo.full_name === LOCAL_MODE_REPO_ID ? (
                                <ServerOff className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Github className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span>{repo.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {!githubToken && (
                     <Button onClick={() => setIsSettingsOpen(true)} className="w-full mt-4">
                       <KeyRound className="mr-2 h-4 w-4"/>
                        Configure GitHub Token to See Repositories
                      </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
            
            {/* Step 2: PRD Input */}
            {selectedRepo && (
              <motion.div key="step2" {...cardAnimation}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-6 w-6 text-accent" />
                      <span>Step 2: Provide PRD</span>
                    </CardTitle>
                    <CardDescription>
                      Paste your Product Requirements Document below. Before generating, ensure your Google AI API key is set in the settings or your environment.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="As a user, I want to be able to..."
                      value={prd}
                      onChange={(e) => setPrd(e.target.value)}
                      rows={10}
                    />
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={handleGenerateArchitecture}
                      disabled={!prd || loading.arch}
                      className="ml-auto"
                    >
                      {loading.arch ? (
                        <>
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          Generate Architecture <ChevronRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            )}

            {/* Step 3: Review Plan (Architecture, Specifications, File Structure in one card) */}
            {architecture && (
              <motion.div key="step3" {...cardAnimation}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-6 w-6 text-accent" />
                      <span>Step 3: Review Plan</span>
                    </CardTitle>
                    <CardDescription>
                      The AI has generated the following architecture, specifications, and file structure.
                      Review and edit if needed.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="architecture" className="text-lg font-semibold">Architecture</Label>
                      <Textarea
                        id="architecture"
                        value={architecture}
                        onChange={(e) => setArchitecture(e.target.value)}
                        rows={10}
                        className="mt-2 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="specifications" className="text-lg font-semibold">Specifications</Label>
                      <Textarea
                        id="specifications"
                        value={specifications}
                        onChange={(e) => setSpecifications(e.target.value)}
                        rows={15}
                        className="mt-2 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="file-structure" className="text-lg font-semibold">File Structure</Label>
                      <Textarea
                        id="file-structure"
                        value={fileStructure}
                        onChange={(e) => setFileStructure(e.target.value)}
                        rows={12}
                        className="mt-2 font-mono text-sm"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={handleGenerateArchitecture}
                      disabled={loading.arch}
                    >
                      {loading.arch ? 'Regenerating...' : 'Regenerate'}
                    </Button>
                    <Button onClick={handleGenerateTasks} disabled={loading.tasks || loading.researching}>
                      {loading.tasks || loading.researching ? (
                        <>
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          Generate Tasks <ChevronRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            )}

            {loading.arch && (
               <motion.div key="loading-arch" {...cardAnimation}>
                   <LoadingSpinner text="Generating architecture & specs..." />
               </motion.div>
            )}

            {/* Step 4: Task List */}
            {(tasks.length > 0 || loading.researching) && (
              <motion.div key="step4" {...cardAnimation}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ListChecks className="h-6 w-6 text-accent" />
                      <span>Step 4: Actionable Tasks</span>
                    </CardTitle>
                    <CardDescription>
                      {loading.researching
                        ? 'The AI is researching each task for detailed notes...'
                        : 'Click on a task to view, edit, and preview its details.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading.researching && (
                      <div className="mb-4 space-y-2">
                        <Progress value={researchProgress} />
                        <p className="text-sm text-center text-muted-foreground">
                          {`Researching... (${Math.round((researchProgress / 100) * tasks.length)}/${tasks.length} complete)`}
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      {tasks.map((task, index) => (
                        <button
                          key={index}
                          onClick={() => handleViewTask(task)}
                          disabled={task.details === 'Researching...' || taskLoading[task.title]}
                          className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-wait disabled:bg-muted/30"
                        >
                          {isResearchFailed(task.details) ? (
                            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-destructive" />
                          ) : (
                            <Bot className="h-5 w-5 flex-shrink-0 text-primary" />
                          )}
                          <div className="flex-1 overflow-hidden">
                            <p className='font-medium truncate'>{task.title}</p>
                            {taskLoading[task.title] && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <LoaderCircle className="h-3 w-3 animate-spin" />
                                  <span>Retrying research...</span>
                                </div>
                            )}
                            {task.details === 'Researching...' && !taskLoading[task.title] && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <LoaderCircle className="h-3 w-3 animate-spin" />
                                <span>Researching details...</span>
                              </div>
                            )}
                          </div>
                          <FilePenLine className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </CardContent>
                  {/* Export/Issue buttons only shown after tasks are generated */}
                  {(tasks.length > 0) && (
                    <CardFooter className="flex justify-end gap-2">
                       <Button
                        variant="outline"
                        onClick={handleExportData}
                        disabled={loading.exporting || loading.researching}
                      >
                        {loading.exporting ? (
                          <>
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            Exporting...
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Export Data
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleCreateIssue}
                        disabled={loading.issue || loading.researching || selectedRepo === LOCAL_MODE_REPO_ID}
                        title={selectedRepo === LOCAL_MODE_REPO_ID ? "Cannot create issues in local mode" : ""}
                      >
                        {loading.issue ? (
                          <>
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            Creating Issue...
                          </>
                        ) : (
                          <>
                             <Github className="mr-2 h-4 w-4"/> Create GitHub Issue
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              </motion.div>
            )}
            {loading.tasks && !loading.researching && (
                <motion.div key="loading-tasks" {...cardAnimation}>
                    <LoadingSpinner text="Generating task list..." />
                </motion.div>
            )}

            {/* Step 5: Done */}
            {finalIssueURL && (
               <motion.div key="step5" {...cardAnimation}>
                  <Card className="bg-gradient-to-br from-primary/20 to-background">
                     <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <CheckCircle2 className="h-6 w-6 text-green-500" />
                           <span>All Done!</span>
                        </CardTitle>
                        <CardDescription>
                           Your implementation plan has been created as a GitHub Issue.
                        </CardDescription>
                     </CardHeader>
                     <CardContent>
                        <a href={finalIssueURL} target="_blank" rel="noopener noreferrer">
                           <Button className="w-full">
                              <ExternalLink className="mr-2 h-4 w-4"/>
                              View Created Issue
                           </Button>
                        </a>
                     </CardContent>
                     <CardFooter>
                        <Button variant="link" onClick={() => {
                           setSelectedRepo(LOCAL_MODE_REPO_ID);
                           setPrd('');
                           setArchitecture('');
                           setSpecifications('');
                           setTasks([]);
                           setFinalIssueURL('');
                           setSelectedTask(null);
                        }}>Start Over</Button>
                     </CardFooter>
                  </Card>
               </motion.div>
            )}
             {loading.issue && (
                <motion.div key="loading-issue" {...cardAnimation}>
                    <LoadingSpinner text="Creating GitHub Issue..." />
                </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
      
      <Dialog open={isTaskDetailOpen} onOpenChange={setIsTaskDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
            <DialogDescription>
              Review and edit the details for this task. This will be included in the GitHub issue.
            </DialogDescription>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-6 overflow-y-auto pr-4">
            <div className="space-y-2">
              <Label htmlFor="task-details" className="font-semibold">
                Task Details & Research
              </Label>
              <Textarea
                id="task-details"
                value={editedTaskDetails}
                onChange={(e) => setEditedTaskDetails(e.target.value)}
                rows={20}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
                <Label className="font-semibold">GitHub Issue Preview</Label>
                <div className="space-y-2 rounded-md border bg-muted/50 p-4 h-full overflow-y-auto">
                    <h4 className="font-bold text-card-foreground">✅ {selectedTask?.title}</h4>
                    <Separator/>
                    {isResearchFailed(editedTaskDetails) ? (
                      <div className="text-destructive-foreground bg-destructive/80 p-3 rounded-md">
                        <p className="font-bold">Research Failed</p>
                        <p className="text-sm">{editedTaskDetails}</p>
                      </div>
                    ) : (
                      <div 
                        className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none" 
                        dangerouslySetInnerHTML={{ __html: editedTaskDetails.replace(/\n/g, '<br />') }}
                      />
                    )}
                </div>
            </div>
          </div>
          <DialogFooter className="mt-auto pt-4">
            {selectedTask && isResearchFailed(selectedTask.details) && (
              <Button
                variant="destructive"
                onClick={() => researchSingleTask(selectedTask)}
                disabled={taskLoading[selectedTask.title]}
                className="mr-auto"
              >
                {taskLoading[selectedTask.title] ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Research
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsTaskDetailOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTaskDetails}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
